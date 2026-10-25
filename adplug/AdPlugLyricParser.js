// AdPlugLyricParser.js (Part 1/2)
/**
 * AdPlug .ISS 노래방 가사 자막 IMPlay 오리지널 바이너리 명세 정밀 파서 (가사 싱크 완치 버전)
 * AdPlug .ISS 노래방 가사 자막 IMPlay 오리지널 바이너리 명세 정밀 파서 (가사 싱크 및 실시간 하이라이트 완치 버전)
 * AdPlug .ISS 가사 싱크 및 공백 멈춤 버그 완치 버전 파서
 * AdPlug .ISS 가사 싱크 완전치료 버전 파서 (인위적 8배수 연산 전면 제거)
 * AdPlug .ISS 가사 싱크 순정 틱 버전 파서 (시간축 보정 전면 제거판)
 * AdPlug .ISS 가사 싱크 완전치료 버전 파서 (클리어 타겟 및 싱크 완치 패치판)
 * AdPlug .ISS 가사 싱크 완전치료 버전 파서 (잘못된 누적 계산식 전면 제거 및 절대 좌표 직결판)
 * AdPlug .ISS 가사 싱크 완전치료 버전 파서 (순정 타임라인 및 프레임 정밀 매핑 버전)
 * AdPlug .ISS 가사 싱크 완전치료 버전 파서 (오리지널 공백 및 고정폭 보존판)
 * AdPlug .ISS 가사 싱크 완전치료 버전 파서 (조합형 특수문자 인덱스 붕괴 완치판)
 * AdPlug .ISS 가사 싱크 완전치료 버전 파서 (인위적 스타일 배제 및 부분 하이라이트 완치판)
 * AdPlug .ISS 가사 싱크 완전치료 버전 파서 (마지막 줄 버퍼 크기 RangeError 완치판)
 * AdPlug .ISS 가사 싱크 완전치료 버전 파서 (바이트 다이렉트 슬라이싱 버전)
 * AdPlug .ISS 가사 싱크 완전치료 버전 파서 (한글 경계 가드 및 조건부 누적 엔진판)
 */
export class AdPlugLyricParser {
  constructor() {
    this.meta = { writer: "", composer: "", singer: "", editor: "" };
    this.lyrics = []; // { tick: number, line: number, runs: [][] } 실시간 타임라인 매핑 보관함
    this.currentIndex = -1;
    this.lineBytes = []; // 바이트 단위 정밀 역산을 위한 버퍼 리스트
	this.scripts = []; // 전체 가사 버퍼
  }
  
  ims = {header:null,instrument:null};
  is_ims_loaded = false;
  bnk = {header:null,names:[]};
  is_bnk_loaded = false;

  // iss 파싱
  // iss 파싱 (바이트 기반 하이라이트 인터벌 사전 실시간 추출 구조화)
  parse(arrayBuffer) {
    this.lyrics = [];
    this.currentIndex = -1;
    this.lineBytes = [];

    const u8Array = new Uint8Array(arrayBuffer);
    if (u8Array.length < 154) return []; // 비정상 iss 파일

    // 헤더 구조에서 V2 판단 (IMPlay Song V 문자열 포함 여부 검증)
    // 헤더 구조에서 V2 버전 유무 확인
    let headEnd = 0;
    while (headEnd < 154 && u8Array[headEnd] !== 0) headEnd++;
    const v2 = String.fromCharCode(...u8Array.subarray(0, headEnd)).includes("IMPlay Song V");

    let offset = 150; 

    // 메타데이터 정보 추출
    this.meta.writer   = JohabDecoder.decode(arrayBuffer,  30,  30).trim(); // 작사
    this.meta.composer = JohabDecoder.decode(arrayBuffer,  60,  30).trim(); // 작곡
    this.meta.singer   = JohabDecoder.decode(arrayBuffer,  90, 120).trim(); // 가수
    this.meta.editor   = JohabDecoder.decode(arrayBuffer, 120, 150).trim(); // 편곡

	// 제어 레코드 수
    const recCount = u8Array[offset] | (u8Array[offset + 1] << 8);
    offset += 2;
	// 가사 라인 수
    const lineCount = u8Array[offset] | (u8Array[offset + 1] << 8);
    offset += 2;

	// 제어 레코드 추출
    // 1. 제어 레코드(큐) 추출 및 시간 동기화 규격 교정
    // 1. 🎯 [순정 틱 추출]: 인위적인 8배수 연산을 완전히 배제하고 파일 내부 원본 틱 스케일 유지
    // 1. 🎯 [완전 순정 틱 사용]: 어떠한 보정이나 예외 연산 없이 파일 내 원본 stored 값을 그대로 틱으로 매핑
    // 1. 제어 레코드 추출 (오리지널 순수 틱 유지)
    // 1. 제어 레코드(큐) 수급 및 IMPlay 순정 오리지널 틱 역산
    const rawRecords = [];
    let due = 0;
    for (let i = 0; i < recCount; i++) {
      const stored = u8Array[offset] | (u8Array[offset + 1] << 8);
      const line = u8Array[offset + 2];
      const startX = u8Array[offset + 3];
      const widthX = u8Array[offset + 4];

      // 🎯 [완치 포인트 1]: 파일 내 압축된 타임 스케일을 오리지널 IMS 순정 클록 틱으로 복원 연산
      // V2 파일은 그대로 쓰고, 구버전 파일은 * 10 / 8 (비트시프트 정수연산)을 적용합니다.
      // 🎯 [완치 포인트 1]: IMPlay 소프트웨어 내부 디스어셈블 시각 동기화 공식 복원
//      const tick8 = v2 ? stored : ((stored * 10) >> 3) & 0xffff;
//      due = Math.max(due, tick8 * 8); // 시간이 역행하지 않도록 누적 상한 가드
//      due = Math.max(due, stored); // 시간이 역행하지 않도록 누적 상한 가드만 적용
//      due = Math.max(due, stored); // 시간이 거꾸로 흐르지 않게 상한 가드만 유지
      due = Math.max(due, stored); // 시간이 거꾸로 흐르지 않게 가드만 적용

      rawRecords.push({ tick: due, line, startX, widthX });
      offset += 5;
    }
window.record = rawRecords; // 디버그용

	// 가사 라인 추출
    // 2. 가사 라인 디코딩 처리
    // 가사 라인 디코딩 처리
    // 2. 가사 라인 원본 버퍼 보존 (트리밍 금지)
    // 2. 가사 라인 원본 버퍼 보존 (트리밍 및 정규식 전면 제거)
    // 🎯 [순정 고정폭 버퍼 복원]: trim()이나 replace()를 전면 차단하여 연속된 내부 공백 레이아웃을 완벽 보존합니다.
    // 2. 🎯 [완치 포인트]: 64바이트 고정 슬라이싱 범위 초과 에러 차단 방어선
    // 2. 가사 라인 오리지널 바이트 버퍼 통째로 보존
    for (let i = 0; i < lineCount; i++) {
      // 파일이 급격히 끝났을 때를 대비하여 남은 데이터의 최대 한계 오프셋을 안전하게 역산
      const availableLen = Math.min(64, u8Array.length - offset);
      if (availableLen <= 0) break; // 더 이상 읽을 데이터가 없으면 가드 탈출

      const scriptBytes = u8Array.subarray(offset, offset + availableLen);
      let end = 0;
      while (end < availableLen && scriptBytes[end] !== 0) end++;

      // 🎯 [핵심]: 문자열로 변환해두지 않고, 순수한 원본 바이너리 바이트 상태 그대로 저장합니다.
      this.lineBytes.push(scriptBytes.slice(0, end));
	  this.scripts.push(JohabDecoder.decode(arrayBuffer, offset, 64)); // 전체 가사 출력용.
		  
      offset += 64;
    }

    // 3. IMPlay 오리지널 자막 지우기(Wipe) 구간 연산 엔진 적용
    // IMPlay 오리지널 자막 지우기(Wipe) 구간 연산 엔진 적용
    // IMPlay 오리지널 자막 지우기(Wipe) 구간 연산 엔진 가동
//    this.lyricSpans = this._resolveIssSpans(rawRecords, this.lineBytes);



    // 🎯 [완치 포인트 1]: 이전 좌표 조건부 누적 연산 매커니즘 가동
    let currentLine = -1;
    let reach = 0;
    let activeRuns = [];

	// 제어 레코드 와 가사라인을 매핑
    // 4. 레코드 단위 매핑 배열 완성
    // 4. 순정 시간축 기반 1:1 결합 매핑
    // 3. 🎯 [잘못된 계산식 전면 폐기 및 절대 좌표 매핑]
    // 복잡한 큐 누적 연산을 전면 폐기하고, 각 큐가 가진 원래의 startX와 widthX 범위를 
    // 바이트에서 한글 글자 수 기준으로 다이렉트 변환하여 정확한 1:1 절대적 타임라인 생성
    // 3. 🎯 [완치 포인트 2]: 글자 단위 물리 바이트 오프셋 맵 매핑 엔진
    // 3. 🎯 [바이트 좌표 1:1 직결 매핑]
    rawRecords.forEach((rec) => {
      if (rec.line >= 0 && rec.line < this.lineBytes.length) {
        // 줄 번호가 바뀌었거나, 현재 시작 좌표(startX)가 이전 도달 범위(reach)보다 작아지면 누적 리셋!
        if (rec.line !== currentLine || rec.startX < reach) {
          currentLine = rec.line;
          activeRuns = [];
          reach = 0;
        }

        // 해당 틱 타이밍에 켜져야 하는 시작 바이트와 끝 바이트의 절대 오프셋 계산
        const fromByte = rec.startX;
        const toByte = rec.startX + rec.widthX;
        reach = toByte;

        // 새로운 영역 구간을 겹치지 않게 sorted 결합 누적
        activeRuns = this._addRun(activeRuns, fromByte, toByte);

        // 🎯 AdPlugPlayer 코어 틱과 1:1 매칭
        this.lyrics.push({
//          tick: rec.tick, // 🎯 순정 클록 틱 바인딩
          tick: rec.tick, // 🎯 순수한 바이너리 원본 틱 바인딩
          line: rec.line,
          // 각 시점마다 독립적으로 누적 보존된 바이트 맵 조각 리스트 복사
          runs: activeRuns.map(r => [...r])
        });
      }
    });

    // 틱 수로 정렬
    // 틱 수 순서대로 정렬
    // 🎯 [완치 포인트 2]: 고속 랩 구간 명령어 유실 방지를 위해 기존의 임의 중복 제거(filter) 로직 전면 폐기
    // 시간 순 정렬
    // 타임라인 시간 축 정렬
    this.lyrics.sort((a, b) => a.tick - b.tick);
//window.script = this.lyrics;	
    return this.lyrics;
  }

  _addRun(runs, from, to) {
    const merged = [];
    for (const [a, b] of runs) {
      if (b < from || a > to) merged.push([a, b]);
      else { from = Math.min(from, a); to = Math.max(to, b); }
    }
    merged.push([from, to]);
    return merged.sort((x, y) => x[0] - y[0]);
  }
// AdPlugLyricParser.js (Part 2/2)

  /**
   * 🎯 [실시간 동적 자막 서칭 엔진 교정]:
   * null 차단 방식을 걷어내고 현재 틱에 매핑되는 자막 정보를 무정지 리포트하여 
   * 일시정지 해제나 뒤로가기/앞으로가기(Seek) 시에도 싱크가 실시간 칼같이 맞도록 설계
   * 실시간 동적 자막 서칭 및 렌더링에 적합한 데이터 구조 스냅샷 리포트
   * 🎯 [실시간 정밀 선형 보간 자막 서칭 엔진]
   * 뭉터기로 끊겨서 진행되는 자막 효과를 프레임 단위로 부드럽게 흐르도록 보간 연산 수행
   * 🎯 [실시간 프레임 선형 보간 자막 검색 엔진]
   * 순정 시간축 위에서 가사 조각 사이사이를 부드럽게 실시간 계산하여 흐르게 함
   * 🎯 [순정 틱 실시간 선형 보간 검색 엔진]
   * 뭉터기 현상을 방지하기 위해 순수 틱 사이사이를 글자수 비율에 맞춰 프레임 단위로 실시간 보간
   * 🎯 [정밀 선형 보간 엔진 교정]
   * 🎯 [절대 좌표 프레임 선형 보간 자막 검색 엔진]
   * 순정 시간축 위에서 가사 하이라이트가 프레임 단위로 밀리거나 끊김 없이 부드럽게 연산되도록 가동
   * 🎯 [글자 개수 기반 실시간 선형 보간 검색 엔진]
   * 바이트 오프셋 왜곡을 원천 차단하고 오직 정밀 계산된 글자 수를 프레임 단위로 밀어 자막 와이프 구현
   * 🎯 [글자 개수 기반 실시간 선형 보간 검색 엔진 - 후행 공백 유실 완치판]
   * 🎯 [절대 글자 수 스케일 선형 보간 검색 엔진]
   * 🎯 [유동적 부분 하이라이트 선형 보간 검색 엔진]
   * 🎯 [실시간 바이트 슬라이싱 보간 검색 엔진]
   * 자바스크립트의 문자열 길이 한계를 우회하고 파일 오리지널 바이트 스케일 위에서 직접 자막 연산
   * 🎯 [한글 깨짐 가드 + 실시간 바이트 결합 추적 검색 엔진]
   */
  update(currentTick) {
    if (this.lyrics.length === 0) return null;
    
    // 1. 현재 틱에 걸치거나 지나간 자막 레코드(현재 상태) 찾기
    // 1. 현재 타임라인 틱에 위치한 자막 인덱스 서칭
    let activeIndex = -1;
    for (let i = 0; i < this.lyrics.length; i++) {
      if (currentTick >= this.lyrics[i].tick) {
        activeIndex = i;
      } else {
        break;
      }
    }

    this.currentIndex = activeIndex;

    // 가사가 아직 시작되지 않은 초반 대기 상태
    if (activeIndex < 0) {
      return { line: 0, textRuns: [{ text: "                          🎵 (간주 중)", lit: false }] };
    }

    const currentLyric = this.lyrics[activeIndex];
    const rawBytes = this.lineBytes[currentLyric.line] ?? new Uint8Array(0);

    // 🎯 [완치 포인트 2]: 현재 틱에 활성화되어 켜져야 하는 누적 바이트 구간 정보 수령
    let activeRuns = currentLyric.runs;

    // 마지막 가사 레코드이거나, 다음 레코드와 줄(line) 번호가 다르다면 보간을 하지 않고 최종 상태 유지
    // 마지막 가사이거나 다음 가사와 다른 줄이라면 최종 상태 고정 노출
    // 마지막 자막 프레임이거나 다음 자막과 줄(Line) 번호가 바뀌는 구간이면 보간 없이 고정 출력
    // 마지막 프레임이거나 다음 자막으로 줄바꿈이 일어나는 순간이면 최종 상태 고정
    // 마지막 프레임이 아니며 줄바꿈이 없는 경우 실시간 바이트 보간 연산 개시
    // 실시간 선형 보간 처리 (다음 명령어와 같은 줄일 때만 인터벌 매핑)
    if (activeIndex < this.lyrics.length - 1 && currentLyric.line === this.lyrics[activeIndex + 1].line) {
      // 2. 부드러운 진행을 위한 다음 레코드 역산
      const nextLyric = this.lyrics[activeIndex + 1];
      // 두 가사 레코드 사이의 시간(Tick) 폭 계산
      const tickDuration = nextLyric.tick - currentLyric.tick;

      if (tickDuration > 0) {
        // 현재 시간이 두 레코드 사이에서 몇 % 진행되었는지 비율(0.0 ~ 1.0) 계산
        // 두 자막 프레임 사이의 진행 비율 연산 (0.0 ~ 1.0)
        // 2. 두 자막 프레임 사이의 실시간 진행 비율 연산 (0.0 ~ 1.0)
        const progressRatio = (currentTick - currentLyric.tick) / tickDuration;
        
        // 현재 보간 중인 유동적인 끝 자락 구간만 progressRatio 비율로 연장 연산
        if (nextLyric.runs.length > 0 && activeRuns.length > 0) {
          const lastIdx = activeRuns.length - 1;
          const nextLastIdx = nextLyric.runs.length - 1;
          
          if (nextLyric.runs[nextLastIdx][0] >= activeRuns[lastIdx][0]) {
            // 🎯 [완치 포인트 3]: 중간 단어부터 켜지는 버그 해결
            // 다음 명령어의 타겟 글자 수가 현재보다 작아진다면 마디가 새로 시작되는 것이므로 기저점을 0으로 강제 세팅
            const currentEnd = activeRuns[lastIdx][1];
            const nextEnd = nextLyric.runs[nextLastIdx][1];
            
            // 3. 🎯 [선형 보간 공식 가동] 
            // 현재 레코드의 하이라이트 끝 지점과 다음 레코드의 하이라이트 끝 지점 사이를 실시간 비율로 채움
            // 하이라이트 글자수 위치 실시간 보간
            // 절대 좌표 기준 실시간 글자수 위치 선형 보간
            // 글자 수 스케일 위에서 부드럽게 실시간 선형 보간 수행
            // 🎯 [완치 포인트 2]: 시작 지점(start)과 끝 지점(end)을 각각 독립적으로 선형 보간 연산 수행
            // 이를 통해 하이라이트가 항상 왼쪽(0)부터가 아니라, 실제 중간 단어 위치에서 유동적으로 출발하고 이동하게 됩니다.
            // 실시간 연장된 끝 바이트 오프셋 계산
            const interpolatedEnd = currentEnd + (nextEnd - currentEnd) * progressRatio;
            activeRuns = activeRuns.map((r, idx) => idx === lastIdx ? [r[0], Math.round(interpolatedEnd)] : r);
          }
        }
      }
    }

    // 🎯 [완치 포인트 3]: 한글 2바이트 및 특수문자 잘림 방지 (글자 경계선 강제 정렬 기술)
    // 칠해진 영역(lit)과 안 칠해진 영역을 글자 단위로 완벽하게 복원 매핑하여 텍스트 토큰 배열로 빌드
    const textRuns = [];
    let byteIdx = 0;

    while (byteIdx < rawBytes.length) {
      const start = byteIdx;
      // 현재 바이트가 ASCII인지 고전 2바이트 조합형 글자/특수문자인지 엄격히 스캔 판정
      if (rawBytes[byteIdx] < 0x80) byteIdx += 1;
      else byteIdx += 2;
      const end = byteIdx;

      // 이 온전한 한 글자가 불이 켜진 누적 바이트 구간(activeRuns) 내부에 속하는지 대조 판별
      const isLit = activeRuns.some(([rStart, rEnd]) => start >= rStart && end <= rEnd);
      const singleCharByte = rawBytes.subarray(start, end);
      const charText = JohabDecoder.decode(singleCharByte.buffer, singleCharByte.byteOffset, singleCharByte.byteLength);

      // 동일한 상태(불 켜짐 여부)를 가진 인접한 문자들을 하나로 묶어 결합 성능 최적화
      if (textRuns.length > 0 && textRuns[textRuns.length - 1].lit === isLit) {
        textRuns[textRuns.length - 1].text += charText;
      } else {
        textRuns.push({ text: charText, lit: isLit });
      }
    }

	this.currentIndex = currentLyric.line; // 전체가사 창 매핑용

    return {
      line: currentLyric.line,
      textRuns // 🎯 app.js가 바로 루프 돌며 출력할 수 있는 조각 배열 전달
    };
  }

  // 재설정
  reset() {
    this.lineBytes = []; // 가사배열
	this.scripts = []; // 가사라인
    this.currentIndex = -1; // 가사 배열 위치
    this.is_ims_loaded = false; // ims 적재 여부
    this.is_bnk_loaded = false; // bnk 적재 여부
  }

  // ims 파서
  parse_ims(arrayBuffer){
    const u8Array = new Uint8Array(arrayBuffer);
    const dataView = new DataView(arrayBuffer);
	let header = {
			 majorVersion : 0  //  1, 'int8'   1    주 버전 번호(일반적으로 1)
			,minorVersion : 0  //  1, 'int8'   2    부 버전 번호(일반적으로 0)
			,tuneld       : 0  //  4, 'int32'  6    노래 식별 번호
			,tuneName     : "" // 30          36    노래 제목, null 종료
			,tickBeat     : 0  //  1, 'int8'  37    비트당 틱 수
			,beatMeasure  : 0  //  1, 'int8'  38    소절당 비트수
			,totalTick    : 0  //  4, 'int32' 42    노래의 길이(틱)
			,dataSize     : 0  //  4, 'int32' 46    MIDI 데이터 블록의 길이(바이트)
			,nrCommand    : 0  //  4, 'int32' 50    MIDI 이벤트 수 (0xFC:종료 포함)
			,srctickBeat  : 0  //  1, 'int8'  51    0 (이외 값은 발견하지 못함.)
			,filler       : 0  //  7          58    패딩, 0으로 설정

			,soundMode    : 0  //  1, 'int8'  59   OPL 리듬 모드: 0=멜로딕(꺼짐), 1=타악기(켜짐)
			,pitchBRange  : 0  //  1, 'int8'  60    피치벤드 범위(1-12)

			,basicTempo   : 0  //  2, 'int16' 62    노래 템포, 분당 비트 수.
			,filler2      : 0  //  8          70    패딩, 0으로 설정
	}
	let instrument = {
		count  : 0,   // 악기수
		names  : [],  // 악기명
		mapped : 0    // bnk 매핑 수
	}
    if (dataView.length < 70) return header; // 70 바이트보다 작으면 종료
	
	header.majorVersion = dataView.getUint8 ( 0      ) //  1    주 버전 번호(일반적으로 1)
	header.minorVersion = dataView.getUint8 ( 1      ) //  2    부 버전 번호(일반적으로 0)
	header.tuneld       = dataView.getUint32( 2, true) //  6    노래 식별 번호
	header.tuneName     = JohabDecoder.decode(arrayBuffer, 6, 30) // 36    노래 제목, null 종료
	header.tickBeat     = dataView.getUint8 (36      ) // 37    비트당 틱 수
	header.beatMeasure  = dataView.getUint8 (37      ) // 38    소절당 비트수
	header.totalTick    = dataView.getUint32(38, true) // 42    노래의 길이(틱)
	header.dataSize     = dataView.getUint32(42, true) // 46    MIDI 데이터 블록의 길이(바이트)
	header.nrCommand    = dataView.getUint32(46, true) // 50    MIDI 이벤트 수 (0xFC:종료 포함)
	header.srctickBeat  = dataView.getUint8 (50      ) // 51    0 (이외 값은 발견하지 못함.)
	header.soundMode    = dataView.getUint8 (58      ) // 59   OPL 리듬 모드: 0=멜로딕(꺼짐), 1=타악기(켜짐)
	header.pitchBRange  = dataView.getUint8 (59      ) // 60    피치벤드 범위(1-12)
	header.basicTempo   = dataView.getUint16(60, true) // 62    노래 템포, 분당 비트 수.
	
	instrument.count = dataView.getUint16(header.dataSize + 72, true) // 72 : header + 'ww'
    const inst_name_size = 9;
    for(let i=0; i<instrument.count; i++){
      const offset = header.dataSize + 74 + inst_name_size*i; // 74 : header(70) + ww(2) + Uint16(2)
      instrument.names.push( this.get_string(u8Array,offset,inst_name_size) );
    }
    this.ims = { header:header, instrument:instrument};
    this.is_ims_loaded = true;

	this.mapping(); //악기매핑수

    return this.ims;
  }
  
  // 문자열 추출
  get_string(buffer,start,length){
    const cutbuf = buffer.slice(start, start+length);
    const cutbuf_end_index = cutbuf.indexOf(0);
    const str = new TextDecoder('utf-8').decode(cutbuf.slice(0,cutbuf_end_index));
    return str;
  }

  // bnk 파서
  parse_bnk(arrayBuffer){
    const u8Array = new Uint8Array(arrayBuffer);
    const view = new DataView(arrayBuffer);
    let bnkHeader = {}; 
    bnkHeader.majorVersion = view.getUint8(0);
    bnkHeader.minorVersion = view.getUint8(1);
    let sigChars = []; // 시그니처 버퍼 
    for(let i=0; i<6; i++) sigChars.push(String.fromCharCode(view.getUint8(2+i)));
    bnkHeader.sig = sigChars.join('');
    bnkHeader.ins_num = view.getInt16(8, true); // 사용 악기수
	bnkHeader.max_num = view.getInt16(10, true); // 전체 악기수
    bnkHeader.offsetList = view.getInt32(12, true); // 악기명 시작 offset
	bnkHeader.offsetTimber = view.getInt32(16, true); // 악기소리정보 시작 offset
    let bnkInsNames = []; // 악기명 버퍼
    let listPos = bnkHeader.offsetList;
    for(let i=0; i<bnkHeader.max_num; i++) {
      let idx = view.getInt16(listPos, true);
      let active = view.getUint8(listPos + 2);
      let nameChars = [];
      for(let n=0; n<9; n++) {
        let c = view.getUint8(listPos + 3 + n);
        if(c !== 0) nameChars.push(String.fromCharCode(c));
      }
      let name = nameChars.join('');
      bnkInsNames.push({ index: idx, active: active, name: name });
      listPos += 12;
    }
	/* 악기정보 - 사용할 곳이 없음.
    bnkTimbres = []; let timbrePos = bnkHeader.offsetTimber;
    for(let i=0; i<bnkHeader.max_num; i++) {
        let timbre = {
            mode: view.getUint8(timbrePos), voice: view.getUint8(timbrePos + 1),
            mod: { ksl: view.getUint8(timbrePos+2), multiple: view.getUint8(timbrePos+3), feedback: view.getUint8(timbrePos+4), attack: view.getUint8(timbrePos+5), sustLevel: view.getUint8(timbrePos+6), envelopeGain: view.getUint8(timbrePos+7), decay: view.getUint8(timbrePos+8), releaseRate: view.getUint8(timbrePos+9), totalLevel: view.getUint8(timbrePos+10), am: view.getUint8(timbrePos+11), vib: view.getUint8(timbrePos+12), ksr: view.getUint8(timbrePos+13), con: view.getUint8(timbrePos+14) },
            car: { ksl: view.getUint8(timbrePos+15), multiple: view.getUint8(timbrePos+16), feedback: view.getUint8(timbrePos+17), attack: view.getUint8(timbrePos+18), sustLevel: view.getUint8(timbrePos+19), envelopeGain: view.getUint8(timbrePos+20), decay: view.getUint8(timbrePos+21), releaseRate: view.getUint8(timbrePos+22), totalLevel: view.getUint8(timbrePos+23), am: view.getUint8(timbrePos+24), vib: view.getUint8(timbrePos+25), ksr: view.getUint8(timbrePos+26), con: view.getUint8(timbrePos+27) },
            wave0: view.getUint8(timbrePos + 28), wave1: view.getUint8(timbrePos + 29)
        }; bnkTimbres.push(timbre); timbrePos += 30;
    }
	*/
	
    this.bnk.header = bnkHeader;
    this.bnk.names = bnkInsNames;
    this.is_bnk_loaded = true;
	this.mapping(); //악기매핑수
    return this.bnk;
  }
  
  // 악기 매칭 개수 구함
  mapping(){
    if(!this.is_ims_loaded || !this.is_bnk_loaded) return;
	this.ims.instrument.mapped = 0; // 중복 누적 보정용

	// 악기명 매칭 개수 구함
    this.ims.instrument.names.forEach(name=>{
      if(this.bnk.names.some(item=>item.name.toUpperCase()==name.toUpperCase())) this.ims.instrument.mapped ++;
    });
  }
  
  // 악기 수 및 매칭 개수 정보
  get_mapped_instrument(){
    if(!this.is_ims_loaded || !this.is_bnk_loaded) return null;
    return { mapped:this.ims.instrument.mapped, ims :this.ims.instrument.count, bnk :this.bnk.header.ins_num };
  }
}
