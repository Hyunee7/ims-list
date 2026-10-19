/**
 * AdPlug 오디오 청크 공급 및 재생 수급 가속 제어 시스템 (비주얼라이저 완전 복원 버전)
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

    this.isFinished = false;
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

    while (this.inFlight < this.maxChunks) {
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
      const transferBuffers = [chunk[0].buffer, chunk[1].buffer];

      this.workletNode.port.postMessage({
        type: "chunk",
        channels: chunk,
        length: renderCount
      }, transferBuffers);

      this.totalFrames += renderCount;
      this.inFlight++;

      if (isFinished) {
      //if (this.isFinished) {
		this.isFinished = isFinished; // add
		// 🎯 완치: 여기서도 스스로 player.stop()을 호출하던 구문을 완전히 제거합니다.
        //this.player.stop();
        break;
      }
    }
  }

  startLoop() {
    if (!this.player.isPlaying || this.player.isPaused) return;
    this.feedQueue(); 
    this.animationFrameId = requestAnimationFrame(() => this.startLoop());
  }

  initNode(audioContext) {
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
  }

  stopNode(type = 'reset') {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
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
  speed( speed = 1.0 ) {
    if (this.workletNode) {
		this.workletNode.port.postMessage({ type: 'SET_SPEED', speed: speed });
    }
  }
}
