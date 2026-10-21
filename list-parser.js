	// 불러올 리스트 파일들
	// ocplay 의 리스트 파일(_IMS_).LST 만 지원
	var lstFile = [
             'dos/C_Drv/MUSIC/DATA/ALLADLIB/(_IMS_).LST'
            ,'dos/C_Drv/MUSIC/DATA/BEST/(_IMS_).LST'
            ,'dos/C_Drv/MUSIC/DATA/COLLECT/(_IMS_).LST'
            ,'dos/C_Drv/MUSIC/DATA/GAMEBGM/(_IMS_).LST'
            ,'dos/C_Drv/MUSIC/DATA/GAMEBGM/GODDES/(_IMS_).LST'
            ,'dos/C_Drv/MUSIC/DATA/IMS&ISS/(_IMS_).LST'
            ,'dos/C_Drv/MUSIC/DATA/IMSDATA/(_IMS_).LST'
            ,'dos/C_Drv/MUSIC/DATA/IMS1/(_IMS_).LST'
            ,'dos/C_Drv/MUSIC/DATA/IMS2/(_IMS_).LST'
            ,'dos/C_Drv/MUSIC/DATA/IMS3/(_IMS_).LST'
            ,'dos/C_Drv/MUSIC/DATA/IMS4/(_IMS_).LST'
            ,'dos/C_Drv/MUSIC/DATA/IMS_DATA/(_IMS_).LST'
            ,'dos/C_Drv/MUSIC/DATA/MUSIC/(_IMS_).LST'
            ,'dos/C_Drv/MUSIC/DATA/OCP/(_IMS_).LST'
            ,'dos/C_Drv/MUSIC/DATA/SONGNEW/(_IMS_).LST'
            ,'dos/C_Drv/MUSIC/MMPLAY/(_IMS_).LST'
            ,'dos/C_Drv/MUSIC/OCPLAY/(_IMS_).LST'
            ,'dos/C_Drv/MUSIC/YMPLAY/(_IMS_).LST'
        ];

// 프로토타입 확장
Number.prototype.to2 = function(){ return this < 10 ? '0' + this : this; }
Number.prototype.toDate = function(){
    var y = 80 + (this >> 9) & 0x00ff;   // [0000 000]0  0000  0000   0- 6 7비트 년 + 80 (80을 더해야 실제 년도가 됨.)
    var m = (this >> 5) & 0x000f;        //  0000 000[0  000]0 0000   7-10 4비트 월
    var d = this & 0x001f;               //  0000 0000   000[0 0000] 11-15 5비트 일
    if(y >= 100) y -= 100;
    return y.to2() + '-' + m.to2() + '-' + d.to2();
}
Number.prototype.format = function(){ 
    return new String(this).replace(/\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g, ","); 
}
Number.prototype.timeFormat = function(){ 
    return Math.floor(this / 60) + ':' + (this % 60).to2(); 
}


// 전역 관리 변수 
let songs = [];           // 곡 목록
let page_num = 20;        // 한페이지 출력할 곡 수
let show_page_num = 10;   // 페이지 숫자를 출력할 개수
let current_page = 1;     // 현재 출력된 page 번호


// 정렬
function listSort(id){
    sort.key = id;
    sort[id] = (++sort[id]) % 2;
    listPut(1);
}

// 랜덤페이지
function randomPage(){
  setTimeout(()=>{
	var total_page=parseInt((songs.length-1)/page_num)+1; // 전체 페이지 구함
	var rnd = Math.floor(Math.random()*total_page)%total_page+1;
	listPut( rnd );
  },100);
}

	// 리스트 파일 파싱
    function loadList(rs){
        var getByte = new GetByte(rs);
        //console.log('rs.response',rs.response);
        //console.log('new Uint8Array(rs.response)',new Uint8Array(rs.response));
        //uInt8Array = new Uint8Array(rs.response);

        // ocplay ims 목록 파일의 해더 정의
        function Header(){
            return {
                 head_str   : getByte(28)            //  28 문자열27Byte + EOS(0x1A,문자열끝)
                ,bankpath   : getByte(80)            // 108 기본 뱅크 파일 경로
                ,listpath   : getByte(80)            // 188 (_IMS_).LST 파일 경로
                ,cursor1    : getByte(2, 'int16')    // 190 전체 중 커서 위치
                ,cursor2    : getByte(2, 'int16')    // 192 화면 상 커서 위치
                ,songcnt    : getByte(2, 'int16')    // 194
                ,selected   : getByte(2, 'int16')    // 196 선택 곡 수
                ,sort       : getByte(2, 'int16')    // 198 정렬
                ,tmp04_3_i8 : getByte(2, 'int16')    // 199 ??
				,check_sum  : getByte(2, 'int16')    // 202 체크섬 head_str,songcnt 항목을 뺀 나머지 합산
            }
        }

        // ocplay ims 목록의 1개 item 정의
		// imsattr 는 각 비트의 역활이 있는것으로 추정됨
		// 0000 0000  0001 0000 = 파일목록에서 선택된 파일(플레이리스트에 추가됨)
		// 0000 0000  0000 0001 = 데이타 영역이  65,000 이상의 경우 44 번째가 1
		// 0000 0000  0000 0010 = 데이타 영역이 130,000 이상인 경우 44 번째가 2
		// 용량 체크 부분은 파일 용량일 수 있음. 수치도 정확하지는 않음.
		// 예외 44 번째가 0 인경우 43번째가 ff 또는 fe 인경우 1 이됨.
		// 이는 해더영역+악기이름영역 크기 포함하면 1로 바뀔 수 있음.
		// ims파일용량>>16 값이 유력함.(2026-10-17 토 보유데이타에 예외없음)
        function SongList(hdr){
            return {
                 imssize   : getByte(2, 'int16') //  2 ims 용량
                ,imsattr   : getByte(2, 'int16') //  4 선택파일 여부 (0x0010 재생목록에 추가)
                ,isssize   : getByte(2, 'int16') //  6 iss 용량
                ,issattr   : getByte(2, 'int16') //  8 뭐하는 항목일까?
                ,filename  : getByte(9)          // 17 8Byte + 0x00(1Byte)
                ,date      : getByte(2, 'int16') // 19 ims 날짜
                ,duration  : getByte(2, 'int16') // 21 재생시간
                ,title     : getByte(30)         // 51 제목
                ,index     : getByte(2, 'int16') // 53 index
                ,path      : hdr.listpath
            }
        }
        ///////////////////////////////////////////////////////////////////////

        var header = new Header();

        // ocplpay 버전별 리스트 파일 해더 크기가 다름.
//        if(header.tmp04_1_i8) header.tmp05_i16 = getByte(2, 'int16'); // 202

        //log('header', header);
        //console.log('header.songcnt',header.songcnt);
        //console.log('ajaxcounter', ajaxcounter,'header.songcnt', header.songcnt, '>', header.songcnt+songs.length);
        //console.log('ajaxcounter %2d header.songcnt %4d', ajaxcounter ,header.songcnt);
        for(var i=0; i<header.songcnt; i++){
//            isErr=false;
            //songs.push( new SongList(header) );
            var song = new SongList(header);
            song.index = songs.length; // 인덱스 덧쒸움
            songs.push( song );
            //if(isErr) log('idx',i);
            if(GetByte.isErr) log('idx',songs.length-1, );
        }
        //log('songs', songs);
    }
	
	// 여러 fetch 를 실행 및 상태 체크
	async function fetchAllData() {
	  const urls = lstFile;

	  try {
		const promises = urls.map(async (url) => {
		  const response = await fetch(url);
		  if (!response.ok) throw new Error('네트워크 에러 : '+url);
		  //return response.json();
		  //return {response:response,url:url};
		  return await response.arrayBuffer();
		  //return '성공';
		});

		// 모든 작업이 끝날 때까지 대기
		const finalData = await Promise.all(promises);
		console.log('모든 fetch 완료:', finalData.length);
		finalData.map(rs=>loadList(rs));

		randomPage();
		setLocalDb(songs);

	  } catch (error) {
		console.error('하나 이상의 fetch에서 에러 발생:', error);
	  }
	}

function downloadCSV(lines, filename) {
    const BOM = '\uFEFF'; // 엑셀 한글 깨짐 방지
    const csvContent = BOM + lines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    
    const link = document.createElement("a");
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

function downloadJSON(lines, filename) {
    const dataContent = JSON.stringify(lines);
    const blob = new Blob([dataContent], { type: 'text/csv;charset=utf-8;' });
    
    const link = document.createElement("a");
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

function setLocalDb(songs){
//    localStorage.setItem('songs', songs);
    localStorage.setItem('songs', JSON.stringify(songs));
}

function getLocalDB(){
	return JSON.parse(localStorage.getItem('songs'))||[];
}