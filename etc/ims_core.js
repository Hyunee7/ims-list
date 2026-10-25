/**
 * C++ Ims 헤더 명세 및 PlayEvent 구조체 시뮬레이션 인터프리터 클래스
 */
class ImsCoreParser {
    constructor(arrayBuffer) {
        this.buffer = arrayBuffer;
        this.view = new DataView(arrayBuffer);
        this.header = {};
        this.instruments = [];
        this.events = [];
    }

    parse() {
        // IMS_HEADER 70바이트 파싱 구조 정의
        this.header.nVerMajor = this.view.getUint8(0);
        this.header.nVerMinor = this.view.getUint8(1);
        this.header.nTuneID = this.view.getInt32(2, true);
        
        // 외부에 분리된 hangul_decoder.js의 전역 함수 decodeJohab 호출
        const tuneNameBytes = new Uint8Array(this.buffer, 6, 30);
        this.header.szTuneName = decodeJohab(tuneNameBytes);

        this.header.nTickBeat = this.view.getUint8(36);
        this.header.nBeatMeasure = this.view.getUint8(37);
        this.header.nTotalTick = this.view.getInt32(38, true);
        this.header.cbDataSize = this.view.getInt32(42, true);
        this.header.nrCommand = this.view.getInt32(46, true);
        this.header.nSrcTickBeat = this.view.getUint8(50);
        this.header.nSoundMode = this.view.getUint8(58);
        this.header.nPitchBRange = this.view.getUint8(59);
        this.header.nBasicTempo = this.view.getUint16(60, true);

        // 데이터 오프셋 및 악기 섹션 정의
        let songDataOffset = 71; 
        let instCountOffset = songDataOffset + this.header.cbDataSize + 1;
        this.header.instCount = this.view.getUint16(instCountOffset, true);

        let instNameOffset = instCountOffset + 2;
        let asciiDecoder = new TextDecoder('ascii');
        for(let x=0; x < this.header.instCount; x++) {
            let nameBytes = new Uint8Array(this.buffer, instNameOffset + (x * 9), 9);
            let nullIdx = nameBytes.indexOf(0);
            if(nullIdx === -1) nullIdx = 9;
            let instName = asciiDecoder.decode(nameBytes.subarray(0, nullIdx)).trim();
            this.instruments.push({ index: x, name: instName ? instName : "무명 악기" });
        }

        // PlayEvent() 스트림 시뮬레이션 분석 엔진 루프 구동
        let sIdx = 0;
        let stCode = 0;
        let currentTick = 0;

        while (sIdx < this.header.cbDataSize) {
            let rawIdx = sIdx;
            let curCode = this.view.getUint8(songDataOffset + sIdx);
            
            if (curCode > 0x7F) {
                sIdx++;
                stCode = curCode;
            } else {
                curCode = stCode;
            }

            let voice = (curCode & 0x0F) + 1; 
            let commandType = curCode & 0xF0;
            let statusHex = "0x" + curCode.toString(16).toUpperCase();
            
            let eventName = "Unknown";
            let detail = "";
            let cssClass = "";

            switch (commandType) {
                case 0x80:
                    eventName = "Note Off & Re-On";
                    cssClass = "status-80";
                    let rNote = this.view.getUint8(songDataOffset + sIdx);
                    let rVol = this.view.getUint8(songDataOffset + sIdx + 1);
                    detail = `채널 [${voice}] 음 해제 ➔ 새 음표 연주 | 음 번호: ${rNote}, 볼륨: ${rVol}`;
                    sIdx += 2;
                    break;
                case 0x90:
                    eventName = "Note On / Off";
                    cssClass = "status-90";
                    let nNote = this.view.getUint8(songDataOffset + sIdx);
                    let nVol = this.view.getUint8(songDataOffset + sIdx + 1);
                    detail = nVol > 0 ? `채널 [${voice}] 🎵 음표 연주 시작 | 음 번호: ${nNote}, 벨로시티: ${nVol}` : `채널 [${voice}] 🚫 음표 연주 중단 | 음 번호: ${nNote}`;
                    sIdx += 2;
                    break;
                case 0xA0:
                    eventName = "Set Volume";
                    cssClass = "status-A0";
                    let vol = this.view.getUint8(songDataOffset + sIdx);
                    detail = `채널 [${voice}] 볼륨 설정 ➔ 제어값: ${vol}`;
                    sIdx++;
                    break;
                case 0xC0:
                    eventName = "Set Instrument";
                    cssClass = "status-C0";
                    let instIdx = this.view.getUint8(songDataOffset + sIdx);
                    detail = `채널 [${voice}] 음색 변경 ➔ 악기 인덱스 [${instIdx}] 참조 로드`;
                    sIdx++;
                    break;
                case 0xE0:
                    eventName = "Set Pitch";
                    cssClass = "status-E0";
                    let p1 = this.view.getUint8(songDataOffset + sIdx);
                    let p2 = this.view.getUint8(songDataOffset + sIdx + 1);
                    let pitch = ((p2 << 8) | p1) / 2;
                    detail = `채널 [${voice}] 피치 밴드 제어 ➔ 연산 값: ${pitch}`;
                    sIdx += 2;
                    break;
                case 0xF0:
                    eventName = "Set Tempo";
                    cssClass = "status-F0";
                    let t1 = this.view.getUint8(songDataOffset + sIdx);
                    let t2 = this.view.getUint8(songDataOffset + sIdx + 1);
                    let calculatedTempo = (this.header.nBasicTempo * t1) + Math.floor((this.header.nBasicTempo * t2) / 128);
                    detail = `다이내믹 템포 변경 ➔ 보정 속도: ${calculatedTempo} BPM`;
                    sIdx += 5;
                    break;
            }

            // 후반부 틱 딜레이 수집
            let delayTime = 0;
            let isSongEnd = false;

            while (sIdx < this.header.cbDataSize) {
                let delay = this.view.getUint8(songDataOffset + sIdx);
                sIdx++;

                if (this.view.getUint8(songDataOffset + sIdx) === 0xFC) {
                    isSongEnd = true;
                    delayTime += delay;
                    break;
                }
                if (delay === 0xF8) {
                    delayTime += 240;
                } else {
                    delayTime += delay;
                    break;
                }
            }

            currentTick += delayTime;

            this.events.push({
                offset: "0x" + rawIdx.toString(16).toUpperCase().padStart(4, '0'),
                tick: currentTick - delayTime,
                statusHex: statusHex,
                eventName: eventName,
                cssClass: cssClass,
                detail: detail,
                delayTime: delayTime,
                isSongEnd: isSongEnd
            });

            if (isSongEnd) break;
        }
    }
}
