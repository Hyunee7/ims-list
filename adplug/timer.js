/**
 * timer.js 시계 출력
 */
document.addEventListener("DOMContentLoaded", () => {
    const timeText = document.getElementById("timeer"); // 시각 출력할 곳
	let timer = null; // 인터벌 개체를 저장할 버퍼
	
	// 현재시각 출력 갱신을 중지/재개 하기 위한 이벤트
	timeText.addEventListener("click", () => {
	});
	
	// 실행 순간 시각을 출력함
	function updateClock() {
	  const now = new Date(); // 현재 시간 객체 생성

	  let hours   = now.getHours  ().toString().padStart(2, '0');
	  let minutes = now.getMinutes().toString().padStart(2, '0');
	  let seconds = now.getSeconds().toString().padStart(2, '0');

	  const timeString = `${hours}:${minutes}:${seconds}`;
	  timeText.textContent = timeString;
	}
	// 시각 출력 시작
	function nowTimeStart(){
		// 1초(1000ms)마다 updateClock 함수 반복 실행
		timer = setInterval(updateClock, 1000);
	}
	
	updateClock(); // 현재 시각 출력
	nowTimeStart();
});
