/**
 * AdPlug 오디오 청크 공급 및 재생 수급 가속 제어 시스템 (비주얼라이저 완전 복원 버전)
 * AdPlug 오디오 청크 공급 및 재생 수급 가속 제어 시스템 (백그라운드 탭 완치 버전)
*/
export class AdPlugQueue {
  constructor(player) {
    this.player = player;
    this.workletNode = null;
    this.chunkPool = [];
    this.inFlight = 0;
    this.allocated = 0;
    this.maxChunks = 16;        
    this.chunkFrames = 4096; 
    this.totalFrames = 0;
    
    this.animationFrameId = null;

    this.timerId = null; // 🎯 requestAnimationFrame 대신 백그라운드용 다중 타이머 결합
    this.isFinished = false;
	
//	this.playbackSpeed = 1.0; // 🎯 배속 보관용 전역 변수 추가
    this.playbackSpeed = 1.0; // 🎯 실시간 배속 상태 저장
    this.finalPlaybackRate = 1.0; // 🎯 음정과 배속이 결합된 하드웨어 최종 주사율 변수 추가

    // 소스 노드 예약 스케줄링을 위한 정밀 가상 타임라인 오프셋 변수
    this.nextStartTime = 0;
    this.activeSources = [];


  }

  obtainChunk() {
    if (this.chunkPool.length > 0) return this.chunkPool.pop();
    if (this.allocated < this.maxChunks) {
      const channels = [new Float32Array(this.chunkFrames), new Float32Array(this.chunkFrames)];
      this.allocated++;
      return channels;
    }
    return null;
  }

  feedQueue() {
    if (!this.player.isPlaying || this.player.isPaused) return;
    if (this.chunkPool.length === 0 && this.allocated >= this.maxChunks) return;

    const scale = 1 / 32768.0;
    const ctx = this.audioContext;

    // 🎯 [몰아서 연주되는 현상 방어선]:
    // 만약 다른 탭에 있다가 와서 ctx.currentTime이 대폭 흘러가 버렸다면, 
    // 밀린 과거 시간부터 예약하는 것이 아니라 현재 스피커 시간 기준으로 가상 타임라인을 강제 정렬합니다.
    if (this.nextStartTime < ctx.currentTime) {
      this.nextStartTime = ctx.currentTime + 0.02;
    }

    // 🎯 배속이 빠를 때(예: 2배속) 메인 스레드가 OPL3 연산을 더 많이 수행하여 오디오 스레드에 넉넉히 공급하도록 조율
    //while (this.inFlight < this.maxChunks) {
    // 현재 스케줄링된 시간이 브라우저 타임라인보다 너무 멀리 앞서가지 않도록 0.2초 가드 배치
    while (this.nextStartTime < ctx.currentTime + 0.2) {
    // 오디오 버퍼 가상 타임라인을 미래 0.25초 앞까지 넉넉하게 선제 예약 스케줄링 (끊김 방지)
    //while (this.nextStartTime < ctx.currentTime + 0.25) {
      const chunk = this.obtainChunk();
      if (!chunk) break;

      const isFinished = this.player.module._emu_compute_audio_samples() !== 0;
      //this.isFinished = this.player.module._emu_compute_audio_samples() !== 0;
      const bufferPtr = this.player.module._emu_get_audio_buffer();
      const bufferLength = this.player.module._emu_get_audio_buffer_length();
      
      const numSamples = bufferLength / 2; 
      const renderCount = Math.min(this.chunkFrames, numSamples / 2);

      if (renderCount <= 0 || bufferLength === 0) {
        this.chunkPool.push(chunk);
        //if (isFinished) this.player.stop();
        //if (isFinished) {this.player.stop(); this.isFinished=isFinished;} // add
        if (isFinished) {
			// 🎯 완치: 스스로 stop()을 호출해 버퍼를 깨뜨리지 않고, 종료 플래그만 세워 메인 루프에 알립니다.
			this.isFinished = true; 
		} // add
        //if (this.isFinished) this.player.stop();
        break;
      }

      const runtimeShortHeap = new Int16Array(this.player.module.HEAP16.buffer, bufferPtr, numSamples);

      // 🎯 [2차원 오디오 평면 배열 복사 문법 영구 완치]:
      // chunk[i]가 아닌 chunk[0][i](좌), chunk[1][i](우) 번지에 정확히 인덱스를 지정하여 대입!
      for (let i = 0; i < renderCount; i++) {
        chunk[0][i] = runtimeShortHeap[i * 2] * scale;     // 좌측 채널 데이터 주입
        chunk[1][i] = runtimeShortHeap[i * 2 + 1] * scale; // 우측 채널 데이터 주입
      }

      if (renderCount < this.chunkFrames) {
        chunk[0].fill(0, renderCount, this.chunkFrames);
        chunk[1].fill(0, renderCount, this.chunkFrames);
      }

      // 🎯 [고속 전송 메모리 타겟 규격 교정]:
      // 0번 평면과 1번 평면의 물리 버퍼 메모리 주소를 명시하여 에러 없이 오디오 스레드로 무정지 이계 처리
	  /*
	  workletNode 사용시
      const transferBuffers = [chunk[0].buffer, chunk[1].buffer];

      this.workletNode.port.postMessage({
        type: "chunk",
        channels: chunk,
        length: renderCount
      }, transferBuffers);

      this.totalFrames += renderCount;
      this.inFlight++;
	  */
  
      // 🎯 [유튜브급 배속 핵심 1]: 소리 조각을 담을 정밀 AudioBuffer 하드웨어 객체 동적 생성
      const audioBuffer = ctx.createBuffer(2, renderCount, ctx.sampleRate);
      audioBuffer.copyToChannel(chunk[0].subarray(0, renderCount), 0);
      audioBuffer.copyToChannel(chunk[1].subarray(0, renderCount), 1);

      // 🎯 [유튜브급 배속 핵심 2]: 고성능 SourceNode 결합 및 브라우저 자체 playbackRate 주입
      const sourceNode = ctx.createBufferSource();
      sourceNode.buffer = audioBuffer;
      sourceNode.playbackRate.value = this.playbackSpeed; // 음정 불변 타임 스트레칭 발동
      // 🎯 [핵심 변경]: 단순 배속이 아닌 음정 변환이 결합된 하드웨어 속도를 주입합니다.
      //sourceNode.playbackRate.value = this.finalPlaybackRate; 

      // 볼륨 및 비주얼라이저 체인 연동
      if (this.player.gainNode) {
        sourceNode.connect(this.player.gainNode);
      } else {
        sourceNode.connect(ctx.destination);
      }

      // 🎯 정밀 타임라인 오프셋 계산에 맞춰 사운드 예약 발사 (끊김 방지 지연 보정)
      // 🎯 청크의 시간 폭 계산은 여전히 오직 '재생 배속'에만 의존해야 자막/시간 싱크가 깨지지 않습니다.
      const chunkDuration = (renderCount / ctx.sampleRate) / this.playbackSpeed;
      sourceNode.start(this.nextStartTime);

      // 재생 완료 시 메모리 풀로 청크 자동 반환 복귀 회로 구축
      sourceNode.onended = () => {
        this.chunkPool.push(chunk);
        this.activeSources = this.activeSources.filter(s => s !== sourceNode);
      };

      this.activeSources.push(sourceNode);
      this.nextStartTime += chunkDuration;
      this.totalFrames += renderCount;

      if (isFinished) {
      //if (this.isFinished) {
		this.isFinished = isFinished; // add
		// 🎯 완치: 여기서도 스스로 player.stop()을 호출하던 구문을 완전히 제거합니다.
        //this.player.stop();
        break;
      }
    }
  }

  // 🎯 백그라운드 탭 저하 현상을 극복하기 위한 무정지 타이머 구동
  startLoop() {
    if (!this.player.isPlaying || this.player.isPaused) return;
    this.feedQueue(); 

    // 음악 끊기는 현상있음
    //this.animationFrameId = requestAnimationFrame(() => this.startLoop());
    // 크롬 백그라운드 제한 정책에 걸리더라도 오디오 끊김 마진(250ms) 내에서 
    // 무조건 수급 루프가 최소 1번 이상 돌도록 하이브리드 교차 타이머 구성
    if (this.timerId !== null) clearTimeout(this.timerId);
    this.timerId = setTimeout(() => this.startLoop(), 50);
  }


  initNode(audioContext) {
	/** /
	// AudioWorkletNode 사용할 때
    if (this.workletNode) return;
    this.workletNode = new AudioWorkletNode(audioContext, 'audio-queue-processor', {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [2]
    });

    this.workletNode.port.onmessage = (e) => {
      if (e.data.type === "recycle") {
        this.chunkPool.push(e.data.channels);
        this.inFlight--; 
        this.feedQueue(); 
      }
    };

    this.workletNode.port.postMessage({ type: "start" });

    if (this.player.gainNode) {
      this.workletNode.connect(this.player.gainNode);
    } else {
      this.workletNode.connect(audioContext.destination);
    }
	/**/
    this.audioContext = audioContext;
    if (this.nextStartTime === 0 || this.nextStartTime < audioContext.currentTime) {
      this.nextStartTime = audioContext.currentTime + 0.02; // 최초 재생 시 미세 여유 오프셋 확보
    }
  }

  start() {
    if (this.workletNode) {
      this.workletNode.port.postMessage({ type: "start" });
    }
    this.startLoop();
  }

  clear() {
    // 버퍼 초기화
    // 🎯 [코어 리셋 안전장치]: 새로운 재생 사이클이 시작될 때 종료 인자를 깨끗이 비웁니다.
    this.isFinished = false;
    this.totalFrames = 0;

    this.nextStartTime = 0;
  }

  // stopNode 호출 시 타이머 해제부 교정
  stopNode(type = 'reset') {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      //clearTimeout(this.animationFrameId); // cancelAnimationFrame 대신 clearTimeout으로 교체
      this.animationFrameId = null;
    }
	
    // 예약되어 날아가고 있던 모든 하드웨어 소리 소스들을 잡음 없이 깨끗하게 즉시 파괴
    this.activeSources.forEach(source => {
      try { source.stop(); } catch(e) {}
    });
    this.activeSources = [];
	
    if (this.workletNode) {
      this.workletNode.port.postMessage({ type });
    }
    if (type === 'reset') {
      if (this.workletNode) {
        this.workletNode.disconnect();
        this.workletNode.port.onmessage = null;
        this.workletNode = null;
      }
      this.chunkPool = [];
      this.allocated = 0;
      this.inFlight = 0;
      this.totalFrames = 0;
    }
  }
  
  // 배속 지정
  //speed( speed = 1.0 ) {
  //  if (this.workletNode) {
  //    this.workletNode.port.postMessage({ type: 'SET_SPEED', speed: speed });
  //  }
  //}
  
  
  // 🎯 실시간 배속 실시간 처리 메커니즘 전면 교정
  // speed(speed) 메서드를 지우거나 아래의 신규 통합 제어 메서드로 교체 및 추가해 주세요.
  speed(speed = 1.0) {
    this.playbackSpeed = speed;
    /**/
    // 1. 타임라인 재정렬: 다음 청크가 들어갈 가상 오프셋 시간을 현재 시간에 맞춰 동기화 보정
    if (this.audioContext) {
      this.nextStartTime = this.audioContext.currentTime + 0.01;
    }
    
    // 2. 현재 공중에 떠서 연주되고 있는 모든 소리 노드의 배속도 즉시 유연 가속 반영
    this.activeSources.forEach(source => {
      if (source.playbackRate) {
        source.playbackRate.setValueAtTime(speed, this.audioContext.currentTime);
      }
    });
    /**/
    //this.player.setPitchAndSpeed(this.player.currentSemitone, speed);
  }

  // 🎯 음정/배속 결합 레이어 실시간 업데이트 엔진 도킹
  setFinalRate(finalRate) {
    this.finalRate = finalRate;
    if (this.audioContext) {
      this.nextStartTime = this.audioContext.currentTime + 0.01;
    }
    this.activeSources.forEach(source => {
      if (source.playbackRate) {
        source.playbackRate.setValueAtTime(finalRate, this.audioContext.currentTime);
      }
    });
  }

}
