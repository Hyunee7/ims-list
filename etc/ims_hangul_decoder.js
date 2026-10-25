/**
 * 90년대 DOS/PC통신용 조합형 한글 바이트 배열 디코더 엔진
 * (GitHub 0x00000FF/KSX1001 표준 변환 공식 이식)
 * @param {Uint8Array} bytes - 조합형 캐릭터셋이 담긴 바이너리 배열
 * @returns {string} 유니코드(UTF-8)로 완전히 복원된 문자열
 */
function decodeJohab(bytes) {
    var result = "";
    var i = 0;

    while (i < bytes.length) {
        // NULL 문자나 빈 바이트 스킵
        if (bytes[i] === 0) { 
            i++; 
            continue; 
        }
        
        // 최상위 비트(MSB)가 0이면 아스키(영문/숫자/제어문자) 처리
        if ((bytes[i] & 0x80) === 0) {
            result += String.fromCharCode(bytes[i]);
            i++;
        } else {
            // 조합형 한글 (2바이트 구성 조건 충족 확인)
            if (i + 1 < bytes.length) {
                var b1 = bytes[i];
                var b2 = bytes[i + 1];

                // 1. 초성 계산: 상위 바이트에서 5비트 추출 후 오프셋 보정
                var chosung = ((b1 >> 2) & 0x1F) - 2;

                // 2. 중성 계산: 상위 바이트 하위 2비트 + 하위 바이트 상위 3비트 조합
                var jungsung = ((b1 & 0x03) << 3) | ((b2 >> 5) & 0x07);
                
                // 중성 코드 영역별 변환 오프셋 분기 적용 (C# 공식 무결성 이식)
                if (jungsung > 7 && jungsung < 16) {
                    jungsung -= 5;
                } else if (jungsung > 15 && jungsung < 24) {
                    jungsung -= 7;
                } else if (jungsung > 25) {
                    jungsung -= 9;
                } else {
                    jungsung -= 3;
                }

                // 3. 종성 계산: 하위 바이트 하위 5비트 추출 후 오프셋 보정
                var jongsung = (b2 & 0x1F) - 1;
                if (jongsung > 16) {
                    jongsung -= 1;
                }

                // 범위 유효성 체크 방어 코드 (비정상 바이트 유입 시 에러 방지)
                if (chosung >= 0 && jungsung >= 0 && jongsung >= 0) {
                    // 4. 현대 한글 유니코드 공식 결합 (초성 * 588 + 중성 * 28 + 종성 + 44032)
                    var unicode = chosung * 588 + jungsung * 28 + jongsung + 44032;
                    result += String.fromCharCode(unicode);
                }

                // 2바이트 소모 완료
                i += 2;
            } else {
                i++;
            }
        }
    }
    return result.trim();
}
