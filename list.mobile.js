
// 전역 관리 변수 
// 1. 브라우저 창의 뷰포트 가로폭 (스크롤바 크기 포함) -> 가장 추천
const viewportWidth = window.innerWidth;

// 2. 스크롤바를 제외한 실제 웹 문서가 표시되는 가로폭
const docWidth = document.documentElement.clientWidth;

// 3. 모니터 전체 화면의 가로폭
const screenWidth = window.screen.width;
//console.log('viewportWidth',viewportWidth);
//alert(window.innerWidth);

let isMobile = viewportWidth<600; // 가로폭이 600px 미만이면 모바일 처리
var isIphoneX = /iPhone/.test(navigator.platform); // 미사용
var isIss = true;
var sort = { 
    none: 2, filename: 2, title: 2, duration: 2, imssize: 2, isssize: 2, date: 2, 
    key: 'none', icon: [' [V]', ' [A]', ''] 
};

/* // 이걸 모바일에서 어케 확인하지?
window.addEventListener('resize', () => {
  const currentWidth = window.innerWidth;
  console.log(`현재 뷰포트 가로폭: ${currentWidth}px`);
});
*/

// 테이블 동적 출력 메인 로직
function listPut(page){
	current_page = page;
	let list = getList(); // 검색어, iss 여부 등 필터링 된 리스트 추출

    if(sort.key !== 'none'){
        var a = sort[sort.key] ? 1 : -1;
        var d = sort[sort.key] ? -1 : 1;
        list.sort((v1, v2) => v1[sort.key] > v2[sort.key] ? a : (v1[sort.key] < v2[sort.key] ? d : 0));
    }

    var total = list.length;
    document.getElementById('totalDiv').innerText = total.format();

    // 테두리 두께 조절된 테이블 출력 시작
    var html = '<table border="0" cellspacing="1">';
    //html += '<colgroup><col width="45px" /><col width="100px" /><col /><col width="55px" /><col width="75px" /><col width="80px" /><col width="85px" /></colgroup>';
	if(isMobile){
		html += '<tr><th rowSpan=2>No.</th>';
		html += '<th colSpan=5 onclick="listSort(\'title\')">MUSIC TITLE' + sort.icon[sort.title] + '</th></tr>';
		html += '<tr><th onclick="listSort(\'filename\')">FILENAME' + sort.icon[sort.filename] + '</th>';
		html += '<th onclick="listSort(\'duration\')">TIME' + sort.icon[sort.duration] + '</th>';
		html += '<th onclick="listSort(\'imssize\')">IMS_SZ' + sort.icon[sort.imssize] + '</th>';
		html += '<th id="isssize" onclick="event.stopPropagation(); listSort(\'isssize\')">ISS_SZ' + sort.icon[sort.isssize];
		html += '<input type="checkbox" id="chkIss" ' + (isIss ? '' : 'checked') + '><label for="chkIss" onclick="event.stopPropagation(); toggleIssCheckbox();"></label></th>';
		html += '<th onclick="listSort(\'date\')">DATE' + sort.icon[sort.date] + '</th></tr>';
	} else { // if(isMobile){
		html += '<tr><th>No.</th>';
		html += '<th onclick="listSort(\'filename\')">FILENAME' + sort.icon[sort.filename] + '</th>';
		html += '<th onclick="listSort(\'title\')">MUSIC TITLE' + sort.icon[sort.title] + '</th>';
		html += '<th onclick="listSort(\'duration\')">TIME' + sort.icon[sort.duration] + '</th>';
		html += '<th onclick="listSort(\'imssize\')">IMS_SZ' + sort.icon[sort.imssize] + '</th>';
		html += '<th id="isssize" onclick="event.stopPropagation(); listSort(\'isssize\')">ISS_SZ' + sort.icon[sort.isssize];
		html += '<input type="checkbox" id="chkIss" ' + (isIss ? '' : 'checked') + '><label for="chkIss" onclick="event.stopPropagation(); toggleIssCheckbox();"></label></th>';
		html += '<th onclick="listSort(\'date\')">DATE' + sort.icon[sort.date] + '</th></tr>';
	} // else { if(isMobile){
    //var html = '<table border="0" cellspacing="1">';
    var start_num = (page - 1) * page_num;
    for(var j = start_num; j < start_num + page_num; j++){
        if(j >= total) break;
        var itemNo = j;
        var listNo = itemNo + 1;
        var iss = list[itemNo].isssize;
		
		var title = list[itemNo].title;
		title = title?list[itemNo].title.replace(/[ ]/g, '&nbsp;'):'<span class="notitle">[제목없음]</span>';
		var duration = typeof list[itemNo].duration === 'number' ? list[itemNo].duration.timeFormat() : list[itemNo].duration;
        
        if(iss) iss = '<a href="javascript:viewIss(' + list[itemNo].index + ')" title="' + list[itemNo].path + '">' + iss.format() + '</a>';
        else iss = '-';

		if(isMobile){
			html += '<tr>';
			html += '<td rowSpan=2 class="center" onclick="viewIms(' + list[itemNo].index + ')">' + listNo + '</td>';
			html += '<td colSpan=5 class="title"><div><span onclick="adplug(' + list[itemNo].index + ')">' + title + '</span><input name="playlist" type="checkbox" id="playlist' + list[itemNo].index + '" value="' + list[itemNo].index + '"><label for="playlist' + list[itemNo].index + '" onclick=""></label></div></td>';
			html += '</tr>';
			
			html += '<tr>';
			html += '<td><a href="javascript:ocplay(' + list[itemNo].index + ')" title="' + list[itemNo].path + '">' + list[itemNo].filename + '</a></td>';
			html += '<td class="center" onclick="hts(' + list[itemNo].index + ')">' + duration + '</td>';
			html += '<td class="right"><a href="javascript:viewIms(' + list[itemNo].index + ')" title="' + list[itemNo].path + '">' + list[itemNo].imssize.format() + '</a></td>';
			html += '<td class="right">' + iss + '</td>';
			html += '<td class="center">' + (typeof list[itemNo].date === 'number' ? list[itemNo].date.toDate() : list[itemNo].date) + '</td>';
			html += '</tr>';
		}else{
			html += '<tr>';
			html += '<td class="center" onclick="viewIms(' + list[itemNo].index + ')">' + listNo + '</td>';
			html += '<td><a href="javascript:ocplay(' + list[itemNo].index + ')" title="' + list[itemNo].path + '">' + list[itemNo].filename + '</a></td>';
			html += '<td class="title" onclick="adplug(' + list[itemNo].index + ')">' + title + '</td>';
			html += '<td class="center" onclick="hts(' + list[itemNo].index + ')">' + duration + '</td>';
			html += '<td class="right"><a href="javascript:viewIms(' + list[itemNo].index + ')" title="' + list[itemNo].path + '">' + list[itemNo].imssize.format() + '</a></td>';
			html += '<td class="right">' + iss + '</td>';
			html += '<td class="center">' + (typeof list[itemNo].date === 'number' ? list[itemNo].date.toDate() : list[itemNo].date) + '</td>';
			html += '</tr>';
		}
    }
    html += '</table>';
    document.getElementById('listDiv').innerHTML = html;

    // 하단 페이지네이션 컴포넌트 계산
    var total_page = parseInt((total - 1) / page_num) + 1;
    var start_page = parseInt((page - 1) / show_page_num) * show_page_num;
    var i = 1;
    
    var pageHtml = '<ul class="pagination">';
    var print_page = "";

    if(page > show_page_num) {
        var prev_page = start_page;
        print_page += "<li class='page-item'><a class='page-link' href='javascript:listPut(1);'>1</a></li>";
        print_page += "<li class='page-item'><a class='page-link' href='javascript:listPut(" + prev_page + ");'>«</a></li>";
    }

    while(i + start_page <= total_page && i <= show_page_num) {
        var move_page = i + start_page;
        if(page == move_page) {
            print_page += "<li class='page-item active'><a class='page-link'>" + move_page + "</a></li>";
        } else {
            print_page += "<li class='page-item'><a class='page-link' href='javascript:listPut(" + move_page + ");'>" + move_page + "</a></li>";
        }
        i++;
    }
    pageHtml += print_page;

    if(total_page > move_page) {
        var next_page = move_page + 1;
        pageHtml += "<li class='page-item'><a class='page-link' href='javascript:listPut(" + next_page + ");'>»</a></li>";
        pageHtml += "<li class='page-item'><a class='page-link' href='javascript:listPut(" + total_page + ");'>" + total_page + "</a></li>";
    }
    pageHtml += '</ul>';
    document.getElementById('pageDiv').innerHTML = pageHtml;
}

function toggleIssCheckbox() {
    isIss = !isIss;
    //listPut(1);
	randomPage();
}

function init(){ // 곡목록 초기화
	songs = getLocalDB(); // 웹DB에서 추출
	if(songs.length) randomPage();
	else             fetchAllData(); // ocplay 곡리스트 파일들 파싱 후 곡리스트 출력
}

// 원본 이벤트 바인딩 규격 상속 및 기기 감별 후 첫 실행
window.addEventListener("load", async ()=> {
	init(); // 곡목록 추출

	search.onkeydown = (ev)=>{
		if(ev.key == 'Enter') listPut(1); // 검색어 입력창에 Enter 이면 목록출력
	}
	search.onkeyup = (ev)=>{
		listPut(1); // 검색어 입력창에 Enter 이면 목록출력
	}

	show_page_num = 8; // 페이지 개수
	if(navigator.platform == 'Win32') page_num = isMobile?11:15;
	if(navigator.platform == 'iPhone'){ page_num = 6; show_page_num=5;}  // iPhoneX
	if(navigator.platform == 'Linux armv81') page_num = 20; // ALLDOCUBE iPlay40
//alert(navigator.platform)
});

/* 원본 인터페이스 액션 함수 브릿지 정의 */
function getUrl(idx, ext='.IMS'){ // GET 방식 전달용 url 조합
	var url = '../dos/C_Drv' + songs[idx].path.replace(/\\/g,'/').replace(/&/g,'%26').substring(2) + '/'
			+ escape(songs[idx].filename)+ext;
	return encodeURIComponent(url);
}
function viewIss(idx) { // iss 파일 내용 보기
	location.href = './etc/lyric.html?url='+getUrl(idx, '.ISS')+'&p=1';
}
function viewIms(idx) { // ims 파일 내용 보기
	location.href = './etc/ims.html?url='+getUrl(idx)+'&p=1';
}
//function ocplay(idx) { console.log("ocplay:", songs[idx]); }
function hts(idx) { console.log("hts:", songs[idx]); }
    function ocplay(idx){
//        console.log(songs[idx])
        var url = 'ocplay.php?path=dos/C_Drv' + songs[idx].path.replace(/\\/g,'/').replace(/&/g,'%26').substring(2) + '/'
                + '&file=' + escape(songs[idx].filename);
//        var url = 'ocplay.php?d=1234567890';
//        console.log(url);
        /**/
        fetch(url)
            .then(res => {
                console.log(res);
                if(res.status === 200) return res.text();
                //location.href='jsdos.html'
            }).then(text =>{
                console.log(text);
                location.href=`jsdos.html?no=${text}`
            })
        /**/
    }

// adplug 모듈로 연주
// 페이지 전환시 애플계열에서 자동재생이 안되는 문제있음
// iFrame 내부 제어로 전면 개편함.
function adplug(idx){
	// iframe 으로 처리
	myIframe.contentWindow.extPlay(getSongFile(idx)); // iframe 함수 호출
	openFullscreen(); // 숨긴 div(iframe 포함된) 보이기
}
window.adp = myIframe.contentWindow; // 디버그용

// 노래목록에서 full 경로 구하기 (도스경로->서버경로)
function getSongFile(idx, ext='.IMS'){
	if(songs[idx].imsattr & 0x80) ext='';
	var url = '../dos/C_Drv'
	        + songs[idx].path.replace(/\\/g,'/')
		                     //.replace(/&/g,'%26')
				             .substring(2) + '/'
			+ songs[idx].filename+ext;
	return url;
}

// 화면회전등 사이즈가 변경되면 처리
window.addEventListener('resize', () => {
  isMobile = window.innerWidth<600; // 가로폭이 600px 미만이면 모바일 처리
  
  if(navigator.platform == 'Win32') page_num = isMobile?11:15;
//  if(navigator.platform == 'iPhone'){ page_num = 6; show_page_num=5;}  // iPhoneX
//  if(navigator.platform == 'Linux armv81') page_num = 20; // ALLDOCUBE iPlay40
  
  //randomPage();
  
  listPut( current_page );
});

// HTTP일 경우 HTTPS로 자동 리다이렉트 (강제)하기
if (window.location.protocol !== 'https:') {
    window.location.replace(`https:${window.location.href.substring(window.location.protocol.length)}`);
}

// 채크용
//  const ua = window.navigator.userAgent;
//  const vendor = window.navigator.vendor;
//alert(ua)
//alert(vendor)


// iframe 창 열기
const container = document.getElementById('container');

// 전체화면 열기 함수
function openFullscreen() {
	if(navigator.platform == 'iPhone') {
            // 1. body를 고정하여 뒷배경 스크롤과 레이아웃이 튀는 현상 방지
            document.body.classList.add('ios-fix');
            
            // 2. 블록 처리 후 iOS WebKit이 화면을 다시 그리도록(Repaint) 강제 트리거
            container.style.display = "block";
            container.style.webkitTransform = "translateZ(0)"; // 하드웨어 가속 유도
            
            // iOS 렌더링 엔진 속도에 맞춰 안전하게 강제 스크롤 최상단 이동
            window.scrollTo(0, 0);
	} else {
		// 숨겨진 div를 보이게 처리
		container.style.display = "block";
	}

	// 브라우저 Fullscreen API 실행 (div를 전체화면으로)
	//if (container.requestFullscreen) {
	//    container.requestFullscreen();
	//} else if (container.webkitRequestFullscreen) { /* 사파리 지원 */
	//    container.webkitRequestFullscreen();
	//}
	
}

// 전체화면 닫기 함수 (iframe 안에서 호출할 예정)
function closeFullscreen() {
	// 전체화면 상태라면 해제
	//if (document.fullscreenElement || document.webkitFullscreenElement) {
	//    if (document.exitFullscreen) {
	//        document.exitFullscreen();
	//    } else if (document.webkitExitFullscreen) {
	//        document.webkitExitFullscreen();
	//    }
	//}
	// 다시 div를 숨김 처리
	if(navigator.platform == 'iPhone') {
            // 1. 컨테이너를 숨김
            container.style.display = "none";
            
            // 2. body 고정 해제
            document.body.classList.remove('ios-fix');
            
            // 3. iOS 스크롤 버그 방지를 위해 가벼운 리사이즈 트리거
            window.dispatchEvent(new Event('resize'));
	} else {
		container.style.display = "none";
	}
}

// 사용자가 ESC 키를 눌러 전체화면을 나갔을 때도 div를 자동으로 숨기도록 이벤트 감지
document.addEventListener('fullscreenchange', () => {
	if (!document.fullscreenElement) {
		container.style.display = "none";
	}
});
document.addEventListener('webkitfullscreenchange', () => {
	if (!document.webkitFullscreenElement) {
		container.style.display = "none";
	}
});
