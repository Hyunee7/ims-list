/**
 * 재생관련 제어 모듈
 */
 
 // 외부모듈
import { AdPlugMemory      } from './AdPlugMemory.js'; // 힙메모리 적제 모듈
import { AdPlugQueue       } from './AdPlugQueue.js';  // 오디오 큐 모듈
import { AdPlugLyricParser } from './AdPlugLyricParser.js'; // 파싱(가사) 모듈

export class AdPlugPlayer {
  constructor() {
    this.module = null;          
    this.isInitialized = false;  
    this.isPlaying = false;      
    this.isPaused = false;       
    this.fileLoaded = false;     
    this.sampleRate = 44100;     
    this.isBankLoaded = false;   
    this.audioContext = null;

    this.gainNode = null;
    this.analyserNode = null; 
    // 🎯 [볼륨 완치]: 초기 소리 크기를 0.5(50%)에서 1.0(100%) 순정 값으로 상향 세팅
    this.currentVolume = 1.0;   
    this.isMuted = false;

    this.currentRuntimeTempo = 120;
    this.tickBeat = 24;

    this.memory = new AdPlugMemory(this);
    this.queue  = new AdPlugQueue(this);
    this.parser = new AdPlugLyricParser(); // 파서모듈

    // 🎯 [로컬 고정선]: 플레이어가 실행되는 호스트 로컬 최상위 폴더의 순정 뱅크 경로 명시
    this.defaultBankPath = './STANDARD.BNK';

	this.ims = {};
	this.imsName = "";
	this.issName = "";
	this.bnkName = "";

    this.currentSemitone = 0; // 🎯 0은 원음, +1은 반음 올림, -1은 반음 내림 상태 저장
  }

  // adplug 엔진 로드
  async loadEngine(jsPath = './adplug.js', wasmPath = './adplug.wasm') {
    if (this.module) return this.module;
    try {
      const { default: AdPlugModule } = await import(jsPath);
      this.module = await AdPlugModule({
        locateFile: (path) => path.endsWith('.wasm') ? wasmPath : path
      });
      return this.module;
    } catch (err) {
      console.error("AdPlug 엔진 로드 중 오류 발생:", err);
      throw err;
    }
  }

  // 엔진 초기화
  /* 
  // audioWorklet 사용할때
  async initEngine(processorPath = './audio-queue-processor.js') {
    if (!this.module) throw new Error("엔진 로드 선행 필요");
    
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    this.sampleRate = this.audioContext.sampleRate;

    this.gainNode = this.audioContext.createGain();
    this.gainNode.gain.setValueAtTime(this.currentVolume, this.audioContext.currentTime);

    this.analyserNode = this.audioContext.createAnalyser();
    this.analyserNode.fftSize = 256;
    this.analyserNode.smoothingTimeConstant = 0.8;

    this.gainNode.connect(this.analyserNode);
    this.analyserNode.connect(this.audioContext.destination);

    await this.audioContext.audioWorklet.addModule(processorPath);

    if (this.isInitialized) {
      this.module._emu_teardown();
    }
    
    if (this.module._emu_init(this.sampleRate) !== 0) {
      throw new Error("AdPlug 에뮬레이터 초기화 실패");
    }

    this.isInitialized = true;
    this.isBankLoaded = false; 
    this.queue.chunkPool = [];
    this.queue.allocated = 0;
  }
  */
  // AdPlugPlayer 클래스 내부의 initEngine 메서드를 아래와 같이 워크렛 없이 간소화 복원합니다.
  async initEngine(processorPath = '') {
    if (!this.module) throw new Error("엔진 로드 선행 필요");
    
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    this.sampleRate = this.audioContext.sampleRate;

    this.gainNode = this.audioContext.createGain();
    this.gainNode.gain.setValueAtTime(this.currentVolume, this.audioContext.currentTime);

    this.analyserNode = this.audioContext.createAnalyser();
    this.analyserNode.fftSize = 256;
    this.analyserNode.smoothingTimeConstant = 0.8;

    this.gainNode.connect(this.analyserNode);
    this.analyserNode.connect(this.audioContext.destination);

    // 🎯 [완치]: 지저분하게 잡음을 만들고 배속 연산 처리가 안 되던 오디오 워크렛 스레드 모듈 호출부를 전면 삭제합니다.
    // await this.audioContext.audioWorklet.addModule(processorPath);

    if (this.isInitialized) {
      this.module._emu_teardown();
    }
    
    if (this.module._emu_init(this.sampleRate) !== 0) {
      throw new Error("AdPlug 에뮬레이터 초기화 실패");
    }

    this.isInitialized = true;
    this.isBankLoaded = false; 
    this.queue.chunkPool = [];
    this.queue.allocated = 0;
  }

  // 엔진에 BNK 추가
  addBankFile(filename, binaryData) {
    return this.memory.addBankFile(filename, binaryData);
  }
  
  // 확장명 추출
  getFileExtension(fullPath) {
    // 1. 경로 구분자(\ 또는 /)를 기준으로 파일명만 추출
    const fileName = fullPath.split(/[\/\\]/).pop();
    
    // 2. 뒤에서부터 '.'의 위치를 찾음
    const lastIndex = fileName.lastIndexOf('.');
    
    // 3. '.'이 없거나 파일명 맨 앞인 경우 확장자 없음
    if (lastIndex <= 0) {
      return '';
    }
    
    // 4. '.' 다음부터 끝까지 잘라내기
    return fileName.substring(lastIndex + 1).toUpperCase();
  }

  // url 확장명 변경
  getSideFileUrl(originUrl, targetExt) {
    const lastDotIdx = originUrl.lastIndexOf(".");
    if (lastDotIdx === -1) return originUrl + targetExt;
    return originUrl.substring(0, lastDotIdx) + targetExt;
  }

  async checkFileExists(path) {
    try {
      const response = await fetch(path, { method: 'HEAD' });
      return response.ok;
    } catch {
      return false;
    }
  }
  
  // ISS 파일 로드
  async loadISS(musicFileUrl) {
      const targetIssUrl = this.getSideFileUrl(musicFileUrl, ".ISS");
      console.log(`%c🔄 IMPlay 표준 조합형 구조(.ISS) 바이너리 분석 중...`, "color: #54ffff; font-weight:bold;");
      const hasIssFile = await this.checkFileExists(targetIssUrl);
      this.currentIssData = null; 

      if (hasIssFile) {
        this.issName = targetIssUrl.substring(targetIssUrl.lastIndexOf('/')+1);
        console.log(`%c[자동 매핑 가사 발견]: %c${targetIssUrl} 동기화 레이어 바인딩`, "color: #54ffff; font-weight:bold;");
        const issResponse = await fetch(targetIssUrl);
        if (issResponse.ok) {
          this.rawIssBuffer = await issResponse.arrayBuffer();
		  this.parser.parse(this.rawIssBuffer); // 가사 파싱
        }
      } else {
        console.log(`%c[가사 자막 유실 안내]: %c해당 곡은 ISS 가사 보기를 생략합니다.`, "color: #aaaaaa;");
        this.rawIssBuffer = null;
      }
  }
  
  // sleep 함수 정의
  sleep(ms){new Promise((resolve) => setTimeout(resolve, ms));}
  

  // SOP 파일 로드
  async loadMusicSOP(musicFileUrl) {
    const ext = this.getFileExtension(musicFileUrl);
    if(ext=='ROL'){
      const targetBnkUrl = this.getSideFileUrl(musicFileUrl, ".BNK");
      let bnkUrlToFetch = this.defaultBankPath; // 기본값은 무조건 로컬의 './STANDARD.BNK'
      const hasCustomBank = await this.checkFileExists(targetBnkUrl);
      if (hasCustomBank) {
        console.log(`%c[자동 매핑 외부 뱅크 발견]: %c${targetBnkUrl} 도킹`, "color: #54ff54; font-weight:bold;");
        bnkUrlToFetch = targetBnkUrl;
      } else {
        // 🎯 [핵심 변경 규칙]: 커스텀 뱅크 유실 시, 외부 서버의 STANDARD.BNK가 아닌 내 로컬 루트 패스로 확실하게 타겟 고정
        console.log(`%c[외부 커스텀 뱅크 부재]: %c내 로컬 시스템의 STANDARD.BNK 대체 스왑 처리`, "color: #ffaa00; font-weight:bold;");
        bnkUrlToFetch = this.defaultBankPath; 
      }
      const bnkResponse = await fetch(bnkUrlToFetch);
      if (!bnkResponse.ok) throw new Error(`BNK 뱅크 파일 호출 실패(${bnkUrlToFetch}): ${bnkResponse.status}`);
      const bnkBuffer = await bnkResponse.arrayBuffer();

      const pureBnkName = bnkUrlToFetch.split("/").pop() || "STANDARD.BNK"; this.bnkName = pureBnkName;
      const r = this.addBankFile(pureBnkName, new Uint8Array(bnkBuffer));
      //console.log('bnk', r, this.bnkName);
    }
      
    const pureSopName = musicFileUrl.split("/").pop() || "sample.ims"; this.imsName = pureSopName;
    const sopResponse = await fetch(unescape(musicFileUrl));
    if (!sopResponse.ok) throw new Error(`SOP 파일 호출 실패: ${sopResponse.status}`);
    const sopBuffer = await sopResponse.arrayBuffer();
    // 음원 바이너리 데이터 적재
    const sopUint8Array = new Uint8Array(sopBuffer);
    const success = this.memory.loadMusicFileToWasm(pureSopName, sopUint8Array);
    if (!success) {
      console.log('!success',success)
      this.fileLoaded = false;
      throw new Error('적재 실패');
      return false;
    }

    // ISS Load
    await this.loadISS(musicFileUrl);
    this.fileLoaded = true;
    this.isPaused = false; 
    this.queue.clear();
    return true;
  }

  /**
   * 🎯 [하이브리드 자동 리소스 스캐너 코어 - 로컬 대체 뱅크 정렬본]:
   * 외부 유입 URL과 동일 경로 상에서 커스텀 bnk를 먼저 찾고, 실패 시 무조건 오직 내 로컬 시스템 경로의 STANDARD.BNK를 전사 복제합니다.
   */
  async loadMusicFile(musicFileUrl) {
    if (!this.isInitialized) throw new Error("초기화 안 됨");
    this.queue.stopNode('reset');

    try {
      const ext = this.getFileExtension(musicFileUrl);
      if(ext!='IMS') return this.loadMusicSOP(musicFileUrl);
console.log('musicFileUrl',musicFileUrl)
      const pureImsName = musicFileUrl.split("/").pop() || "sample.ims"; this.imsName = pureImsName;
      
      const targetBnkUrl = this.getSideFileUrl(musicFileUrl, ".BNK");
      const targetIssUrl = this.getSideFileUrl(musicFileUrl, ".ISS");

      // 1. 악기 뱅크(.BNK) 우선순위 실시간 추적 스캔 가동
      let bnkUrlToFetch = this.defaultBankPath; // 기본값은 무조건 로컬의 './STANDARD.BNK'
      
      // 넘겨받은 외부 URL 경로와 같은 선상에 커스텀 뱅크가 있는지 온라인 선제 확인
      const hasCustomBank = await this.checkFileExists(targetBnkUrl);
      
      if (hasCustomBank) {
        console.log(`%c[자동 매핑 외부 뱅크 발견]: %c${targetBnkUrl} 도킹`, "color: #54ff54; font-weight:bold;");
        bnkUrlToFetch = targetBnkUrl;
      } else {
        // 🎯 [핵심 변경 규칙]: 커스텀 뱅크 유실 시, 외부 서버의 STANDARD.BNK가 아닌 내 로컬 루트 패스로 확실하게 타겟 고정
        console.log(`%c[외부 커스텀 뱅크 부재]: %c내 로컬 시스템의 STANDARD.BNK 대체 스왑 처리`, "color: #ffaa00; font-weight:bold;");
        bnkUrlToFetch = this.defaultBankPath; 
      }

      // 2. IMS 음원 파일(외부 혹은 로컬) 및 확정된 BNK 파일 병렬 패치 개시
      const [imsResponse, bnkResponse] = await Promise.all([
        fetch(musicFileUrl),
        fetch(bnkUrlToFetch)
      ]);

      if (!imsResponse.ok) throw new Error(`IMS 파일 호출 실패: ${imsResponse.status}`);
      if (!bnkResponse.ok) throw new Error(`BNK 뱅크 파일 호출 실패(${bnkUrlToFetch}): ${bnkResponse.status}`);

      const [imsBuffer, bnkBuffer] = await Promise.all([
        imsResponse.arrayBuffer(),
        bnkResponse.arrayBuffer()
      ]);

      // 3. 악기 뱅크 리소스 데이터 WASM 가상 메모리에 먼저 도킹
      const pureBnkName = bnkUrlToFetch.split("/").pop() || "STANDARD.BNK"; this.bnkName = pureBnkName;
      this.addBankFile(pureBnkName, new Uint8Array(bnkBuffer));
	  
	  this.parser.parse_bnk(bnkBuffer); // 뱅크파일 파싱

      // 4. 원시 IMS 음원 바이너리 데이터 적재 전사 단행
      const imsUint8Array = new Uint8Array(imsBuffer);
      const success = this.memory.loadMusicFileToWasm(pureImsName, imsUint8Array);
      if (!success) {
        this.fileLoaded = false;
        return false;
      }
	  this.ims = this.parser.parse_ims(imsBuffer); // ims 파싱

      // 5. 노래방 자막 파일(.ISS) 존재 여부 실시간 확인 사양
      /*
      console.log(`%c🔄 IMPlay 표준 조합형 구조(.ISS) 바이너리 분석 중...`, "color: #54ffff; font-weight:bold;");
      const hasIssFile = await this.checkFileExists(targetIssUrl);
      this.currentIssData = null; 

      if (hasIssFile) {
        this.issName = targetIssUrl.substring(targetIssUrl.lastIndexOf('/')+1);
        console.log(`%c[자동 매핑 가사 발견]: %c${targetIssUrl} 동기화 레이어 바인딩`, "color: #54ffff; font-weight:bold;");
        const issResponse = await fetch(targetIssUrl);
        if (issResponse.ok) {
          this.rawIssBuffer = await issResponse.arrayBuffer();
		  this.parser.parse(this.rawIssBuffer); // 가사 파싱
        }
      } else {
        console.log(`%c[가사 자막 유실 안내]: %c해당 곡은 ISS 가사 보기를 생략합니다.`, "color: #aaaaaa;");
        this.rawIssBuffer = null;
      }
      */
      await this.loadISS(musicFileUrl); // 가사 가져오기

      // 6. 곡 고유의 오리지널 헤더 메타데이터 정보 분석 동기화
      if (window.ChipTuneTitleParser) {
        const imsInfo = window.ChipTuneTitleParser.parseImsHeader(imsBuffer);
        if (imsInfo) {
          this.currentRuntimeTempo = imsInfo.basicTempo || 120;
          this.tickBeat = imsInfo.tickBeat || 24;
        }
      }

      this.fileLoaded = true;
      this.isPaused = false; 
      this.queue.clear();
      return true;

    } catch (err) {
      console.error("[AdPlugPlayer] 자동 리소스 도킹 프로세스 치명적 실패:", err);
      this.fileLoaded = false;
      return false;
    }
  }

  play() {
    if (!this.fileLoaded) throw new Error("로드된 곡 없음");
    if (this.isPlaying && !this.isPaused) return;

    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    if (!this.isPaused) {
      this.module._emu_rewind();
      this.queue.totalFrames = 0;
      this.queue.clear();
    }

    this.isPlaying = true;
    this.isPaused = false; 
    this.module._emu_set_loop_enabled(1); 

    this.queue.initNode(this.audioContext);
    this.queue.start();
  }

  pause() {
    if (!this.isPlaying || this.isPaused) return;
    this.isPaused = true;
    this.queue.stopNode('stop'); 
  }

  stop() {
    this.isPlaying = false;
    this.isPaused = false; 
    this.queue.stopNode('reset'); 
    if (this.fileLoaded) {
      this.module._emu_rewind();
    }
    this.queue.clear();
    //this.fileLoaded = true;
	
	this.ims = {};
	this.imsName = "";
	this.issName = "";
	this.bnkName = "";
	//this.parser.reset(); // 파싱정보 초기화
  }

  // 트랙정보 - 사용할 수 없음.
  getTrackInfo() {
    if (!this.fileLoaded || !this.module) return { title: "100MEET.IMS", author: "알 수 없는 작곡가" };
    try {
      const ptr = this.module._emu_get_track_info();
      if (ptr === 0) return { title: "100MEET.IMS", author: "알 수 없는 작곡가" };

      let bytes = [];
      let offset = ptr;
      while (this.module.HEAPU8[offset] !== 0) {
        bytes.push(this.module.HEAPU8[offset]);
        offset++;
      }

      const parser = new AdPlugLyricParser();
      const rawText = parser.decodeJohab(new Uint8Array(bytes));
      const parts = rawText.split("|");

      return { 
        title: parts ? parts.trim() : "100MEET.IMS", 
        author: parts ? parts.trim() : "알 수 없는 작곡가" 
      };
    } catch {
      return { title: "100MEET.IMS", author: "알 수 없는 작곡가" };
    }
  }

  setLoop(enabled) {
    if (this.module) this.module._emu_set_loop_enabled(enabled ? 1 : 0);
  }

  getPlaybackTime() {
    if (!this.module || !this.fileLoaded) {
      return { current: 0, total: 0 };
    }
    const currentPosMs = this.module._emu_get_current_position();
    const maxPosMs = this.module._emu_get_max_position();
    return {
      current: Math.floor(currentPosMs / 1000),
      total: Math.floor(maxPosMs / 1000)
    };
  }

  setVolume(value) {
    // UI 슬라이더에서 0 ~ 2 사이의 정밀 소수점 값을 넘겨받습니다.
    this.currentVolume = parseFloat(value);
    if (!this.isMuted && this.gainNode) {
      // 🎯 [증폭 완치]: 오디오 컨텍스트 배율을 최대 2.0(200%)까지 무정지 주사합니다.
      this.gainNode.gain.setValueAtTime(this.currentVolume, this.audioContext.currentTime);
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.gainNode) {
      const targetVolume = this.isMuted ? 0 : this.currentVolume;
      this.gainNode.gain.setValueAtTime(targetVolume, this.audioContext.currentTime);
    }
    return this.isMuted;
  }

  getCurrentEmuTick() {
    if (!this.module || !this.isPlaying || typeof this.module._emu_get_current_tick !== "function") return 0;
//    return this.module._emu_get_current_tick() / 8;
    return this.module._emu_get_current_tick() ;
  }

  seekToTime(seconds) {
    if (!this.module || !this.fileLoaded) return;
    this.module._emu_rewind();
    this.queue.clear();
    const targetMs = seconds * 1000;
    let currentMs = 0;
    while (currentMs < targetMs) {
      const isFinished = this.module._emu_compute_audio_samples() !== 0;
      if (isFinished) break;
      currentMs = this.module._emu_get_current_position();
      if (this.module._emu_get_audio_buffer_length() === 0) break;
    }
    this.queue.totalFrames = Math.floor(seconds * this.sampleRate);
  }
  
  // 배속 지정
  speed(speed=1.0){
	this.queue.speed(speed);
  }

  // AdPlugPlayer 클래스 내부에 배속과 음정을 동시에 계산하는 매커니즘 메서드 주입
  setPitchAndSpeed(semitone, speed) {
    this.currentSemitone = semitone;
    
    // 🎯 [음악 물리학 반음 공식]: 1옥타브는 12반음이므로, 반음 n개 이동은 2^(n/12) 배  율을 가집니다.
    const pitchMultiplier = Math.pow(2, semitone / 12);
    
    // 최종 소스노드에 주입할 값 = 음정 배율 * 재생 속도 배율
    const finalPlaybackRate = pitchMultiplier * speed;
    
    // 큐 노드 시스템에 최종 연산된 주파수 주사 속도를 강제 주입
    if (this.queue) {
      this.queue.setFinalRate(finalPlaybackRate);
    }
  }
}