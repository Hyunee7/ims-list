
/*
responseType json, text, blob, arraybuffer
     : 빈 문자열은 기본 유형인 와 동일합니다.responseType"text"
text : 응답 데이터를 문자열로 받을 때 사용됩니다. 서버 응답이 문자열 그대로 반환됩니다.
json : 서버에서 JSON 형식의 응답 데이터를 받을 때 사용됩니다. 
       서버 응답이 JSON으로 파싱되어 JavaScript 객체로 반환됩니다.
blob : 응답 데이터를 이진 데이터(Binary Data)로 받을 때 사용됩니다. 
       이진 데이터는 파일 다운로드 등과 같은 상황에서 유용합니다.
arraybuffer : 응답 데이터를 ArrayBuffer 형식으로 받을 때 사용됩니다. 
              이진 데이터를 효과적으로 처리하는 데 사용됩니다.
              오디오, 비디오 등의 이진 데이터를 요청하고 처리할 때 사용됩니다.
document : HTML 문서 또는 XML XML 문서이며, 수신된 데이터의 MIME 유형에 따라 적절합니다.
*/
var ajaxcounter = 0;
function Ajax(param){
    //console.log(new Date().toISOString(), 'start');
    var xhr = new XMLHttpRequest();
    window['_xhr'] = xhr; // debug 용
    ajaxcounter++;

    xhr.open('GET', param.url, true);
//        xhr.open('GET', url, false);
    if(param.type) xhr.responseType = param.type; // json, text, blob, arraybuffer
    xhr.withCredentials = true;
    xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest'); xhr.setRequestHeader('Access-Control-Allow-Origin', '*');

    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.setRequestHeader('Accept', 'application/json, text/plain, */*'); 

    // via Cache-Control header:
    xhr.setRequestHeader("Cache-Control", "no-cache, no-store, max-age=0");

    // fallbacks for IE and older browsers:
    xhr.setRequestHeader("Expires", "Tue, 01 Jan 1980 1:00:00 GMT");
    xhr.setRequestHeader("Pragma", "no-cache"); //Edit: I noticed this is required for Chrome some time ago... forgot to mention here

    xhr.onprogress = (e)=>{
        if (e.lengthComputable){
            console.log(`Received ${e.loaded} of ${e.total}bytes`)
        } else {
            console.log(`Received ${e.loaded} bytes`)
        }
        if(param.progress) param.progress(e);
    }
    // Process the response when the request is ready.
    xhr.onload = function(e) {
      if (this.status == 200) {
          param.callback(this);
          ajaxcounter--;
      }
    };
    xhr.onerror = function(e){
        console.log('err',e)
    }
    xhr.send();
}


/*****************************************************************************
 HashMap 구현 => Map 로 가능
 *****************************************************************************/
function HashMap(){
//    this.map = []; // 숫자 key 는 사용할 수 없음.
    this.map = {};
}
HashMap.prototype = {
     put:function(key, value){this.map[key] = value;}
    ,get:function(key){return this.map[key];}
    ,getAll:function(){return this.map}
    ,getKeys:function(){
        var keys = [];
        for(var i in this.map){
            keys.push(i);
        }
        return keys;
     }
//    ,clear:function(){this.map = []}
    ,clear:function(){this.map = {}}
    ,remove:function(key){delete this.map[key];}
    ,containsKey:function(key){
        for(var i in this.map){
            if(i==key) return true;
        }
    }
}


/*
    text String 을 file 로 내려받는 함수
*/
function download(filename, text) {
    var element = document.createElement('a');
    //  element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + text);
    element.setAttribute('download', filename);

    element.style.display = 'none';
    document.body.appendChild(element);

    element.click();

    document.body.removeChild(element);
}

/*
    text String 을 file 로 내려받는 샘플
*/
function myBlobToUIntDemo() {
  let str='content';

  str2blob=(str,type='text/plain')=>new Blob([str],{type:type});

  let blob=str2blob(str);  

  function blob2uint(blob){
      return new Response(blob).arrayBuffer().then(buffer=>{
          uint=[...new Uint8Array(buffer)];
          console.log("Uint8Array",uint);
          return uint;
      });
  }
  
  let uint8data = blob2uint(blob);
  console.log(uint8data); //Show Uint8Array
}

/*
    text String 을 file 로 내려받는 샘플
*/
function downloadFile() {
  const blob = new Blob([lyric.join('\n')], {type: 'text/plain'})
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = file.split('/').pop()+'.txt'
  a.click()
  a.remove()
  window.URL.revokeObjectURL(url);
}

/*
    문자열을 byte 단위로 자름
*/
function sliceByByte(str, maxByte) {
    for(b=i=0;c=str.charCodeAt(i);) {
        b+=c>>7?2:1;
        if (b > maxByte)
            break;
        i++;
    }
    return str.substring(0,i);
}


/**
 * 문자열의 바이트수 리턴
 * @returns {Number}
 */
String.prototype.byteLength = function() {
    var l= 0;

    for(var idx=0; idx < this.length; idx++) {
        var c = escape(this.charAt(idx));

        if( c.length==1 ) l ++;
        else if( c.indexOf("%u")!=-1 ) l += 2;
        else if( c.indexOf("%")!=-1 ) l += c.length/3;
    }
    return l;
};
//출처: https://stove99.tistory.com/83 [스토브 훌로구:티스토리]

/*  console.log 출력 소스 위치 파악이 안되는 문제점으로 파기함.

    // console.log 에 Date 추가
    console.logCopy = console.log.bind(console);
    console.log = function(){
        this.logCopy.apply(console
            , [new Date().toJSON()].concat(Array.prototype.slice.call(arguments, 0)) );
    };*/
    function log() {
        console.log.apply(console, arguments);
    }
/**/


// 일시 정지 기능있는 타이머
// delay 가 다 되기 전에 일시정지 하는 기능인듯함.
var Timer = function(callback, delay) {
    var timerId, start, remaining = delay;

    this.pause = function() {
        window.clearTimeout(timerId);
        timerId = null;
        remaining -= Date.now() - start;
    };

    this.resume = function() {
        if (timerId) {
            return;
        }

        start = Date.now();
        timerId = window.setTimeout(callback, remaining);
    };

    this.resume();
};

// iOS 관련
function iOS() {
  return [
    'iPad Simulator',
    'iPhone Simulator',
    'iPod Simulator',
    'iPad',
    'iPhone',
    'iPod'
  ].includes(navigator.platform)
  // iPad on iOS 13 detection
  || (navigator.userAgent.includes("Mac") && "ontouchend" in document)
}
/*
var iOS = !window.MSStream && /iPad|iPhone|iPod/.test(navigator.userAgent); // fails on iPad iOS 13

function iOSversion() {
  if (iOS) { // <-- Use the one here above
    if (window.indexedDB) { return 'iOS 8 and up'; }
    if (window.SpeechSynthesisUtterance) { return 'iOS 7'; }
    if (window.webkitAudioContext) { return 'iOS 6'; }
    if (window.matchMedia) { return 'iOS 5'; }
    if (window.history && 'pushState' in window.history) { return 'iOS 4'; }
    return 'iOS 3 or earlier';
  }
  return 'Not an iOS device';
}

let isIOS = /iPad|iPhone|iPod/.test(navigator.platform)
|| (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

let isIOS = (/iPad|iPhone|iPod/.test(navigator.platform) ||
(navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) &&
!window.MSStream

iOS = /^iP/.test(navigator.platform);
  // or, if you prefer it verbose:
iOS = /^(iPhone|iPad|iPod)/.test(navigator.platform);

//iOSiPadOS = /^iP/.test(navigator.platform) ||
//           /^Mac/.test(navigator.platform) && navigator.maxTouchPoints > 4;
// in 2024 we don't care about IE 11 throwing an error and can do this:
iOSiPadOS = navigator.platform.startsWith("iP") ||
    navigator.platform.startsWith("Mac") && navigator.maxTouchPoints > 4;

var iOS = ['iPad', 'iPhone', 'iPod'].indexOf(navigator.platform) >= 0;

var isIOS = (function () {
    var iosQuirkPresent = function () {
        var audio = new Audio();

        audio.volume = 0.5;
        return audio.volume === 1;   // volume cannot be changed from "1" on iOS 12 and below
    };

    var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    var isAppleDevice = navigator.userAgent.includes('Macintosh');
    var isTouchScreen = navigator.maxTouchPoints >= 1;   // true for iOS 13 (and hopefully beyond)

    return isIOS || (isAppleDevice && (isTouchScreen || iosQuirkPresent()));
})();

_iOSDevice = !!navigator.platform.match(/iPhone|iPod|iPad/);

//Add Modernizr test
Modernizr.addTest('isios', function() {
    return navigator.userAgent.match(/(iPad|iPhone|iPod)/g);
});

//usage
if (Modernizr.isios) {
    //this adds ios class to body
    Modernizr.prefixed('ios');
} else {
    //this adds notios class to body
    Modernizr.prefixed('notios');
}

const iOS_1to12 = /iPad|iPhone|iPod/.test(navigator.platform);

const iOS13_iPad = (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

const iOS1to12quirk = function() {
  var audio = new Audio(); // temporary Audio object
  audio.volume = 0.5; // has no effect on iOS <= 12
  return audio.volume === 1;
};

const isIOS = !window.MSStream && (iOS_1to12 || iOS13_iPad || iOS1to12quirk());

const isIOS = typeof navigator.standalone === 'boolean';

if(navigator.vendor != null && navigator.vendor.match(/Apple Computer, Inc./) && navigator.userAgent.match(/iPhone/i) || (navigator.userAgent.match(/iPod/i))) 
    {
        alert("Ipod or Iphone");
    }
else if (navigator.vendor != null && navigator.vendor.match(/Apple Computer, Inc./) && navigator.userAgent.match(/iPad/i))  
    {
        alert("Ipad");
    }
else if (navigator.vendor != null && navigator.vendor.match(/Apple Computer, Inc./) && navigator.userAgent.indexOf('Safari') != -1)
    {
        alert("Safari");
    }
else if (navigator.vendor == null || navigator.vendor != null)
    {
        alert("Not Apple Based Browser");
    }

    Modernizr.addTest('inpagevideo', function ()
    {
        return navigator.userAgent.match(/(iPhone|iPod)/g) ? false : true;
    });
*/
/*
export const isAndroid = () => {
    const ua = navigator.userAgent.toLowerCase() + navigator?.platform.toLowerCase();
    const isAndroid = ua.indexOf("android") > -1;

    return isAndroid;
}
*/