// adplug-processor.js
class AdPlugProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.audioBuffer = []; // 실시간 재생 대기용 샘플 큐

    this.port.onmessage = (event) => {
      // 💡 메인 스레드(AdPlugPlayer)가 계산해서 보내준 사운드 데이터를 배열에 쌓음
      if (event.data.type === 'AUDIO_SAMPLES') {
        this.audioBuffer.push(...event.data.samples);
      }
    };
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    if (!output || output.length === 0) return true;

    const leftChannel = output[0];
    const rightChannel = output[1];
    const frameCount = leftChannel.length;

    const scale = 1 / 32768; // Int16 양자화 데이터를 Float32 (-1.0 ~ 1.0)로 정규화
    let sampleIndex = 0;

    // 브라우저 오디오 시스템이 요구하는 프레임 크기(보통 128개 단위)만큼 루프 돌며 버퍼 채우기
    for (let i = 0; i < frameCount; i++) {
      if (this.audioBuffer.length >= 2) {
        // 인터리브(좌-우-좌-우) 구조로 들어있는 데이터를 분리하여 대입
        leftChannel[i] = this.audioBuffer.shift() * scale;
        rightChannel[i] = this.audioBuffer.shift() * scale;
        sampleIndex += 2;
      } else {
        // 재생 대기 중인 샘플이 바닥나면 무음 처리
        leftChannel[i] = 0;
        rightChannel[i] = 0;
      }
    }

    // 💡 메인 스레드에 "버퍼 소모했으니 다음 분량만큼 재생 데이터를 더 만들어 달라"고 신호 발송
    this.port.postMessage({ 
      type: 'NEED_SAMPLES', 
      requestedFrames: frameCount 
    });

    return true;
  }
}

registerProcessor('adplug-processor', AdPlugProcessor);
