import fsPromises from 'fs/promises';
import fs from 'fs';
import path from 'path';
import ByteArray from '~/class/ByteArray';
import existsPromise from '~/lib/util/existsPromise';
import readPromise from '~/lib/util/readPromise';
import writePromise from '~/lib/util/writePromise';
import fsyncPromise from '~/lib/util/fsyncPromise';
import openPromise from '~/lib/util/openPromise';
import closePromise from '~/lib/util/closePromise';
import watchPromise from '~/lib/util/watchPromise';

function checkHiddenFile(fileName) {
  let ans = true;
  if (fileName.charAt(0) === '.') {readFile
    return false;
  }
  return ans;
}

function checkHiddenDirs(paths) {
  let ans = true;
  const dirs = paths.split(path.sep);
  for (let i = 0; i < dirs.length; i += 1) {
    const dir = dirs[i];
    if (dir.charAt(0) === '.') {
      ans = false;
      break;
    }
  }
  return ans;
}

async function clearEmptyDirs(paths, end) {
  if (await existsPromise(paths)) {
    const dirs = paths.split(path.sep);
    while (true) {
      const site = dirs.join(path.sep);
      const directory = await fsPromises.opendir(site);
      const entry = await directory.read();
      await directory.close();
      if (typeof end === 'string') {
        if (end === dirs[dirs.length - 1]) {
          break;
        }
      }
      if (entry === null) {
        await fsPromises.rmdir(site);
        dirs.pop();
      } else {
        break;
      }
    }
  }
}

function dealDirname(dirname) {
  return dirname.replaceAll('/', path.sep);
}

function radixSort(list) {
  if (!Array.isArray(list)) {
    throw new Error('[Error] The parameter list should be an array type.');
  }
  list = list.map((e) => [e[0], e]);
  const bucket = new Array(10);
  while (true) {
    for (let i = 0; i < bucket.length; i += 1) {
      bucket[i] = undefined;
    }
    let flag = 0;
    list.forEach((e, i) => {
      const [s] = e;
      const m = s % 10;
      if (bucket[m] === undefined) {
        bucket[m] = [];
      }
      bucket[m].unshift(i);
      const r = parseInt(s / 10);
      if (r !== 0) {
        flag += 1;
      }
      list[i][0] = r;
    });
    if (flag === 0) {
      break;
    }
    const newList = [];
    for (let i = 0; i < bucket.length; i += 1) {
      const groove = bucket[9 - i];
      if (Array.isArray(groove)) {
        groove.forEach((e) => {
          newList.unshift(list[e]);
        });
      }
    }
    list = newList;
  }
  const ans = [];
  for (let i = 0; i < bucket.length; i += 1) {
    const groove = bucket[9 - i];
    if (Array.isArray(groove)) {
      groove.forEach((e) => {
        ans.unshift(list[e][1]);
      });
    }
  }
  return ans;
}

function swapBlank(value) {
  switch (value) {
    case 96:
      value = 0;
      break;
    case 108:
      value = 1;
      break;
    case 110:
      value = 3;
      break;
    case 111:
      value = 5;
      break;
    case 124:
      value = 6;
      break;
    case 127:
      value = 7;
      break;
    case 140:
      value = 8;
      break;
    case 0:
      value = 96;
      break;
    case 1:
      value = 108;
      break;
    case 3:
      value = 110;
      break;
    case 5:
      value = 111;
      break;
    case 6:
      value = 124;
      break;
    case 7:
      value = 127;
      break;
    case 8:
      value = 140;
      break;
  }
  return value;
}

function swapUnsafe(value) {
  switch (value) {
    case 50:
      value = 1;
      break;
    case 21:
      value = 3;
      break;
    case 16:
      value = 6;
      break;
    case 82:
      value = 7;
      break;
    case 18:
      value = 8;
      break;
    case 20:
      value = 9;
      break;
    case 17:
      value = 10;
      break;
    case 19:
      value = 11;
      break;
    case 1:
      value = 50;
      break;
    case 3:
      value = 21;
      break;
    case 6:
      value = 16;
      break;
    case 7:
      value = 82;
      break;
    case 8:
      value = 18;
      break;
    case 9:
      value = 20;
      break;
    case 10:
      value = 17;
      break;
    case 11:
      value = 19;
      break;
  }
  return value;
}

function toInt(value) {
  value -= 33;
  value = swapBlank(value);
  value -= 9;
  value = swapUnsafe(value);
  value -= 12;
  return value;
}

function toChar(value) {
  value += 12;
  value = swapUnsafe(value);
  value += 9;
  value = swapBlank(value);
  value += 33;
  return value;
}

async function removeNameFromNames(namesPath, place) {
  const buffer = await fsPromises.readFile(namesPath);
  const namesBufArr = [];
  let bytes = [];
  if (buffer.toString() === place) {
    await fsPromises.unlink(namesPath);
  } else {
    let currentIdx;
    buffer.forEach((byte, idx) => {
      switch (byte) {
        case 0: {
          const name = Buffer.from(bytes).toString();
          if (name !== place) {
            namesBufArr.push(bytes);
          } else {
            currentIdx = idx;
          }
          bytes = [];
          break;
        }
        default:
          bytes.push(byte);
      }
    });
    const { length, } = namesBufArr;
    if (length === 0) {
      await fsPromises.unlink(namesPath);
    } else if (length >= 2 && currentIdx === buffer.length - 1) {
      const lastNameBufPosition = length - 2;
      await fsPromises.truncate(buffer.length - namesBufArr[lastNameBufPosition].length - 1);
    } else {
      const fd = await openPromise(namesPath, 'w');
      await writePromise(fd, Buffer.from(namesBufArr.flat()));
      await fsyncPromise(fd);
      await closePromise(fd);
    }
  }
}

function getCountFromCountsHash(countsHash, code, frequency) {
  const innerHash = countsHash[code];
  if (typeof innerHash === 'object') {
    const count = countsHash[code][frequency];
    if (typeof count === 'bigint') {
      return count;
    } else {
      return 0;
    }
  } else {
    return 0;
  }
}

function getSortGatherings(place) {
  const hash = {};
  for (let i = 0; i < place.length; i += 1) {
    const code = place.charCodeAt(i);
    if (hash[code] === undefined) {
      hash[code] = 1;
    } else {
      hash[code] += 1;
    }
  }
  let gatherings = [];
  Object.keys(hash).forEach((k) => {
    gatherings.push([parseInt(k), hash[k]]);
  });
  return radixSort(gatherings);
}


function getIndexRelativeDir(code) {
  const paths = [];
  while (code > 0) {
    paths.push(String(code % 10));
    code = Math.floor(code / 10);
  }
  paths.push('0');
  return paths.join(path.sep);
}


async function getNameSet(namesPath) {
  const buffer = await fsPromises.readFile(namesPath);
  const nameSet = {};
  let bytes = [];
  for (let i = 0; i < buffer.length; i += 1) {
    const byte = buffer[i];
    if (byte === 0) {
      const name = Buffer.from(bytes).toString();
      nameSet[name] = true;
      bytes = [];
    } else {
      bytes.push(byte);
    }
  }
  return nameSet;
}

async function checkNameInNames(namesPath, place) {
  const nameSet = await getNameSet(namesPath);
  return nameSet[place];
}

function getCountsPath(pointersPath) {
  return pointersPath + '6';
}

async function addNameToNames(namesPath, code, frequency, name) {
  const fd = await openPromise(namesPath, 'a');
  const buffer = Buffer.concat([Buffer.from(name), Buffer.alloc(1)]);
  await writePromise(fd, buffer);
  await fsyncPromise(fd);
  await closePromise(fd);
}

function checkCrossByte(v1, v2, bytes) {
  const bytes1 = bytes.fromInt(v1);
  const bytes2 = bytes.fromInt(v2);
  const { length: length1, } = bytes1;
  const { length: length2, } = bytes2;
  return length1 === length2;
}

class Storage {
  constructor(location, options = {}) {
    if (typeof location !== 'string') {
      throw new Error('[Error] The parameter location should be a string type.');
    }
    if (!path.isAbsolute(location)) {
      throw new Error('[Error] The location passed in should be an absolute path.');
    }
    if (!checkHiddenDirs(location)) {
      throw new Error('[Error] The parameter location cannot contain hidden directories.');
    }
    if (!fs.existsSync(location)) {
      fs.mkdirSync(location, { recursive: true, });
    }
    if (typeof options !== 'object' && options !== null) {
      throw new Error('[Error] The parameter options should be of type object.');
    }
    this.location = location;
    const defaultOptions = {
      minimumStorageCapacity: 5 * 1024 ** 3,
    };
    this.options = Object.assign(defaultOptions, options);
    this.dealOptions();
    const indexPath = path.join(location, '.index');
    if (!fs.existsSync(indexPath)) {
      fs.mkdirSync(indexPath);
    }
    this.indexPath = indexPath;
    this.shiftOneReasonBytes = new ByteArray({ size: 202n, shift: 1n, });
    this.shiftTwoBytes = new ByteArray({ size: 256n, shift: 2n, });
  }

  dealOptions(options) {
    const {
      options: {
        minimumStorageCapacity,
      },
    } = this;
    if (!Number.isInteger(minimumStorageCapacity)) {
      throw new Error('[Error] The minimum storage capacity should be an integer type.');
    }
    if (!(minimumStorageCapacity > 0)) {
      throw new Error('[Error] The minimum storage capacity should be greater than zero.');
    }
  }

  static unwatchSync(watcher) {
    if (watcher.constructor.name !== 'FSWatcher') {
      throw new Error('[Error] The passed parameter watcher is not of type StatWatcher.');
    }
    watcher.close();
  }

  async readData(place, options) {
    if (typeof place !== 'string') {
      throw new Error('[Error] The parameter place should be of string type.');
    }
    const { location, } = this;
    const filePath = path.join(location, place);
    if (!(path.extname(filePath).length >= 1)) {
      throw new Error('[Error] The added path does not correspond to the file type.');
    }
    if (!await existsPromise(filePath)) {
      throw new Error('[Error] The file being read data does not exist.');
    }
    const dirname = dealDirname(path.dirname(filePath));
    if (!checkHiddenDirs(dirname)) {
      throw new Error('[Error] Cannot operate hidden directorys.');
    }
    const basename = path.basename(filePath);
    if (!checkHiddenFile(basename)) {
      throw new Error('[Error] Cannot operate hidden files.');
    }
    const stats = await fsPromises.stat(filePath, { bigint: true, });
    if (stats.isSymbolicLink()) {
      return await fsPromises.readlink(filePath, options);
    } else {
      return await fsPromises.readFile(filePath, options);
    }
  }

  async readBufferPiece(place, position, length) {
    if (typeof place !== 'string') {
      throw new Error('[Error] The parameter place should be of string type.');
    }
    if (!Number.isInteger(position)) {
      throw new Error('[Error] The parameter position should be an integer type.');
    }
    if (!(position >= 0)) {
      throw new Error('[Error] The parameter position should be greater than or equal to zero.');
    }
    const { location, } = this;
    const filePath = path.join(location, place);
    if (!(path.extname(filePath).length >= 1)) {
      throw new Error('[Error] The file you are working with needs to have its file extension specified.');
    }
    if (!await existsPromise(filePath)) {
      throw new Error('[Error] The file being read buffer piece does not exist.');
    }
    const dirname = dealDirname(path.dirname(filePath));
    if (!checkHiddenDirs(dirname)) {
      throw new Error('[Error] cannot operate hidden directorys.');
    }
    const basename = path.basename(filePath);
    if (!checkHiddenFile(basename)) {
      throw new Error('[Error] cannot operate hidden files.');
    }
    const fd = await openPromise(filePath, 'r');
    return await readPromise(fd, { position, length, });
  }

  async writeBufferPiece(place, position, buffer) {
    if (typeof place !== 'string') {
      throw new Error('[Error] The parameter place should be of string type.');
    }
    if (!Number.isInteger(position)) {
      throw new Error('[Error] The parameter position should be an integer type.');
    }
    if (!(position >= 0)) {
      throw new Error('[Error] The parameter position should be greater than or equal to zero.');
    }
    const { location, } = this;
    const filePath = path.join(location, place);
    if (!(path.extname(filePath).length >= 1)) {
      throw new Error('[Error] The file you are working with needs to have its file extension specified.');
    }
    if (!await existsPromise(filePath)) {
      throw new Error('[Error] The file being write buffer piece does not exist.');
    }
    const dirname = dealDirname(path.dirname(filePath));
    if (!checkHiddenDirs(dirname)) {
      throw new Error('[Error] cannot operate hidden directorys.');
    }
    const basename = path.basename(filePath);
    if (!checkHiddenFile(basename)) {
      throw new Error('[Error] cannot operate hidden files.');
    }
    const fd = await openPromise(filePath, 'a');
    await writePromise(fd, buffer, { position, });
    await fsyncPromise(fd);
    await closePromise(fd);
  }

  async writeBuffer(place, buffer) {
    if (typeof place !== 'string') {
      throw new Error('[Error] The parameter place should be of string type.');
    }
    const { location, } = this;
    const filePath = path.join(location, place);
    if (!(path.extname(filePath).length >= 1)) {
      throw new Error('[Error] The file you are working with needs to have its file extension specified.');
    }
    if (!await existsPromise(filePath)) {
      throw new Error('[Error] The file being write buffer does not exist.');
    }
    const dirname = dealDirname(path.dirname(filePath));
    if (!checkHiddenDirs(dirname)) {
      throw new Error('[Error] cannot operate hidden directorys.');
    }
    const basename = path.basename(filePath);
    if (!checkHiddenFile(basename)) {
      throw new Error('[Error] cannot operate hidden files.');
    }
    const fd = await openPromise(filePath, 'a');
    await writePromise(fd, buffer);
    await fsyncPromise(fd);
    await closePromise(fd);
  }

  async addBuffer(place, buffer) {
    if (typeof place !== 'string') {
      throw new Error('[Error] The parameter place should be of string type.');
    }
    const { location, } = this;
    const filePath = path.join(location, place);
    if (!(path.extname(filePath).length >= 1)) {
      throw new Error('[Error] The file you are working with needs to have its file extension specified.');
    }
    const dirname = dealDirname(path.dirname(filePath));
    if (!checkHiddenDirs(dirname)) {
      throw new Error('[Error] cannot operate hidden directorys.');
    }
    const basename = path.basename(filePath);
    if (!checkHiddenFile(basename)) {
      throw new Error('[Error] cannot operate hidden files.');
    }
    if (!await existsPromise(dirname)) {
      await fsPromises.mkdir(dirname, { recursive: true, });
    }
    await this.addEntireIndex(place);
    const fd = await openPromise(filePath, 'w');
    await writePromise(fd, buffer);
    await fsyncPromise(fd);
    await closePromise(fd);
  }

  async appendData(place, data) {
    if (typeof place !== 'string') {
      throw new Error('[Error] The parameter place should be of string type.');
    }
    const { location, } = this;
    const filePath = path.join(location, place);
    if (!(path.extname(filePath).length >= 1)) {
      throw new Error('[Error] The file you are working with needs to have its file extension specified.');
    }
    if (!await existsPromise(filePath)) {
      throw new Error('[Error] The file being append data does not exist.');
    }
    const dirname = dealDirname(path.dirname(filePath));
    if (!checkHiddenDirs(dirname)) {
      throw new Error('[Error] Cannot operate hidden directorys.');
    }
    const basename = path.basename(filePath);
    if (!checkHiddenFile(basename)) {
      throw new Error('[Error] Cannot operate hidden files.');
    }
    const fd = await openPromise(filePath, 'a');
    await writePromise(fd, data);
    await fsyncPromise(fd);
    await closePromise(fd);
  }

  async remove(place) {
    if (typeof place !== 'string') {
  const { length: length1, } = bytes1;
      throw new Error('[Error] The parameter place should be of string type.');
    }
    const { location, } = this;
    const filePath = path.join(location, place);
    const dirname = dealDirname(path.dirname(filePath));
    if (!checkHiddenDirs(dirname)) {
      throw new Error('[Error] Cannot operate hidden directorys.');
    }
    const basename = path.basename(filePath);
    if (!checkHiddenFile(basename)) {
      throw new Error('[Error] Cannot operate hidden files.');
    }
    if (!(path.extname(filePath).length >= 1)) {
      throw new Error('[Error] The file you are working with needs to have its file extension specified.');
    }
    const stats = await fsPromises.lstat(filePath);
    if (!stats.isSymbolicLink()) {
      if (!await existsPromise(filePath)) {
        throw new Error('[Error] The file being remove does not exist.');
      }
    }
    await this.removeEntireIndex(place);
    await fsPromises.unlink(filePath);
    await clearEmptyDirs(dirname, '.index');
  }

  async truncate(place, length) {
    if (typeof place !== 'string') {
      throw new Error('[Error] The parameter place should be of string type.');
    }
    if (!Number.isInteger(length)) {
      throw new Error('[Error] The parameter length should be an integer type.');
    }
    if (!(length >= 0)) {
      throw new Error('[Error] The parameter length should be greater than or equal to zero.');
    }
    const { location, } = this;
    const filePath = path.join(location, place);
    const dirname = dealDirname(path.dirname(filePath));
    if (!checkHiddenDirs(dirname)) {
      throw new Error('[Error] Cannot operate hidden directorys.');
    }
    const basename = path.basename(filePath);
    if (!checkHiddenFile(basename)) {
      throw new Error('[Error] Cannot operate hidden files.');
    }
    if (!(path.extname(filePath).length >= 1)) {
      throw new Error('[Error] The file you are working with needs to have its file extension specified.');
    }
    if (!await existsPromise(filePath)) {
      throw new Error('[Error] The file being truncate does not exist.');
    }
    await fsPromises.truncate(filePath, length);
  }

  async rename(oldPlace, newPlace) {
    if (typeof oldPlace !== 'string') {
      throw new Error('[Error] The parameter oldPlace should be of string type.');
    }
    const { location, } = this;
    const oldFilePath = path.join(location, oldPlace);
    const oldDirname = dealDirname(path.dirname(oldFilePath));
    if (!checkHiddenDirs(oldDirname)) {
      throw new Error('[Error] Cannot operate hidden directorys.');
    }
    const oldBasename = path.basename(oldFilePath);
    if (!checkHiddenFile(oldBasename)) {
      throw new Error('[Error] Cannot operate hidden files.');
    }
    if (!(path.extname(oldFilePath).length >= 1)) {
      throw new Error('[Error] The file you are working with needs to have its file extension specified.');
    }
    if (!await existsPromise(oldFilePath)) {
      throw new Error('[Error] The file being rename does not exist.');
    }
    if (typeof newPlace !== 'string') {
      throw new Error('[Error] The parameter oldPlace should be of string type.');
    }
    const newFilePath = path.join(location, newPlace);
    const newDirname = dealDirname(path.dirname(newFilePath));
    if (!checkHiddenDirs(newDirname)) {
      throw Error('[Error] Cannot operate hidden directorys.');
    }
    const newBasename = path.basename(newFilePath);
    if (!checkHiddenFile(newBasename)) {
      throw Error('[Error] Cannot operate hidden files.');
    }
    if (!(path.extname(newFilePath).length >= 1)) {
      throw new Error('[Error] The file you are working with needs to have its file extension specified.');
    }
    if (await existsPromise(newFilePath)) {
      throw new Error('[Error] The renamed file path cannot exist.');
    }
    await fsPromises.rename(oldFilePath, newFilePath);
    if (oldDirname !== newDirname) {
      await clearEmptyDirs(oldDirname, '.index');
    }
    await this.removeEntireIndex(oldPlace);
    await this.addEntireIndex(newPlace);
  }

  async link(targetPlace, linkPlace) {
    if (typeof targetPlace !== 'string') {
      throw new Error('[Error] The parameter targetPlace should be of string type.');
    }
    const { location, } = this;
    const targetFilePath = path.join(location, targetPlace);
    const targetDirname = dealDirname(path.dirname(targetFilePath));
    if (!checkHiddenDirs(targetDirname)) {
      throw new Error('[Error] Cannot operate hidden directorys.');
    }
    const targetBasename = path.basename(targetFilePath);
    if (!checkHiddenFile(targetBasename)) {
      throw new Error('[Error] Cannot operate hidden files.');
    }
    if (!(path.extname(targetFilePath).length >= 1)) {
      throw new Error('[Error] The file you are working with needs to have its file extension specified.');
    }
    if (!await existsPromise(targetFilePath)) {
      throw new Error('[Error] The file being link does not exist.');
    }
    if (typeof linkPlace !== 'string') {
      throw new Error('[Error] The parameter linkPlace should be of string type.');
    }
    const linkFilePath = path.join(location, linkPlace);
    const linkDirname = dealDirname(path.dirname(linkFilePath));
    if (!checkHiddenDirs(linkDirname)) {
      throw new Error('[Error] Cannot operate hidden directorys.');
    }
    const linkBasename = path.basename(linkFilePath);
    if (!checkHiddenFile(linkBasename)) {
      throw new Error('[Error] Cannot operate hidden files.');
    }
    if (!(path.extname(linkFilePath).length >= 1)) {
      throw new Error('[Error] The file you are working with needs to have its file extension specified.');
    }
    await this.addEntireIndex(linkPlace);
    await fsPromises.symlink(targetFilePath, linkFilePath);
  }

  async getStats(place) {
    if (typeof place !== 'string') {
      throw new Error('[Error] The parameter place should be of string type.');
    }
    const { location, } = this;
    const filePath = path.join(location, place);
    const dirname = dealDirname(path.dirname(filePath));
    if (!checkHiddenDirs(dirname)) {
      throw new Error('[Error] Cannot operate hidden directorys.');
    }
    const basename = path.basename(filePath);
    if (!checkHiddenFile(basename)) {
      throw new Error('[Error] Cannot operate hidden files.');
    }
    if (!(path.extname(filePath).length >= 1)) {
      throw new Error('[Error] The file you are working with needs to have its file extension specified.');
    }
    if (!await existsPromise(filePath)) {
      throw new Error('[Error] The file being get stats does not exist.');
    }
    return await fsPromises.stat(filePath, { bigint: true, });
  }

  async watch(place, options, listener) {
    if (typeof place !== 'string') {
      throw new Error('[Error] The parameter place should be of string type.');
    }
    const { location, } = this;
    const filePath = path.join(location, place);
    const dirname = dealDirname(path.dirname(filePath));
    const basename = path.basename(filePath);
    if (path.extname(filePath).length >= 1) {
      if (!checkHiddenDirs(dirname)) {
        throw new Error('[Error] Cannot operate hidden directorys.');
      }
      if (!checkHiddenFile(basename)) {
        throw new Error('[Error] Cannot operate hidden files.');
      }
      if (!await existsPromise(filePath)) {
        throw new Error('[Error] The file being watch does not exist.');
      }
      return await watchPromise(filePath, options, listener);
    } else {
      const dirPath = filePath;
      if (!checkHiddenDirs(dirPath)) {
        throw new Error('[Error] Cannot operate hidden directorys.');
      }
      if (!await existsPromise(filePath)) {
        throw new Error('[Error] The path to the operation does not exist.');
      }
      return await watchPromise(dirPath, options, listener);
    }
  }

  async exists(place) {
    let ans = true;
    const {
      indexPath,
      shiftOneReasonBytes,
    } = this;
    const sortGatherings = getSortGatherings(place);
    const { length, } = sortGatherings;
    for (let i = 0; i < length; i += 1) {
      const [code, frequency] = sortGatherings[i];
      const indexAbsoluteDir = path.join(indexPath, getIndexRelativeDir(code));
      const depthName = Buffer.from(shiftOneReasonBytes.fromInt(i)).map((buffer) => toChar(buffer)).toString();
      const ptrsPath = path.join(indexAbsoluteDir, depthName);
      const result = await this.checkIndexFile(ptrsPath, code ,frequency, place, i, length - 1);
      if (result === false) {
        ans = false;
        break;
      }
    }
    return ans;
  }

  async checkPointerInPointers(pointersPath, code, frequency) {
    let ans = false;
    const pointerHash = await this.getPointerHash(pointersPath);
    const frequencies = pointerHash[code];
    if (Array.isArray(frequencies)) {
      frequency = BigInt(frequency);
      if (frequencies.includes(frequency)) {
        ans = true;
      }
    }
    return ans;
  }

  async checkIndexFile(ptrsPath, code, frequency, name, idx, last) {
    if (await existsPromise(ptrsPath)) {
      const ptrsDirPath = path.dirname(ptrsPath);
      if (idx === last) {
        const namesDir = path.join(path.dirname(ptrsPath), String(code));
        const namesPath = path.join(namesDir, String(frequency));
        const ans = await this.checkPointerInPointers(ptrsPath, code, frequency);
        if (ans === false) {
          return ans;
        }
        return await checkNameInNames(namesPath, name);
      } else {
        return await this.checkPointerInPointers(ptrsPath, code, frequency);
      }
    } else {
      return false;
    }
  }

  async getPointerHash(pointersPath) {
    const pointerHash = {};
    if (await existsPromise(pointersPath)) {
      const buffer = await fsPromises.readFile(pointersPath);
      const { shiftTwoBytes, } = this;
      let status = 0;
      let bytes = [];
      let code;
      for (let i = 0; i < buffer.length; i += 1) {
        const byte = buffer[i];
        if (byte === 0) {
          if (status === 0) {
            code = shiftTwoBytes.toInt(bytes);
            if (pointerHash[code] === undefined) {
              pointerHash[code] = [];
            }
            status = 1;
          } else {
            const frequency = shiftTwoBytes.toInt(bytes);
            pointerHash[code].push(frequency);
          }
          bytes = [];
        } else {
          bytes.push(byte);
        }
      }
    }
    return pointerHash;
  }

  async addEntireIndex(place) {
    const {
      indexPath,
      shiftOneReasonBytes,
    } = this;
    const sortGatherings = getSortGatherings(place);
    const { length, } = sortGatherings;
    for (let i = 0; i < length; i += 1) {
      let [code, frequency] = sortGatherings[i];
      const indexAbsoluteDir = path.join(indexPath, getIndexRelativeDir(code));
      if (!await existsPromise(indexAbsoluteDir)) {
        await fsPromises.mkdir(indexAbsoluteDir, { recursive: true, });
      }
      const depthName = Buffer.from(shiftOneReasonBytes.fromInt(i)).map((buffer) => toChar(buffer)).toString();
      const pointersPath = path.join(indexAbsoluteDir, depthName);
      if (!await existsPromise(pointersPath)) {
        if (i !== length - 1) {
          await this.addIndexFile(pointersPath, code, frequency);
        } else {
          await this.addIndexFile(pointersPath, code, frequency, place);
        }
        const pointerPath = getCountsPath(pointersPath);
        await this.createCountsFile(pointerPath, code, frequency);
      } else {
        const pointerHash = await this.getPointerHash(pointersPath);
        const frequencies = pointerHash[code];
        if (Array.isArray(frequencies)) {
          frequency = BigInt(frequency);
          if (!frequencies.includes(frequency)) {
            if (i !== length - 1) {
              await this.addIndexFile(pointersPath, code, frequency);
            } else {
              await this.addIndexFile(pointersPath, code, frequency, place);
            }
          } else {
            const countsPath = getCountsPath(pointersPath);
            code = BigInt(code);
            frequency = BigInt(frequency);
            await this.increaseCount(countsPath, code, frequency);
          }
        } else {
          if (i !== length - 1) {
            await this.addIndexFile(pointersPath, code, frequency);
          } else {
            await this.addIndexFile(pointersPath, code, frequency, place);
          }
          const pointerPath = getCountsPath(pointersPath);
          await this.createCountFile(pointerPath, code, frequency);
        }
      }
    }
  }

  async createCountsFile(countsPath, code, frequency) {
    const fd = await openPromise(countsPath, 'w');
    const { shiftTwoBytes, } = this;
    const bytes = [shiftTwoBytes.fromInt(code), 0, shiftTwoBytes.fromInt(frequency), 1, shiftTwoBytes.fromInt(1), 1, 0];
    await writePromise(fd, Buffer.from(bytes));
    await fsyncPromise(fd);
    await closePromise(fd);
  }

  async addIndexFile(pointersPath, code, frequency, name) {
    if (name !== undefined) {
      await this.addPointerToPointers(pointersPath, code, frequency);
      const namesDirectory = path.join(path.dirname(pointersPath), String(code));
      if (!await existsPromise(namesDirectory)) {
        await fsPromises.mkdir(namesDirectory);
      }
      const namesPath = path.join(namesDirectory, String(frequency));
      await addNameToNames(namesPath, code, frequency, name);
    } else {
      await this.addPointerToPointers(pointersPath, code, frequency);
    }
  }

  async addPointerToPointers(pointersPath, code, frequency) {
    const { shiftTwoBytes, } = this;
    const words = [shiftTwoBytes.fromInt(code), 0, shiftTwoBytes.fromInt(frequency), 0];
    if (await existsPromise(pointersPath)) {
      const fd = await openPromise(pointersPath, 'a');
      await writePromise(fd, Buffer.from(words.flat()));
      await fsyncPromise(fd);
      await closePromise(fd);
    } else {
      const fd = await openPromise(pointersPath, 'w');
      await writePromise(fd, Buffer.from(words.flat()));
      await fsyncPromise(fd);
      await closePromise(fd);
    }
  }

  async increaseCount(countsPath, code, frequency) {
    const { shiftTwoBytes, } = this;
    const buffer = await fsPromises.readFile(countsPath);
    let words = [];
    let bytes = [];
    let update = false;
    let status = 0;
    let idx;
    const assemble = {
      code: -1,
      frequency: -1,
    };
    for (let i = 0; i < buffer.length; i += 1) {
      const byte = buffer[i];
      if (byte === 0) {
        if (status === 0) {
          assemble.code = shiftTwoBytes.toInt(bytes);
          words = words.concat([code, 0]);
          bytes = [];
          status = 1;
        } else if (status === 3) {
          words.push(0);
          status = 1;
        }
      } else if (byte === 1) {
        if (status === 1) {
          assemble.frequency = shiftTwoBytes.toInt(bytes);
          bytes = [];
          status = 2;
        } else if (status === 2) {
          assemble.count = shiftTwoBytes.toInt(bytes);
          bytes = [];
          const {
            code: code1,
            frequency: frequency1,
            count,
          } = assemble;
          if (code1 === code && frequency1 === frequency) {
            if (checkCrossByte(count, count + 1n, shiftTwoBytes)) {
              idx = i;
              update = true;
              break;
            } else {
              words = words.concat([shiftTwoBytes.fromInt(frequency1), 1, shiftTwoBytes.fromInt(count), 1]);
            }
          } else {
            words = words.concat([shiftTwoBytes.fromInt(frequency1), 1, shiftTwoBytes.fromInt(count), 1]);
          }
          status = 3;
        }
      } else {
        bytes.push(byte);
      }
    }
    if (update === true) {
      const fd = await openPromise(countsPath, 'a');
      const { count, } = assemble;
      const buffer = Buffer.from(shiftTwoBytes.fromInt(count + 1n));
      const position = idx - buffer.length;
      await writePromise(fd, buffer, { position, });
      await fsyncPromise(fd);
      await closePromise(fd);
    } else {
      const fd = await openPromise(countsPath, 'w');
      await writePromise(fd, Buffer.from(words.flat()));
      await fsyncPromise(fd);
      await closePromise(fd);
    }
  }

  async removeEntireIndex(place) {
    const {
      indexPath,
      shiftOneReasonBytes,
    } = this;
    const sortGatherings = getSortGatherings(place);
    const { length, } = sortGatherings;
    for (let i = length - 1; i >= 0; i -= 1) {
      const [code, frequency] = sortGatherings[i];
      const indexAbsoluteDir = path.join(indexPath, getIndexRelativeDir(code));
      const depthName = Buffer.from(shiftOneReasonBytes.fromInt(i)).map((buffer) => toChar(buffer)).toString();
      const ptrsPath = path.join(indexAbsoluteDir, depthName);
      await this.removeIndexFile(ptrsPath, code ,frequency, place, i, length - 1);
    }
  }

  async getCountsHash(countsPath) {
    const { shiftTwoBytes, } = this;
    const countsHash = {};
    if (await existsPromise(countsPath)) {
      let all = true;
      const buffer = await fsPromises.readFile(countsPath);
      let bytes = [];
      let flag = 0;
      let currentCode;
      let currentFrequency;
      buffer.forEach((byte) => {
        switch (byte) {
          case 0:
            switch (flag) {
              case 0:
                currentCode = shiftTwoBytes.toInt(bytes);
                bytes = [];
                countsHash[currentCode] = {};
                flag = 1;
                break;
              case 1:
              case 2:
                flag = 0;
                break;
            }
            break;
          case 1:
            switch (flag) {
              case 1:
                currentFrequency = shiftTwoBytes.toInt(bytes);
                bytes = [];
                flag = 2;
                break;
              case 2:
                const count = shiftTwoBytes.toInt(bytes);
                if (count !== 0n) {
                  all = false;
                }
                bytes = [];
                countsHash[currentCode][currentFrequency] = count;
                flag = 1;
                break;
            }
            break;
          default:
            bytes.push(byte);
        }
      });
      if (all === true) {
        await fsPromises.unlink(countsPath);
      }
    }
    return countsHash;
  }

  async removePtrFromPtrs(ptrsPath, code, frequency) {
    const { shiftTwoBytes, } = this;
    const buffer = await fsPromises.readFile(ptrsPath);
    let ptrsBufArr = [];
    let bytes = [];
    let flag = 0;
    let currentCode;
    let currentFrequenciesBuf;
    let remove;
    let byteCount;
    for (let i = 0; i < buffer.length; i += 1) {
      const byte = buffer[i];
      switch (byte) {
        case 0: {
          switch (flag) {
            case 0:
              currentCode = shiftTwoBytes.toInt(bytes);
              currentFrequenciesBuf = [];
              remove = false;
              flag = 1;
              break;
            case 1:
              if (remove === true && i === buffer.length - 1) {
                await fsPromises.truncate(ptrsPath, buffer.length - byteCount - 2);
                const fd = await openPromise(ptrsPath, 'a');
                const appendBuf = Buffer.from([1, 0]);
                await writePromise(fd, appendBuf);
                await fsyncPromise(fd);
                await closePromise(fd);
                return;
              }
              if (currentFrequenciesBuf.length > 0) {
                ptrsBufArr = ptrsBufArr.concat(currentFrequenciesBuf);
                ptrsBufArr.push(0);
              }
              flag = 0;
              break;
          }
          bytes = [];
          break;
        }
        case 1:
          const currentFrequency = shiftTwoBytes.toInt(bytes);
          if (!(currentCode === BigInt(code) && currentFrequency === BigInt(frequency))) {
            if (bytes.length > 0) {
              currentFrequenciesBuf.push(currentCode);
            }
          } else {
            byteCount = bytes.length;
            remove = true;
          }
          break;
        default:
          bytes.push(byte);
      }
    }
    if (ptrsBufArr.length === 0) {
      await fsPromises.unlink(ptrsPath);
      const ptrsDirPath = path.dirname(ptrsPath);
      await clearEmptyDirs(ptrsDirPath, '.index');
    } else {
      const fd = await openPromise(ptrsPath, 'w');
      await writePromise(fd, Buffer.from(ptrsBufArr.flat()));
      await fsyncPromise(fd);
      await closePromise(fd);
    }
  }

  async reduceCountToCounts(countsPath, code, frequency) {
    const { shiftTwoBytes, } = this;
    const buffer = await fsPromises.readFile(countsPath);
    const countsBufArr = [];
    let bytes = [];
    let flag = 0;
    let currentCode;
    let currentFrequency;
    let currentCount;
    let currentIdx;
    let afterCountBuf;
    let update = false;
    outer: for (let i = 0; i < buffer.length; i += 1) {
      const byte = buffer[i];
      switch (byte) {
        case 0:
          switch (flag) {
            case 0:
            case 1:
              currentCode = shiftTwoBytes.toInt(bytes);
              bytes = [];
              flag = 1;
              break;
            case 2:
              flag = 0;
              break;
          }
          break;
        case 1:
          switch (flag) {
            case 1:
              currentFrequency = shiftTwoBytes.toInt(bytes);
              bytes = [];
              flag = 2;
              break;
            case 2:
              currentCount = shiftTwoBytes.toInt(bytes);
              if (currentCount === 1n) {
                //if (i === buffer.length - 3) {
                  //let byteCount = 0;
                  //let byte;
                  //let j = i - 1;
                  //while (true) {
                    //byte = buffer[j];
                    //if (byte === 0) {
                      //break;
                    //}
                    //if (byte !== 1) {
                      //byteCount += 1;
                    //}
                  //}
                  //await fsPromises.truncate(ptrsPath, buffer.length - byteCount - 2);
                  //const fd = await openPromise(ptrsPath, 'a');
                  //const appendBuf = Buffer.from([1, 0]);
                  //await writePromise(fd, appendBuf);
                  //await fsyncPromise(fd);
                  //await closePromise(fd);
                  //return;
                //}
                flag = 1;
                continue outer;
              }
              if ((currentCode === BigInt(code) && currentFrequency === BigInt(frequency)) && i === buffer.length - 2) {
                const currentCountBuf = shiftTwoBytes.fromInt(currentCount);
                const afterCount = currentCount - 1n;
                afterCountBuf = shiftTwoBytes.fromInt(afterCount);
                if (currentCountBuf.length === afterCountBuf.length && i === buffer.length - 2) {
                  currentIdx = i;
                  update = true;
                  break outer;
                } else {
                  countsBufArr.push(shiftTwoBytes.fromInt(currentCode));
                  countsBufArr.push(0);
                  countsBufArr.push(shiftTwoBytes.fromInt(currentFrequency));
                  countsBufArr.push(1);
                  countsBufArr.push(shiftTwoBytes.fromInt(afterCount));
                  countsBufArr.push(1);
                }
              } else {
                countsBufArr.push(shiftTwoBytes.fromInt(currentCode));
                countsBufArr.push(0);
                countsBufArr.push(shiftTwoBytes.fromInt(currentFrequency));
                countsBufArr.push(1);
                countsBufArr.push(shiftTwoBytes.fromInt(currentCount));
                countsBufArr.push(1);
              }
              flag = 1;
              break;
          }
          break;
        default:
          bytes.push(byte);
      }
    }
    if (update === true) {
      const fd = await openPromise(countsPath, 'a');
      await writePromise(fd, Buffer.from(afterCountBuf), { position: currentIdx - afterCountBuf.length, });
      return;
    }
    if (countsBufArr.length > 0) {
      const fd = await openPromise(countsPath, 'w');
      await writePromise(fd, Buffer.from(countsBufArr.flat()));
      await fsyncPromise(fd);
      await closePromise(fd);
    } else {
      fsPromises.unlink(countsPath);
    }
  }

  async removeIndexFile(ptrsPath, code, frequency, name, idx, last) {
    const ptrsDirPath = path.dirname(ptrsPath);
    if (idx === last) {
      const namesDirPath = path.join(path.dirname(ptrsPath), String(code));
      const namesPath = path.join(namesDirPath, String(frequency));
      await removeNameFromNames(namesPath, code, frequency, name);
      await clearEmptyDirs(namesDirPath, '.index');
      await this.reduceCountToCounts(getCountsPath(ptrsPath), code, frequency);
      const countsHash = await this.getCountsHash(getCountsPath(ptrsPath));
      if (getCountFromCountsHash(countsHash, code, frequency) === 0n) {
        await this.removePtrFromPtrs(ptrsPath, code, frequency);
        await clearEmptyDirs(ptrsDirPath, '.index');
      }
    } else {
      await this.reduceCountToCounts(getCountsPath(ptrsPath), code, frequency);
      const countsHash = await this.getCountsHash(getCountsPath(ptrsPath));
      if (getCountFromCountsHash(countsHash, code, frequency) === 0n) {
        await this.removePtrFromPtrs(ptrsPath, code, frequency);
        await clearEmptyDirs(ptrsDirPath, '.index');
      }
    }
  }
}

export default Storage;
