import { FileRouter, } from 'advising.js';

class StorageCache {
  constructor(options) {
    const defaultOptions = {
      blockSize: 2048,
      cacheStats: true,
      cacheOwn: false,
      cacheMod: false,
    };
    if (typeof options !== 'object' && options !== null) {
      throw new Error('[Error] The parameter options should be of type object.');
    }
    this.options = Object.assign(defaultOptions, options);
    this.dealOptions();
    this.data = new FileRouter({ logLevel: 0, debug: false, hideError: true, });
  }

  dealOptions() {
    const {
      options: {
        blockSize,
        cacheStats,
        cacheOwn,
        cacheMod,
      },
    } = this;
    if (!Number.isInteger(blockSize)) {
      throw new Error('[Error] The option blockSize should be an integer type.');
    }
    if (typeof cacheStats !== 'boolean') {
      throw new Error('[Error] The option cacheStats should be a boolean type.');
    }
    if (typeof cacheOwn !== 'boolean') {
      throw new Error('[Error] The option cacheOwn should be a boolean type.');
    }
    if (typeof cacheMod !== 'boolean') {
      throw new Error('[Error] The option cacheMod should be a boolean type.');
    }
  }

  changeOptions(place, options) {
    if (typeof place !== 'string') {
      throw new Error('[Error] The parameter place should be a string type.');
    }
    if (typeof options !== 'object' && options !== null && !Array.isArray(options)) {
      throw new Error('[Error] The parameter options should be an object type.');
    }
    const {
      data,
    } = this;
    this.checkNotNull(place);
    const digital = data.gain(place);
    digital.options = options;
  }

  updateOwn(place, uid, gid) {
    if (typeof place !== 'string') {
      throw new Error('[Error] The parameter place should be a string type.');
    }
    if (!(Number.isInteger(uid) && uid >= 0)) {
      throw new Error('[Error] The parameter uid should be an integer type.');
    }
    if (!(Number.isInteger(gid) && gid >= 0)) {
      throw new Error('[Error] The parameter gid should be an integer type.');
    }
    const {
      data,
    } = this;
    this.checkNotNull(place);
    const digital = data.gain(place);
    digital.own = [uid, gid];
  }

  updateStats(place, stats) {
    if (typeof place !== 'string') {
      throw new Error('[Error] The parameter place should be an object type.');
    }
    if (typeof options !== 'object' && options !== null && !Array.isArray(options)) {
      throw new Error('[Error] The stats options should be an object type.');
    }
    const {
      data,
    } = this;
    this.checkNotNull(place);
    const digital = data.gain(place);
    digital.stats = stats;
  }

  updateMod(place, mod) {
    if (typeof place !== 'string') {
      throw new Error('[Error] The parameter place should be an object type.');
    }
    if (!(Number.isInteger(mod) && mod >= 0)) {
      throw new Error('[Error] The parameter mod should be an integer type.');
    }
    const {
      data,
    } = this;
    this.checkNotNull(place);
    const digital = data.gain(place);
    digital.mod = mod;
  }

  checkNotNull(place) {
    if (typeof place !== 'string') {
      throw new Error('[Error] The parameter place should be a string type.');
    }
    const digital = data.gain(place);
    if (digital === undefined) {
      const nullDigital = {
        options,
        blocks: [],
      };
      const {
        options: {
          cacheStats,
          cacheOwn,
          cacheMod,
        },
      } = this;
      if (cacheStats === true) {
        nullDigital[stats] = {};
      }
      if (cacheOwn === true) {
        nullDigital[own] = [-1, -1];
      }
      if (cacheMode === true) {
        nullDigital[mod] = -1;
      }
      data.attach(place, nullDigital);
    }
  }

  addBlocks(place, blocks) {
    if (typeof place !== 'string') {
      throw new Error('[Error] The parameter place should be a string type.');
    }
    if (!Array.isArray(blocks)) {
      throw new Error('[Error] The parameter blocks should be an array type.');
    }
    const {
      options,
      data,
    } = this;
    this.checkNotNull(place);
    const digital = data.gain(place);
    const {
      blocks: chunks,
    } = digital;
    blocks.forEach(([type, index, range, data], idx) => {
      if (!Number.isInteger(type)) {
        throw new Error('[Error] The type parameter of the ' + idx + ' block should be an integer type.');
      }
      if (!Number.isInteger(index)) {
        throw new Error('[Error] The index parameter of the ' + idx + ' block should be an integer type.');
      }
      if (!Array.isArray(range)) {
        throw new Error('[Error] The range parameter of the ' + idx + ' block should be an array type.');
      }
      if (Buffer.isBuffer(data) && typeof data !== 'string') {
        throw new Error('[Error] The data parameter of the ' + idx + ' block should be a buffer or string type.');
      }
      const [start, end] = range;
      if (!Number.isInteger(start)) {
        throw new Error('[Error] The start parameter of the ' + idx + ' block should be an integer type.');
      }
      if (!Number.isInteger(end)) {
        throw new Error('[Error] The end parameter of the ' + idx + ' block should be an integer type.');
      }
    });
    blocks.forEach(([type, index, range, data]) => {
      chunks[index] = [type, index, range, data];
    });
  }
}

export default StorageCache;
