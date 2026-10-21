// app.js
import { AdPlugPlayer } from './AdPlugPlayer.js';
import { AdPlugLyricParser } from './AdPlugLyricParser.js';

const player = new AdPlugPlayer();
const lyricParser = new AdPlugLyricParser();

// 외부호출 시 전달된 IMS 경로
let MUSIC_URL = './100MEET.IMS'; 
const PLAYLIST = [
  '../dos/C_Drv/MUSIC/DATA/COLLECT/SB-NOPRO.IMS',
  '../dos/C_Drv/MUSIC/DATA/COLLECT/SB-TIES.IMS',
  '../dos/C_Drv/MUSIC/DATA/COLLECT/SIM-BUHL.IMS'
];
let PLAYLIST_index = 0;

const params = new URLSearchParams(window.location.search);
//console.log('params',params);
//console.log(params.get('ims'));
//const MUSIC_URL = params.get('ims') || './100MEET.IMS'; 
const isPopup = params.get('p') || false;

let uiTimerId = null;
let isUserDraggingSlider = false; 
let info = {title:"", files:[]}; // 곡명, 곡 파일들


// ISS 파일 경로
function getMatchingLyricUrl(musicUrl) {
  const lastDotIdx = musicUrl.lastIndexOf(".");
  if (lastDotIdx === -1) return musicUrl + ".ISS";
  return musicUrl.substring(0, lastDotIdx) + ".ISS";
}

// 전체 가사 출력. 중복되는 라인는 제거함.
function renderAllLyricsToWindow(lyricsArray) {
  const viewer = document.getElementById('allLyricsView');
  viewer.innerHTML = ""; 
  if (lyricsArray.length === 0) {
    viewer.innerHTML = "<div style='color:#808080; text-align:center;'>가사 데이터가 비어 있습니다.</div>";
    return;
  }

  //console.log(lyricsArray);
  // 가사 중복라인 제거
  const deDupingLyricsArray = lyricsArray.filter((item, index) => {
    return lyricsArray.findIndex(t => t.text === item.text) === index;
  });
  //console.log(lyricsArray);
  // 가사 출력
  deDupingLyricsArray.forEach((line, idx) => {
    const row = document.createElement('div');
    row.id = `lyric-line-${idx}`;
    row.innerText = line.text;
    viewer.appendChild(row);
  });
}

// app.js 맨 하단 영역의 initSystem() 호출부를 아래 엔진으로 전면 교정합니다.

// 🎯 [자동 연주 완치 포인트 1]: 주소창에서 ?url=... 링크 주소를 실시간 파싱 추출합니다.
function getMusicUrlFromQuery() {
  const params = new URLSearchParams(window.location.search);
//  return params.get("url"); // ?url=https://... 에서 뒤쪽 주소만 쏙 끄집어냄
  return params.get("ims"); // ?url=https://... 에서 뒤쪽 주소만 쏙 끄집어냄
}

// 시스템 초기 탑재 및 자동 스캔 엔진 가동
async function initSystem() {
  try {
    await player.loadEngine();
    await player.initEngine();
window['AdPlugPlayer'] = player; // 디버그용?

    // 기본 오리진 주소를 주입하되, 외부 URL 유입 파라미터가 있다면 오버라이드(교체) 단행
    const queryMusicUrl = getMusicUrlFromQuery();
    const FINAL_MUSIC_URL = queryMusicUrl ? decodeURIComponent(queryMusicUrl) : MUSIC_URL; // 🎯 외부 입력 우선 순위 적용

    // 이하는 교정 완료된 정밀 64바이트 파라미터 주사 결합 유지 사양
    info.files.push(FINAL_MUSIC_URL.split('/').pop());
    const targetLyricUrl = getMatchingLyricUrl(FINAL_MUSIC_URL);
    document.getElementById('playStatus').innerText = "🔄 IMPlay 표준 조합형 구조(.ISS) 바이너리 분석 중...";

    const lyricRes = await fetch(targetLyricUrl);
    if (lyricRes.ok) {
      const lBuf = await lyricRes.arrayBuffer();
      const parsedLyrics = lyricParser.parse(lBuf);
window.iss = parsedLyrics; // 디버그용
      renderAllLyricsToWindow(parsedLyrics);
		// ISS 파일명 추출
		info.files.push(targetLyricUrl.split('/').pop());
    } else {
      //document.getElementById('lyricBox').innerText = "🎵 (자막 파일이 존재하지 않는 곡입니다)";
      document.getElementById('lyricBox').innerHTML = "<span>🎵 (자막 파일이 존재하지 않는 곡입니다)</span>";
    }

    // 🎯 전역 스코프에 최종 확정된 음악 URL 주소 바인딩 (startPlay 함수가 읽어 쓰도록 조율)
    window.ACTIVE_MUSIC_URL = FINAL_MUSIC_URL;

    // 🎯 [자동 연주 완치 포인트 2]: 외부 파일 URL을 수급 받았는지 유무를 판별합니다.
    if (queryMusicUrl) {
      document.getElementById('playStatus').innerText = "🔮 외부 음원 버퍼 로드 완료! 브라우저 보안으로 인해 화면 아무 곳이나 클릭하시면 즉시 연주가 개시됩니다.";
      document.getElementById('btnPlay').disabled = false;
      
      // 현대 브라우저 오디오 오토플레이 제약 우회 장치: 사용자가 화면 아무 데나 누르는 순간 바로 연주 스타트!
	  /** /
      const triggerAutoPlay = async () => {
        window.removeEventListener('click', triggerAutoPlay);
        window.removeEventListener('touchstart', triggerAutoPlay); // 모바일 터치 대응
        await startPlay(); // 자동 재생 전사 실행
      };
      window.addEventListener('click', triggerAutoPlay);
      window.addEventListener('touchstart', triggerAutoPlay);
	  /**/
    } else {
      // 일반 진입 시 기존 순정 안내 그대로 유지
      document.getElementById('playStatus').innerText = "✅ 모든 버퍼 탑재 완료! 재생 버튼을 누르세요.";
      document.getElementById('btnPlay').disabled = false;
    }
	
    const initialVol = Math.round(player.currentVolume * 100);
    document.getElementById('volumeValue').innerText = `${initialVol}%`;
  } catch (err) {
    console.error(err);
    document.getElementById('playStatus').innerText = "❌ 시스템 초기화 실패";
  }
}

//initSystem();

// 비주얼라이저. 화면이 그려 질때마다 반복함
// app.js 내 setupVisualizer 함수를 아래 완전판 엔진으로 전면 교정합니다.
// app.js 내 setupVisualizer 함수를 연산량 최소화 가드 버전으로 교정합니다.
// app.js 내 setupVisualizer 함수를 구형 모바일 호환성 가드 버전으로 교정합니다.
function setupVisualizer() {
  const analyser = player.analyserNode;
  if (!analyser) return;

  const canvas = document.getElementById('visualizer');
  const canvasCtx = canvas.getContext('2d');
  
  // 캔버스 그래픽 픽셀 해상도 동기화 (DPR 매핑)
  const dpr = window.devicePixelRatio || 1;
  canvas.width = canvas.clientWidth * dpr;
  canvas.height = canvas.clientHeight * dpr;
  canvasCtx.scale(dpr, dpr);

  // 전광판 하드웨어 규격 설정
  const barCount = 16;       // 16열
  const segmentCount = 22;   // 32층
  const segmentGap = 1;      // LED 간격
  
  // 피크 홀드 물리 가속 법칙 상수
  const PEAK_HOLD_FRAMES = 15;
  const PEAK_FALL_ACCELERATION = 0.3;
  const VALUE_FALL_SPEED = 4;

  // 레드로 LED 색상 조합 명세
  const colors = {
    low: "#00FF44",      // 저음역 (그린)
    mid: "#FFCC00",      // 중음역 (옐로우)
    high: "#FF0055",     // 고음역 (레드)
    peak: "#FFFFFF",     // 피크선 (화이트)
    bg: "#000000"        // 닫힌 배경 (블랙)
  };

  // 피크 보관용 내부 메모리 큐
  const barData = Array.from({ length: barCount }, () => ({
    value: 0, peak: 0, peakHoldTime: 0, peakFallSpeed: 0
  }));

  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  let lastTime = 0;
  const targetInterval = 1000 / 30; // 30fps 고정 타겟 가드

  function draw(timestamp) {
    requestAnimationFrame(draw);

    // 연주 정지 및 일시정지 시 전광판 즉시 암전 후 연산 스킵 (절전)
    if (!player.isPlaying || player.isPaused) {
      canvasCtx.fillStyle = colors.bg;
      canvasCtx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
      return;
    }

    // 🎯 [구형 안드로이드 완치 방어선 1]: 
    // 구형 웹뷰나 크롬 구버전은 requestAnimationFrame이 타임스탬프를 누락하거나
    // 초기 프레임에서 밀리초 동기화 에러(NaN)를 낼 수 있습니다.
    // 값이 정상적이지 않다면 고유 성능 시계인 performance.now() 혹은 Date.now()로 정밀 대체 피드백을 구축합니다.
    const currentTimestamp = timestamp || (window.performance ? performance.now() : Date.now());

    // 🎯 [구형 안드로이드 완치 방어선 2]:
    // lastTime이 초기값(0)인 첫 프레임 주행 시 조건문 통과 가드 배치
    if (lastTime !== 0 && (currentTimestamp - lastTime < targetInterval)) return;
    lastTime = currentTimestamp;

    analyser.smoothingTimeConstant = 0; 
    analyser.getByteFrequencyData(dataArray);

    const viewWidth = canvas.clientWidth;
    const viewHeight = canvas.clientHeight;

    // 비주얼라이저 전면 딥 블랙 청소
    canvasCtx.fillStyle = colors.bg;
    canvasCtx.fillRect(0, 0, viewWidth, viewHeight);

    const skipBins = 2;
    const usableBins = bufferLength - skipBins;
    const binsPerBar = Math.floor(usableBins / barCount);
    const totalBarGap = 4; 
    const barWidth = (viewWidth - (totalBarGap * (barCount - 1))) / barCount;
    const segmentHeight = (viewHeight - (segmentGap * (segmentCount - 1))) / segmentCount;

    for (let i = 0; i < barCount; i++) {
      const startBin = skipBins + i * binsPerBar;
      const endBin = Math.min(startBin + binsPerBar, bufferLength);
      let sum = 0;
      for (let j = startBin; j < endBin; j++) { sum += dataArray[j]; }
      const avg = sum / (endBin - startBin);
      const rawValue = Math.round((avg / 255) * 100);

      const prev = barData[i];

      // 하강 속도 및 물리 피크 홀드 계산
      let value = rawValue >= prev.value ? rawValue : Math.max(rawValue, prev.value - VALUE_FALL_SPEED);
      let peak = prev.peak;
      let peakHoldTime = prev.peakHoldTime;
      let peakFallSpeed = prev.peakFallSpeed;

      if (value >= peak) {
        peak = value; peakHoldTime = PEAK_HOLD_FRAMES; peakFallSpeed = 0;
      } else if (peakHoldTime > 0) {
        peakHoldTime--;
      } else {
        peakFallSpeed += PEAK_FALL_ACCELERATION;
        peak = Math.max(0, peak - peakFallSpeed);
      }

      barData[i] = { value, peak, peakHoldTime, peakFallSpeed };

      const barX = i * (barWidth + totalBarGap);
      
      // 실제 켜진 LED의 최고층(Top 층) 역산
      const activeTopIndex = Math.floor((value * segmentCount) / 100);
      const peakSegIndex = Math.min(Math.floor((peak * segmentCount) / 100), segmentCount - 1);

      // 실제 활성화된 높이까지만 정밀 고속 주사
      for (let segIndex = 0; segIndex < activeTopIndex; segIndex++) {
        const ratio = segIndex / segmentCount;
        let color = colors.low;  
        //if (ratio >= 5 / 6) color = colors.high;
        //else if (ratio >= 3 / 6) color = colors.mid;
                if (ratio >= 2 / 3) color = colors.high; // 3분할
                else if (ratio >= 1 / 3) color = colors.mid;

        const segY = (segmentCount - 1 - segIndex) * (segmentHeight + segmentGap);
        canvasCtx.fillStyle = color;
        canvasCtx.fillRect(barX, segY, barWidth, segmentHeight);
      }

      // 공중에 떠 있는 하얀색 피크선 블록 딱 1개 정위치 단발 주사
      if (peak > 2 && peakSegIndex >= activeTopIndex) {
        const peakY = (segmentCount - 1 - peakSegIndex) * (segmentHeight + segmentGap);
        canvasCtx.fillStyle = colors.peak;
        canvasCtx.fillRect(barX, peakY, barWidth, segmentHeight);
      }
    }
  }

  // 첫 진입 루프 스타트
  requestAnimationFrame(draw);
}



// 재생시각 출력용
function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// 연주중 처리 루프
function startInterfaceLoop() {
  if (uiTimerId !== null) clearInterval(uiTimerId);

  uiTimerId = window.setInterval(() => {
//console.log('연주중')
//console.log(player.queue.isFinished)
    // 🎯 [완치 포인트 1]: 오디오 프로세서가 노래가 끝났다고 신호를 보내면 즉시 인터페이스 연주 종료 처리 단행
    if (player.queue.isFinished) {
      stopInterface(); 
	  if(isPopup) history.go(-1); // 이전 페이지 복귀
      return;
    }
    if (!player.isPlaying || player.isPaused) return; // 일시정지

    const timeInfo = player.getPlaybackTime();
    document.getElementById('timeText').innerText = `${formatTime(timeInfo.current)} / ${formatTime(timeInfo.total)}`;
    
    if (!isUserDraggingSlider && timeInfo.total > 0) {
      const progressBar = document.getElementById('progressBar');
      progressBar.max = timeInfo.total;
      progressBar.value = timeInfo.current;
    }

    // 1. 코어 클락에서 순정 가사 보정 처리가 완비된 진짜 틱 수령
    const currentEmuTick = player.getCurrentEmuTick();
    //console.log(currentEmuTick, player.module._emu_get_current_tick()/8)
		
    // 2. 가사 파서 업데이트 (현재 시각에 딱 매칭되는 한글 텍스트 추출)
    const currentLyricText = lyricParser.update(currentEmuTick);
    //console.log(currentLyricText);
    //console.log(iss[iss.findIndex(itm => itm.tick>player.getCurrentEmuTick())-1]);
    // 3. 🎯 [UI 드로우 조건절 교정]: 무조건 자막을 밀어넣고 액티브 행을 동적 추적
    if (currentLyricText !== null) {
      //document.getElementById('lyricBox').innerText = currentLyricText;
      document.getElementById('lyricBox').innerHTML = `<span>${currentLyricText}<span>`;
      /*
      const activeIdx = lyricParser.currentIndex;
      
      // 전체 가사 목록 중 액티브 클래스 실시간 스왑 처리
      document.querySelectorAll('#allLyricsView div').forEach(el => el.classList.remove('active-line'));
      const activeRow = document.getElementById(`lyric-line-${activeIdx}`);
      if (activeRow) {
        activeRow.classList.add('active-line');
        activeRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
	  */
    }
  }, 100); 
}

// 연주 종료시 화면 처리
function stopInterface() {
  player.stop();
  lyricParser.reset();
  // 🎯 [재생 불가 완치]: 큐 엔진에 잠겨있던 종료 플래그를 완전히 잠금 해제(false)합니다.
  if (player.queue) {
    player.queue.isFinished = false; 
  }
  if (uiTimerId !== null) {
    clearInterval(uiTimerId);
    uiTimerId = null;
  }

  //document.getElementById('lyricBox').innerText = "옥소리 애드립 노래방 시스템 준비 완료";
  //글자크기 조절되게(css 영향받게) 수정
  document.getElementById('lyricBox').innerHTML = "<Span>옥소리 애드립 노래방 시스템 준비 완료</span>";
  document.getElementById('timeText').innerText = "0:00 / 0:00";
  document.getElementById('progressBar').value = 0;
  document.getElementById('progressBar').disabled = true;
  document.getElementById('infoTitle').innerText = "-";
  document.getElementById('infoAuthor').innerText = "-";
  document.querySelectorAll('#allLyricsView div').forEach(el => el.classList.remove('active-line'));
  document.getElementById('playStatus').innerText = "■ 연주 정지됨";
  document.getElementById('btnPlay').disabled = false;
  document.getElementById('btnPause').disabled = true;
  document.getElementById('btnStop').disabled = true;
}

// 재생 함수
async function startPlay() {
  document.getElementById('playStatus').innerText = "🔄 음악 오리진 버퍼 연산 중...";
  
  if (player.queue) {
    player.queue.isFinished = false;
  }

  // 🎯 고정된 MUSIC_URL 대신 오토플레이 캐처가 확정한 유동적 타겟 URL을 바라봅니다.
  const targetUrl = window.ACTIVE_MUSIC_URL || MUSIC_URL;

  if (!player.fileLoaded) {
//    const response = await fetch(MUSIC_URL);
    const response = await fetch(targetUrl); // 👈 targetUrl로 변경
    const arrayBuffer = await response.arrayBuffer();

    const u8Array = new Uint8Array(arrayBuffer);
	//info.title = lyricParser.decodeJohab(u8Array.subarray(6, 36));
	info.title = JohabDecoder.decode(arrayBuffer, 6, 30); // 조합형변환 모듈 변경
//    await player.loadMusicFile(MUSIC_URL, new Uint8Array(arrayBuffer));
//console.log('parse_ims',player.parser.parse_ims(arrayBuffer));
	player.parser.parse_ims(arrayBuffer); // ims 파싱
    await player.loadMusicFile(targetUrl, new Uint8Array(arrayBuffer)); // 👈 targetUrl로 변경
	info.files.push(player.memory.bnkName); // BNK 파일명
//	console.log(player.parser.get_mapped_instrument()); // 매핑악기수
  }  

  player.play();
  document.getElementById('playStatus').innerText = "▶ OPL3 실시간 리샘플링 연주 구동 중";
  
  document.getElementById('btnPlay').disabled = true;
  document.getElementById('btnPause').disabled = false;
  document.getElementById('btnStop').disabled = false;
  document.getElementById('progressBar').disabled = false;

  // 재생정보
  //const info = player.getTrackInfo(); // 사용불가
  document.getElementById('infoTitle').innerText = info.title;
  document.getElementById('infoAuthor').innerText = info.files.join(', ');
//	console.log(player.parser.get_mapped_instrument()); // 매핑악기수
  const mapped = player.parser.get_mapped_instrument(); // 매핑악기수
//  document.getElementById('infoAuthor').innerText += ` (${mapped.mapped} / ${mapped.ims} / ${mapped.bnk})`;
  document.getElementById('infoAuthor').innerHTML += ` (${mapped.mapped}<span>/</span>${mapped.ims}<span>/</span>${mapped.bnk.toLocaleString()})`;

  setupVisualizer();
  startInterfaceLoop();
}

// 재생 버튼
document.getElementById('btnPlay').addEventListener('click', startPlay);

// 일시정지 버튼
document.getElementById('btnPause').addEventListener('click', () => {
  player.pause();
  document.getElementById('playStatus').innerText = "⏸ 연주 일시정지됨";
  document.getElementById('btnPlay').disabled = false;
  document.getElementById('btnPause').disabled = true;
});

// 정지 버튼
document.getElementById('btnStop').addEventListener('click', () => {
  stopInterface();
});

// 배속처리
/*
let isSpeed=false;
document.getElementById('btnSpeed').addEventListener('click', () => {
	if(isSpeed){
	  player.speed(1.0);
	  isSpeed=false;
	}else{
	  console.log('player',player)
	  player.speed(1.5);
	  isSpeed=true;
	}
});
*/
let isSpeed=-1;
document.getElementById('btnSpeed').addEventListener('click', () => {
	isSpeed = ++isSpeed%4;
	let speed = 1.0;
	if(     isSpeed==0) speed=0.5;
	else if(isSpeed==1) speed=1.0;
	else if(isSpeed==2) speed=1.5;
	else if(isSpeed==3) speed=2.0;
	speedTxt.innerText = `빨리감기(${speed})`;
	player.speed(speed);
});
// UI 슬라이더 등과 연동
//document.getElementById('pitchSlider').addEventListener('input', (e) => {
//  setPlaybackPitch(parseFloat(e.target.value));
//});

// 진행바
const progressBar = document.getElementById('progressBar');
progressBar.addEventListener('input', () => { isUserDraggingSlider = true; });
progressBar.addEventListener('change', () => {
  const targetSeconds = parseInt(progressBar.value, 10);
  player.seekToTime(targetSeconds); 
  isUserDraggingSlider = false; 
});

// ② 볼륨 바 input 이벤트 리스너 전면 교정
document.getElementById('volumeBar').addEventListener('input', (e) => {
  const volValue = parseFloat(e.target.value); // 슬라이더의 0.0 ~ 2.0 값 수령
  player.setVolume(volValue); 
  
  // 🎯 [백분율 환산식 교정]: 배율에 100을 곱해 '0% ~ 200%' 정수로 시각화 출력
  const percent = Math.round(volValue * 100);
  document.getElementById('volumeValue').innerText = `${percent}%`;
});

// 음소거
document.getElementById('btnMute').addEventListener('click', () => {
  const isMuted = player.toggleMute();
  const btn = document.getElementById('btnMute');
  btn.innerText = isMuted ? "🔇 Muted" : "🔊 Mute";
  btn.style.color = isMuted ? "#FF0000" : "var(--text-main)";
});

// 가사내용 펼치기/닫기
document.getElementById('lyricsBtn').addEventListener('click', () => {
  const overlay = allLyricsView;
  if(overlay.classList.contains('hidden'))
    overlay.classList.remove("hidden");
  else
    overlay.classList.add("hidden");

});

// 닫기(?) 버튼 클릭
const secondSpan = document.querySelector('.title-bar span:nth-of-type(2)');
secondSpan.addEventListener('click', () => {
	stopInterface(); // 재생정지
	history.go(-1); // 이전 페이지로
});

// app.js 맨 하단 영역에 추가 (모바일 화면 회전 시 비주얼라이저 자석 배열 실시간 갱신 장치)
window.addEventListener('resize', () => {
	//alert(navigator.appVersion);
  if (player.isPlaying && !player.isPaused) {
    setupVisualizer(); // 화면 크기가 변하면 캔버스 그래픽 픽셀 면적을 재연산하여 복원
  }
});

// 시스템 초기화
await initSystem();
const isiPhone = /iPhone/i.test(navigator.userAgent);
//alert(`isiPhone:${isiPhone}`)
const isIPad = /iPad/.test(navigator.userAgent) || 
                           (navigator.maxTouchPoints > 1 && /Macintosh/i.test(navigator.userAgent));

//alert(`아이패드 여부:${isIPad}`);
if(params.get('ims') && !isiPhone && !isIPad) setTimeout(startPlay,1000);

//if(params.get('ims') && isiPhone) setTimeout(startPlay,2000);
/*
if(params.get('ims') && isIPad) {
	setTimeout(()=>{
		startPlay();
//		alert(player.audioContext.state)
		player.audioContext.onstatechange = () => {
		  console.log('AudioContext state:', audioContext.state);
		  //alert('AudioContext state:', audioContext.state);
		  if (audioContext.state === 'suspended') {
			// 필요 시 resume() 시도
			audioContext.resume();
		  }
		};
	},3000);
}
*/

function isPC() {
    const userAgent = navigator.userAgent.toLowerCase();
    // 모바일 관련 키워드 목록
    const mobileKeywords = /mobi|android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;
    
    // mobileKeywords에 걸리지 않으면 PC로 판별
    return !mobileKeywords.test(userAgent);
}

if (isPC()) {
    console.log("PC 환경입니다.");
} else {
    console.log("모바일 환경입니다.");
}
