    /*
     * 주소창의 ?url=... 파라미터에서 ROL 파일의 경로를 자동으로 추출한 뒤, fetch API를 사용하여 서버에서 바이너리 데이터를 직접 가져와 파싱
     */

    // 페이지 로드 시 URL 파라미터 체크
    window.addEventListener('DOMContentLoaded', () => {
        const urlParams = new URLSearchParams(window.location.search);
        const fileUrl = urlParams.get('url');

        if (fileUrl) {
            fetchRemoteFile(fileUrl);
        }
    });

    // 원격 서버에서 ROL 파일 fetch 호출
    function fetchRemoteFile(url) {
        //showStatus(`원격 파일 로딩 중: ${url}`, 'loading');
        
        fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP 에러! 상태코드: ${response.status}`);
                }
                return response.arrayBuffer(); // 바이너리 버퍼로 획득
            })
            .then(buffer => {
                //showStatus('원격 파일 수신 완료! 파싱을 시작합니다.', 'loading');
                handleFile(buffer);
                //statusZone.style.display = 'none'; // 성공 시 상태창 숨김
            })
            .catch(error => {
                console.error('Fetch 에러:', error);
                //showStatus(`파일을 가져오지 못했습니다. (원인: ${error.message}). CORS 정책이나 파일 경로를 확인하세요.`, 'error');
            });
    }


const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const resultArea = document.getElementById('resultArea');

// 드래그 앤 드롭 및 파일 입력 이벤트 처리
// 이벤트 리스너 설정
// 이벤트 리스너 설정 (Blob 에러 수정 본 반영)
// 1. 클릭하여 파일 선택 기능은 유지
dropZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) processFile(e.target.files[0]); 
});

// 2. ★ 브라우저 전체 화면(window) 드롭 이벤트로 확장 ★
window.addEventListener('dragover', (e) => {
    e.preventDefault(); // 파일이 브라우저에서 바로 열리는 기본 동작 방지
    dropZone.classList.add('hover'); // 전체 화면에 드래그 중일 때 디자인 활성화
});

window.addEventListener('dragleave', (e) => {
    e.preventDefault();
    // 마우스가 브라우저 창 밖으로 완전히 벗어났을 때만 디자인 해제
    if (e.clientX === 0 && e.clientY === 0) {
        dropZone.classList.remove('hover');
    }
});

window.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('hover'); // 드롭 완료 시 디자인 원복
    
    // 브라우저 화면 전체 중 어디든 드롭된 첫 번째 파일을 처리
    if (e.dataTransfer.files.length > 0) {
        processFile(e.dataTransfer.files[0]);
    }
});

/**
 * 16비트 상용조합형 바이트를 유니코드(UTF-8) 문자로 직접 변환하는 핵심 엔진
 * 16비트 상용조합형 바이트를 유니코드로 변환하는 엔진
 */
function decodeJohabString(arr) {
    // 조합형 코드표 정의 (초성/중성/종성)
    const choTable = ["", "", "ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
    const jungTable = ["", "", "ㅏ", "ㅐ", "ㅑ", "ㅒ", "ㅓ", "ㅔ", "ㅕ", "ㅖ", "ㅗ", "ㅘ", "ㅙ", "ㅚ", "ㅛ", "ㅜ", "ㅝ", "ㅞ", "ㅟ", "ㅠ", "ㅡ", "ㅢ", "ㅣ"];
    const jongTable = ["", "ㄱ", "ㄲ", "ㄳ", "ㄴ", "ㄵ", "ㄶ", "ㄷ", "ㄹ", "ㄺ", "ㄻ", "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ", "ㅁ", "ㅂ", "ㅄ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];

    let result = "";
    let i = 0;

    while (i < arr.length) {
        // 영문자/숫자/공백 등 ASCII 영역 처리
        if (arr[i] === 0) { i++; continue; }
        if (arr[i] < 0x80) {
            result += String.fromCharCode(arr[i]);
            i++;
            continue;
        }

        // 2바이트 한글 조합형 처리 영역
        if (i + 1 < arr.length) {
            const code = (arr[i] << 8) | arr[i + 1];
            // 최상위 비트가 1이면 한글 (0x8000)
            if (code & 0x8000) {
                // 인덱스 유효성 검사 및 초/중/종성 매핑 (가장 보편적인 초성 2, 중성 2, 종성 1 기본값 보정)
                // 비트 마스킹을 통한 5비트 분할 추출
                const choIdx  = (code >> 10) & 0x1F;
                const jungIdx = (code >> 5) & 0x1F;
                const jongIdx = code & 0x1F;

                // 인덱스 유효성 검사 및 초/중/종성 매핑 (가장 보편적인 초성 2, 중성 2, 종성 1 기본값 보정)
                const c = choIdx >= 2 ? choIdx - 2 : -1;
                const j = jungIdx >= 2 ? jungIdx - 2 : -1;
                const o = jongIdx >= 1 ? jongIdx - 1 : 0; // 종성 없는 경우는 0

                if (c >= 0 && j >= 0) {
                    // 현대 한글 유니코드 조합 공식 대입
                    result += String.fromCharCode(0xAC00 + (c * 21 * 28) + (j * 28) + o);
                }
            }
            i += 2;
        } else {
            i++;
        }
    }
    return result.trim();
}

/**
 * 브라우저 내장 기능 없이 CP949(완성형/EUC-KR)을 유니코드로 변환하는 대체 엔진
 * (자주 쓰이는 완성형 한글 코드 범위를 유니코드 테이블과 직접 매핑 계산)
 */
// 도스 시절 CP949(완성형 한글) 디코딩 함수
function decodeFallbackCP949(arr) {
    let result = "";
    let i = 0;

    while (i < arr.length) {
        if (arr[i] === 0) { i++; continue; }
        // 아스키 문자 처리
        if (arr[i] < 0x80) {
            result += String.fromCharCode(arr[i]);
            i++;
            continue;
        }

        // 완성형 2바이트 한글 처리 (행: 0xB0 ~ 0xC8, 열: 0xA1 ~ 0xFE 범위의 현대 한글)
        if (i + 1 < arr.length) {
            const b1 = arr[i];
            const b2 = arr[i + 1];

            if (b1 >= 0xB0 && b1 <= 0xC8 && b2 >= 0xA1 && b2 <= 0xFE) {
                const group = b1 - 0xB0;
                const index = b2 - 0xA1;
                const kscIndex = (group * 94) + index;
                
                // KSC5601 완성형 한글 배열 시작점(가)에서 유니코드 가(0xAC00) 매핑 연산
                // (일부 특수문자나 한자 제외, 순수 한글 2350자 내의 표준 배열 기준 계산)
                if (kscIndex >= 0 && kscIndex < 2350) {
                    const uniCode = 0xAC00 + kscIndex; 
                    // 완성형과 유니코드 자소 배열 순서 차이 보정을 위한 약식 변환 테이블 대입 대신
                    // 가장 널리 쓰이는 가-힇 순차 변환 수식 적용
                    result += String.fromCharCode(uniCode);
                } else {
                    result += ""; // 유효하지 않은 비트 조합 시 대체 문자
                }
            } else {
                // 한글 외 규격 외 코드는 공백 처리
                result += " ";
            }
            i += 2;
        } else {
            i++;
        }
    }
    
    // 혹시 브라우저가 euc-kr을 뒤늦게 지원할 수도 있으므로 try-catch로 교차 검증
    try {
        const decoder = new TextDecoder('euc-kr');
        return decoder.decode(arr).trim();
    } catch(err) {
        return result.trim(); // 최악의 경우 직접 계산한 한글 반환
    }
}

/**
  * 파일 내 한글 인코딩 방식을 자동 판별하여 문자열을 반환하는 안전 장치
  * 인코딩 판별 및 자동 디코딩 통합 함수
 */
function autoDecodeKorean(uint8Array) {
    // 내부 널 문자(0x00) 자르기
    const nullIndex = uint8Array.indexOf(0);
    const arr = nullIndex === -1 ? uint8Array : uint8Array.subarray(0, nullIndex);

    // 1단계: 바이너리 패턴을 분석하여 조합형 유무 임시 확인
    let isJohab = false;
    for (let i = 0; i < arr.length - 1; i++) {
        if (arr[i] >= 0x80) {
            const word = (arr[i] << 8) | arr[i + 1];
            // 상용조합형 한글은 대개 최상위 비트(0x8000)가 켜져 있으며, 특정 코드 범위를 가짐
            if ((word & 0x8000) && ((word >> 10) & 0x1F) >= 2 && ((word >> 5) & 0x1F) >= 2) {
                isJohab = true;
                break;
            }
        }
    }

    if (isJohab) {
        return decodeJohabString(arr);
    } else {
        // 상용조합형이 아닐 경우 기존 안시(완성형/CP949)로 변환
        return decodeFallbackCP949(arr);
    }
}

// 바이너리 데이터 분석 실행부
function processFile(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        handleFile(e.target.result)
    };
    reader.readAsArrayBuffer(file);
}

function handleFile(bufferArr){
        const buffer = new Uint8Array(bufferArr);
        const view = new DataView(buffer.buffer);
        let offset = 0;

        // 1. 시그니처 체크 ("sopepos")
        const sigBytes = buffer.subarray(0, 7);
        const sigStr = String.fromCharCode(...sigBytes);
        if (sigStr !== "sopepos") {
            alert("유효한 sopepos SOP 파일 형식이 아닙니다.");
            return;
        }
        document.getElementById('metaSig').innerText = sigStr;
        offset += 7; // 7

        // 2. 버전 체크
        const major = buffer[offset++]; // 8
        const minor = buffer[offset++]; // 9
        document.getElementById('metaVer').innerHTML = `<span class="badge badge-info">SOP v${major}.${minor}</span>`;

        // 3. 예약 영역 건너뛰기
        //offset += 14;
		offset++; // 10 padding
        const fileNameBytes = buffer.subarray(offset, offset + 13);
		document.getElementById('fileName').innerHTML = autoDecodeKorean(fileNameBytes) || "";
        offset += 13;  // 23

        // 4. 곡 제목 추출 (30 바이트)
        // 4. 곡 제목 추출 (30 바이트) 및 조합형 자동 해독 적용
        // 4. 곡 제목 추출 및 디코더 적용
        //const titleBytes = buffer.subarray(offset, offset + 30);
        //document.getElementById('metaTitle').innerText = autoDecodeKorean(titleBytes) || "(제목 없음)";
        var songTitle = JohabDecoder.decode(bufferArr, offset, 31) || "(제목 없음)";
		document.getElementById('metaTitle').innerText = songTitle;

        offset += 31; // 54 제목은 31바이트(30아님)

        // 5. 드럼 모드, TPB, BPM 추출 (리틀 엔디안)
        // 5. 드럼 모드, TPB, BPM 추출
        const d_mode = view.getUint16(offset, true); offset += 2; // 56
        const tpb = view.getUint16(offset, true);    offset += 2; // 58
        //const bpm = view.getUint16(offset, true);    offset += 2;
        const beatMeasure = view.getUint8(offset, true);    offset ++; //59
        const bpm = view.getUint8(offset, true);    offset ++; // 60

        document.getElementById('metaDrum').innerHTML = d_mode === 1 
            ? '<span class="badge badge-warning">리듬 드럼 모드 (11채널)</span>' 
            : '<span class="badge badge-success">일반 멜로디 모드 (9채널)</span>';
        document.getElementById('metaTpb').innerText = `${tpb} Ticks`;
        document.getElementById('beatMeasure').innerText = `${beatMeasure} beatMeasure`;
        document.getElementById('metaBpm').innerText = `${bpm} BPM`;

        // 6. 패딩 건너뛰기
        //offset += 14;
        offset += 13; // 73 comment 사용않음

        // 7. 총 채널 수 및 악기 개수
        const numChan = buffer[offset++]; // 74 트랙수
        const instNum = view.getUint16(offset, true); offset += 2; // 76 악기수 + 패딩

        document.getElementById('metaChan').innerText = `${numChan} 트랙`;
        document.getElementById('metaInstNum').innerText = `${instNum} 개`;

        // 8. 채널별 4OP 매핑 정보 출력
        const chanModeTableBody = document.querySelector('#channelModeTable tbody');
        chanModeTableBody.innerHTML = '';
        for (let i = 0; i < numChan; i++) {
            const opFlag = buffer[offset++];
            let desc = opFlag === 1 ? "OPL3 4-오퍼레이터 기능 가동 (고급 합성)[YMF-262M 4OP 모드]" : "일반 2-오퍼레이터 FM 합성 모드[YM-3812 2OP 모드]";
            chanModeTableBody.innerHTML += `<tr><td>채널 ${i + 1}</td><td><code>0x0${opFlag}</code></td><td>${desc}</td></tr>`;
        }

        // 9. 내장 악기 뱅크 리스트 출력 (악기 이름에도 조합형 변환 매핑 적용)
        // 9. 내장 악기 뱅크 리스트 출력
        const instTableBody = document.querySelector('#instBankTable tbody');
        instTableBody.innerHTML = '';
        
        for (let i = 0; i < instNum; i++) {
            const mode = buffer[offset++];
            //const instNameBytes = buffer.subarray(offset, offset + 27);
            //offset += 27;
            //const instName = autoDecodeKorean(instNameBytes) || `Instrument_${i}`;
			const instSNameBytes = buffer.subarray(offset, offset + 8);
            offset += 8;
			const instLNameBytes = buffer.subarray(offset, offset + 19);
            offset += 19;
            const instSName = autoDecodeKorean(instSNameBytes) || `Ins_${i}`;
            const instLName = autoDecodeKorean(instLNameBytes) || `Instrument_$${i}`;
            //const instName = `${instSName} / ${instLName}`;
            const instName = `${instSName}<Br>${instLName}`;

            let modeDesc = "";
            let dataSize = 0;
			let instData = [];
			let rawInstData = []; 

            if (mode === 0x0C) { // 12
                modeDesc = '<span class="badge" style="background:#7f8c8d;">미사용 (Empty)</span>';
                dataSize = 0;
            } else if (mode === 0x00) { // 멜로디 (YMF-262M, 4OP 모드)
                modeDesc = '<span class="badge badge-info">일반 FM 악기</span>';
                dataSize = 22;
                //offset += 22;
            } else {
            //    modeDesc = `<span class="badge badge-warning">변형 모드 (0x${mode.toString(16).toUpperCase()})</span>`;
				if (mode == 1) {
                    modeDesc = `<span class="badge badge-warning">(0x${mode.toString(16).toUpperCase()}) 멜로디 (YM-3812, 2OP 모드)</span>`;
				} else if (mode == 6) {
                    modeDesc = `<span class="badge badge-warning">(0x${mode.toString(16).toUpperCase()}) 베이스 드럼</span>`;
				} else if (mode == 7) {
                    modeDesc = `<span class="badge badge-warning">(0x${mode.toString(16).toUpperCase()}) 스네어 드럼</span>`;
				} else if (mode == 8) {
                    modeDesc = `<span class="badge badge-warning">(0x${mode.toString(16).toUpperCase()}) 톰 톰</span>`;
				} else if (mode == 9) {
                    modeDesc = `<span class="badge badge-warning">(0x${mode.toString(16).toUpperCase()}) 심벌</span>`;
				} else if (mode == 10) {
                    modeDesc = `<span class="badge badge-warning">(0x${mode.toString(16).toUpperCase()}) 하이햇</span>`;
				}
                dataSize = 11;
            }
			// 단순 String 배열 대신, 수식 계산을 위해 원래의 바이트(숫자) 데이터 배열을 보관합니다.
			for(var j=0; j<dataSize; j++){
				instData.push(buffer[offset+j].toString(16).padStart(2, '0').toUpperCase()); 
				rawInstData.push(buffer[offset+j]); // 숫자 값 저장
			}
            offset += dataSize;

			// --- [이 부분이 변경됩니다] ---
			// 각 행(row)의 Canvas에 접근하기 위해 고유 ID(graph_인덱스)를 부여합니다.
			// --- [수정된 타겟 영역] ---
			// 지정된 6개 모드 전체를 Canvas 렌더링 대상으로 지정합니다.
			const validModes = [0, 1, 6, 7, 8, 9, 10];
			let graphHtml = '';

			if (validModes.includes(mode)) {
			//    graphHtml = `<canvas title="[${instData.join(' ')}]" id="graph_${i}" width="250" height="48" style="background:#111; border:1px solid #333; border-radius:4px; vertical-align:middle;"></canvas>`;
				graphHtml = `<canvas title="[${instData.join(' ')}]" id="graph_${i}" width="250" height="48" style="background:#111; border:1px solid #333; border-radius:4px; vertical-align:middle;"></canvas><br><span>${instData.join(' ')}</span>`;
			} else {
				graphHtml = `<span>${instData.join(' ')}</span>`;
			}

            instTableBody.innerHTML += `
                <tr>
                    <td>${i}</td>
                    <td>${modeDesc}</td>
                    <td style="font-family:monospace;">${instName}</td>
                    <td>${dataSize} Bytes ${graphHtml}</td>
                </tr>`;

			// HTML이 동적으로 추가된 직후, Canvas가 존재하면 그래프를 그립니다.
			// 조건에 만족하는 모든 모드의 드라우잉 스크립트를 호출합니다.
			if (validModes.includes(mode)) {
				drawMinigraph(`graph_${i}`, mode, rawInstData);
			}
			// ----------------------------

        }

        // 10. 트랙별 연주 데이터 메타 정보 출력
        const trackTableBody = document.querySelector('#trackMetaTable tbody');
        trackTableBody.innerHTML = '';
		// event 코드의 설명
		let eventStr = ["", "Special Event", "Note On", "??", "Change Volume", 
		                "Change Pitch", "Instrument Change", "Set Panning"];
		let panningStr = ["right","middle","left"];

        for (let i = 0; i < numChan + 1; i++) {
            const eventCount = view.getUint16(offset, true); offset += 2;
            const trackSize = view.getUint32(offset, true);  offset += 4;
			let sopEventStr = "";
/*
			// SOP_EVENT
			for(let j=0; j<eventCount; j++){
				// Delta-ticks (change position)
				const ticks = view.getUint16(offset, true); offset += 2;
				// Event code
				const event = view.getUint8(offset); offset ++;
				
				let strData = `ticks[${ticks}], event[${event}{${eventStr[event]}}:`;
				const sopEvel = view.getUint8(offset); offset ++;
				// SOP_EVAL
				if(event == 2){
					strData += `value(${sopEvel})]`;
				}else if(event == 2){
					const length = view.getUint16(offset, true); offset += 2; // in ticks
					strData += `pitch(${sopEvel}),length(${length}) in ticks]`; 
				}else if(event == 4){
					strData += `volume(${sopEvel})]`; 
				}else if(event == 5){
					strData += `pitch(${sopEvel}) (0x64 (100) is a center value)]`; 
				}else if(event == 6){
					strData += `number(${sopEvel})]`; 
				}else if(event == 7){
					strData += `panning(${sopEvel}{${panningStr[sopEvel]}})]`; 
				}
				//sopEventStr += `<div>${strData}</div>`;
			}
*/
offset+=trackSize;

            const trackLabel = i === numChan ? "전역 제어 채널 (템포/볼륨)" : `트랙 ${i + 1}`;
            trackTableBody.innerHTML += `
                <tr>
                    <td style="font-weight:bold;">${trackLabel}</td>
                    <td>${eventCount.toLocaleString()} 개</td>
                    <td>${trackSize.toLocaleString()} Bytes</td>
					<td>${sopEventStr}</td>
                </tr>`;
        } // for (let i = 0; i < numChan + 1; i++) {

        // 결과 영역 시각화
        resultArea.classList.remove('hidden');
    
}


/**
 * 악기 데이터 바이트를 해석하여 250x48 Canvas에 파형을 그리는 함수
 * @param {string} canvasId - 대상 Canvas 태그의 ID
 * @param {number} mode - 악기 모드 (1: 멜로디, 6: 베이스드럼)
 * @param {Array<number>} rawData - 11바이트의 악기 데이터 배열

 * OPL2 악기 데이터 바이트를 해석하여 6개 모드별 파형을 250x48 Canvas에 그리는 함수
 * OPL2/OPL3 악기 데이터를 해석하여 250x48 Canvas에 파형을 그리는 통합 함수 (이탈 방지 수정본)
 */
function drawMinigraph(canvasId, mode, rawData) {
    // DOM이 완전히 렌더링된 후 그리도록 setTimeout 처리
    setTimeout(() => {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        
        const width = 250;
        const height = 48;
        const centerY = height / 2;
        
        ctx.clearRect(0, 0, width, height);
        ctx.lineWidth = 1.5;

        // 4. 기본 내장 파형(Wave Select) 지원 (0:사인파, 1:반파사인파 등 단순화 시뮬레이션)
        // 고유 파형 선택기 헬퍼 함수
        const getWave = (phase, waveSel) => {
            const sel = waveSel & 0x03;
            const sine = Math.sin(phase);
            if (sel === 1) return sine >= 0 ? sine : 0; // 반파 사인파 (Half-sine)
            if (sel === 2) return Math.abs(sine);       // 절대값 사인파 (Abs-sine)
            return sine;                                // 0: 기본 사인파 (Standard-sine)
        };

        ctx.beginPath();

        // ==========================================
        // [CASE A] 4-Operator 모드 (Mode 0 또는 12)
        // ==========================================
        if (mode === 0 || mode === 12) {
            ctx.strokeStyle = '#007aff'; // 4OP는 선명한 파란색 파형
                                         // 4OP는 파란색
            
            // 22바이트 데이터 매핑
            const op1Char     = rawData[0]  || 0; const op1Scale    = rawData[1]  || 0;
            const op1WaveSel  = rawData[4]  || 0; const op1Feedback = rawData[5]  || 0;
            const op2Char     = rawData[6]  || 0; const op2Scale    = rawData[7]  || 0;
            const op2WaveSel  = rawData[10] || 0;
            const op3Char     = rawData[11] || 0; const op3Scale    = rawData[12] || 0;
            const op3WaveSel  = rawData[15] || 0; const op3Feedback = rawData[16] || 0;
            const op4Char     = rawData[17] || 0; const op4Scale    = rawData[18] || 0;
            const op4WaveSel  = rawData[21] || 0;

            // 주파수 배율(MULT) 추출
            const m1 = (op1Char & 0x0F) === 0 ? 0.5 : (op1Char & 0x0F);
            const m2 = (op2Char & 0x0F) === 0 ? 0.5 : (op2Char & 0x0F);
            const m3 = (op3Char & 0x0F) === 0 ? 0.5 : (op3Char & 0x0F);
            const m4 = (op4Char & 0x0F) === 0 ? 0.5 : (op4Char & 0x0F);

            // 오퍼레이터별 실질 출력 볼륨 계산 (Total Level 기반)
            const v1 = ((63 - (op1Scale & 0x3F)) / 63);
            const v2 = ((63 - (op2Scale & 0x3F)) / 63);
            const v3 = ((63 - (op3Scale & 0x3F)) / 63);
            const v4 = ((63 - (op4Scale & 0x3F)) / 63);

            // 피드백 양 및 OPL3 4OP 알고리즘 커넥션(CNT) 판별
            const fbVal = (op1Feedback >> 1) & 0x07;
            const fbAmt = fbVal * 0.2;
            
            // CNT1(op1FB의 비트0)과 CNT2(op3FB의 비트0)를 조합해 4종류 결합방식 정의
            const cnt1 = op1Feedback & 0x01;
            const cnt2 = op3Feedback & 0x01;
            const algorithm = (cnt1 << 1) | cnt2;

            // 1단계: 화면 삐져나감 방지를 위한 진폭 제한(Normalization) 변수 설계
            // 알고리즘 결합 방식에 따라 수학적 최대 발생 가능 진폭이 다릅니다.
            let ampScale = 1.0; 
            switch (algorithm) {
                case 0: ampScale = 1.0; break; // 직렬 구조는 최종 오퍼레이터 1개만 출력되므로 스케일 유지
                case 1: ampScale = 0.5; break; // 두 쌍의 병렬 변조 합산 (최대 2.0 가능성) -> 0.5배 축소
                case 2: ampScale = 0.4; break; // 혼합 가산 구조 (최대 2.5 가능성) -> 0.4배 축소
                case 3: ampScale = 0.25; break; // 4개 알고리즘 단순 가산 (최대 4.0 가능성) -> 0.25배 축소
            }

            for (let x = 0; x < width; x++) {
                const t = (x / width) * Math.PI * 4;
                let finalSignal = 0;

                // Op1 자기 피드백 신호 연산
                // Op1 (자기 피드백 장치 가동)
                const o1_phase = t * m1;
                const o1 = getWave(o1_phase + fbAmt * Math.sin(o1_phase), op1WaveSel) * v1;

                switch (algorithm) {
                    case 0: // 1 -> 2 -> 3 -> 4 (직렬 직렬 변조 구조)
                        const o2_a = getWave((t * m2) + o1 * 4.0, op2WaveSel) * v2;
                        const o3_a = getWave((t * m3) + o2_a * 4.0, op3WaveSel) * v3;
                        finalSignal = getWave((t * m4) + o3_a * 4.0, op4WaveSel) * v4;
                        break;
                        
                    case 1: // (1 -> 2) + (3 -> 4) (병렬 변조 구조)
                        const o2_b = getWave((t * m2) + o1 * 4.0, op2WaveSel) * v2;
                        const o3_b = getWave(t * m3, op3WaveSel) * v3;
                        const o4_b = getWave((t * m4) + o3_b * 4.0, op4WaveSel) * v4;
                        finalSignal = (o2_b + o4_b) * ampScale; // 안전 영역으로 압축
                        break;
                        
                    case 2: // 1 + (2 -> 3 -> 4) (혼합 가산 구조)
                        const o3_c = getWave(t * m3, op3WaveSel) * v3;
                        const o4_c = getWave((t * m4) + o3_c * 4.0, op4WaveSel) * v4;
                        const o2_c = getWave((t * m2) + o4_c * 4.0, op2WaveSel) * v2;
                        finalSignal = (o1 + o2_c) * ampScale;
                        break;
                        
                    case 3: // 1 + 2 + 3 + 4 (완전 독립 가산 구조)
                        const o2_d = getWave(t * m2, op2WaveSel) * v2;
                        const o3_d = getWave(t * m3, op3WaveSel) * v3;
                        const o4_d = getWave(t * m4, op4WaveSel) * v4;
                        finalSignal = (o1 + o2_d + o3_d + o4_d) * ampScale;
                        break;
                }

                // 2. 보정된 신호를 기반으로 정확히 48px 세로축 안에 고정 정렬 (여백 10% 확보)
                const y = centerY - (finalSignal * (height * 0.40));
                
                if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
        }
        // ==========================================
        // [CASE B] 2-Operator 및 리듬 모드 (기존 동일)
        // ==========================================
        else {
			// 안전한 데이터 맵핑
			// 11바이트 OPL2 레지스터 구조 해석
			// 11바이트 OPL2 악기 데이터 구조 매핑 (인덱스 버그 수정)
			const iModChar    = rawData[0] || 0; // 0x20: Modulator 특성 (MULT 등)
			const iModScale   = rawData[1] || 0; // 0x40: Modulator 출력 레벨
			const iModAttack  = rawData[2] || 0; // 0x60: Modulator AD (엔벨로프)
			const iModSustain = rawData[3] || 0; // 0x80: Modulator SR
			const iModWaveSel = rawData[4] || 0; // 0xE0: Modulator 파형 선택
			const iFeedback   = rawData[5] || 0; // 0xC0: 피드백 및 알고리즘
			const iCarChar    = rawData[6] || 0; // 0x23: Carrier 특성
			const iCarScale   = rawData[7] || 0; // 0x43: Carrier 출력 레벨
			const iCarAttack  = rawData[8] || 0; // 0x63: Carrier AD
			const iCarSustain = rawData[9] || 0; // 0x83: Carrier SR
			const iCarWaveSel = rawData[10] || 0;// 0xE3: Carrier 파형 선택

			// 주파수 배율(MULT) 추출 (하위 4비트)
			// MULT 추출 및 파라미터 계산
			// 1. 주파수 배율(MULT) 추출 (하위 4비트, 0이면 0.5배로 연산)
            const modMult = (iModChar & 0x0F) === 0 ? 0.5 : (iModChar & 0x0F);
            const carMult = (iCarChar & 0x0F) === 0 ? 0.5 : (iCarChar & 0x0F);
			
			// 변조 지수(Modulation Index) 계산 (Total Level이 작을수록 볼륨이 크고 변조가 강함)
			// 0x40 레지스터의 하위 6비트가 Total Level (0~63)
			// 2. 변조 지수 (Modulation Index) 정밀 계산
			// 0x40 레지스터의 하위 6비트가 Total Level (0이 최대 볼륨, 63이 소리 없음)
            const modOutput = (63 - (iModScale & 0x3F)) / 63; // 0.0 ~ 1.0 실질 출력 볼륨
			const modIndex = modOutput * 5.0;                 // FM 변조 강도 가중치 변환
			// 피드백 양 결정 (0xC0 레지스터의 비트 1~3)
			// 3. 피드백 가중치 추출 (0xC0 레지스터의 1~3번 비트)
            const fbAmt = ((iFeedback >> 1) & 0x07) * 0.25;

            if (mode === 1) {
				// 1. 일반 멜로디 모드 (2OP FM)
				// [1] 일반 멜로디 모드: 순수 2OP FM 결합 파형
				// 멜로디 모드: Modulator와 Carrier의 관계가 실시간 바이트 데이터로 동적 결합됨
				ctx.strokeStyle = '#ff3b30'; // 멜로디는 빨간색 파형
											 // 빨강
            
	            // 데이터 연결 알고리즘(비트0) 검사: 0 = FM 구조, 1 = 가산 구조(Additive)
                const isAdditive = (iFeedback & 0x01) === 1;
                for (let x = 0; x < width; x++) {
					const t = (x / width) * Math.PI * 4; // 2주기 분량 해독
														 // 기본 2주기 렌더링
					
					// Modulator 신호 생성 (자기 피드백 포함)
                    const modSignal = getWave(t * modMult, iModWaveSel);
					
                    let finalSignal = 0;
                    if (isAdditive) {
	                    // 가산 합성 모드: 두 사인파를 그냥 더함
                        finalSignal = (getWave(t * carMult, iCarWaveSel) * 0.5) + (modSignal * 0.5 * modOutput);
                    } else {
	                    // FM 합성 모드: Modulator가 Carrier의 위상을 변조
                        finalSignal = getWave((t * carMult) + (modSignal * modIndex), iCarWaveSel);
                    }
					
                    const y = centerY - (finalSignal * (height * 0.4));
                    if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                }
            // --- [리듬 드럼 모드 로직 (기존과 동일)] ---
            } else if (mode === 6) {
                // 2. 베이스 드럼 모드
                // [6] 베이스 드럼: 피드백이 강력하게 걸린 압축 저음역 킥 파형
                ctx.strokeStyle = '#ff9500'; // 베이스 드럼은 주황색 파형
                                             // 주황
                // 드럼 특유의 강한 변조 지수 반영
                for (let x = 0; x < width; x++) {
                    const t = (x / width) * Math.PI * 4;
                    // 자기 피드백을 수식화한 구조
                    const modFB = Math.sin(t * modMult + fbAmt * Math.sin(t * modMult)); 
                    const finalSignal = Math.sin(t * carMult + modIndex * modFB);
                    if (x === 0) ctx.moveTo(x, centerY - (finalSignal * 20)); else ctx.lineTo(x, centerY - (finalSignal * 20));
                }
            } else if (mode === 7) {
                // [7] 스네어 드럼: 고주파 금속성 배음에 하이트 노이즈가 강하게 튀는 파형
                ctx.strokeStyle = '#34c759'; // 초록
                for (let x = 0; x < width; x++) {
                    //const noise = Math.random() * 2 - 1; // 화이트 노이즈 성분
                    const t = (x / width) * Math.PI * 8;
                    const finalSignal = (Math.sin(t * 3.5) * 0.3) + ((Math.random() * 2 - 1) * 0.4 * modOutput);
                    if (x === 0) ctx.moveTo(x, centerY - (finalSignal * 20)); else ctx.lineTo(x, centerY - (finalSignal * 20));
                }
            } else if (mode === 8) {
                // [8] 톰 톰: 베이스 드럼보단 주파수가 높고 노이즈가 없는 전형적인 미드레인지 타격 파형
                ctx.strokeStyle = '#5ac8fa'; // 하늘색
                for (let x = 0; x < width; x++) {
                    const t = (x / width) * Math.PI * 6; // 촘촘한 주기
                    const finalSignal = Math.sin(t * 1.5 + modIndex * Math.sin(t * modMult));
                    if (x === 0) ctx.moveTo(x, centerY - (finalSignal * 20)); else ctx.lineTo(x, centerY - (finalSignal * 20));
                }
            } else if (mode === 9) {
                // [9] 심벌즈: 여러 개의 고주파 정방형 사각파와 사인파가 밀도 높게 교차하는 금속 마찰 파형
                ctx.strokeStyle = '#af52de'; // 보라
                for (let x = 0; x < width; x++) {
                    const t = (x / width) * Math.PI * 16;
                    // OPL3 심벌 난수 위상 시뮬레이션
                    const finalSignal = (Math.sign(Math.sin(t * 4.1)) * 0.2) + (Math.sign(Math.sin(t * 7.3)) * 0.2) + ((Math.random() * 2 - 1) * 0.2);
                    if (x === 0) ctx.moveTo(x, centerY - (finalSignal * 20)); else ctx.lineTo(x, centerY - (finalSignal * 20));
                }
            } else if (mode === 10) {
                // [10] 하이햇: 극단적인 초고주파 펄스와 노이즈 뭉치로 이루어진 칩튠 치찰음 파형
                ctx.strokeStyle = '#ffcc00'; // 노랑
                for (let x = 0; x < width; x++) {
                    //const pulse = (x % 4 === 0) ? 0.6 : -0.2; // 가상 펄스 트리거
                    const finalSignal = ((Math.random() * 2 - 1) * 0.6 + ((x % 4 === 0) ? 0.3 : -0.1)) * modOutput;
                    if (x === 0) ctx.moveTo(x, centerY - (finalSignal * 20)); else ctx.lineTo(x, centerY - (finalSignal * 20));
                }
            }
        }

        ctx.stroke();
    }, 0);
}
