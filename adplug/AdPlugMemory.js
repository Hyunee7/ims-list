/**
 * AdPlug WebAssembly 가상 힙 메모리 정밀 데이터 적재 시스템
 */
export class AdPlugMemory {
  constructor(player) {
    this.player = player;
  }
  
  bnkName = ''; // bnk 파일명
  imsName = ''; // ims 파일명

  // 엔진에 Uint8Array 형식 BNK 데이타 전달
  addBankFile(filename, binaryData) {
    const module = this.player.module;
    const nameBytes = new TextEncoder().encode(filename + "\0");
    const namePtr = module._malloc(nameBytes.length);
    module.HEAPU8.set(nameBytes, namePtr);

    const dataPtr = module._malloc(binaryData.length);
    module.HEAPU8.set(binaryData, dataPtr); 

    // ROL 에 BNK 가 있는 경우 첫 로드시 에러가 발생해서 추가함.
    module.stringToUTF8("STANDARD.BNK", namePtr, 13); 
    
    const result = module._emu_add_file(namePtr, dataPtr, binaryData.length);
    
    module._free(namePtr);
    module._free(dataPtr);
	this.bnkName = filename;

    if (result === 0) {
      this.player.isBankLoaded = true;
      return true;
    }
    return false;
  }

  // 엔진에 Uint8Array 형식 IMS 데이타 전달
  loadMusicFileToWasm(filename, binaryData) {
    const module = this.player.module;
    const pureName = filename.split('/').pop();
    const nameBytes = new TextEncoder().encode(pureName + "\0");
    const namePtr = module._malloc(nameBytes.length);
    module.HEAPU8.set(nameBytes, namePtr);

    const dataPtr = module._malloc(binaryData.length);
    module.HEAPU8.set(binaryData, dataPtr); 

    const result = module._emu_load_file(namePtr, dataPtr, binaryData.length);

    module._free(namePtr);
    module._free(dataPtr);
	this.imsName = filename;

    return result === 0;
  }
}
