import net from 'net';
import os from 'os';
import { Buffer, } from 'buffer';
import { FileRouter, } from 'advising.js';
import {
  ByteArray,
  checkLogPath,
  addToLog,
  appendToLog,
  logOutOfMemory,
  getGTMNowString,
} from 'manner.js/server';
import radixSort from '~/lib/util/radixSort';

const nonZeroByteArray = new ByteArray({ size: 256n, shift: 1n, });

function getBinBuf(params) {
  if (!Array.isArray(params)) {
    throw new Error('[Error] The params parameter should be an array type.');
  }
  const { length, } = params;
  if (length <= 1) {
    throw new Error('[Error] The length of the params parameter should be greater than or equal to two');
  }
  const pbytes = [];
  params.forEach((param) => {
    switch (typeof param) {
      case 'string':
        pbytes.push(Array.from(Buffer.from(param)));
        break;
      case 'number':
        if (!Number.isInteger(param)) {
          throw new Error('[Error] If the param type is a number, ite should be an integer.');
        }
        pbytes.push(Array.from(nonZeroByteArray.fromInt(param)));
        break;
    }
    pbytes.push(0);
  });
  const buf = Buffer.from(pbytes.flat());
  return buf;
}

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
  }
  if (inSection(removeRight, fullSection)) {
    ans.push([removeRight + 1, fullRight]);
  }
  return ans;
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

function getSectionLength(section) {
  const [left, right] = section;
  return right - left + 1;
}

function joinContinuousSections(sections) {
  const { length, } = sections;
  const [left] = sections[0];
  const [_, right] = sections[length - 1];
  return [left, right];
}

function bitToByte(bit) {
  if (!Number.isInteger(bit)) {
    throw new Error('[Error] The parameter bit should be of integer type.');
  }
  if (!(bit > 0)) {
    throw new Error('[Error] The parameter bit should be of positive integer type.');
  }
  const byte = bit / 8;
  if (!Number.isInteger(byte)) {
    throw new Error('[Error] The calculated number of bytes should be an integer.')
  }
}

function getBitWidth() {
  const arch = os.arch();
  switch (arch) {
    case 'ia32':
    case 'arm':
    case 's390x':
      return 32;
    case 'x64':
    case 'riscv64':
    case 'ppc64':
    case 'mips':
    case 'loong64':
    case 'arm64':
      return 64;
  }
}

function checkAmountsNotNull(count, place) {
  if (count.gain(place) === undefined){
    count.attach(place, { amounts: [], orders: [], outOfOrder: false, });
  }
}
function getStringOccupy(length) {
  return (length + 1) * 4 * 8;
}

function getBufferOccupy(length) {
  return length * 8;
}

function getDataOccupy(data) {
  const {
    length,
  } = data;
  if (typeof data === 'string') {
    return (length + 1) * 4 * 8;
  }
  if (Buffer.isBuffer(data)) {
    return length * 8;
  }
}

function getNextBorder(id, blockSize) {
  return Math.floor((id + blockSize) / blockSize) * blockSize - 1;
}

function getBlockIndex(start, blockSize) {
  return Math.floor(start / blockSize);
}

class StorageCache {
  constructor(options) {
    const defaultOptions = {
      threshold: 0.01,
      bond: 25,
      dutyCycle: 500,
      logLevel: 0,
      blockSize: 2048,
      cacheStats: false,
      cacheOwn: false,
      cacheMod: false,
      cacheRealpath: false,
      cacheDiskOccupy: false,
      logPath: '/var/log/immense.js',
      safeMemoryCapacity: 4 * 1024 * 1024 * 1024,
      ip: '127.0.0.1',
      port: 7000,
    };
    defaultOptions.bitWidth = getBitWidth();
    if (typeof options !== 'object' && options !== null) {
      throw new Error('[Error] The parameter options should be of type object.');
    }
    this.defaultOptions = defaultOptions;
    this.options = Object.assign(defaultOptions, options);
    this.dealOptions(this.options);
    const {
      options: {
        logLevel,
      },
    } = this;
    this.data = new FileRouter({ logLevel, debug: false, hideError: true, });
    this.count = new FileRouter({ logLevel: 0, debug: false, hideError: true, });
    this.startTime = Date.now();
    this.place = '';
    this.fillNumber = 0;
    this.totalNumber = 0;
    this.averageLength = 0;
    this.minimumLength = 5 * bitToByte(this.getArrayOccupy(5) + 6 * this.getPointerOccupy());
    this.checkMemory();
  }

  setUpClient() {
    try {
      const {
        ip,
        port,
      } = this;
      const client = net.createConnection(port, ip, () => {
      });
      client.on('close', () => {
        client.destroySoon();
      });
      this.client = client;
    } catch (error) {
    }
  }

  getCache(place, stats) {
    if (cacheOwn === true) {
      this.updateOwn(place, uid, gid);
    }
    delete stats.uid;
    delete stats.gid;
    if (cacheMod === true) {
      this.updateMod(place, mod);
    }
    delete stats.mode;
    this.updateStats(stats);
  }

  renewStats(place, stats) {
    delete stats.uid;
    delete stats.gid;
    delete stats.mode;
    this.updateStats(place, stats);
  }

  setTemporaryMemorySwitch(temporaryMemorySwitch) {
    if (typeof temporaryMemorySwtich !== 'boolean') {
      throw new Error('[Error] Parameter temporaryMemorySwtich should be of boolean type.');
    }
    this.temporaryMemorySwitch = temporaryMemorySwitch;
  }

  getBlockOccupy(block) {
    const { type, range, data, } = block;
    const {
      length,
    } = range;
    const objectOccupy = this.getArrayOccupy(5) + this.getPointerOccupy();
    const rangeOccupy = this.getArrayOccupy(length);
    const typeOccupy = this.getIntegerOccupy();
    const dataOccupy = getDataOccupy(data);
    return bitToByte(objectOccupy + rangeOccupy + typeOccupy + dataOccupy);
  }

  countSection(place, section) {
    const {
      count,
    } = this;
    checkAmountsNotNull(count, place);
    const quantity = count.gain(place);
    const { amounts, } = quantity;
    const [l, r] = section;
    for (let i = l; i <= r; i += 1) {
      if (amounts[i] === undefined) {
        amounts[i] = 0;
      }
      amounts[i] += 1;
    }
    quantity.outOfOrdder = true;
    this.checkMemory();
  }

  sortOrders(place) {
    const {
      count,
    } = this;
    const quantity = count.gain(place);
    if (quantity !== undefined) {
      const {
        amounts,
      } = quantity;
      quantity.orders = amounts.map((e, i) => [e, i]);
      quantity.orders = radixSort(this.orders);
      quantity.outOfOrder = false;
    }
    this.checkMemory();
  }

  checkMemory() {
    const {
      temporaryMemorySwitch,
      safeMemoryCapacity,
    } = this;
    let capacity;
    if (safeMemoryCapacity === undefined) {
      capacity = 0;
    } else {
      capacity = safeMemoryCapacity;
    }
    let freemem = os.freemem();
    if (temporaryMemorySwitch === true) {
      freemem = capacity;
    }
    let ans = false;
    if (freemem > capacity) {
      ans = true;
    } else {
      const {
        options: {
          debug,
          logPath,
        },
        constructor: {
          name,
        },
      } = this;
      logOutOfMemory(logPath, freemem);
    }
    return ans;
  }

  addSinglePart(place, section1, block) {
    const { type, data, } = block;
    switch (type) {
      case 0:
        this.addBlock(place, section1, data[0]);
        break;
      case 1:
        this.addBlock(place, section1, data);
        break;
    }
  }

  addIncompletePart(place, block, incompleteBlockWrap) {
    incompleteBlockWrap.val = block;
  }

  anewSeparation(place, newBlockSize) {
    if (typeof place !== 'string') {
      throw new Error('[Error] The parameter place should be a string type.');
    }
    place = this.getLinkPlace(place);
    const {
      data,
      options: {
        logLevel,
      },
    } = this;
    const digital = data.gain(place);
    const {
      blocks,
      options,
    } = digital;
    const {
      blockSize,
    } = options;
    this.newData = new FileRouter({ logLevel, debug: false, hideError: true, });
    const nullDigital = {
      options,
      blocks: [],
    };
    nullDigital.options['blockSize'] = newBlockSize;
    const {
      options: {
        cacheStats,
        cacheOwn,
        cacheMod,
        cacheRealpath,
        cacheDiskOccupy,
      },
    } = nullDigital;
    if (cacheStats === true) {
      nullDigital[stats] = {};
    }
    if (cacheOwn === true) {
      nullDigital[own] = [-1, -1];
    }
    if (cacheMod === true) {
      nullDigital[mod] = -1;
    }
    if (cacheRealpath === true) {
      nullDigital[realpath] = '';
    }
    if (cacheDiskOccupy === true) {
      nullDigital[diskOccupy] = -1;
    }
    const {
      newData,
    } = this;
    const incompleteBlockWrap = { val: undefined, };
    for (let i = 0; i < blocks.length; i += 1) {
      if (block !== undefined) {
        const { range, type, data, } = block;
        switch (type) {
          case 0: {
            const [section1, section2] = getDifferenceSection([0, newBlockSize - 1], range);
            const { val: incompleteBlock, } = incompleteBlockWrap;
            if (incompleteBlock !== undefined) {
              const { data: kind, data: figure, } = incompleteBlock;
              let joinSection;
              switch (kind) {
                case 0: {
                  const { range: scope, } = incompleteBlock;
                  const [_, interval2] = getDifferenceSection([0, blockSize - 1], scope);
                  joinSection = joinContinuousSections(interval2, section1);
                  break;
                }
                case 1: {
                  const { range: scope, } = incompleteBlock;
                  joinSection = joinContinuousSections(scope, section1);
                  break;
                }
              }
              if (typeof data === 'string') {
                if (typeof figure === 'string') {
                  switch (kind) {
                    case 0:
                      this.addBlock(place, joinSection, figure[0] + data[0]);
                      this.addIncompletePart(place, block, incompleteBlockWrap);
                      break;
                    case 1:
                      this.addBlock(place, joinSection, figure + data[0]);
                      this.addIncompletePart(place, block, incompleteBlockWrap);
                      break;
                  }
                  continue;
                } else {
                  this.addBlock(place, scope, figure);
                  this.addSinglePart(place, section1, block);
                }
              }
              if (Buffer.isBuffer(data)) {
                if (Buffer.isBuffer(figure)) {
                  switch (kind) {
                    case 0:
                      this.addBlock(place, joinSection, Buffer.concat([figure[0], data[0]]));
                      this.addIncompletePart(place, block, incompletBlockWrap);
                      break;
                    case 1:
                      this.addBlock(place, joinSection, Buffer.concat([figure, data[0]]));
                      this.addIncompletePart(place, block, incompleteBlockWrap);
                      break;
                  }
                  continue;
                } else {
                  this.addBlock(place, scope, figure);
                  this.addSinglePart(place, section1, block);
                }
              }
            } else {
              this.addSinglePart(place, section1, block);
            }
            this.addIncompletePart(place, block, incompleteBlockWrap);
            break;
          }
          case 1: {
            const { val: incompleteBlock, } = incompleteBlockWrap;
            const [left, right] = range;
            if (incompleteBlock !== undefined) {
              const { data: kind, range: scope, data: figure, } = incompleteBlock;
              if (left === 0 && right === blockSize - 1) {
                switch (kind) {
                  case 0: {
                    if (typeof data === 'string') {
                      if (typeof figure === 'string') {
                        incompleteBlock.type = 1;
                        incompleteBlock.range = joinContinuousSections(scope, range);
                        incompleteBlock.data = data[1] + figure;
                      } else {
                        this.addSinglePart(place, scope, figure);
                        this.addBlock(place, range, data);
                      }
                      if (Buffer.isBuffer(data)) {
                        if (Buffer.isBuffer(figure)) {
                          incompleteBlock.type = 1;
                          incompleteBlock.range = joinContinuousSections(scope, range);
                          incompleteBlock.data = Buffer.concat(data[1], figure);
                        } else {
                          this.addSinglePart(place, scope, figure);
                          this.addBlock(place, range, data);
                        }
                      }
                    }
                    break;
                  }
                  case 1: {
                    if (typeof data === 'string') {
                      if (typeof figure === 'string') {
                        incompleteBlock.range = joinContinuousSections(scope, range);
                        incompleteBlock.data = data + figure;
                      } else {
                        this.addSinglePart(place, scope, figure);
                        this.addBlock(place, range, data);
                      }
                      if (Buffer.isBuffer(data)) {
                        if (Buffer.isBuffer(figure)) {
                          incompleteBlock.range = joinContinuousSections(scope, range);
                          incompleteBlock.data = Buffer.concat(data, figure);
                        } else {
                          this.addSinglePart(place, scope, figure);
                          this.addBlock(place, range, data);
                        }
                      }
                    }
                    break;
                  }
                }
              } else if (left === 0) {
                let joinSection;
                switch (kind) {
                  case 0: {
                    const { range: scope, } = incompleteBlock;
                    const [_, interval2] = getDifferenceSection([0, blockSize - 1], scope);
                    joinSection = joinContinuousSections(interval2, range);
                    break;
                  }
                  case 1: {
                    const { range: scope, } = incompleteBlock;
                    joinSection = joinContinuousSections(scope, section1);
                    break;
                  }
                }
                if (typeof data === 'string') {
                  if (typeof figure === 'string') {
                    switch (kind) {
                      case 0:
                        this.addBlock(place, joinSection, figure[0] + data);
                        break;
                      case 1:
                        this.addBlock(place, joinSection, figure + data);
                        break;
                    }
                    continue;
                  } else {
                    this.addSinglePart(place, scope, figure);
                    this.addBlock(place, range, data);
                  }
                }
                if (Buffer.isBuffer(data)) {
                  if (Buffer.isBuffer(figure)) {
                    switch (kind) {
                      case 0:
                        this.addBlock(place, joinSection, Buffer.concat([figure[0], data]));
                        break;
                      case 1:
                        this.addBlock(place, joinSection, Buffer.concat([figure, data]));
                        break;
                    }
                    continue;
                  } else {
                    this.addSinglePart(place, scope, figure);
                    this.addBlock(place, range, data);
                  }
                }
                continue;
              } else {
                this.addBlock(place, range, block);
              }
            }
            break;
          }
        }
      }
    }
    newData.attach(place, nullDigital);
    data.ruinAll();
    this.data = newData;
    delete this.newData;
    this.checkMemory();
  }

  transformBlocks(place, data, start) {
    if (typeof place !== 'string') {
      throw new Error('[Error] The parameter place should be a string type.');
    }
    if (!Number.isInteger(start)) {
      throw new Error('[Error] The parameter start should be of integer type.');
    }
    if (!(start >= 0)) {
      throw new Error('[Error] The parameter start should be of positive integer type.');
    }
    this.checkNotNull(place);
    place = this.getLinkPlace(place);
    const {
      data: figure,
    } = this;
    const digital = figure.gain(place);
    const {
      options: {
        blockSize,
      },
    } = digital;
    const { length, } = data;
    const blocks = [];
    if (typeof data === 'string') {
      const string = data;
      let index = getBlockIndex(start, blockSize);
      let pointer = start;
      while (true) {
        if (pointer === start) {
          const end = getNextBorder(start, blockSize);
          if (end >= start + length - 1) {
            blocks.push({
              index,
              type: 1,
              range: [start, start + length - 1],
              data: string.substring(start, end + 1),
            });
            break;
          } else {
            blocks.push({
              index,
              type: 1,
              range: [start, end],
              data: string.substring(start, end + 1),
            });
            pointer = end + 1;
          }
        } else if (pointer + blockSize - 1 >= start + length - 1) {
          const end = start + length - 1;
          blocks.push({
            index,
            type: 1,
            range: [pointer, end],
            data: string.substring(pointer, end + 1),
          });
          break;
        } else {
          const start = pointer;
          pointer += blockSize - 1;
          blocks.push({
            index,
            type: 1,
            range: [start, pointer],
            data: string.substring(start, pointer + 1),
          });
          pointer += 1;
        }
        index += 1;
      }
    } else if (Buffer.isBuffer(data)) {
      const buffer = data;
      let index = getBlockIndex(start, blockSize);
      let pointer = start;
      while (true) {
        if (pointer === start) {
          const end = getNextBorder(start, blockSize);
          if (end >= start + length - 1) {
            blocks.push({
              index,
              type: 1,
              range: [start, start + length - 1],
              data: buffer.subarray(start, end + 1),
            });
            break;
          } else {
            blocks.push({
              index,
              type: 1,
              range: [start, end],
              data: buffer.subarray(start, end + 1),
            });
            pointer = end + 1;
          }
        } else if (pointer + blockSize - 1 >= start + length - 1) {
          const end = start + length - 1;
          blocks.push({
            index,
            type: 1,
            range: [pointer, end],
            data: buffer.subarray(pointer, end + 1),
          });
          break;
        } else {
          const start = pointer;
          pointer += blockSize - 1;
          blocks.push({
            index,
            type: 1,
            range: [start, pointer],
            data: buffer.subarray(start, pointer + 1),
          });
          pointer += 1;
        }
        index += 1;
      }
    } else {
      throw new Error('[Error] The parameter data should be of string type or buffer type.');
    }
    return blocks;
  }

  getIntegerOccupy() {
    const {
      options: {
        bitWidth,
      },
    } = this;
    return bitWidth;
  }

  getPointerOccupy() {
    const {
      options: {
        bitWidth,
      },
    } = this;
    return bitWidth;
  }

  getArrayOccupy(length) {
    const {
      options: {
        bitWidth,
      },
    } = this;
    return (length * 2 + 1) * bitWidth;
  }

  emptyCache() {
    const {
      data,
      count,
    } = this;
    data.ruinAll();
    count.ruinAll();
  }

  updateAverageLength(newAverageLength) {
    const {
      averageLength,
    } = this;
    if (averageLength === 0) {
      this.averageLength = newAverageLength;
    } else {
      this.averageLength = (averageLength + newAverageLength) / 2;
    }
  }

  increaseFillNumber() {
    this.fillNumber += 1;
    this.updateDutyCycle();
    this.updateRate();
    const { place, } = this;
    if (this.greaterThresholdAndBondAndDutyCycle(place)) {
      const { averageLength, minimumLength, } = this;
      if (averageLength > minimumLength) {
        this.anewSeperation(place, averageLength);
      } else {
        this.anewSeperation(place, minimumLength);
      }
      this.averageLength = 0;
      this.fillNumber = 0;
      this.dutyCycle = 0;
      this.rate = 0;
    }
  }

  updateRate() {
    const {
      fillNumber,
      totalNumber,
    } = this;
    this.rate = fillNumber / totalNumber;
  }

  postOperation() {
    this.place = '';
    this.totalNumber += 1;
  }

  updateDutyCycle() {
    const {
      fillNumber,
    } = this;
    const endTime = Date.now();
    this.dutyCycle = fillNumber * 1000 * 60 * 60 / (startTime - endTime);
  }

  getBlockInterval(section) {
    const {
      options: {
        blockSize,
      },
    } = this;
    const [left, right] = section;
    const leftIndex = left % blockSize;
    const rightIndex = right % blockSize;
    return [leftIndex, rightIndex];
  }

  dealOptions(options) {
    const {
      threshold,
      bond,
      dutyCycle,
      logLevel,
      blockSize,
      cacheStats,
      cacheOwn,
      cacheMod,
      cacheRealpath,
      cacheDiskOccupy,
      bitWidth,
      safeMemoryCapacity,
      ip,
      port,
    } = options;
    if (threshold !== undefined) {
      if (typeof threshold !== 'number') {
        throw new Error('[Error] The option threshold should be a number type.');
      }
    }
    if (bond !== undefined) {
      if (!Number.isInteger(bond)) {
        throw new Error('[Error] The option bond should be an integer type.');
      }
    }
    if (dutyCycle !== undefined) {
      if (typeof threshold !== 'number') {
        throw new Error('[Error] The option dutyCycle should be a number type.');
      }
    }
    if (!Number.isInteger(logLevel)) {
      throw new Error('[Error] The option logLevel should be an integer type.');
    }
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
    if (!Number.isInteger(bitWidth)) {
      throw new Error('[Error] The option bitWidth should be a integer type.');
    }
    if (!(bitWidth > 0)) {
      throw new Error('[Error] The option bitWidth should be a positive integer.');
    }
    if (!Number.isInteger(safeMemoryCapacity)) {
      throw new Error('[Error] The option safeMemoryCapacity should be a integer type.');
    }
    if (!(safeMemoryCapacity > 0)) {
      throw new Error('[Error] The option safeMemoryCapacity should be a positive integer.');
    }
    if (!Number.isInteger(port)) {
      throw new Error('[Error] The option storagePort should be a integer type.');
    }
    if (!(port > 0)) {
      throw new Error('[Error] The option storagePort should be a positive integer.');
    }
    if (typeof ip !== 'string') {
      throw new Error('[Error] The option storageIp should be of string type.');
    }
  }

  greaterThresholdAndBondAndDutyCycle(place) {
    if (typeof place !== 'string') {
      throw new Error('[Error] The parameter place should be a string type.');
    }
    place = this.getLinkPlace(place);
    const {
      data,
    } = this;
    const digital = data.gain(place);
    const {
      options: {
        threshold,
        bond,
        dutyCycle,
      },
    } = digital;
    if (threshold === undefined && bond === undefined && dutyCycle !== undefined) {
      return this.dutyCycle >= dutyCycle;
    }
    if (threshold === undefined && dutyCycle === undefined && bond !== undefined) {
      const { fillNumber, } = this;
      return fillNumber >= bond;
    }
    if (bond === undefined && dutyCycle === undefined && threshold !== undefined) {
      const { rate, } = this;
      return rate >= threshold;
    }
    if (bond !== undefined && dutyCycle !== undefined && threshold !== undefined) {
      const { fillNumber, } = this;
      return fillNumber >= bond && this.dutyCycle >= dutyCycle;
    }
    if (threshold !== undefined && dutyCycle !== undefined && bond === undefined) {
      const { rate, } = this;
      return threshold >= threshold && this.dutyCycle >= dutyCycle;
    }
    if (threshold !== undefined && bond !== undefined && dutyCycle === undefined) {
      const { rate, fillNumber, } = this;
      return rate >= threshold && fillNumber >= bond;
    }
    if (threshold !== undefined && bond !== undefined && dutyCycle !== undefined) {
      const { rate, fillNumber, } = this;
      return rate >= threshold && fillNumber >= bond && this.dutyCycle >= dutyCycle;
    }
    throw new Error('[Error] Threshold, bond and dutyCycle cannot be empty at the same time.');
  }

  changeOptions(place, newOptions) {
    if (typeof place !== 'string') {
      throw new Error('[Error] The parameter place should be a string type.');
    }
    place = this.getLinkPlace(place);
    if (typeof newOptions !== 'object' && newOptions !== null && !Array.isArray(newOptions)) {
      throw new Error('[Error] The parameter newOptions should be an object type.');
    }
    const {
      defaultOptions,
    } = this;
    newOptions = Object.assign(defaultOptions, newOptions);
    this.dealOptions(newOptions);
    const {
      data,
    } = this;
    this.checkNotNull(place);
    const digital = data.gain(place);
    const {
      options: {
        threshold,
        bond,
        dutyCycle,
        logLevel,
        blockSize,
        cacheStats,
        cacheOwn,
        cacheMod,
        cacheRealpath,
        cacheDiskOccupy,
      },
    } = digital;
    const {
      threshold: newThreshold,
      bond: newBond,
      dutyCycle: newDutyCycle,
      blockSize: newBlockSize,
      cacheStats: newCacheStats,
      cacheOwn: newCacheOwn,
      cacheMod: newCacheMod,
      cacheRealpath: newCacheRealpath,
      cacheDiskOccupy: newCacheDiskOccupy,
    } = newOptions;
    if (threshold !== newThreshold) {
      this.rate = 0;
    }
    if (bond !== newBond) {
      this.fillNumber = 0;
    }
    if (dutyCycle !== newDutyCycle) {
      this.dutyCyle = 0;
    }
    if (blockSize !== newBlockSize) {
      this.anewSeperation(place);
    }
    if (cacheStats !== newCacheStats) {
      if (newCacheStats === true) {
        digital.stats = {};
      } else {
        delete digital.stats;
      }
    }
    if (cacheOwn !== newCacheOwn) {
      if (newCacheOwn === true) {
        digital.own = [-1, -1];
      } else {
        delete digital.own;
      }
    }
    if (cacheMod !== newCacheMod) {
      if (newCacheMod) {
        digital.mod = -1;
      } else {
        delete digital.mod;
      }
    }
    if (cacheRealpath !== newCacheRealpath) {
      if (newCacheRealpath) {
        digital.realpath = '';
      } else {
        delete digital.realpath;
      }
    }
    if (cacheDiskOccupy !== newCacheDiskOccupy) {
      if (newCacheDiskOccupy) {
        digital.diskOccupy = -1;
      } else {
        delete digital.diskOccupy;
      }
    }
    digital.options = newOptions;
    this.checkMemory();
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
    this.checkMemory();
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
    const {
      data,
    } = this;
    const digital = data.gain(place);
    if (digital === undefined) {
      const {
        options,
      } = this;
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
      if (cacheMod === true) {
        nullDigital[mod] = -1;
      }
      if (cacheRealpath === true) {
        nullDigital[realpath] = '';
      }
      if (cacheDiskOccupy === true) {
        nullDigital[diskOccupy] = -1;
      }
      data.attach(place, nullDigital);
      this.checkMemory();
    }
  }

  checkBlocksContent(blocks) {
    blocks.forEach(({ type, index, range, data, }, idx) => {
      if (!Number.isInteger(type)) {
        throw new Error('[Error] The type parameter of the ' + idx + ' block should be an integer type.');
      }
      if (!(type > 0)) {
        throw new Error('[Error] The type parameter of the ' + idx + ' block should be a positive integer type.');
      }
      if (!Number.isInteger(index)) {
        throw new Error('[Error] The index parameter of the ' + idx + ' block should be an integer type.');
      }
      if (!(index >= 0)) {
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
      if (!(start >= 0)) {
        throw new Error('[Error] The start parameter of the ' + idx + ' block should be an integer type.');
      }
      if (!Number.isInteger(end)) {
        throw new Error('[Error] The end parameter of the ' + idx + ' block should be an integer type.');
      }
      if (!(end > 0)) {
        throw new Error('[Error] The end parameter of the ' + idx + ' block should be a positive integer type.');
      }
    });
  }

  adjunctionBlock(block, data, begin, end) {
    const { type, range: scope, } = block;
    if (begin === 0) {
      if (typeof data === 'string') {
        block.data = data + block.data;
      }
      if (Buffer.isBuffer(data)) {
        block.data = Buffer.concat(data, block.data);
      }
    } else {
      if (typeof data === 'string') {
        block.data = data + block.data;
      }
      if (Buffer.isBuffer(data)) {
        block.data = Buffer.concat(data, block.data);
      }
    }
  }

  async setBlock(block, data, begin, end) {
    const range = [begin, end];
    const { type, range: scope, } = block;
    const region = getComplement(range, scope);
    if (getSectionLength(region) > 0) {
      const [left, right] = region;
      const {
        options: {
          blockSize,
        },
        place,
      } = this;
      const figure = await this.requestStorageData(place, left, right);
      this.adjunctionBlock(block, data, left, right);
      this.updateAverageLength(getSectionLength(range));
      this.increaseFillNumber();
    }
    const interval = this.getBlockInterval(range);
    const [head, tail] = interval;
    const {
      length,
    } = block.data;
    if (typeof data === 'string') {
      const occupy1 = getStringOccupy(length);
      const occupy2 = getStringOccupy(getSectionLength(interval));
      if (occupy2 > occupy1) {
        const { place, } = this;
        this.releaseOccupy(place, occupy2 - occupy1);
      }
      block.data = data.substring(head, tail + 1);
    }
    if (Buffer.isBuffer(data)) {
      const occupy1 = getBufferOccupy(length);
      const occupy2 = getBufferOccupy(getSectionLength(interval));
      if (occupy2 > occupy1) {
        const { place, } = this;
        this.releaseOccupy(place, occupy2 - occupy1);
      }
      block.data = data.subarray(head, tail + 1);
    }
  }

  getData(data, begin, end) {
    const range = [begin, end];
    const interval = getBlockInterval(range);
    const [head, tail] = interval;
    if (typeof data === 'string') {
      return data.substring(head, tail + 1);
    }
    if (Buffer.isBuffer(data)) {
      return data.subarray(head, tail + 1);
    }
  }

  setReverseBlock(block, kind, figure, range) {
    const [begin, end] = range;
    if (begin === 0) {
      const {
        data: {
          length,
        },
      } = data;
      switch (kind) {
        case 0: {
          this.releaseJoinStringOccupy(length, interval);
          block.data = [block.data, this.getData(figure, begin, end)];
          break;
        }
        case 1: {
          this.releaseJoinBufferOccupy(length, interval);
          block.data = [this.getData(figure, begin, end), block.data];
          break;
        }
      }
    }
  }

  releaseJoinStringOccupy(length, section) {
    const occupy1 = getStringOccupy(length);
    const occupy2 = getStringOccupy(getSectionLength(section)) + occupy1;
    if (occupy2 > occupy1) {
      const { place, } = this;
      this.releaseOccupy(place, occupy2 - occupy1);
    }
  }

  releaseInterStringOccupy(length, interval2) {
    const occupy1 = getStringOccupy(length);
    const occupy2 = getStringOccupy(getSectionLength(section)) + occupy1;
    if (occupy2 > occupy1) {
      const { place, } = this;
      this.releaseOccupy(place, occupy2 - occupy1);
    }
  }

  setInterBlock(block, data, type, inter, extend) {
    const [begin, end] = inter;
    const interval1 = this.getBlockInterval(inter);
    const [head1, tail1] = interval1;
    if (Buffer.isBuffer(data)) {
      for (let i = head1; i <= tail1; i += 1) {
        block.data[i] = data[i];
      }
    }
    if (typeof data === 'string') {
      const charArray1 = block.data.split('');
      const charArray2 = data.split('');
      for (let i = head1; i <= tail1; i += 1) {
        charArray1[i] = charArray2[i];
      }
      block.data = charArray1.join('');
    }
    const interval2 = this.getBlockInterval(extend);
    const [head2, tail2] = interval2;
    const {
      data: {
        length,
      }
    } = block;
    switch (type) {
      case 0:
        if (typeof data === 'string') {
          this.releaseInterStringOccupy(length, interval2);
          block.data = data.substring(head2, tail2 + 1) + block.data;
        }
        if (Buffer.isBuffer(data)) {
          this.releaseInterBufferOccupy(length, interval2);
          block.data = Buffer.concat([data.subarray(head2, tail2 + 1), block.data]);
        }
        break;
      case 1:
        if (typeof data === 'string') {
          this.releaseInterStringOccupy(length, interval2);
          block.data = block.data + data.substring(head2, tail2 + 1);
        }
        if (Buffer.isBuffer(data)) {
          this.releaseInterBufferOccupy(length, interval2);
          block.data = Buffer.concat([block.data, data.subarray(head2, tail2 + 1)]);
        }
        break;
    }
  }

  addPositiveBlock(block, data, begin, end) {
    const { range: scope, } = block;
    if (!interSection(range, scope)) {
      if (isNullSection(scope)) {
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

  async addReverseBlock(block, data, begin, end, blockSize) {
    const [left, right] = range;
    const { data: digital, range: scope, } = block;
    const [section1, section2] = getDifferenceSection([0, blockSize - 1], scope);
    const interSection1 = findInterSection(section1, range, false);
    const interSection2 = findInterSection(section2, range, false);
    if (interSection1 !== undefined && interSection2 !== undefined) {
      block.type = 1;
      block.range = [0, blockSize - 1];
      const difference1Section = getDifferenceSection(range, section1);
      const difference2Section = getDifferenceSection(range, section2);
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
      if (length1 <= length2) {
        const fillSection = [right + 1, right + 1 + length];
        block.range = [end + 1, right];
        const { place, } = this;
        const figure = await this.requestStorageData(place, fillSection[0], fillSection[1]);
        this.placeBlock(block, figure, 0, fillSection[0], fillSection[1]);
        this.updateAverageLength(length1);
        this.increaseFillNumber();
      } else {
        const fillSection = [left + 1 - length, left + 1];
        block.range = [end + 1, right];
        block.range = [left, begin + 1];
        const { place, } = this;
        const figure = await this.requestStorageData(place, fillSection[0], fillSection[1]);
        this.placeBlock(block, figure, 1, fillSection[0], fillSection[1]);
        this.updateAverageLength(length2);
        this.increaseFillNumber();
      }
    }
  }

  placeBlock(block, data, type, begin, end) {
    const { data: digital, } = block;
    const range = [begin, end];
    const interval = this.getBlockInterval(range);
    const [head, tail] = interval;
    if (Buffer.isBuffer(data)) {
      for (let i = head; i <= tail; i += 1) {
        digital[i] = data[i];
      }
    }
    if (typeof data === 'string') {
      const charArray1 = digital[type].split('');
      const charArray2 = data.split('');
      for (let i = head; i <= tail; i += 1) {
        charArray1[i] = charArray2[i];
      }
      block.data = charArray1[i].join('');
    }
  }

  addBlocks(place, range, figure, dealPlace) {
    if (typeof place !== 'string') {
      throw new Error('[Error] The parameter place should be a string type.');
    }
    if (dealPlace !== undefined) {
      if (dealPlace !== 'boolean') {
        throw new Error('[Error] The parameter dealPlace should be a boolean type.');
      }
    }
    if (dealPlace !== false) {
      place = this.getLinkPlace(place);
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
    this.checkBlocksContent(chunks);
    const [start, end] = range;
    const begin = Math.floor(start / blockSize) * blockSize;
    this.place = place;
    if (end < ((begin + 1) * blockSize)) {
      const chunk = chunks[begin];
      const { type, } = chunk;
      switch (type) {
        case 0:
          this.addReverseBlock(chunk, digital, data, begin, end);
          break;
        case 1:
          this.addPositveBlock(chunk, digital, data, begin, blockSize - 1);
          break;
      }
      return;
    } else {
      const chunk = chunks[begin];
      const { type, } = chunk;
      switch (type) {
        case 0:
          this.addReverseBlock(chunk, digital, data, begin, blockSize - 1);
          break;
        case 1:
          this.addPositveBlock(chunk, digital, data, begin, blockSize - 1);
          break;
      }
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
    this.postOperation();
    this.checkMemory();
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

  releaseOccupy(place, occupy) {
    this.sortOrders(place);
    const {
      count,
    } = this;
    const quantity = count.gain(place);
    if (quantity !== undefined) {
      const {
        orders,
      } = quantity;
      if (Array.isArray(orders)) {
        for (let i = 0; i < orders.length; i += 1) {
          const [_, idx] = orders[i];
          const block = blocks[idx];
          this.clearBlock(place, idx);
          occupy -= this.getBlockOccupy(block);
          if (occupy <= 0) {
            break;
          }
        }
      }
    }
  }

  instillBlocks(place, blocks, dealPlace) {
    if (typeof place !== 'string') {
      throw new Error('[Error] The parameter place should be a string type.');
    }
    if (dealPlace !== undefined) {
      if (dealPlace !== 'boolean') {
        throw new Error('[Error] The parameter dealPlace should be a boolean type.');
      }
    }
    if (dealPlace !== false) {
      place = this.getLinkPlace(place);
    }
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
    if (!this.checkMemory()) {
      let blocksOccupy = 0;
      blocks.forEach((block) => {
        blocksOccupy += this.getBlockOccupy(block);
      });
      this.releaseOccupy(place, blocksOccupy);
    }
    blocks.forEach(({ index, type, range, data, }) => {
      chunks[index] = { type, range, data, };
    });
  }

  checkRangeContent(range) {
    if (!Array.isArray(range)) {
      throw new Error('[Error] The parameter range should be an array type.');
    }
    const [start, end] = range;
    if (!Number.isInteger(start)) {
      throw new Error('[Error] The parameter start should be an integer type.');
    }
    if (!(start >= 0)) {
      throw new Error('[Error] The parameter start should be greater than or equal zero.');
    }
    if (!Number.isInteger(end)) {
      throw new Error('[Error] The parameter end should be an integer type.');
    }
    if (!(end > 0)) {
      throw new Error('[Error] The parameter end should be a positive integer type.');
    }
    if (start > end) {
      throw new Error('[Error] The parameter start of should be less than or equal to correspond the parameter end.');
    }
  }

  removeSingleEndBlock(block, range) {
    const { range: scope, } = block;
    const [begin, end] = range;
    const {
      options: {
        blockSize,
      },
    } = this;
    if (left === 0 && right === blockSize - 1) {
      const region = getComplement(scope, range);
      block.range = region;
      const [left, right] = region;
      this.setBlock(block, data, left, right);
    } else if (right === blockSize - 1) {
      block.range = [left, right];
      this.setBlock(block, data, left, right);
    } else {
      const region = getComplement(scope, range);
      const length = getSectionLength(region);
      if (length === 0) {
        blocks[index] = undefined;
      } else {
        block.range = region;
        const [left, right] = region;
        const interval = this.getBlockInterval(region);
        const [head, tail] = interval;
        if (typeof block === 'string') {
          block.data = data.substring(head, tail + 1);
        }
        if (Buffer.isBuffer(block)) {
          block.data = data.subarray(head, tail + 1);
        }
      }
    }
  }

  removeSingleBeginBlock(block, range) {
    const { range: scope, data, } = block;
    const [left, right] = range;
    if (left === 0 && right === blockSize - 1) {
      const region = getComplement(scope, range);
      const [left, right] = region;
      this.setBlock(block, data, left, right);
      block.range = region;
    } else if (left === 0) {
      block.range = [left, right];
      this.setBlock(block, data, left, right);
    } else {
      const region = getComplement(scope, range);
      const length = getSectionLength(region);
      if (length === 0) {
        blocks[index] = undefined;
      } else {
        block.range = region;
        const [left, right] = region;
        const [head, tail] = this.getBlockInterval(region);
        if (typeof block === 'string') {
          block.data = data.substring(head, tail + 1);
        }
        if (Buffer.isBuffer(block)) {
          block.data = data.subarray(head, tail + 1);
        }
      }
    }
  }

  removeBeginBlock(blocks, index, begin, end) {
    const {
      options: {
        blockSize,
      },
    } = this;
    const range = [begin, end];
    const block = blocks[index];
    const { type, range: scope, data, } = block;
    switch (type) {
      case 0: {
        const [section1, section2] = getDifferenceSection([0, blockSize - 1], scope);
        this.removeSingleBeginBlock(block, section1);
        this.removeSingleBeginBlock(block, section2);
        break;
      }
      case 1: {
        this.removeSingleBeginBlock(block, range);
        break;
      }
    }
  }

  removeEndBlock(blocks, index, begin, end) {
    const {
      options: {
        blockSize,
      },
    } = this;
    const range = [begin, end];
    const block = blocks[index];
    const { type, range: scope, data, } = block;
    switch (type) {
      case 0: {
        const [section1, section2] = getDifferenceSection([0, blockSize - 1], scope);
        this.removeSingleEndBlock(block, section1);
        this.removeSingleEndBlock(block, section2);
        break;
      }
      case 1: {
        this.removeSingleEndBlock(block, range);
        break;
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

  clearBlocks(place, indexs) {
    if (typeof place !== 'string') {
      throw new Error('[Error] The parameter place should be a string type.');
    }
    if (Array.isArray(indexs)) {
      throw new Error('[Error] The parameter indexs should be an array type.');
    }
    indexs.forEach((index) => {
      this.clearBlock(place, index);
    });
  }

  clearBlock(place, index) {
    if (!Number.isInteger(index)) {
      throw new Error('[Error] The parameter index should be an integer type.');
    }
    if (index >= 0) {
      throw new Error('[Error] The parameter index should be greater than or equal to zero.')
    }
    place = this.getLinkPlace(place);
    this.check
    const {
      data,
    } = this;
    const digital = data.gain(place);
    const { blocks, } = digital;
    const {
      length,
    } = blocks;
    indexs.forEach((index) => {
      if (index === length - 1) {
        let number = 0;
        for (let i = 0; i >= 0; i -= 1) {
          if (blocks === undefined) {
            number += 1;
          } else {
            break;
          }
        }
        blocks.length = length - number;
      } else {
        delete counts[id];
      }
    });
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
      place = this.getLinkPlace(place);
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
      blocks: chunks,
    } = digital;
    const [start, end] = range;
    const begin = Math.floor(start / blockSize) * blockSize;
    this.place = place;
    if (end < ((begin + 1) * blockSize)) {
      const chunk = chunks[begin];
      this.removeBeginBlock(chunks, begin, begin, end);
      return;Connection
    } else {
      const chunk = chunks[begin];
      if (start === 0) {
        this.removeBeginBlock(chunk, start, (begin + 1) * blockSize);
      } else {
        this.removeBeginBlock(chunk, start, (begin + 1) * blockSize);
      }
    }
    let ptr = (begin + 1) * blockSize;
    let number = begin + 1;
    while (true) {
      ptr += blockSize;
      if (ptr >= end) {
        const chunk = chunks[number];
        this.removeEndBlock(chunks, number, ptr - blockSize, end);
        break;
      } else {
        const chunk = chunks[number];
        this.removeFullBlock(chunks, number, ptr - blockSize, ptr);
      }
    }
    const {
      count,
    } = this;
    const quantity = count.gain(place);
    const {
      counts,
    } = quantity;
    const {
      length,
    } = counts;
    const [left, right] = range;
    for (let i = left; i <= right; i += 1) {
      if (i === length - 1) {
        let number = 0;
        for (let j = 0; j >= 0; j -= 1) {
          if (counts[j] === 0 || counts[j] === undefined) {
            number += 1;
          } else {
            break;
          }
        }
        counts.length = length - number;
      } else {
        delete counts[j];
      }
    }
    this.postOperation();
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

  async requestStorageData(place, left, right) {
    const { client, } = this;
    client.write(getBinBuf([0, place, left, right]));
    const data = await new Promise((resolve, reject) => {
      client.once('data', (data) => {
        resolve(data);
      });
    });
    return data;
  }

  async getSingleBlock(block, range) {
    const { data, type, range: scope, } = block;
    const { place, } = this;
    const differentSections = getDifferenceSection(range, scope);
    if (Array.isArray(differentSections) && differentSections.length > 0) {
      for await (const section of differentSections) {
        const [left, right] = section;
        let occupy;
        if (typeof block === 'string') {
          occupy = getStringOccupy(getSectionLength(section));
        }
        if (Buffer.isBuffer(block)) {
          occupy = getBufferOccupy(getSectionLength(section));
        }
        this.releaseOccupy(place, occupy);
        const figure = await this.requestStorageData(place, left, right);
        this.adjunctionBlock(block, figure, left, right);
      }
    }
    const interval = this.getBlockInterval(range);
    const [head, tail] = interval;
    if (typeof data === 'string') {
      return data.substring(head, tail + 1);
    }
    if (Buffer.isBuffer(data)) {
      return data.subarray(head, tail + 1);
    }
  }

  async getBlock(block, begin, end) {
    const {
      options: {
        blockSize,
      },
    } = this;
    const range = [begin, end];
    const { type, range: scope, data, } = block;
    const ans = [];
    switch (type) {
      case 0: {
        const [section1, section2] = getDifferenceSection([0, blockSize - 1], scope);
        ans.push(await this.getSingleBlock(block, section1));
        ans.push(await this.getSingleBlock(block, section2));
        break;
      }
      case 1: {
        ans.push(await this.getSingleBlock(block, range));
        break;
      }
    }
    return ans;
  }

  async getBlocks(place, range, dealPlace) {
    if (typeof place !== 'string') {
      throw new Error('[Error] The parameter place should be a string type.');
    }
    if (dealPlace !== undefined) {
      if (dealPlace !== 'boolean') {
        throw new Error('[Error] The parameter dealPlace should be a boolean type.');
      }
    }
    if (dealPlace !== false) {
      place = this.getLinkPlace(place);
    }
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
      blocks: chunks,
    } = digital;
    const [start, end] = range;
    const ans = [];
    this.place = place;
    const nextBorder = getNextBorder(start, blockSize);
    let count = Math.floor(start / blockSize);
    if (end <= nextBorder) {
      const chunk = chunks[count];
      ans.push(await this.getBlock(chunk, start, end));
      return ans.flat();
    } else {
      const chunk = chunks[count];
      ans.push(await this.getBlock(chunk, start, nextBorder));
    }
    let ptr = nextBorder;
    while (true) {
      count += 1;
      const chunk = chunks[count];
      ptr += 1;
      if (end <= ptr + (blockSize - 1)) {
        ans.push(await this.getBlock(chunk, ptr, end));
        break;
      } else {
        ans.push(await this.getBlock(chunk, ptr, ptr += (blockSize - 1)));
      }
    }
    this.countSection(place, range);
    this.postOperation();
    return ans.flat();
  }

  async getGroupBlocks(place, ranges, dealPlace) {
    if (typeof place !== 'string') {
      throw new Error('[Error] The parameter place should be a string type.');
    }
    if (!Array.isArray(ranges)) {
      throw new Error('[Error] The parameter indexs should be an array type.');
    }
    if (dealPlace !== undefined) {
      if (dealPlace !== 'boolean') {
        throw new Error('[Error] The parameter dealPlace should be a boolean type.');
      }
    }
    if (dealPlace !== false) {
      place = this.getLinkPlace(place);
    }
    const ans = [];
    for await (const range of ranges) {
      ans.push(await this.getBlocks(place, range));
    }
    return ans;
  }
}

export default StorageCache;
