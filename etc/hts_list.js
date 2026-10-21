/**
 * HTS 플레이리스트 바이너리 파일 파서
 * @param {ArrayBuffer} arrayBuffer - 파일에서 읽어온 바이너리 데이터
 * @returns {Object} 헤더 정보와 파싱된 목록 데이터
 */
function parseHtsListFile(arrayBuffer) {
  const HEADER_SIZE = 32;
  const RECORD_SIZE = 64;
  
  // 한글 깨짐을 방지하기 위한 EUC-KR 디코더 (브라우저 및 최신 Node.js 지원)
  const decoder = new TextDecoder('euc-kr');
  
  // 1. 헤더 영역 분리 및 파싱 (0 ~ 32 바이트)
  const headerBuffer = arrayBuffer.slice(0, HEADER_SIZE);
  // \x1A (EOF)나 무효한 바이트를 제거하고 텍스트로 변환
  const headerText = decoder.decode(headerBuffer).replace(/[\x00-\x1F]/g, '').trim();

  // 2. 목록 영역 분리 및 반복 파싱 (32 바이트 이후 ~ 끝까지)
  const listBuffer = arrayBuffer.slice(HEADER_SIZE);
  const totalRecords = Math.floor(listBuffer.byteLength / RECORD_SIZE);
  const items = [];

  for (let i = 0; i < totalRecords; i++) {
    const startOffset = i * RECORD_SIZE;
    const endOffset = startOffset + RECORD_SIZE;
    const recordBuffer = listBuffer.slice(startOffset, endOffset);

    /* 
     * [레코드 내부 구조 추정 오프셋 정의]
     * 데이터 패턴에 맞춰 세부 바이트 영역을 쪼갭니다.
     */
    const controlBytes = recordBuffer.slice(0, 8);       // 제어 및 식별자 영역 (f4, tf4 등 포함)
    const titleBytes = recordBuffer.slice(8, 40);       // 곡 제목 영역 (약 32바이트)
    const artistBytes = recordBuffer.slice(40, 52);     // 아티스트/제작자 영역 (약 12바이트)
    const filenameBytes = recordBuffer.slice(52, 64);   // 파일명 영역 (12바이트 고정)

    // 바이트 데이터를 텍스트로 변환 및 공백 제거
    const title = decoder.decode(titleBytes).trim();
    const artist = decoder.decode(artistBytes).trim();
    const filename = decoder.decode(filenameBytes).trim();

    // 빈 항목이 아니거나 파일명이 존재하는 경우 결과 배열에 추가
    if (filename) {
      items.push({
        index: i + 1,
        filename: filename,
        title: title || '제목 없음',
        artist: artist || '알 수 없음'
      });
    }
  }

  // 최종 분리된 구조 반환
  return {
    header: {
      size: HEADER_SIZE,
      signature: headerText
    },
    list: {
      size: listBuffer.byteLength,
      itemCount: items.length,
      items: items
    }
  };
}

// ==========================================
// [사용 예시 - Node.js 환경에서 파일 읽기]
// ==========================================
/*
const fs = require('fs');

try {
  const buffer = fs.readFileSync('H-VGILR2.IMS'); // 분석하신 실제 파일명
  const result = parseHtsListFile(buffer.buffer);
  
  console.log("=== 헤더 정보 ===");
  console.log(result.header);
  
  console.log("\n=== 파싱된 재생 목록 ===");
  console.table(result.list.items); // 테이블 형태로 깔끔하게 출력
} catch (error) {
  console.error("파일 파싱 중 오류 발생:", error);
}
*/
