/**
 * audio-queue-processor.js
 * 
 * [고성능 대역 제어본: 잡음 분리 소멸 및 고속 평면 메모리 풀 체인 연동 완료]
 * 메인 스레드(AdPlugQueue.js)의 고속 메모리 이전 규격에 맞춰
 * 오디오 전용 독립 스레드에서 무정지 실시간 음원 출력을 보장합니다.
 */

const PROGRESS_INTERVAL_QUANTA = 32; // 약 93ms 주기마다 재생 진행 현황 리포트 계산 규칙 (44.1kHz 기준)

class AudioQueueProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.queue = [];           // 메인 스레드로부터 공급받은 청크 적재 큐: { channels: Float32Array[], length: number }
    this.current = null;       // 현재 스피커로 출력 주사 중인 오디오 청크 조각
    this.currentOffset = 0;    // 현재 청크 내부의 읽기 포인터 인덱스 위치
    this.playing = false;
    this.totalRead = 0;        // 실시간으로 스피커에 출력된 총 프레임 카운트 누계
    this.stopAtFrame = null;
    this.quantumCounter = 0;
    this.stopped = false;
	
	this.playbackSpeed = 1.0; // 기본 배속

    // 메인 스레드(AdPlugQueue) 컨트롤러의 실시간 상태 변화 메시지 수신부
    this.port.onmessage = (e) => {
      const msg = e.data;
      switch (msg.type) {
        case 'chunk':
          // 넘겨받은 고속 평면 구조의 오디오 채널 조각을 재생 대기열 큐에 안전 삽입
          this.queue.push({ channels: msg.channels, length: msg.length });
          break;
        case 'start':
          this.playing = true;
          this.stopped = false;
          this.stopAtFrame = null;
          break;
        case 'stop':
          if (msg.frame === null || msg.frame === undefined) {
            this.playing = false;
            this.recycleAll();
            this.stopAtFrame = null;
            this.emitStopped();
          } else {
            this.stopAtFrame = msg.frame;
          }
          break;
        case 'reset':
        case 'hard_reset': // player.js의 중지(btnStop) 이벤트 명령 프로토콜 유연 정밀 대응
          this.playing = false;
          this.recycleAll();
          this.totalRead = 0;
          this.stopAtFrame = null;
          this.stopped = false;
          break;
		case 'SET_SPEED': // 배속 명령처리
		  this.playbackSpeed = msg.speed;
          break;
      }
    };
  }

  /**
   * 대기 큐 및 렌더링 파이프라인에 머물러 있는 모든 메모리 배열 박스를 안전하게 메인 스레드로 즉시 전사 반환
   */
  recycleAll() {
    if (this.current) {
      this.recycle(this.current.channels);
      this.current = null;
      this.currentOffset = 0;
    }
    while (this.queue.length > 0) {
      const c = this.queue.shift();
      this.recycle(c.channels);
    }
  }

  /**
   * [고성능 재사용의 핵심]: 메모리를 파괴하지 않고 ArrayBuffer 소유권만 그대로 복귀시켜 버퍼 재사용 풀에 즉시 도킹
   */
  recycle(channels) {
    const transfer = [channels[0].buffer, channels[1].buffer];
    this.port.postMessage({ type: 'recycle', channels }, transfer);
  }

  /**
   * 트랙 재생 완전 중단 사태 알림 방출기
   */
  emitStopped() {
    if (this.stopped) return;
    this.stopped = true;
    this.port.postMessage({ type: 'stopped' });
  }

  /**
   * 브라우저 오디오 시스템에 의해 초당 수백 번씩 물리 하드웨어 스레드에서 무정지 기동되는 핵심 주사 렌더러
   */
  process(_inputs, outputs) {
    const out = outputs[0]; 
    if (!out || out.length === 0) return true;
    
    const channelCount = out.length;  // 물리 오디오 장치 출력 채널 수 (보통 스테레오 2개 채널)
    if (!out[0]) return true;
    //const frameCount = out[0].length; // 단일 양자 주기 기준 목표 전사 해상도 프레임 크기 (보통 128샘플)
    const frameCount = out[0].length * this.playbackSpeed; // 배속 적용

    // [교정선 1]: 재생 정지 중이거나 버퍼 수급 대기열이 완전히 고갈된 공백 돌입 시 물리 무음 강제 전사
    if (!this.playing || (this.queue.length === 0 && !this.current)) {
      for (let ch = 0; ch < channelCount; ch++) {
        out[ch].fill(0); // 모든 스피커 출력단을 완전 무음 처리하여 주기적인 '치직-' 디지털 잡음을 원천 소멸
      }
      return true; 
    }

    let written = 0;
    
    // [교정선 2]: 브라우저 오디오 표준 블록 크기(frameCount)를 완전히 충족할 때까지 연속 데이터 밀집 복사 진행
    while (written < frameCount) {
      if (this.stopAtFrame !== null && this.totalRead >= this.stopAtFrame) {
        this.playing = false;
        this.recycleAll();
        this.emitStopped();
        break;
      }

      // 현재 처리 중인 오디오 조각을 모두 소모한 경우, 대기열에서 다음 소리 묶음을 인계받음
      if (!this.current) {
        if (this.queue.length === 0) {
          break; // 버퍼 언더런(공급 지연) 발생 시 데이터를 강제로 쪼개어 연산하지 않고 루프를 안전 탈출
        }
        this.current = this.queue.shift();
        this.currentOffset = 0;
      }

      const remaining = this.current.length - this.currentOffset;
      const toCopy = Math.min(remaining, frameCount - written);
      const srcChannels = this.current.channels;
      const srcChannelCount = srcChannels.length;
      
      // 실제 좌우 출력 스피커 버퍼 레일 번지에 1:1 디코딩 복사 단행
      for (let ch = 0; ch < channelCount; ch++) {
        // 소스 채널 수가 부족할 경우(모노 음원 등)를 유연하게 스왑 대응 방어 코드 배치
        const src = srcChannels[ch < srcChannelCount ? ch : srcChannelCount - 1];
        const dst = out[ch]; 
        const srcOff = this.currentOffset;
        const dstOff = written;
        
        // 메모리 루프를 고속 주사하여 타겟 출력 버퍼 주소 공간에 완전 대입
        for (let i = 0; i < toCopy; i++) {
          dst[dstOff + i] = src[srcOff + i]; 
        }
      }
      
      this.currentOffset += toCopy;
      written += toCopy;
      this.totalRead += toCopy;

      // 해당 청크 박스의 파형 데이터를 한 치의 남김없이 모두 긁어 쓴 경우 즉시 빈 박스 반납 트리거 가동
      if (this.currentOffset >= this.current.length) {
        this.recycle(this.current.channels);
        this.current = null;
      }
    }

    // [교정선 3]: 연산 속도 밀림 현상 등으로 미세하게 채워지지 못한 잔여 출력 버퍼 공백 영역 마스킹
    if (written < frameCount) {
      for (let ch = 0; ch < channelCount; ch++) {
        out[ch].fill(0, written, frameCount); // 아직 도달하지 못한 파이프라인 공간을 무음으로 방어 마스킹
      }
    }

    // player.js 고유의 미디 가사 매핑 및 시각 동기화를 위한 런타임 하드웨어 absoluteTick 발생 메커니즘 도킹
    this.quantumCounter++;
    if (this.quantumCounter >= PROGRESS_INTERVAL_QUANTA) {
      this.quantumCounter = 0;
      // 메인 스레드에 현재 스피커단이 완벽하게 실시간으로 소화해 낸 프레임 누계값을 통보합니다.
      this.port.postMessage({ 
        type: 'recycle', // player-engine.js의 하이브리드 리스너 분기에 맞춤 대응
        currentRealTick: this.totalRead 
      });
    }

    return true;
  } // process(_inputs, outputs) 
}

registerProcessor('audio-queue-processor', AudioQueueProcessor);
