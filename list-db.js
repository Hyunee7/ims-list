
// songs 객체를 localStorage 에 추가
function setLocalDb(songs){
//    localStorage.setItem('songs', songs);
    localStorage.setItem('songs', JSON.stringify(songs));
}

// localStorage 에서 songs 객체 추출
function getLocalDB(){
	return JSON.parse(localStorage.getItem('songs'))||[];
}

function setIsIss(value){
    localStorage.setItem('isIss', value?'0':'1');
}

function getIsIss(){
    return localStorage.getItem('isIss')||'0'=='0'?false:true;
}

function setValue(key,value){
	localStorage.setItem(key, value);
}

function getValue(key){
	return localStorage.getItem(key);
}