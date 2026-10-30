    //import {lib} from './lib.js';

    function log() {
        console.log.apply(console
            , [new Date().toJSON()].concat(Array.prototype.slice.call(arguments, 0)) );
    }

var isIphoneX = navigator.platform == 'iPhone';
var ajaxcounter = 0;
var _xhr;
    function Ajax(url,callback){
        //console.log(new Date().toISOString(), 'start');
        var xhr = new XMLHttpRequest();
        ajaxcounter++;
//_xhr = xhr
        xhr.open('GET', url, true);
//        xhr.open('GET', url, false);
        xhr.responseType = 'arraybuffer';
        xhr.withCredentials = true;
        xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest'); xhr.setRequestHeader('Access-Control-Allow-Origin', '*');

        // via Cache-Control header:
        xhr.setRequestHeader("Cache-Control", "no-cache, no-store, max-age=0");

        // fallbacks for IE and older browsers:
        xhr.setRequestHeader("Expires", "Tue, 01 Jan 1980 1:00:00 GMT");
        xhr.setRequestHeader("Pragma", "no-cache"); //Edit: I noticed this is required for Chrome some time ago... forgot to mention here

        // Process the response when the request is ready.
        xhr.onload = function(e) {
          if (this.status == 200) {
              //callback(this.response);
              //log('xhr.responseURL',xhr.responseURL);
              loadList(this.response)
              ajaxcounter--;
              //console.log('ajaxcounter',ajaxcounter)
              //if(!ajaxcounter) listPut(1);
              if(!ajaxcounter){
                  setTimeout(()=>{
                    var total_page=parseInt((songs.length-1)/page_num)+1; // 전체 페이지 구함
                    var rnd = Math.floor(Math.random()*total_page)%total_page+1;
                    listPut( rnd );
                  },100);
              }
          }
        };
        xhr.send();
    }

    var isIss = true;
    //var isFilename = true;
    //var isTitle = true;
    // 정렬관련 변수
    var sort={none:2,filename:2,title:2,duration:2,imssize:2,isssize:2,date:2
             ,key:'none',icon:['▽','△','']};

    // 리스트를 페이지 단위로 출력하는 함수
    function listPut(page){
        //console.log(new Date().toISOString(), 'listPut Start');
        //var list = songs.filter( (el)=>{return el.title.indexOf(search.value)>-1} );

        var list = songs.filter( (el)=>{ // 검색어가 있는경우 검색어를 필터함.
                if(isIss){
                    return el.title.replace(/[ ]/g,'').toUpperCase()
                            .indexOf(search.value.toUpperCase())>-1;
                } else { // iss가 있는것만 보는 경우
                    return el.title.replace(/[ ]/g,'').toUpperCase()
                            .indexOf(search.value.toUpperCase())>-1 && el.isssize;
                }
            } );
        if(sort.key!='none'){
            var a = sort[sort.key]? 1:-1;
            var d = sort[sort.key]?-1: 1;
            list.sort( (v1,v2)=>{return v1[sort.key]>v2[sort.key]?a:v1[sort.key]<v2[sort.key]?d:0;} )
        }

        //console.log(list);
        var total = list.length;
        totalDiv.innerText = total.format();
        var html='<table border=0 cellspacing=1 style="table-layout: fixed;">'
        html += '<colgroup><col width="40px" /><col width="85px" /><col /><col width="40px" /><col width="70px" /><col width="60px" /><col width="80px" /></colgroup>';
        html += '<tr><th>No.</th>';
        html += '<th onclick="listSort(\'filename\')">파일명'+sort.icon[sort.filename]+'</th>';
        html += '<th onclick="listSort(\'title\')">노래 제목'+sort.icon[sort.title]+'</th>';
        html += '<th onclick="listSort(\'duration\')">시간'+sort.icon[sort.duration]+'</th>'
        html += '<th onclick="listSort(\'imssize\')">Ims'+sort.icon[sort.imssize]+'</th>';
        html += '<th id=isssize><a href=javascript:listSort("isssize")>Iss</a>'
              +sort.icon[sort.isssize]
              +'<input type="checkbox" id="chkIss"'+(isIss?'':' checked')+'><label for="chkIss"></label></th>';
        html += '<th onclick="listSort(\'date\')"'+sort.icon[sort.date]+'>Date</th></tr>';
        var start_num=(page-1)*page_num; // 페이지 수에 따른 출력시 첫번째가 될 글의 번호 구함
        //log('total', total);
        //log('start_num', start_num);
        for(var j=start_num; j<start_num+page_num; j++){
            //log('j',j);
            if(j>=total) break;
            var itemNo = j;
            var listNo = itemNo + 1;
            var iss = list[itemNo].isssize;
            if(iss) iss = '<a href="javascript:viewIss('+list[itemNo].index+')" title="'+list[itemNo].path+'">'+ iss.format() +'</a>';
            else    iss = '-'; //'&lt;None>';
            html += '<tr>';
            html += '<td align=center onclick="viewIms('+list[itemNo].index+')">'+ listNo +'</td>';
            html += '<td><a href="javascript:ocplay('+list[itemNo].index+')" title="'+list[itemNo].path+'">'+ list[itemNo].filename +'</a></td>';
            //html += '<td><a href="javascript:viewIss('+list[itemNo].index+')">'+ list[itemNo].title.replace(/[ ]/g,'&nbsp;') +'</a></td>';
            html += '<td class="title" onclick="adplug('+list[itemNo].index+')">'+ list[itemNo].title.replace(/[ ]/g,'&nbsp;') +'</td>';
            //html += '<td class="title"><pre>'+ list[itemNo].title +'</pre></td>';
            html += '<td align=center onclick="hts('+list[itemNo].index+')">'+ list[itemNo].duration.timeFormat() +'</td>';
            html += '<td align=right><a href="javascript:viewIms('+list[itemNo].index+')" title="'+list[itemNo].path+'">'+ list[itemNo].imssize.format() +'</a></td>';
            //html += '<td align=right><a href="javascript:viewIss('+list[itemNo].index+')">'+ list[itemNo].isssize.format() +'</a></td>';
            html += `<td align=right>${iss}</td>`;
            html += '<td align=center>'+ list[itemNo].date.toDate() +'</td>';
            html += '</tr>';
        }
        html += '</table>';
        listDiv.innerHTML = html;

        var total_page=parseInt((total-1)/page_num)+1; // 전체 페이지 구함
        var start_page=parseInt((page-1)/show_page_num)*show_page_num;
        //log('start_page', start_page);
        var i=1;
        var print_page="";
        var move_page = 1; // ??


        //log('total_page', total_page);
        var align = isIphoneX?'':' justify-content-center';
        html = '<nav class="d-flex flex-column"><ul class="pagination'+align+'">';

        var a_1_prev_page= "";
        var a_1_next_page= "";
        var a_prev_page = "";
        var a_next_page = "";

        //if(page>1) a_1_prev_page="<li><a href='javascript:listPut("+(page-1)+")'>이전</a>&nbsp;</li>";
        //if(page<total_page) a_1_next_page="<li>&nbsp;<a href='javascript:listPut("+(page+1)+")'>다음</a></li>";

        if(page>show_page_num) {
            prev_page=start_page;
            a_prev_page="<li class=page-item><a class=page-link href='javascript:listPut("+prev_page+");'>《</a></li>";
            //print_page+="<li><a href='javascript:listPut("+1+")'>1</a>&nbsp;...&nbsp;</li>";
            print_page+="<li class=page-item><a class=page-link href='javascript:listPut("+1+");'>1</a></li>";
        }

        while(i+start_page<=total_page&&i<=show_page_num) {
            move_page=i+start_page;
//            if(page==move_page) print_page+="<li>"+move_page+"&nbsp;</li>";
            if(page==move_page) print_page+="<li class='page-item active'><a class=page-link>"+move_page+"</a></li>";
            else print_page+="<li class=page-item><a class=page-link href='javascript:listPut("+move_page+");'>"+move_page+"</a></li> ";
            i++;
        }

        if(total_page>move_page) {
            next_page=move_page+1;
            a_next_page="<li class=page-item><a class=page-link href='javascript:listPut("+next_page+");'>》</a></li>";
            print_page+="<li class=page-item><a class=page-link href='javascript:listPut("+total_page+");'>"+total_page+"</a></li>";
        }

        html += a_1_prev_page + a_prev_page + print_page + a_next_page + a_1_next_page;

        html += '</ul></nav>';
        pageDiv.innerHTML = html;
        //console.log(new Date().toISOString(), 'listPut end');
    }


    function viewIss(idx){
        var url = 'dos/C_Drv'
                + escape(songs[idx].path.replace(/\\/g,'/').substring(2)
                + '/'+songs[idx].filename+'.ISS');

        if(!songs[idx].isssize){
            alert(url+' 파일이 없습니다.');
        } else{
            location.href = 'iss.html?url='+encodeURIComponent(url);
        }
    }

    function viewIms(idx){
        var url = 'dos/C_Drv'
                + escape(songs[idx].path.replace(/\\/g,'/').substring(2)
                + '/'+songs[idx].filename);

        if(!songs[idx].imssize){
            alert(url+' 파일이 없습니다.');
        } else{
            location.href = '/ims/ims.html?url=/iss/'+encodeURIComponent(url)+'&d='+songs[idx].duration;
        }
    }

    function ocplay(idx){
        console.log(songs[idx])
        var url = 'ocplay.php?path=dos/C_Drv' + songs[idx].path.replace(/\\/g,'/').replace(/&/g,'%26').substring(2) + '/'
                + '&file=' + escape(songs[idx].filename);
//        var url = 'ocplay.php?d=1234567890';
        console.log(url);
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
    function adplug(idx){
        console.log(idx,songs[idx])
        var url = '../dos/C_Drv' + songs[idx].path.replace(/\\/g,'/').replace(/&/g,'%26').substring(2) + '/'
                + escape(songs[idx].filename)+'.IMS&p=1';
        console.log(url);
        location.href = './adplug/?ims='+url;
    }

    function hts(idx){
        console.log(songs[idx])
        var url = 'hts.php?path=dos/C_Drv' + songs[idx].path.replace(/\\/g,'/').replace(/&/g,'%26').substring(2) + '/'
                + '&file=' + songs[idx].filename;
        console.log(url);
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


    window.addEventListener("click", function(ev){
        //alert(ev.target.id)
        //search.value = ev.target.id;
        if(ev.target.id == 'chkIss'){
            isIss = !isIss;
            listPut(1);
        }else if(ev.target.id == 'isssize'){ // ipad 에선 안됨
            listSort('isssize');
        }
        window._ev = ev;
    });

    window.addEventListener("mousedown", function(event){
        touchEl = event.target;
        //alert("touchstart"+event.touches[0].target.tagName);
        //if(touchEl.tagName == 'TD')
            touchEl.style.backgroundColor='#666';
    });
    window.addEventListener("mouseup", function(event){
        //alert("touchend");
        //alert("touchend"+event.touches[0].target.tagName);
        touchEl.style.backgroundColor='';
    });

    var touchEl;
    window.addEventListener("touchstart", function(event){
        touchEl = event.touches[0].target;
        //alert("touchstart"+event.touches[0].target.tagName);
        //if(touchEl.tagName == 'TD')
            touchEl.style.backgroundColor='#666';
    });
    window.addEventListener("touchend", function(event){
        //alert("touchend");
        //alert("touchend"+event.touches[0].target.tagName);
        touchEl.style.backgroundColor='';
    });

//    alert( 'ontouchstart' in document.documentElement )
var clickEvent = (function() {
  if ('ontouchstart' in document.documentElement === true) {
    return 'touchstart';
  } else {
    return 'click';
  }
})();
window.addEventListener(clickEvent,function(){
  // ...
  //alert("touch");
});

// 페이지 로드완료 후 실행
window.addEventListener("load", function(e){
	log('window.onload');
	lstFile.forEach((item)=>{ new Ajax(item) });

	search.onkeydown = (ev)=>{
		if(ev.key == 'Enter') listPut(1); // 검색어 입력창에 Enter 이면 목록출력
	}
	search.onkeyup = (ev)=>{
		listPut(1); // 검색어 입력창에 Enter 이면 목록출력
	}

	if(navigator.platform == 'Win32') page_num = 30;   // iPhoneX
	if(navigator.platform == 'iPhone'){ page_num = 19; show_page_num=10;}  // iPhoneX
	if(navigator.platform == 'Linux armv81') page_num = 30; // ALLDOCUBE iPlay40
});
