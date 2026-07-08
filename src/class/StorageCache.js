import EventEmitter from 'events';
import { Buffer, } from 'buffer';
import { FileRouter, } from 'advising.js';

function getBetweenLength(section1, section2) {
  const [l1, r1] = sectinon1;
  const [l2, r2] = sectinon2;
  if (l2 >= r1) {
    return l2 - r1;
  } else if (l1 >= r2) {
    return l1 - r2;
  }
}

function inSection(value, section) {
  const [left, right] = section;
  if (value >= left && value <= right) {
    return true;
  } else {
    return false;
  }
}

function findInterSection(section1, section2, error) {
  const [left1, right1] = section1;
  const [left2, right2] = section2;
  if ((right2 >= left1) || (right1 >= left2)) {
    const left = Math.max(left1, left2);
    const right = Math.min(right1, right2);
    return [left, right];
  }
  if (error !== false) {
    throw new Error('[Error] The two sets have no intersection.');
  }
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
  const interSection = findInterSection(fullSection, removeSection, false);
  if (interSection !== undefined) {
    return getDifferenceSet(fullSection, interSection);
  }
}

function isNullSection(section) {
  const [left, right] = section;
  if (left === right) {
    return true;
  } else {
    return false;
  }
}

function dealReverseSection(section1, section2) {
  const [l1, r1] = section1;
  const [l2, r2] = section2;
  if (r1 < l2) {
    return [1, [r1 + 1, l2 - 1]];
  } else {
    return [0, [r2 + 1, l1 - 1]];
  }
}

class StorageCache {
  constructor(options) {
    const defaultOptions = {
      blockSize: 2048,
      cacheStats: true,
      cacheOwn: false,
      cacheMod: false,
      cacheRealpath: false,
      cacheDiskOccupy: true,
    };
    if (typeof options !== 'object' && options !== null) {
      throw new Error('[Error] The parameter options should be of type object.');
    }
    this.options = Object.assign(defaultOptions, options);
    this.dealOptions();
    this.getEventEmitter = false;
    this.eventEmitter = new EventEmitter();
    this.data = new FileRouter({ logLevel: 0, debug: false, hideError: true, });
    this.fillNumber = 0;
    this.averageLength = 0;
  }

  emptyCache() {
    const {
      data,
    } = this;
    data.ruinAll();
  }

  newSeparation() {
  }

  getBlockPosition(location) {
    const {
      options: {
        blockSize,
      },
    } = this;
    return location % blockSize;
  }

  getOffset(data) {
    const {
      options: {
        blockSize,
      },
    } = this;
    const { length, } = data;
    return blockSize - length;
  }

  dealOptions() {
    const {
      options: {
        blockSize,
        cacheStats,
        cacheOwn,
        cacheMod,
        cacheRealpath,
        cacheDiskOccupy,
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
    if (typeof cacheRealpath !== 'boolean') {
      throw new Error('[Error] The option cacheRealpath should be a boolean type.');
    }
    if (typeof cacheDiskOccupy !== 'boolean') {
      throw new Error('[Error] The option cacheDiskOccupy should be a boolean type.');
    }
  }

  getEventEmitter() {
    return this.eventEmitter;
  }

  changeOptions(place, options) {
    if (typeof place !== 'string') {
      throw new Error('[Error] The parameter place should be a string type.');
    }
    place = this.getLinkPlace(place);
    if (typeof options !== 'object' && options !== null && !Array.isArray(options)) {
      throw new Error('[Error] The parameter options should be an object type.');
    }
    const {
      options,
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
    place = this.getLinkPlace(place);
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
    const {
      options: {
        cacheOwn,
      },
    } = digital;
    if (cacheOwn !== true) {
      throw new Error('[Error] The current file does not have the option to enable cache own.');
    }
    digital.own = [uid, gid];
  }

  updateStats(place, stats) {
    if (typeof place !== 'string') {
      throw new Error('[Error] The parameter place should be an object type.');
    }
    place = this.getLinkPlace(place);
    if (typeof options !== 'object' && options !== null && !Array.isArray(options)) {
      throw new Error('[Error] The stats options should be an object type.');
    }
    const {
      data,
    } = this;
    this.checkNotNull(place);
    const digital = data.gain(place);
    const {
      options: {
        cacheStats,
      },
    } = digital;
    if (cacheStats !== true) {
      throw new Error('[Error] The current file does not have the option to enable cache stats.');
    }
    digital.stats = stats;
  }

  updateRealpath(place, realpath) {
    if (typeof place !== 'string') {
      throw new Error('[Error] The parameter place should be an object type.');
    }
    place = this.getLinkPlace(place);
    if (typeof realpath !== 'string') {
      throw new Error('[Error] The parameter realpath should be an object type.');
    }
    const {
      data,
    } = this;
    this.checkNotNull(place);
    const digital = data.gain(place);
    const {
      options: {
        cacheRealpath,
      },
    } = digital;
    if (cacheRealpath !== true) {
      throw new Error('[Error] The current file does not have the option to enable cache realpath.');
    }
    digital.realpath = realpath;
  }

  updateMod(place, mod) {
    if (typeof place !== 'string') {
      throw new Error('[Error] The parameter place should be an object type.');
    }
    place = this.getLinkPlace(place);
    if (!(Number.isInteger(mod) && mod >= 0)) {
      throw new Error('[Error] The parameter mod should be an integer type.');
    }
    const {
      data,
    } = this;
    this.checkNotNull(place);
    const digital = data.gain(place);
    const {
      options: {
        cacheMod,
      },
    } = digital;
    if (cacheMod !== true) {
      throw new Error('[Error] The current file does not have the option to enable cache mod.');
    }
    digital.mod = mod;
  }

  updateDiskOccupy(place, diskOccupy) {
    if (typeof place !== 'string') {
      throw new Error('[Error] The parameter place should be an object type.');
    }
    place = this.getLinkPlace(place);
    if (!(Number.isInteger(diskOccupy) && diskOccupy >= 0)) {
      throw new Error('[Error] The parameter diskOccupy should be an integer type.');
    }
    const {
      data,
    } = this;
    this.checkNotNull(place);
    const digital = data.gain(place);
    const {
      options: {
        cacheMod,
      },
    } = digital;
    if (cacheDiskOccupy !== true) {
      throw new Error('[Error] The current file does not have the option to enable cache disk occupy.');
    }
    digital.diskOccupy = diskOccupy;
  }

  linkFile(sourcePlace, targetPlace) {
    if (typeof sourcePlace !== 'string') {
      throw new Error('[Error] The parameter sourcePlace should be a string type.');
    }
    if (typeof targetPlace !== 'string') {
      throw new Error('[Error] The parameter targetPlace should be a string type.');
    }
    const {
      data,
    } = this;
    data.attach(targetPlace, sourcePlace);
  }

  getLinkPlace(place) {
    const {
      data,
    } = this;
    const digital = data.gain(place);
    if (typeof digital === 'string') {
      return digital;
    } else {
      return place;
    }
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
          cacheRealpath,
          cacheDiskOccupy,
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
      if (cacheRealpath === true) {
        nullDigital[realpath] = '';
      }
      if (cacheDiskOccupy === true) {
        nullDigital[diskOccupy] = -1;
      }
      data.attach(place, nullDigital);
    }
  }

  checkBlocksContent(blocks) {
    blocks.forEach(({ type, index, range, data}, idx) => {
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

  setBlock(block, data, begin, end) {
    const { data, type, } = block;
    if (begin === 0) {
      if (typeof data === 'string') {
        block.data = data.substring(begin, end + 1);
      }
      if (Buffer.isBuffer(data)) {
        block.data = data.subarray(begin, end + 1);
      }
    } else {
      const offset = this.getOffset(data);
      if (typeof data === 'string') {
        block.data = data.substring(begin - offset, end + 1 - offset);
      }
      if (Buffer.isBuffer(data)) {
        block.data = data.subarray(begin - offset, end + 1 - offset);
      }
    }
  }

  setReverseBlock(block, kind, data, range) {
    const [begin, end] = range;
    if (begin === 0) {
      switch (kind) {
        case 0: {
          const beginPos = this.getBlockPostion(begin);
          const endPos = this.getBlockPosition(end);
          block.data = [block.data, this.getData(data, beginPos, endPos)];
          break;
        }
        case 1: {
          const beginPos = this.getBlockPosition(begin);
          const endPos = this.getBlockPostion(end);
          block.data = [this.getData(data, begin, end), block.data];
          break;
        }
      }
    } else {
      const offset = this.getOffset(data);
      switch (kind) {
        case 0: {
          block.data = [block.data, this.getData(data, begin - offset, end + 1 - offset)];
          break;
        }
        case 1:
          block.data = [this.getData(data, begin - offset, end + 1 - offset), block.data];
          break;
      }
    }
  }

  setInterBlock(block, data, type, inter, extend) {
    const [left, right] = inter;
    if (left === 0) {
      if (Buffer.isBuffer(data)) {
        for (let i = left; i <= right; i += 1) {
          block.data[i] = data[i];
        }
      }
      if (typeof data === 'string') {
        const charArray1 = block.data.split('');
        const charArray2 = data.split('');
        for (let i = left; i <= right; i += 1) {
          charArray1[i] = charArray2[i];
        }
        block.data = charArray1.join('');
      }
    } else {
      const offset = this.getOffset(data);
      if (Buffer.isBuffer(data)) {
        for (let i = left - offset; i <= right - offset; i += 1) {
          block.data[i] = data[i];
        }
      }
      if (typeof data === 'string') {
        const charArray1 = block.data.split('');
        const charArray2 = data.split('');
        for (let i = left - offset; i <= right - offset; i += 1) {
          charArray1[i] = charArray2[i];
        }
        block.data = charArray1.join('');
      }
    }
    const [head, tail] = extend;
    switch (type) {
      case 0:
        if (Buffer.isBuffer(data)) {
          block.data = data.subarray(head, tail + 1) + block.data;
        }
        if (typeof data === 'string') {
          block.data = data.substring(head, tail + 1) + block.data;
        }
        break;
      case 1:
        if (Buffer.isBuffer(data)) {
          block.data = block.data + data.subarray(head, tail + 1);
        }
        if (typeof data === 'string') {
          block.data = block.data + data.substring(head, tail + 1);
        }
        break;
    }
  }

  addPositiveBlock(block, data, begin, end) {
    const [begin, end] = range;
    const { data, range: scope, } = block;
    if (data === undefined) {
      block.range = [begin, end];
      this.setBlock(block, begin, end);
    }
    if (!interSection(range, scope)) {
      if (isBareSection(scope)) {
        block.range = [begin, end];
        this.setBlock(block, data, begin, end);
      } else {
        const [kind, span] = dealReverseSection(scope, range);
        block.type = 0;
        block.range = span;
        this.setReverseBlock(block, kind, data, range);
      }
    } else {
      const [left, right] = scope;
      const interSection = findInterSection(scope, range);
      if (begin <= left) {
        block.range = [begin, right];
        this.setInterBlock(block, data, 0, interSection, [begin, right + 1]);
      } else if (end >= right) {
        block.range = [left, end];
        this.setInterBlock(block, data, 1, interSection, [right + 1, end]);
      }
    }
  }

  addReverseBlock(block, data, begin, end, blockSize) {
    const [left, right] = range;
    const { data: digital, range: scope, } = block;
    const [section1, section2] = getDifferenceSection([0, blockSize - 1], scope);
    const interSection1 = findInterSection(section1, range, false);
    const interSection2 = findInterSection(section2, range, false);
    if (interSection1 !== undefined && interSection2 !== undefined) {
      block.type = 1;
      block.range = [0, blockSize - 1];
      const difference1Section = getDifferenceSection(section1, range);
      const difference2Section = getDifferenceSection(section2, range);
      block.data = Buffer.alloc(blockSize);
      const [begin1, end1] = difference1Section;
      const [begin2, end2] = difference2Section;
      this.placeBlock(block, digital[0], begin1, end1);
      this.placeBlock(block, digital[1], begin2, end2);
      this.placeBlock(block, data, begin, end);
    } else if (interSection1 !== undefined) {
      const max = Math.max(left, end);
      if (max === end) {
        block.range = [max + 1, right];
        block.data[0] = Buffer.alloc(max);
        const difference1Section = getDifferenceSection(section1, range);
        const [begin1, end1] = difference1Section;
        this.placeBlock(block, digital[0], 0, begin1, end1);
        this.placeBlock(block, data, 0, end1 + 1, max);
      } else {
        this.setBlock(block, data, begin, end);
      }
    } else if (interSection2 !== undefined) {
      if (min === start) {
        const min = Math.min(right, start);
        block.range = [left, min + 1];
        const difference1Section = getDifferenceSection(section2, range);
        block.data[1] = Buffer.alloc(blockSize - 1 - min);
        const [begin1, end1] = difference2Section;
        this.placeBlock(block, digital[1], 1, begin1, end1);
        this.placeBlock(block, data, 1, min, end1 + 1);
      } else {
        this.setBlock(block, data, begin, end);
      }
    } else {
      const length1 = getBetweenLength(section1, range);
      const length2 = getBetweenLength(range, section2);
      const { eventEmitter, } = this;
      if (length1 <= length2) {
        const fillSection = [right + 1, right + 1 + length];
        block.range = [end + 1, right];
        let figure;
        eventEmitter.on('giveData', (data) => figure = data);
        eventEmitter.emit('requestData', fillSection[0], fillSection[1]);
        if (figure === undefined) {
          throw new Error('[Error] The process of processing the fill data was omitted.')
        }
        this.placeBlock(block, figure, 0, , end1 + 1);
        this.fillNumber += 1;
      } else {
        const fillSection = [left + 1 - length, left + 1];
        block.range = [end + 1, right];
        block.range = [left, begin + 1];
        let figure;
        eventEmitter.on('giveData', (data) => figure = data);
        eventEmitter.emit('requestData', fillSection[0], fillSection[1]);
        if (figure === undefined) {
          throw new Error('[Error] The process of processing the fill data was omitted.')
        }
        this.placeBlock(block, figure, 1, fillSection[0], fillSection[1]);
        this.fillNumber += 1;
      }
    }
  }

  placeBlock(block, data, type, begin, end) {
    const { data: digital, } = block;
    if (begin === 0) {
      if (Buffer.isBuffer(data)) {
        for (let i = begin; i <= end; i += 1) {
          digital[type][i] = data[i];
        }
      }
      if (typeof data === 'string') {
        const charArray1 = digital[type].split('');
        const charArray2 = data.split('');
        for (let i = begin; i <= end; i += 1) {
          charArray1[i] = charArray2[i];
        }
        block.data = charArray1[i].join('');
      }
    } else {
      const offset = this.getOffset(data);
      if (Buffer.isBuffer(data)) {
        const figure = digital[type];
        for (let i = begin - offset; i <= end - offset; i += 1) {
          figure[i] = data[i];
        }
      }
      if (typeof data === 'string') {
        const charArray1 = digital[type].split('');
        const charArray2 = data.split('');
        for (let i = begin - offset; i <= end - offset; i += 1) {
          charArray1[i] = charArray2[i];
        }
        block.data = charArray1[i].join('');
      }
    }
  }

  addBlocks(place, range, figure) {
    if (typeof place !== 'string') {
      throw new Error('[Error] The parameter place should be a string type.');
    }
    if (dealPlace !== undefined) {
      if (dealPlace !== 'boolean') {
        throw new Error('[Error] The parameter dealPlace should be a boolean type.');
      }
    }
    if (dealPlace !== false) {
      place = this.getLinkPlace();
    }
    place = this.getLinkPlace(place);
    if (!Array.isArray(blocks)) {
      throw new Error('[Error] The parameter blocks should be an array type.');
    }
    if (Buffer.isBuffer(figure) && typeof figure !== 'string') {
      throw new Error('[Error] The parameter blocks should be a buffer or string.');
    }
    const {
      data,
    } = this;
    this.checkNotNull(place);
    const digital = data.gain(place);
    const {
      options: {
        blockSize,
      },
      blocks: chunks,
    } = digital;
    this.checkBlocksContent(blocks);
    const [start, end] = range;
    const begin = start % blockSize;
    const count = begin;
    if (end <= ((begin + 1) * blockSize)) {
      const chunk = chunks[begin];
      const { type, } = chunk;
      switch (type) {
        case 0:
          this.addReverseBlock(chunk, digital, data, begin, end, blockSize);
          break;
        case 1:
          this.addPositveBlock(chunk, digital, data, begin, end);
          break;
      }
      continue;
    }
    let ptr = (begin + 1) * blockSize;
    let count = begin + 1;
    while (true) {
      ptr += blockSize;
      if (ptr >= end) {
        const chunk = chunks[count];
        const { type, } = chunk;
        switch (type) {
          case 0:
            this.addReverseBlock(chunk, digital, data, ptr - blockSize, end, blockSize);
            break;
          case 1:
            this.addPositiveBlock(chunk, digital, data, ptr - blockSize, end);
            break;
        }
        break;
      } else {
        const chunk = chunks[count];
        switch (type) {
          case 0:
            this.addReverseBlock(chunk, digital, data, ptr - blockSize, ptr, blockSize);
            break;
          case 1:
            this.addPositiveBlock(chunk, digital, data, ptr - blockSize, ptr);
            break;
        }
      }
    }
  }

  addGroupBlocks(place, ranges, figures) {
    if (typeof place !== 'string') {
      throw new Error('[Error] The parameter place should be a string type.');
    }
    if (!Array.isArray(ranges)) {
      throw new Error('[Error] The parameter ranges should be an array type.');
    }
    if (!Array.isArray(figures)) {
      throw new Error('[Error] The parameter figures should be an array type.');
    }
    if (ranges.length !== figures.length) {
      throw new Error('[Error] The parameter ranges length shoule be equal to parameter figures.');
    }
    ranges.forEach((range, idx) => {
      this.addBlocks(place, range, figures[idx], false);
    });
  }

  rename(place1, place2) {
    if (typeof place1 !== 'string') {
      throw new Error('[Error] The parameter place1 should be a string type.');
    }
    if (typeof place2 !== 'string') {
      throw new Error('[Error] The parameter place1 should be a string type.');
    }
    this.checkNotNull(place1);
    const {
      data,
    } = this;
    data.exchange(place1, place2);
  }

  shrinkLength(place, length) {
    if (typeof place !== 'string') {
      throw new Error('[Error] The parameter place should be a string type.');
    }
    place = this.getLinkPlace(place);
    if (!Number.isInteger(length)) {
      throw new Error('[Error] The parameter length should be an integer type.');
    }
    if (length > 0) {
      throw new Error('[Error] The parameter length should be a positive integer.')
    }
    const {
      data,
    } = this;
    const digital = data.gain(place);
    const {
      blocks: chunks,
    } = digital;
    blocks.forEach((block, idx) => {
      const [type, index, range, data] = block;
      const [left, right] = range;
      if (left > length) {
        blocks.splice(idx, 1);
      } else if (inSection(length, range)) {
        block.data = this.getData(data, left, length);
        block.range = [left, length];
      }
    });
  }

  overlapBlocks(place, blocks) {
    if (typeof place !== 'string') {
      throw new Error('[Error] The parameter place should be a string type.');
    }
    place = this.getLinkPlace(place);
    if (!Array.isArray(blocks)) {
      throw new Error('[Error] The parameter blocks should be an array type.');
    }
    const {
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
      chunks[index] = { type: 1, range, data, };
    });
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
      throw new Error('[Error] The start parameter of the ' + idx + ' should be less than or equal to correspond the end parameter.');
    }
  }

  removeEndBlock(block, begin, end) {
  }

  removeBeginBlock(blocks, index, begin, end) {
    const {
      options: {
        blockSize,
      },
    } = this;
    const block = blocks[index];
    if (begin === 0) {
      const range = [begin, end];
      const { data, range: scope, } = block;
      if (typeof block === 'string') {
        const [left, right] = getComplement(scope, range);
        if ((left === 0) || (right === blockSize - 1)) {
          blocks[index] = undefined;
        } else {
          block.type = 0;
          block.range = [left, right];
          block.data = [];
          const { data: digital, } = block;
          digital[0] = data.substring(0, left);
          digital[1] = data.substing(right + 1, blockSize);
        }
      }
      if (Buffer.isBuffer(block)) {
        const [left, right] = getComplement(scope, range);
        if ((left === 0) || (right === blockSize - 1)) {
          blocks[index] = undefined;
        } else {
          block.type = 0;
          block.range = [left, right];
          block.data = [];
          const { data: digital, } = block;
          digital[0] = data.subarray(0, left);
          digital[1] = data.subarray(right + 1, blockSize);
        }
      }
    } else {
      const offset = this.getOffset(data);
      const range = [begin, end];
      const { data, range: scope, } = block;
      if (typeof block === 'string') {
        if ((left === 0) || (right === blockSize - 1)) {
          blocks[index] = undefined;
        } else {
          block.type = 0;
          block.range = [left, right];
          block.data = [];
          const { data: digital, } = block;
          digital[0] = data.substring(0, left);
          digital[1] = data.substring(right + 1 - offset, blockSize - offset);
        }
      }
      if (Buffer.isBuffer(block)) {
        if ((left === 0) || (right === blockSize - 1)) {
          blocks[index] = undefined;
        } else {
          block.type = 0;
          block.range = [left, right];
          block.data = [];
          const { data: digital, } = block;
          digital[0] = data.subarray(0, left);
          digital[1] = data.subarray(right + 1 - offset, blockSize - offset);
        }
      }
    }
  }

  removeFullBlock(blocks, index, begin, end) {
    const {
      options: {
        blockSize,
      },
    } = this;
    const block = blocks[index];
    if (block !== undefined) {
      blocks[index] = undefined;
    }
  }

  removeBlocks(place, range, dealPlace) {
    if (typeof place !== 'string') {
      throw new Error('[Error] The parameter place should be a string type.');
    }
    if (dealPlace !== undefined) {
      if (dealPlace !== 'boolean') {
        throw new Error('[Error] The parameter dealPlace should be a boolean type.');
      }
    }
    if (dealPlace !== false) {
      place = this.getLinkPlace();
    }
    this.checkRangeContent(range);
    const {
      data,
    } = this;
    const digital = data.gain(place);
    const {
      options: {
        blockSize,
      },
      range,
      blocks: chunks,
    } = digital;
    const [start, end] = range;
    const begin = start % blockSize;
    const count = begin;
    if (end < ((begin + 1) * blockSize)) {
      const chunk = chunks[begin];
      this.removeBeginBlock(chunks, begin, begin, end);
      continue;
    } else {
      const chunk = chunks[begin];
      if (start === 0) {
        this.removeBeginBlock(chunk, start, (begin + 1) * blockSize);
      } else {
        this.removeBeginBlock(chunk, start, (begin + 1) * blockSize);
      }
    }
    let ptr = (begin + 1) * blockSize;
    let count = begin + 1;
    while (true) {
      ptr += blockSize;
      if (ptr >= end) {
        const chunk = chunks[count];
        this.removeEndBlock(chunks, count, ptr - blockSize, end);
        break;
      } else {
        const chunk = chunks[count];
        this.removeFullBlock(chunks, count, ptr - blockSize, ptr);
      }
    }
  }

  removeGroupBlocks(place, ranges) {
    if (typeof place !== 'string') {
      throw new Error('[Error] The parameter place should be a string type.');
    }
    place = this.getLinkPlace(place);
    if (!Array.isArray(ranges)) {
      throw new Error('[Error] The parameter ranges should be an array type.');
    }
    const ans = [];
    ranges.forEach((range) => {
      this.removeBlocks(place, range, false);
    });
  }

  getMiddleBlock(block, begin, end) {
    const { data, type, } = block;
    if (begin === 0) {
      if (typeof data === 'string') {
        return data.substring(begin, end + 1);
      }
      if (Buffer.isBuffer(data)) {
        return data.subarray(begin, end + 1);
      }
    } else {
      const offset = this.getOffset(data);
      if (typeof data === 'string') {
        return data.substring(begin - offset, end + 1 - offset);
      }
      if (Buffer.isBuffer(data)) {
        return data.subarray(begin - offset, end + 1 - offset);
      }
    }
  }

  getBlocks(place, range, dealPlace) {
    if (typeof place !== 'string') {
      throw new Error('[Error] The parameter place should be a string type.');
    }
    if (dealPlace !== undefined) {
      if (dealPlace !== 'boolean') {
        throw new Error('[Error] The parameter dealPlace should be a boolean type.');
      }
    }
    if (dealPlace !== false) {
      place = this.getLinkPlace();
    }
    place = this.getLinkPlace(place);
    if (!Array.isArray(range)) {
      throw new Error('[Error] The parameter indexs should be an array type.');
    }
    this.checkRangeContent(range);
    const {
      data,
    } = this;
    const digital = data.gain(place);
    const {
      options: {
        blockSize,
      },
      range,
      blocks: chunks,
    } = digital;
    const [start, end] = range;
    const begin = start % blockSize;
    const ans = [];
    if (end < ((begin + 1) * blockSize)) {
      const chunk = chunks[begin];
      ans.push(this.getBeginBlock(chunk, begin, end));
      continue;
    } else {
      ans.push(this.getBeginBlock(chunk, (begin + 1) * blockSize));
    }
    let ptr = (begin + 1) * blockSize;
    let count = begin + 1;
    while (true) {
      ptr += blockSize;
      count += 1;
      const chunk = chunks[count];
      if (ptr >= end) {
        ans.push(this.getEndBlock(chunk, ptr - blockSize, end));
        break;
      } else {
        ans.push(this.getMiddleBlock(chunk, ptr - blockSize, ptr));
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
      ans.push(this.getBlocks(place, range, false));
    });
    return ans;
  }
}

export default StorageCache;
