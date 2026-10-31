// app.js (Part 1/2)
/**
 * 연주기 메인 모듈
 */

// 외부 모듈
import { AdPlugPlayer } from './AdPlugPlayer.js';
const player = new AdPlugPlayer();

// 외부호출 시 전달된 IMS 경로
let MUSIC_URL = './100MEET.IMS';

// =================================================================
// 플레이리스트 [미사용]
const PLAYLIST = [
  '../dos/C_Drv/MUSIC/DATA/COLLECT/SB-NOPRO.IMS',
  '../dos/C_Drv/MUSIC/DATA/COLLECT/SB-TIES.IMS',
  '../dos/C_Drv/MUSIC/DATA/COLLECT/SIM-BUHL.IMS'
];
let PLAYLIST_index = 0;
// =================================================================

const params = new URLSearchParams(unescape(window.location.search)); // GET 방식 파라미터 파싱
const isPopup = params.get('p') || false;

let uiTimerId = null; // 연주중 처리 루프 인터벌 저장
let isUserDraggingSlider = false; // 진행바 값 변경 여부
let info = {title:"", files:[]}; // 곡명, 곡 파일들

// 전체 가사 출력.
function renderAllLyricsToWindow(lyricsArray) {
  const viewer = document.getElementById('allLyricsView');
  //viewer.classList.remove("hidden");
  //viewer.innerHTML = "";
  // 최신 브라우저에서 지원하는 가장 깔끔한 자식 제거 방법
  viewer.replaceChildren(); 
  if (lyricsArray.length === 0) {
    viewer.innerHTML = "<div style='color:#808080; text-align:center;'>가사 데이터가 비어 있습니다.</div>";
    return;
  }

  //const deDupingLyricsArray = lyricsArray; // 중복제거
  
  // 가사 출력
  lyricsArray.forEach((line, idx) => {
    const row = document.createElement('div');
    row.id = `lyric-line-${idx}`;
    row.innerText = line;
    viewer.appendChild(row);
  });
}

// 🎯 주소창에서 ?url=... 링크 주소를 실시간 파싱 추출합니다.
function getMusicUrlFromQuery() {
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

    // 🎯 전역 스코프에 최종 확정된 음악 URL 주소 바인딩 (startPlay 함수가 읽어 쓰도록 조율)
    window.ACTIVE_MUSIC_URL = FINAL_MUSIC_URL;

    // 🎯 외부 파일 URL을 수급 받았는지 유무를 판별합니다.
    if (queryMusicUrl) {
      document.getElementById('playStatus').innerText = "🔮 외부 음원 버퍼 로드 완료! 브라우저 보안으로 인해 화면 아무 곳이나 클릭하시면 즉시 연주가 개시됩니다.";
      document.getElementById('btnPlay').disabled = false;
    } else {
      // 일반 진입 시 기존 순정 안내 그대로 유지
      document.getElementById('playStatus').innerText = "✅ 모든 버퍼 탑재 완료! 재생 버튼을 누르세요.";
      document.getElementById('btnPlay').disabled = false;
    }

    const initialVol = Math.round(player.currentVolume * 100); // 기본 볼륨설정
    document.getElementById('volumeValue').innerText = `${initialVol}%`;
  } catch (err) {
    console.error(err);
    document.getElementById('playStatus').innerText = "❌ 시스템 초기화 실패";
  }
}

// 비주얼라이저. 화면이 그려 질때마다 반복함
//  연산량 최소화. 구형 모바일 호환성 교정.
function setupVisualizer() {
  const analyser = player.analyserNode;
  if (!analyser) return;

  const canvas = document.getElementById('visualizer');
  const canvasCtx = canvas.getContext('2d');
  
  // 캔버스 그래픽 픽셀 해상도 동기화 (DPR 매핑)
  const dpr = window.devicePixelRatio || 1;
  const clientWidth  = canvas.clientWidth;
  const clientHeight = canvas.clientHeight;
  
  canvas.width  = clientWidth  * dpr;
  canvas.height = clientHeight * dpr;
  canvasCtx.scale(dpr, dpr);

  // 전광판 하드웨어 규격 설정
  const barCount     = 16;   // 16열
  const segmentCount = 22;   // 32층
  const segmentGap   =  1;   // LED 간격
  
  // 피크 홀드 물리 가속 법칙 상수
  const PEAK_HOLD_FRAMES = 15;
  const PEAK_FALL_ACCELERATION = 0.3;  // 떨어지는 속도
  const VALUE_FALL_SPEED = 4;

  // 레드로 LED 색상 조합 명세
  const colors = {
    low : "#00FF44",     // 저음역 (그린)
    mid : "#FFCC00",     // 중음역 (옐로우)
    high: "#FF0055",     // 고음역 (레드)
    peak: "#FFFFFF",     // 피크선 (화이트)
    bg  : "#000000"      // 닫힌 배경 (블랙)
  };

  // 피크 보관용 내부 메모리 큐
  const barData = Array.from({ length: barCount }, () => ({
    value: 0, peak: 2.5, peakHoldTime: 0, peakFallSpeed: 0
  }));

  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  // 🎯 [CPU 해소 핵심 1]: 매번 352번 루프 돌며 사각형을 쪼개 그리지 않고, 
  // 캔버스 자체의 선형 그라데이션 컬러맵을 단 1번만 프리셋으로 구워 메모리에 바인딩.
  const gradient = canvasCtx.createLinearGradient(0, clientHeight, 0, 0);
  gradient.addColorStop(0   , colors.low );
  gradient.addColorStop(0.33, colors.low );
  gradient.addColorStop(0.34, colors.mid );
  gradient.addColorStop(0.66, colors.mid );
  gradient.addColorStop(0.67, colors.high);
  gradient.addColorStop(1   , colors.high);

  let lastTime = 0;
  const targetInterval = 1000 / 30; // 30fps 고정 타겟

  // 비주얼라이즈 반복 그리기
  function draw(timestamp) {
    requestAnimationFrame(draw);

    // 연주 정지 및 일시정지 시 전광판 즉시 암전 후 연산 스킵 (절전)
    if (!player.isPlaying || player.isPaused) {
      canvasCtx.fillStyle = colors.bg;
      canvasCtx.fillRect(0, 0, clientWidth, clientHeight);
      return;
    }

    // 🎯 [구형 안드로이드 완치 방어선 1]: 
    // 구형 웹뷰나 크롬 구버전은 requestAnimationFrame이 타임스탬프를 누락하거나
    // 초기 프레임에서 밀리초 동기화 에러(NaN)를 낼 수 있다.
    // 값이 정상적이지 않다면 고유 성능 시계인 performance.now() 혹은 Date.now()로 대체.
    // 🎯 [CPU 해소 핵심 2 - 타이밍 가드]: timestamp 이 NaN 일 경우를 대비함.
    const currentTimestamp = timestamp || (window.performance ? performance.now() : Date.now());

    // 🎯 [구형 안드로이드 완치 방어선 2]:
    // lastTime이 초기값(0)인 첫 프레임 주행 시 조건문 통과 가드 배치
    if (lastTime !== 0 && (currentTimestamp - lastTime < targetInterval)) return;
    
    // 다음 프레임 정밀 계산을 위해 실행 시점의 시계를 누적 가산식으로 보정
    lastTime = currentTimestamp - ((currentTimestamp - lastTime) % targetInterval);

    analyser.smoothingTimeConstant = 0; 
    analyser.getByteFrequencyData(dataArray);

    // 전체 검은색 배경 청소 (단발성 실행)
    canvasCtx.fillStyle = colors.bg;
    canvasCtx.fillRect(0, 0, clientWidth, clientHeight);

    const skipBins = 2;
    const usableBins = bufferLength - skipBins;
    const binsPerBar = Math.floor(usableBins / barCount);
    const totalBarGap = 4; 
    const barWidth = (clientWidth - (totalBarGap * (barCount - 1))) / barCount;
    const segmentHeight = (clientHeight - (segmentGap * (segmentCount - 1))) / segmentCount;

    // 바 개수 만큼 그리기
    for (let i = 0; i < barCount; i++) {
      const startBin = skipBins + i * binsPerBar;
      const endBin = Math.min(startBin + binsPerBar, bufferLength);
      let sum = 0;
      for (let j = startBin; j < endBin; j++) { sum += dataArray[j]; }
      const avg = sum / (endBin - startBin);
      const rawValue = Math.round((avg / 255) * 100);

      const prev = barData[i]; // 이전 피크값

      // 하강 속도 및 물리 피크 홀드 계산
      let value = rawValue >= prev.value ? rawValue : Math.max(rawValue, prev.value - VALUE_FALL_SPEED);
      let peak          = prev.peak;
      let peakHoldTime  = prev.peakHoldTime;
      let peakFallSpeed = prev.peakFallSpeed;

      if (value >= peak) {           // 피크가 올랐을때
        peak = value; peakHoldTime = PEAK_HOLD_FRAMES; peakFallSpeed = 0;
      } else if (peakHoldTime > 0) { // 피크 홀드값 줄이기
        peakHoldTime--;
      } else {                       // 피크값 없으면 바닥에 피크홀드 고정
        peakFallSpeed += PEAK_FALL_ACCELERATION;
        peak = Math.max(2.5, peak - peakFallSpeed); // 피크값 하단에 고정
      }

      barData[i] = { value, peak, peakHoldTime, peakFallSpeed }; // 계산된 피크값 보관

      const barX = i * (barWidth + totalBarGap);
      
      // 실제 켜진 LED의 최고층(Top 층) 역산
      const activeTopIndex = Math.floor((value * segmentCount) / 100);
      const peakSegIndex = Math.min(Math.floor((peak * segmentCount) / 100), segmentCount - 1);

      // 🎯 [CPU 해소 핵심 3 - 2D 컨텍스트 드로잉 압축]:
      // 기존의 격자 층(segIndex) 무한 내포 루프를 통째로 들어내어 제거!
      // 대신 열마다 통째로 기둥 사각형 딱 1개만(`fillRect`) 그라데이션 컬러로 한 번 그려줌.
      if (activeTopIndex > 0) {
        const drawnHeight = activeTopIndex * (segmentHeight + segmentGap) - segmentGap;
        const barY = clientHeight - drawnHeight;
        
        canvasCtx.fillStyle = gradient; // 미리 정의된 그라데이션 값 매핑
        canvasCtx.fillRect(barX, barY, barWidth, drawnHeight);

        // 🎯 [LED 도스 전광판 느낌 복원]: 통짜 사각형 위에 검은색 가로줄(Gap)들을 뭉뚱그려 한 번에 주사하여
        // 352번 그리던 연산을 단 16번 그리기로 줄이면서도 완벽한 LED 눈금 비주얼을 유지.
        canvasCtx.fillStyle = colors.bg;
        for (let segIndex = 1; segIndex < activeTopIndex; segIndex++) {
          const gapY = clientHeight - (segIndex * (segmentHeight + segmentGap));
          canvasCtx.fillRect(barX, gapY, barWidth, segmentGap);
        }
      }

      // 공중에 떠 있는 하얀색 피크선 블록 딱 1개 정위치 단발 주사
      // 화이트 피크 점선 블록 단발 주사
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


// 재생시각 출력용 문자열 조합
function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
// app.js (Part 2/2)

// =================================================================
// 연주중 처리 루프
// startInterfaceLoop 루프 내부의 가사 틱 검출 수식을 교정.
let rAF_InterfaceId = null; // 🎯 setInterval 대신 애니메이션 프레임 ID 저장 보관함

// 연주중 처리 루프 (rAF 기반 오디오 엔진 클락 동기화 버전)
function startInterfaceLoop() {
  // 기존에 돌고 있던 루프가 있다면 안전하게 선제 폭파
  if (rAF_InterfaceId !== null) {
    cancelAnimationFrame(rAF_InterfaceId);
    rAF_InterfaceId = null;
  }

  let lastEmuTick = -1; // 🎯 불필요한 중복 렌더링을 차단하기 위한 이전 틱 기억 소자

  // requestAnimationFrame 반복 실행 엔진
  function loop() {
    // 1. 🎯 오디오 프로세서가 노래가 끝났다고 신호를 보내면 즉시 인터페이스 연주 종료 처리 단행
    if (player.queue && player.queue.isFinished) {
      stopInterface(); 
      if(isPopup) history.go(-1); // 이전 페이지 복귀
      if(params.get('i')) closeParent();  // 전체화면 (iframe) 닫기
      return;
    }

    // 재생 중이 아니거나 일시정지 상태이면 다음 프레임 예약 후 연산 스킵 (절전 가드)
    if (!player.isPlaying || player.isPaused) {
      rAF_InterfaceId = requestAnimationFrame(loop);
      return;
    }

    // 2. 🎯 오디오 코어 가사 엔진 클락에서 현재 실시간 연주 틱 수령
    let currentEmuTick = player.getCurrentEmuTick();
    document.getElementById('curTick').innerText = currentEmuTick.toLocaleString();
    if( /\.ims/i.test(info.files[0]) ) currentEmuTick = currentEmuTick /8 -8;
    if( /\.rol/i.test(info.files[0]) ) currentEmuTick = currentEmuTick * 7.4;
    if( /\.sop/i.test(info.files[0]) ) currentEmuTick = currentEmuTick * 3.75;
    // [부하 차단 핵심 가드]: 엔진 내부 틱이 이전 프레임과 동일하다면 DOM 렌더링을 전면 패스.
    if (currentEmuTick === lastEmuTick) {
      rAF_InterfaceId = requestAnimationFrame(loop);
      return;
    }
    lastEmuTick = currentEmuTick; // 현재 틱을 기저점에 백업

    // 3. [배속 맞춤형 진행 시간 보정]: 시간 텍스트와 프로그레스 바가 배속 속도에 동기화되도록 처리
    const timeInfo = player.getPlaybackTime();
    // 만약 고유 시간 함수가 배속을 인식하지 못한다면 인터페이스 갱신용 가상 보정 로직을 추가 결합할 수 있다. <- ??
    document.getElementById('timeText').innerText = `${formatTime(timeInfo.current)} / ${formatTime(timeInfo.total)}`;
    
    if (!isUserDraggingSlider && timeInfo.total > 0) {
      const progressBar = document.getElementById('progressBar');
      progressBar.max = timeInfo.total;
      progressBar.value = timeInfo.current;
    }

    // 4. 가사 파서 업데이트 (현재 오디오 코어 틱에 딱 매칭되는 가사 스냅샷 정밀 수급)
    const lyricSnapshot = player.parser.update(currentEmuTick);

    // 5. 완치된 가사 렌더러 가동
    if (lyricSnapshot !== null) {
      const { textRuns } = lyricSnapshot;
      const box = document.getElementById('lyricBox');

      // 정상적인 하이라이트 범위 정보가 수급되었는지 검증
      if (textRuns && textRuns.length > 0) {
        // 🎯 이미 파서 내부에서 글자 단위 완벽 마감 처리가 끝난 조각들을 결합 수행
        let finalHtml = "";
        const runLen = textRuns.length;
        for (let i = 0; i < runLen; i++) {
          const run = textRuns[i];
          if (run.lit) {
            // 불이 들어온 액티브 가사 구간 출력
            finalHtml += `<span style="color:#f5c200;">${run.text}</span>`;
          } else {
            // 간주 중이거나 하이라이트 대기 상태
            finalHtml += `<span>${run.text}</span>`;
          }
        }
        
        // 🎯 [미세 떨림 방지]: HTML 내용이 실제로 변했을 때만 DOM에 주사
        if (box.innerHTML !== finalHtml) {
          box.innerHTML = finalHtml;
        }
      }
      
      // 전체 가사 목록 액티브 추적 및 자동 스크롤
      const activeIdx = player.parser.currentIndex;
      // 전체 가사 목록 중 액티브 클래스 실시간 스왑 처리
      document.querySelectorAll('#allLyricsView div').forEach(el => el.classList.remove('active-line'));
      const activeRow = document.getElementById(`lyric-line-${activeIdx}`);
      if (activeRow) {
        activeRow.classList.add('active-line');
        //activeRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); // 현위치에 가까이 배치
        activeRow.scrollIntoView({ behavior: 'smooth', block: 'center' }); // 세로 중앙 배치
      }
    }

    // 다음 브라우저 수직 동기화 타이밍에 재귀 호출 예약
    rAF_InterfaceId = requestAnimationFrame(loop);
  }

  // 첫 진입 루프 가동
  rAF_InterfaceId = requestAnimationFrame(loop);
}
// =================================================================


// 🎯 연주 종료시 화면 처리 (rAF 클락 리셋 구문 추가 결합 완료)
function stopInterface() {
  player.stop();          // 재생중지
  // 🎯 큐 엔진에 잠겨있던 종료 플래그를 완전히 잠금 해제(false)
  if (player.queue) {
    player.queue.isFinished = false; 
  }

  // 🎯 고정 인터벌 타이머 해제 대신 rAF 애니메이션 클락 체인을 완전히 끊어낸다.
  if (rAF_InterfaceId !== null) {
    cancelAnimationFrame(rAF_InterfaceId);
    rAF_InterfaceId = null;
  }
  
  // 🎯 [배속 슬라이더 코어 리셋]: 곡이 끝나거나 정지 버튼을 누르면 배속 슬라이더와 수치도 1.0 순정으로 안전 강제 복귀
  if (speedSlider && speedTxt) {
    speedSlider.value = "1.0";
    speedTxt.innerText = "1.0x";
    player.speed(1.0); // 엔진 속도도 기본값으로 안전 리셋
  }

  // 정지 시 음정 시스템도 원음으로 안전 리셋
  if (pitchTxt) {
    player.currentSemitone = 0;
    updatePitchUI();
  }

  // 화면 처리
  // 글자크기 조절되게(css 영향받게) 수정
  document.getElementById('lyricBox').innerHTML = "<span>             🎶 옥소리 애드립 노래방 시스템 준비 완료</span>";
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
  
  if (!player.fileLoaded) {  // 읽은 파일이 없을 때
    // 🎯 url 파라미터 있으면 MUSIC_URL 대신 URL 값을 배치.
    const targetUrl = window.ACTIVE_MUSIC_URL || MUSIC_URL;
    await player.loadMusicFile( escape(targetUrl) ); // 👈 targetUrl로 변경
//console.log('player.parser.scripts', player.parser.scripts)    
    await renderAllLyricsToWindow(player.parser.scripts);
    
    const ext = player.getFileExtension(targetUrl);

    info = {title:"", files:[]}; // 곡명, 곡 파일들
    info.title = ext=='IMS'?player.ims.header.tuneName:"[제목없음]"; // 제목
    info.files.push(targetUrl.split('/').pop()); // 음악 파일명 저장
    if(player.issName) info.files.push(player.issName);
    else 
      document.getElementById('lyricBox').innerHTML = "<span>            🎵 (자막 파일이 존재하지 않는 곡입니다)</span>";
    if(player.bnkName||false) info.files.push(player.bnkName); // BNK 파일명
  }  

  handleVisibilityChange(); // audioContext 깨우기
  player.play(); // 재생 시작
  
  // 화면처리
  document.getElementById('playStatus').innerText = "▶ OPL3 실시간 리샘플링 연주 구동 중";

  document.getElementById('btnPlay').disabled = true;
  document.getElementById('btnPause').disabled = false;
  document.getElementById('btnStop').disabled = false;
  document.getElementById('progressBar').disabled = false;

  // 재생정보
  document.getElementById('infoTitle').innerText = info.title;
  document.getElementById('infoAuthor').innerText = info.files.join(', ');
//console.log(info);

  if( /\.ims/i.test(info.files[0]) ){
    const mapped = player.parser.get_mapped_instrument(); // 매핑악기수
    document.getElementById('infoAuthor').innerHTML += ` (${mapped.mapped}<span>/</span>${mapped.ims}<span>/</span>${mapped.bnk.toLocaleString()})`;
  }

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
// UI 슬라이더 등과 연동
//document.getElementById('pitchSlider').addEventListener('input', (e) => {
//  setPlaybackPitch(parseFloat(e.target.value));
//});
// =================================================================
// 🎯 0.5 ~ 3.0 배속 자석형 정밀 슬라이더 제어 레이어 도킹
// =================================================================
const speedSlider = document.getElementById('speedSlider');
const speedTxt = document.getElementById('speedTxt');

if (speedSlider && speedTxt) {
  // 사용자가 슬라이더 바를 조작할 때 실시간으로 자석식 버퍼 수급 개시
  speedSlider.addEventListener('input', (e) => {
    const targetSpeed = parseFloat(e.target.value);
    
    // 1. 시각화 화면 문구 즉시 업데이트 (예: 1.0x, 2.5x)
    speedTxt.innerText = `${targetSpeed.toFixed(1)}x`;
    
    // 2. 유튜브급 하드웨어 배속 엔진(SourceNode)에 실시간 속도 가속 주입
    if (window.AdPlugPlayer) {
      player.speed(targetSpeed);
    }
  });
}
// =================================================================



// 피치조정
// =================================================================
// 🎯 노래방 전용 반음 단위 음정(Key) 제어 레이어 시스템
// =================================================================
const btnPitchUp = document.getElementById('btnPitchUp');
const btnPitchDown = document.getElementById('btnPitchDown');
const btnPitchReset = document.getElementById('btnPitchReset');
const pitchTxt = document.getElementById('pitchTxt');

function updatePitchUI() {
  const currentKey = player.currentSemitone;
  if (currentKey === 0) {
    pitchTxt.innerText = "원음";
    pitchTxt.style.color = "#0000ff"; // 기본 블랙/블루
  } else if (currentKey > 0) {
    pitchTxt.innerText = `+${currentKey}`;
    pitchTxt.style.color = "#ff0055"; // 높은 음은 레드 계열
  } else {
    pitchTxt.innerText = `${currentKey}`;
    pitchTxt.style.color = "#00ff44"; // 낮은 음은 그린 계열
  }
}

// ♯ 버튼 클릭 (반음 올림, 최대 +6키 제한)
btnPitchUp?.addEventListener('click', () => {
  if (player.currentSemitone < 6) {
    const nextKey = player.currentSemitone + 1;
    const currentSpeed = player.queue.playbackSpeed || 1.0;
    player.setPitchAndSpeed(nextKey, currentSpeed);
    updatePitchUI();
  }
});

// ♭ 버튼 클릭 (반음 내림, 최소 -6키 제한)
btnPitchDown?.addEventListener('click', () => {
  if (player.currentSemitone > -6) {
    const nextKey = player.currentSemitone - 1;
    const currentSpeed = player.queue.playbackSpeed || 1.0;
    player.setPitchAndSpeed(nextKey, currentSpeed);
    updatePitchUI();
  }
});

// 초기화 버튼 클릭
btnPitchReset?.addEventListener('click', () => {
  const currentSpeed = player.queue.playbackSpeed || 1.0;
  player.setPitchAndSpeed(0, currentSpeed);
  updatePitchUI();
});
// =================================================================

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

// 닫기() 버튼 클릭
const secondSpan = document.querySelector('.title-bar span:nth-of-type(2)');
secondSpan.addEventListener('click', () => {
	stopInterface(); // 재생정지

	if(params.get('p'))	history.go(-1); // 이전 페이지로
	if(params.get('i')) closeParent();  // 전체화면 (iframe) 닫기
});

function closeParent() {
	player.parser.reset();  // 가사상태 초기화
    // 부모 창(window.parent)의 closeFullscreen 함수를 실행합니다.
    if (window.parent && typeof window.parent.closeFullscreen === 'function') {
        window.parent.closeFullscreen();
    } else {
        console.error("부모 창의 함수에 접근할 수 없습니다. (도메인이 다르거나 함수가 없습니다.)");
    }
}

document.getElementById('closeFullScreen').addEventListener('click', closeParent);


// 모바일 화면 회전 시 비주얼라이저 자석 배열 실시간 갱신 장치
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

// 자동재생용 - 애플계열에서 안됨.
//alert(`아이패드 여부:${isIPad}`);
//if(params.get('ims') && !isiPhone && !isIPad) setTimeout(startPlay,1000);
//if(params.get('ims') && !isiPhone && !isIPad) await startPlay();
//setTimeout(startPlay,5000); // autoplay 애플계열에서 안됨.






// 외부에서 재생 호출
export function extPlay(music){
	stopInterface();           // 재생정지
	player.queue.clear();      // 이전 큐 정리
	player.fileLoaded = false; // 로드된 파일 없음

	window.ACTIVE_MUSIC_URL = null;
	MUSIC_URL = music;         // 재생할 파일 적용
	startPlay();               // 재생시작
}
window.extPlay = extPlay; // export 가 안되서 강제 전달

 
 
 
 

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


// 오디오 잠김 현상 해제용

/**
 * 1. 페이지 복귀 시(Visibility/Focus) 강제 재개 (가장 보편적인 방법)
 * 🎯 [완치본]: 페이지 복귀 시(Visibility/Focus) 오디오 Context 깨우기 및 UI 레이어 강제 칼싱크 보전
 */
function handleVisibilityChange() {
  if (document.visibilityState === 'visible') {
    
    // iOS에서는 interrupted 상태이거나 완전히 먹통이 된 경우가 많으므로 안전하게 resume 처리
    // 1. [오디오 엔진 복원] iOS 및 크롬 백그라운드 락 완화
    if (player.audioContext && (player.audioContext.state === 'suspended' || player.audioContext.state === 'interrupted')) {
      player.audioContext.resume().then(() => {
        console.log('AudioContext가 성공적으로 재개되었습니다.');
      }).catch(err => {
        console.error('재개 실패:', err);
      });
    }

    // 2. 🎯 [UI 실시간 강제 워프 가드]: 다른 탭에 있는 동안 requestAnimationFrame이 멈춰 밀린 UI를 한 번에 강제 동기화
    if (player.isPlaying && !player.isPaused) {
      
      // A. 현재 오디오 코어의 진짜 하드웨어 틱 수령
      const currentEmuTick = player.getCurrentEmuTick()/8 - 8;
      
      // B. 가사 파서에게 현재 틱의 자막 스냅샷을 강제로 즉시 수급 요청
      const lyricSnapshot = player.parser.update(currentEmuTick);
      if (lyricSnapshot !== null) {
        const { textRuns } = lyricSnapshot;
        const box = document.getElementById('lyricBox');
        
        if (textRuns && textRuns.length > 0) {
          let finalHtml = "";
          const runLen = textRuns.length;
          for (let i = 0; i < runLen; i++) {
            const run = textRuns[i];
            if (run.lit) finalHtml += `<span style="color:#f5c200;">${run.text}</span>`;
            else finalHtml += `<span>${run.text}</span>`;
          }
          box.innerHTML = finalHtml; // 밀려있던 자막 레이아웃 즉시 강제 갱신
        }
      }

      // C. 재생 시간 텍스트 및 프로그레스 바도 현재 오디오 위치로 강제 동기화 워프
      const timeInfo = player.getPlaybackTime();
      document.getElementById('timeText').innerText = `${formatTime(timeInfo.current)} / ${formatTime(timeInfo.total)}`;
      if (!isUserDraggingSlider && timeInfo.total > 0) {
        const progressBar = document.getElementById('progressBar');
        progressBar.max = timeInfo.total;
        progressBar.value = timeInfo.current;
      }
      
      // D. 전광판 비주얼라이저가 깨졌을 수 있으므로 안전하게 다시 한 번 재가동 주입
      setupVisualizer();
    }
  }
}

// 브라우저 탭 활성화 감지 시스템에 결합 명세 보존
document.addEventListener('visibilitychange', handleVisibilityChange);
// 앱 포커스 감지 (창 전환 등)
window.addEventListener('focus', handleVisibilityChange);



/**
 * 2. iOS 버그 우회를 위한 'Suspend 후 Resume' 트릭
 */
function isIOS() {
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  
  // iPhone, iPad, iPod 체크
  const isiPhoneOrIPadOrIPod = /iPad|iPhone|iPod/.test(userAgent);
  
  // 아이패드 OS 13 이상 (데스크톱 모드 및 터치 지원 확인)
  const isMacWithTouch = (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  
  return isiPhoneOrIPadOrIPod || isMacWithTouch;
}
 
async function forceResumeIOS() {
  // 강제로 중지했다가 다시 깨우는 iOS 전용 트릭
  await player.audioContext.suspend();
  await player.audioContext.resume();
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    //forceResumeIOS().catch(console.error);
    //if(navigator.platform == 'iPhone') forceResumeIOS().catch(console.error);
    if(isIOS()) forceResumeIOS().catch(console.error);
  }
});


/**
 * 3. 화면이 꺼져도 오디오를 계속 유지하고 싶다면 (HTML5 오디오 믹싱)
 */
// 1. 아주 짧은 묵음(Silent) 오디오 파일이나 Data URI를 생성
const silentAudio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==');
silentAudio.loop = true;

// 2. 최초 사용자 인터랙션(버튼 클릭 등) 시점에 AudioContext와 함께 재생
function startAudio() {
  player.audioContext.resume();
  silentAudio.play().catch(console.error);
}

// 3. 락스크린 해제 시점에 오디오가 끊겼다면 다시 맞물려 실행
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    silentAudio.play();
    player.audioContext.resume();
  }
});
/**/

