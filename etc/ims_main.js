document.addEventListener("DOMContentLoaded", function() {
    var fileInput = document.getElementById('imsFile');
    var fileNameDiv = document.getElementById('fileName');
    var resultDiv = document.getElementById('result');
    var tableBody = document.getElementById('eventTableBody');
    var instListUl = document.getElementById('resInstList');
	
  const dropZone = document.getElementById('drop-zone');
  console.log('dropZone',dropZone)
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.style.borderColor = '#4f46e5'; });
  dropZone.addEventListener('dragleave', () => { dropZone.style.borderColor = '#c7d2fe'; });
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = '#c7d2fe';
    if (e.dataTransfer.files.length > 0) handleFile(e.dataTransfer.files);
  });


    if (!fileInput) return;

    fileInput.addEventListener('change', function(e) {
        //var files = e.target.files;
	    if (e.target.files.length > 0) handleFile(e.target.files);
    });
        
	function handleFile(fileList) {
        // 사용자가 취소를 눌렀을 때의 안정적인 예외 방어 조치
        if (!fileList || fileList.length === 0) {
            fileNameDiv.innerText = "선택된 파일이 없습니다.";
            return;
        }

        var file = fileList[0];
        fileNameDiv.innerText = file.name;

        var reader = new FileReader();
        reader.onload = function(event) {
            var buffer = event.target.result;
            renderResult(buffer);
         };

        reader.readAsArrayBuffer(file);
    }

	function renderResult(buffer){
           // 1. 코어 파서 엔진 인스턴스 생성 및 연산 실행
            var parser = new ImsCoreParser(buffer);
            try {
                parser.parse();
            } catch (err) {
                document.getElementById('metaInfo').classList.add('error');
                document.getElementById('resTitle').innerText = "파싱 실패 (손상된 포맷)";
                console.error(err);
                return;
            }

            // 2. 파싱된 데이터 구조체 필드 UI 매핑
            resultDiv.style.display = 'block';
            tableBody.innerHTML = '';
            instListUl.innerHTML = '';
            document.getElementById('metaInfo').classList.remove('error');

            document.getElementById('resVersion').innerText = parser.header.nVerMajor + "." + parser.header.nVerMinor;
            document.getElementById('resTuneID').innerText = parser.header.nTuneID;
            document.getElementById('resTitle').innerText = parser.header.szTuneName ? parser.header.szTuneName : "(곡명 비어있음)";
            document.getElementById('resBeatInfo').innerText = parser.header.nTickBeat + " Ticks / " + parser.header.nBeatMeasure + " Beats";
            document.getElementById('resTotalTick').innerText = parser.header.nTotalTick;
            document.getElementById('resDataSize').innerText = parser.header.cbDataSize + " Bytes";
            document.getElementById('resCommandCount').innerText = parser.header.nrCommand;
            document.getElementById('resSrcTickBeat').innerText = parser.header.nSrcTickBeat;
            document.getElementById('resSoundMode').innerText = parser.header.nSoundMode;
            document.getElementById('resPitchRange').innerText = parser.header.nPitchBRange;
            document.getElementById('resBasicTempo').innerText = parser.header.nBasicTempo;

            // 재생 시간 연산 출력
            var ticksPerMin = parser.header.nBasicTempo * parser.header.nTickBeat;
            var ticksPerSec = ticksPerMin / 60;
            var totalSec = ticksPerSec > 0 ? Math.floor(parser.header.nTotalTick / ticksPerSec) : 0;
            var min = Math.floor(totalSec / 60);
            var sec = totalSec % 60;
            document.getElementById('resDuration').innerText = min + "분 " + sec + "초 (" + totalSec + "초)";
            document.getElementById('resInstCount').innerText = parser.header.instCount + " 개";

            // 3. 악기 리스트 화면 출력
            parser.instruments.forEach(function(inst) {
                var li = document.createElement('li');
                li.className = 'instrument-item';
                li.innerText = "Index [" + inst.index + "]: " + inst.name;
                instListUl.appendChild(li);
            });

            // 4. 대용량 미디 스트림 로그 렌더링 최적화 루프
            var rowsHtml = "";
            var logLimit = Math.min(parser.events.length, 2000);

            for (var i = 0; i < logLimit; i++) {
                var ev = parser.events[i];
                var delaySpan = ev.delayTime > 0 ? ' <span class="status-delay">[대기 지연: +' + ev.delayTime + ' Ticks]</span>' : '';
                
                rowsHtml += '<tr>' +
                    '<td>' + ev.offset + '</td>' +
                    '<td>' + ev.tick + '</td>' +
                    '<td class="' + ev.cssClass + '">' + ev.statusHex + '</td>' +
                    '<td class="' + ev.cssClass + '">' + ev.eventName + '</td>' +
                    '<td>' + ev.detail + delaySpan + '</td>' +
                '</tr>';

                if (ev.isSongEnd) {
                    rowsHtml += '<tr class="status-end"><td colspan="5">⏹ 0xFC 종료 마커 감지 - 시퀀스 해석 마침</td></tr>';
                }
            }

            tableBody.innerHTML = rowsHtml;
            if (parser.events.length > 2000) {
                tableBody.innerHTML += '<tr class="status-limit"><td colspan="5">... 브라우저 최적화를 위해 상위 2000개의 이벤트 스트림만 출력되었습니다 ...</td></tr>';
            }
	}
	
	///////////////////////////////////////////////////////////////////////////
    // 1. 주소창의 쿼리 스트링에서 'url' 파라미터 값을 가져옵니다.
    const urlParams = new URLSearchParams(window.location.search);
    const targetUrl = urlParams.get('url');

    // 'url' 파라미터가 존재할 때만 실행합니다.
    if (targetUrl) {
        fetchAndDisplay(targetUrl);
    }

	async function fetchAndDisplay(url) {
		const outputView = document.getElementById('result');
		
		if (!outputView) {
			console.error("id='output-view' 엘리먼트를 찾을 수 없습니다.");
			return;
		}

		try {
			// 2. 입력받은 URL을 fetch 합니다.
			const response = await fetch(url);
			
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}
			
			//const data = await response.text(); // 또는 필요에 따라 response.json() 사용
			
			// 3. 내용을 화면에 보여줍니다.
			//outputView.innerHTML = data; 
			const arrayBuffer = await response.arrayBuffer();
			const dataView = new DataView(arrayBuffer);
			const uint8Array = new Uint8Array(arrayBuffer);
			
			renderResult(arrayBuffer);

			// 4. 내용을 보여준 직후 id=output-view를 최상단으로 스무스하게 이동시킵니다.
			outputView.scrollIntoView({ 
				behavior: 'smooth', 
				block: 'start' 
			});

		} catch (error) {
			console.error('Fetch 실패:', error);
			outputView.innerHTML = `<p style="color: red;">데이터를 불러오는 중 오류가 발생했습니다: ${error.message}</p>`;
		}
	}

});
