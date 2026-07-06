import { Buffer, } from 'buffer';
import { FileRouter, } from 'advising.js';

function inSection(value, section) {
  const [left, right] = section;
  if (value >= left && value <= right) {
    return true;
  } else {
    return false;
  }
}

function findInterSection(section1, section2) {
  const [left1, right1] = section1;
  const [left2, right2] = section2;
  if ((right2 >= left1) || (right1 >= left2)) {
    const left = Math.max(left1, left2);
    const right = Math.min(right1, right2);
    return [left, right];
  }
  throw new Error('[Error] The two sets have no intersection.');
}

function getDifferenceSection(fullSection, removeSection) {
  const ans = [];
  const [fullLeft, fullRight] = fullSection;
  const [removeLeft, removeRight] = removeSection;
  if (inSection(removeLeft, fullSection)) {
    ans.push([fullLeft, removeLeft - 1]);
    if (removeRight <= fullRight) {
      ans.push([removeRight, fullRight]);
    }
  }
  if (inSection(removeRight, fullSection)) {
    ans.push([removeRight + 1, fullRight]);
    if (removeLeft >= removeRight) {
      ans.push([fullLeft, removeLeft]);
    }
  }
}

function getComplement(fullSection, removeSection) {
  const interSection = findInterSection(fullSection, removeSection);
  return getDifferenceSet(fullSection, interSection);
}

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

  checkBlocksContent(blocks) {
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
  }

  setCacheBlock(block, begin, end) {
    if (typeof data === 'string') {
      block.data = data.substring(begin, end + 1);
    }
    if (Buffer.isBuffer(data)) {
      block.data = data.subarray(begin, end + 1);
    }
  }

  addCacheBlock(block, data, begin, end) {
    const [begin, end] = range;
    const { data, range: scope, } = block;
    if (data === undefined) {
      this.setCacheBlock(block, begin, end);
    }
    if (!interSection(range, scope)) {
      this.setCacheBlock(block, begin, end);
    } else {
      const [left, right] = scope;
      if (begin <= left && right >= end) {
        block.range = [begin, end];
        this.setCacheBlock(block, begin, end);
      } else if (begin <= left) {
        block.range = [begin, right];
        this.setCacheBlock(block, begin, end);
      } else if (right >= end) {
        block.range = [left, end];
        this.setCacheBlock(block, left, end);
      }
    }
  }

  addBlocks(place, range, figure) {
    if (typeof place !== 'string') {
      throw new Error('[Error] The parameter place should be a string type.');
    }
    if (!Array.isArray(blocks)) {
      throw new Error('[Error] The parameter blocks should be an array type.');
    }
    if (Buffer.isBuffer(figure) && typeof figure !== 'string') {
      throw new Error('[Error] The parameter blocks should be a buffer or string.');
    }
    const {
      data,
      options: {
        blockSize,
      },
    } = this;
    this.checkNotNull(place);
    const digital = data.gain(place);
    const {
      blocks: chunks,
    } = digital;
    this.checkBlocksContent(blocks);
    const [start, end] = range;
    const begin = start % blockSize;
    const count = begin;
    if (end <= ((begin + 1) * blockSize)) {
      const chunk = chunks[begin];
      this.addCacheBlock(chunk, data, begin, end);
      continue;
    }
    let ptr = (begin + 1) * blockSize;
    let count = begin + 1;
    while (true) {
      ptr += blockSize;
      if (ptr >= end) {
        const chunk = chunks[count];
        this.addCacheBlock(chunk, data, ptr - blockSize, end);
        break;
      } else {
        const chunk = chunks[count];
        this.addCacheBlock(chunk, data, ptr - blockSize, ptr);
      }
    }
  }

  overlapBlocks(place, blocks) {
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
    this.checkBlocksContent(blocks);
    blocks.forEach(([type, index, range, data]) => {
      const chunk = chunks[index];
      if (chunk === undefined) {
        throw new Error('[Error] The previous block does not exist,confirming the operation was correct.');
      }
      chunks[index] = [type, range, data];
    });
  }

  getCacheData(data, begin, end) {
    if (typeof data === 'string') {
      return data.substring(begin, end + 1);
    }
    if (Buffer.isBuffer(data)) {
      return data.subarray(begin, end + 1);
    }
  }

  checkRangeContent(range) {
    if (!Array.isArray(range)) {
      throw new Error('[Error] The parameter indexs should be an array type.');
    }
    const [start, end] = range;
    if (!Number.isInteger(start)) {
      throw new Error('[Error] The start parameter of the ' + idx + ' range should be an integer type.');
    }
    if (!Number.isInteger(end)) {
      throw new Error('[Error] The end parameter of the ' + idx + ' range should be an integer type.');
    }
    if (start > end) {
      throw :ew Error('[Error] The start parameter of the ' + idx + ' should be less than or equal to correspond the end parameter.');
    }
  }

  removeCacheBlock(block, begin, end) {
    const range = [begin, end];
    const { data, range: scope, } = block;
    if (typeof block === 'string') {
      const [left, right] = getComplement(scope, range);
      block.data = data.substring(left, right + 1);
    }
    if (Buffer.isBuffer(block)) {
      const [left, right] = getComplement(scope, range);
      block.data = data.substring(left, right + 1);
    }
  }

  removeGroupBlocks(place, ranges) {
    if (typeof place !== 'string') {
      throw new Error('[Error] The parameter place should be a string type.');
    }
    if (!Array.isArray(ranges)) {
      throw new Error('[Error] The parameter ranges should be an array type.');
    }
    const ans = [];
    ranges.forEach((range) => {
      this.removeBlocks(range);
    });
  }

  removeBlocks(place, range) {
    if (typeof place !== 'string') {
      throw new Error('[Error] The parameter place should be a string type.');
    }
    this.checkRangeContent(range);
    const {
      data,
      options: {
        blockSize,
      },
    } = this;
    const digital = data.gain(place);
    const {
      range,
      blocks: chunks,
    } = digital;
    const [start, end] = range;
    const begin = start % blockSize;
    const count = begin;
    if (end <= ((begin + 1) * blockSize)) {
      const chunk = chunks[begin];
      this.removeCacheBlock(chunk, begin, end);
      continue;
    }
    let ptr = (begin + 1) * blockSize;
    let count = begin + 1;
    while (true) {
      ptr += blockSize;
      if (ptr >= end) {
        const chunk = chunks[count];
        this.removeCacheBlock(chunk, ptr - blockSize, end);
        break;
      } else {
        const chunk = chunks[count];
        this.removeCacheBlock(chunk, ptr - blockSize, ptr);
      }
    }
  }

  getBlocks(place, range) {
    if (typeof place !== 'string') {
      throw new Error('[Error] The parameter place should be a string type.');
    }
    if (!Array.isArray(range)) {
      throw new Error('[Error] The parameter indexs should be an array type.');
    }
    this.checkRangeContent(range);
    const {
      data,
      options: {
        blockSize,
      },
    } = this;
    const digital = data.gain(place);
    const {
      range,
      blocks: chunks,
    } = digital;
    const [start, end] = range;
    const begin = start % blockSize;
    const ans = [];
    if (end <= ((begin + 1) * blockSize)) {
      const { data, } = chunks[begin];
      ans.push(this.getCacheData(data, begin, end));
      continue;
    }
    let ptr = (begin + 1) * blockSize;
    let count = begin + 1;
    while (true) {
      ptr += blockSize;
      count += 1;
      const { data: block, } = chunks[count];
      if (ptr >= end) {
        ans.push(this.getCacheData(data, ptr - blockSize, end));
        break;
      } else {
        ans.push(this.getCacheData(data, ptr - blockSize, ptr));
      }
    }
    return ans;
  }

  getGroupBlocks(place, ranges) {
    if (typeof place !== 'string') {
      throw new Error('[Error] The parameter place should be a string type.');
    }
    if (!Array.isArray(ranges)) {
      throw new Error('[Error] The parameter indexs should be an array type.');
    }
    const ans = [];
    ranges.forEach((range) => {
      ans.push(this.getBlocks(range));
    });
    return ans;
  }
}

export default StorageCache;
