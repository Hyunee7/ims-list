/**
 * AdPlug WebAssembly 가상 힙 메모리 정밀 데이터 적재 시스템
 */
export class AdPlugMemory {
  constructor(player) {
    this.player = player;
  }
  
  bnkName = '';
  imsName = '';

  addBankFile(filename, binaryData) {
    const module = this.player.module;
    const nameBytes = new TextEncoder().encode(filename + "\0");
    const namePtr = module._malloc(nameBytes.length);
    module.HEAPU8.set(nameBytes, namePtr);

    const dataPtr = module._malloc(binaryData.length);
    module.HEAPU8.set(binaryData, dataPtr); 

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
