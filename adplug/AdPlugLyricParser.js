/**
 * AdPlug .ISS 노래방 가사 자막 IMPlay 오리지널 바이너리 명세 정밀 파서 (가사 싱크 완치 버전)
 */
export class AdPlugLyricParser {
  constructor() {
    this.meta = { writer: "", composer: "", singer: "", editor: "" };
    this.lyrics = []; // { tick: number, text: string } 실시간 타임라인 매핑 보관함
    this.currentIndex = -1;

    // IMPlay(상용 조합형) 5-5-5 표준 한글 자모 자석 배열 정의
    this.CHOSUNG_MAP = [-1, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1];
    this.JUNGSUNG_MAP = [-1, -1, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, -1, -1, -1, -1, -1, -1, -1];
    this.JONGSUNG_MAP = [0, -1, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, -1, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, -1];
	
  }
  
  ims = {header:null,instrument:null};
  is_ims_loaded = false;
  bnk = {header:null,names:[]};
  is_bnk_loaded = false;

  decodeJohab(bytes) {
	/*
    let result = "";
    let i = 0;

    while (i < bytes.length) {
      const b1 = bytes[i];
      if (b1 === 0x00) break; 

      if (b1 <= 0x7E) {
        if (b1 >= 0x20) result += String.fromCharCode(b1);
        i++;
        continue;
      }

      if (i + 1 < bytes.length) {
        const b2 = bytes[i + 1];
        const word = (b1 << 8) | b2;

        if (word & 0x8000) {
          const choIdx  = (word >> 10) & 0x001F;
          const jungIdx = (word >> 5)  & 0x001F;
          const jongIdx = word         & 0x001F;

          const cho  = this.CHOSUNG_MAP[choIdx];
          const jung = this.JUNGSUNG_MAP[jungIdx];
          const jong = this.JONGSUNG_MAP[jongIdx];

          if (cho !== undefined && cho !== -1 && jung !== undefined && jung !== -1) {
            const finalJong = (jong !== undefined && jong !== -1) ? jong : 0;
            const uniChar = String.fromCharCode(0xAC00 + (cho * 21 * 28) + (jung * 28) + finalJong);
            result += uniChar;
          }
        }
        i += 2;
      } else {
        i++;
      }
    }
    return result;
	*/
    var result = ""; var i = 0;
    while (i < bytes.length) {
      if (bytes[i] === 0) { i++; continue; }
      if ((bytes[i] & 0x80) === 0) { result += String.fromCharCode(bytes[i]); i++; } 
      else {
        if (i + 1 < bytes.length) {
          var b1 = bytes[i]; var b2 = bytes[i + 1];
          var chosung = ((b1 >> 2) & 0x1F) - 2;
          var jungsung = ((b1 & 0x03) << 3) | ((b2 >> 5) & 0x07);
          if (jungsung > 7 && jungsung < 16) jungsung -= 5;
          else if (jungsung > 15 && jungsung < 24) jungsung -= 7;
          else if (jungsung > 25) jungsung -= 9; else jungsung -= 3;
          var jongsung = (b2 & 0x1F) - 1; if (jongsung > 16) jongsung -= 1;
          if (chosung >= 0 && jungsung >= 0 && jongsung >= 0) {
            var unicode = chosung * 588 + jungsung * 28 + jongsung + 44032; result += String.fromCharCode(unicode);
          }
          i += 2;
        } else { i++; }
      }
    }
    return result;
  }

  parse(arrayBuffer) {
    this.lyrics = [];
    this.currentIndex = -1;

    const u8Array = new Uint8Array(arrayBuffer);
    if (u8Array.length < 154) return [];

    let offset = 150; 
    this.meta.writer = this.decodeJohab(u8Array.subarray(30, 60)).trim();
    this.meta.composer = this.decodeJohab(u8Array.subarray(60, 90)).trim();
    this.meta.singer = this.decodeJohab(u8Array.subarray(90, 120)).trim();
    this.meta.editor = this.decodeJohab(u8Array.subarray(120, 150)).trim();

    const recCount = u8Array[offset] | (u8Array[offset + 1] << 8);
    offset += 2;
    const lineCount = u8Array[offset] | (u8Array[offset + 1] << 8);
    offset += 2;
//console.log('recCount',recCount)
//console.log('lineCount',lineCount)
    const rawRecords = [];
    for (let i = 0; i < recCount; i++) {
      const kasaTick = u8Array[offset] | (u8Array[offset + 1] << 8);
      const line = new DataView(u8Array.buffer, u8Array.byteOffset + offset + 2, 1).getUint8(0);
      rawRecords.push({ kasaTick, line });
      offset += 5;
    }
	
	
window.record = rawRecords;
    const scripts = [];
    for (let i = 0; i < lineCount; i++) {
      const scriptBytes = u8Array.subarray(offset, offset + 64);
      //const textLine = this.decodeJohab(scriptBytes);
      const textLine = JohabDecoder.decode(arrayBuffer, offset, 64);
	  /*
	  let textLine = this.decodeJohab(scriptBytes);
	  try{
        textLine = JohabDecoder.decode(arrayBuffer, offset, 64);
		//console.log(i,textLine);
	  }catch(ex){
		console.log(ex);
	  }
	  */
      scripts.push(textLine);
      offset += 64;
    }
window.scripts = scripts;
	//console.log(scripts);

    rawRecords.forEach(rec => {
      if (rec.line >= 0 && rec.line < scripts.length) {
        const cleanText = scripts[rec.line];
        // 🎯 [교정]: 기존의 무리한 *8 곱셈을 전면 제거하여 AdPlugPlayer 코어 틱과 1:1 크기 일치
        this.lyrics.push({ tick: rec.kasaTick, text: cleanText });
      }
    });

//console.log('this.lyrics.length',this.lyrics.length)
/**/
    this.lyrics.sort((a, b) => a.tick - b.tick);
    this.lyrics = this.lyrics.filter((item, index, self) => 
      index === self.findIndex((t) => t.tick === item.tick && t.text === item.text)
    );
/**/
//console.log('this.lyrics.length',this.lyrics.length)

    return this.lyrics;
  }
  
  /**
   * 🎯 [실시간 동적 자막 서칭 엔진 교정]:
   * null 차단 방식을 걷어내고 현재 틱에 매핑되는 자막 정보를 무정지 리포트하여 
   * 일시정지 해제나 뒤로가기/앞으로가기(Seek) 시에도 싱크가 실시간 칼같이 맞도록 설계
   */
  update(currentTick) {
    if (this.lyrics.length === 0) return null;
    
    let activeIndex = -1;
    for (let i = 0; i < this.lyrics.length; i++) {
      if (currentTick >= this.lyrics[i].tick) {
        activeIndex = i;
      } else {
        break;
      }
    }

    this.currentIndex = activeIndex;
    return activeIndex >= 0 ? this.lyrics[activeIndex].text : "🎵 (간주 중)";
  }
/*  * /
// AdPlugLyricParser.js 의 update 메서드를 실시간 스피커 프레임 대응용으로 정밀 교정합니다.
update(currentRealFrames) {
  if (this.lyrics.length === 0) return null;
  
  // 🎯 [싱크 완치 공식]: 44100Hz 오디오 프레임 단위를 오리지널 노래방 자막 틱 스케일로 정밀 역산합니다.
  // 에뮬레이터 내부 타이머 메커니즘과 연동되어 귀에 들리는 타이밍과 자막이 정확히 일치하게 됩니다.
  const currentTick = (currentRealFrames / 44100) * (70 / 8); 

  let activeIndex = -1;
  for (let i = 0; i < this.lyrics.length; i++) {
    if (currentTick >= this.lyrics[i].tick) {
      activeIndex = i;
    } else {
      break;
    }
  }

  this.currentIndex = activeIndex;
  return activeIndex >= 0 ? this.lyrics[activeIndex].text : "🎵 (간주 중)";
}
*/
  reset() {
    this.currentIndex = -1;
  }
  
  // ims 파서
  parse_ims(arrayBuffer){
    const u8Array = new Uint8Array(arrayBuffer);
    const dataView = new DataView(arrayBuffer);
	let header = {
			 majorVersion : 0  //  1, 'int8'   1    주 버전 번호(일반적으로 1)
			,minorVersion : 0  //  1, 'int8'   2    부 버전 번호(일반적으로 0)
			,tuneld       : 0  //  4, 'int32'  6    노래 식별 번호
			,tuneName     : "" // 30          36    노래 제목, null 종료
			,tickBeat     : 0  //  1, 'int8'  37    비트당 틱 수
			,beatMeasure  : 0  //  1, 'int8'  38    소절당 비트수
			,totalTick    : 0  //  4, 'int32' 42    노래의 길이(틱)
			,dataSize     : 0  //  4, 'int32' 46    MIDI 데이터 블록의 길이(바이트)
			,nrCommand    : 0  //  4, 'int32' 50    MIDI 이벤트 수 (0xFC:종료 포함)
			,srctickBeat  : 0  //  1, 'int8'  51    0 (이외 값은 발견하지 못함.)
			,filler       : 0  //  7          58    패딩, 0으로 설정

			,soundMode    : 0  //  1, 'int8'  59   OPL 리듬 모드: 0=멜로딕(꺼짐), 1=타악기(켜짐)
			,pitchBRange  : 0  //  1, 'int8'  60    피치벤드 범위(1-12)

			,basicTempo   : 0  //  2, 'int16' 62    노래 템포, 분당 비트 수.
			,filler2      : 0  //  8          70    패딩, 0으로 설정
	}
	let instrument = {
		count  : 0,   // 악기수
		names  : [],  // 악기명
		mapped : 0    // bnk 매핑 수
	}
    if (dataView.length < 70) return header; // 70 바이트보다 작으면 종료
	
	header.majorVersion = dataView.getUint8 ( 0      ) //  1    주 버전 번호(일반적으로 1)
	header.minorVersion = dataView.getUint8 ( 1      ) //  2    부 버전 번호(일반적으로 0)
	header.tuneld       = dataView.getUint32( 2, true) //  6    노래 식별 번호
	header.tuneName     = JohabDecoder.decode(arrayBuffer, 6, 30) // 36    노래 제목, null 종료
	header.tickBeat     = dataView.getUint8 (36      ) // 37    비트당 틱 수
	header.beatMeasure  = dataView.getUint8 (37      ) // 38    소절당 비트수
	header.totalTick    = dataView.getUint32(38, true) // 42    노래의 길이(틱)
	header.dataSize     = dataView.getUint32(42, true) // 46    MIDI 데이터 블록의 길이(바이트)
	header.nrCommand    = dataView.getUint32(46, true) // 50    MIDI 이벤트 수 (0xFC:종료 포함)
	header.srctickBeat  = dataView.getUint8 (50      ) // 51    0 (이외 값은 발견하지 못함.)
	header.soundMode    = dataView.getUint8 (58      ) // 59   OPL 리듬 모드: 0=멜로딕(꺼짐), 1=타악기(켜짐)
	header.pitchBRange  = dataView.getUint8 (59      ) // 60    피치벤드 범위(1-12)
	header.basicTempo   = dataView.getUint16(60, true) // 62    노래 템포, 분당 비트 수.
	
	instrument.count = dataView.getUint16(header.dataSize + 72, true) // 72 : header + 'ww'
	const inst_name_size = 9;
	for(let i=0; i<instrument.count; i++){
		const offset = header.dataSize + 74 + inst_name_size*i; // 74 : header(70) + ww(2) + Uint16(2)
		instrument.names.push( this.get_string(u8Array,offset,inst_name_size) );
	}
	this.ims = { header:header, instrument:instrument};
	this.is_ims_loaded = true;

	this.mapping(); //악기매핑수

	return this.ims;
  }
  
  // 문자열 추출
  get_string(buffer,start,length){
  	const cutbuf = buffer.slice(start, start+length);
  	const cutbuf_end_index = cutbuf.indexOf(0);
//  	const str = cutbuf.slice(0,cutbuf_end_index).toString('utf-8');
  	const str = new TextDecoder('utf-8').decode(cutbuf.slice(0,cutbuf_end_index));
  	return str;
  }

  // bnk 파서
  parse_bnk(arrayBuffer){
    const u8Array = new Uint8Array(arrayBuffer);
    const dataView = new DataView(arrayBuffer);
	
	let bnkHeader = {};

    const view = new DataView(arrayBuffer);
    bnkHeader.majorVersion = view.getUint8(0);
	bnkHeader.minorVersion = view.getUint8(1);
    let sigChars = [];
    for(let i=0; i<6; i++) sigChars.push(String.fromCharCode(view.getUint8(2+i)));
    bnkHeader.sig = sigChars.join('');
    bnkHeader.ins_num = view.getInt16(8, true);
	bnkHeader.max_num = view.getInt16(10, true);
    bnkHeader.offsetList = view.getInt32(12, true);
	bnkHeader.offsetTimber = view.getInt32(16, true);
    let bnkInsNames = [];
	let listPos = bnkHeader.offsetList;
    for(let i=0; i<bnkHeader.max_num; i++) {
        let idx = view.getInt16(listPos, true);
		let active = view.getUint8(listPos + 2);
		let nameChars = [];
        for(let n=0; n<9; n++) {
			let c = view.getUint8(listPos + 3 + n);
			if(c !== 0) nameChars.push(String.fromCharCode(c));
		}
        let name = nameChars.join('');
		bnkInsNames.push({ index: idx, active: active, name: name });
		listPos += 12;
    }
	/*
    bnkTimbres = []; let timbrePos = bnkHeader.offsetTimber;
    for(let i=0; i<bnkHeader.max_num; i++) {
        let timbre = {
            mode: view.getUint8(timbrePos), voice: view.getUint8(timbrePos + 1),
            mod: { ksl: view.getUint8(timbrePos+2), multiple: view.getUint8(timbrePos+3), feedback: view.getUint8(timbrePos+4), attack: view.getUint8(timbrePos+5), sustLevel: view.getUint8(timbrePos+6), envelopeGain: view.getUint8(timbrePos+7), decay: view.getUint8(timbrePos+8), releaseRate: view.getUint8(timbrePos+9), totalLevel: view.getUint8(timbrePos+10), am: view.getUint8(timbrePos+11), vib: view.getUint8(timbrePos+12), ksr: view.getUint8(timbrePos+13), con: view.getUint8(timbrePos+14) },
            car: { ksl: view.getUint8(timbrePos+15), multiple: view.getUint8(timbrePos+16), feedback: view.getUint8(timbrePos+17), attack: view.getUint8(timbrePos+18), sustLevel: view.getUint8(timbrePos+19), envelopeGain: view.getUint8(timbrePos+20), decay: view.getUint8(timbrePos+21), releaseRate: view.getUint8(timbrePos+22), totalLevel: view.getUint8(timbrePos+23), am: view.getUint8(timbrePos+24), vib: view.getUint8(timbrePos+25), ksr: view.getUint8(timbrePos+26), con: view.getUint8(timbrePos+27) },
            wave0: view.getUint8(timbrePos + 28), wave1: view.getUint8(timbrePos + 29)
        }; bnkTimbres.push(timbre); timbrePos += 30;
    }
	*/

	this.bnk.header = bnkHeader;
	this.bnk.names = bnkInsNames;
	this.is_bnk_loaded = true;
	
	this.mapping(); //악기매핑수
	
	return this.bnk;
  }
  
  mapping(){
	if(!this.is_ims_loaded || !this.is_bnk_loaded) return;
	/**/
	this.ims.instrument.names.forEach(name=>{
		//if(this.bnk.names.includes(name)) this.ims.instrument.mapped ++;
		//console.log(name, this.bnk.names.some(item=>item.name==name.toUpperCase()))
		if(this.bnk.names.some(item=>item.name.toUpperCase()==name.toUpperCase())) this.ims.instrument.mapped ++;
	});
	/**/
  }
  
  get_mapped_instrument(){
	if(!this.is_ims_loaded || !this.is_bnk_loaded) return null;
	//console.log(this.is_bnk_loaded, this.bnk);
	return {
		mapped:this.ims.instrument.mapped, 
		ims   :this.ims.instrument.count, 
		bnk   :this.bnk.header.ins_num
	};
  }

}
