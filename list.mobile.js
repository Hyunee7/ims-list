
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
    var searchInput = document.getElementById('search');
    var filterWord = searchInput ? searchInput.value.toUpperCase() : '';

    var list = songs.filter((el) => {
        var matchWord = el.title.replace(/[ ]/g,'').toUpperCase().indexOf(filterWord) > -1;
        return isIss ? matchWord : (matchWord && el.isssize);
    });

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
			html += '<td colSpan=5 class="title" onclick="adplug(' + list[itemNo].index + ')">' + title + '</td>';
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
    listPut(1);
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

  } catch (error) {
    console.error('하나 이상의 fetch에서 에러 발생:', error);
  }
}

// 원본 이벤트 바인딩 규격 상속 및 기기 감별 후 첫 실행
window.addEventListener("load", async ()=> {
	fetchAllData(); // ocplay 곡리스트 파일들 파싱 후 곡리스트 출력

	search.onkeydown = (ev)=>{
		if(ev.key == 'Enter') listPut(1); // 검색어 입력창에 Enter 이면 목록출력
	}
	search.onkeyup = (ev)=>{
		listPut(1); // 검색어 입력창에 Enter 이면 목록출력
	}

	show_page_num = 8; // 페이지 개수
	if(navigator.platform == 'Win32') page_num = isMobile?9:15;
	if(navigator.platform == 'iPhone'){ page_num = 6; show_page_num=5;}  // iPhoneX
	if(navigator.platform == 'Linux armv81') page_num = 20; // ALLDOCUBE iPlay40
});

/* 원본 인터페이스 액션 함수 브릿지 정의 */
function viewIss(idx) { console.log("viewIss:", songs[idx]); }
function viewIms(idx) { console.log("viewIms:", songs[idx]); }
function ocplay(idx) { console.log("ocplay:", songs[idx]); }
//function adplug(idx) { console.log("adplug:", songs[idx]); }
function hts(idx) { console.log("hts:", songs[idx]); }

// adplug 모듈로 연주
function adplug(idx){
	console.log(idx,songs[idx])
	var url = '../dos/C_Drv' + songs[idx].path.replace(/\\/g,'/').replace(/&/g,'%26').substring(2) + '/'
			+ escape(songs[idx].filename)+'.IMS&p=1';
	console.log(url);
	location.href = './adplug/?ims='+url;
}

// 화면회전등 사이즈가 변경되면 처리
window.addEventListener('resize', () => {
  //const currentWidth = window.innerWidth;
  //console.log(`현재 뷰포트 가로폭: ${currentWidth}px`);
  isMobile = window.innerWidth<600; // 가로폭이 600px 미만이면 모바일 처리
  //randomPage();
  listPut( current_page );
});

// HTTP일 경우 HTTPS로 자동 리다이렉트 (강제)하기
if (window.location.protocol !== 'https:') {
    window.location.replace(`https:${window.location.href.substring(window.location.protocol.length)}`);
}
