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

function checkHiddenFile(fileName) {
  let ans = true;
  if (fileName.charAt(0) === '.') {
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

function getIndexRelDirs(code) {
  const paths = [];
  while (code > 0) {
    paths.push(String(code % 10));
    code = Math.floor(code / 10);
  }
  paths.push('0');
  return paths.join(path.sep);
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

async function getNames(namesPath) {
  const buffer = await fsPromises.readFile(namesPath);
  const names = [];
  let bytes = [];
  buffer.forEach((byte) => {
    switch (byte) {
      case 0:
        names.push(Buffer.from(bytes).toString());
        bytes = [];
        break;
      default:
        bytes.push(byte);
    }
  });
  return ptrsHash;
}

async function addNameToNames(namesPath, code, frequency, name) {
  const fd = await openPromise(namesPath, 'a');
  const nameBufArr= [];
  nameBufArr.push(Buffer.from(name));
  nameBufArr.push(0);
  await writePromise(fd, Buffer.from(nameBufArr.flat()));
  await fsyncPromise(fd);
  await closePromise(fd);
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
      throw Error('[Error] The parameter location cannot contain hidden directories.');
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
    this.reasonByteArray = new ByteArray({ size: 202n, });
    this.nonZeroByteArray = new ByteArray({ size: 256n, shift: 1n, });
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

  async readData(place) {
    if (typeof place !== 'string') {
      throw new Error('[Error] The parameter place should be of string type.');
    }
    const { location, } = this;
    const filePath = path.join(location, place);
    if (!(path.extname(filePath).length >= 1)) {
      throw new Error('[Error] The added path does not correspond to the file type.');
    }
    if (!await existsPromise(filePath)) {
      throw new Error('[Error] The file being operated on does not exist.');
    }
    const dirname = dealDirname(path.dirname(filePath));
    if (!checkHiddenDirs(dirname)) {
      throw Error('[Error] Cannot operate hidden directorys.');
    }
    const basename = path.basename(filePath);
    if (!checkHiddenFile(basename)) {
      throw Error('[Error] Cannot operate hidden files.');
    }
    const stats = await fsPromises.stat(filePath, { bigint: true, });
    if (stats.isSymbolicLink()) {
      return fsPromises.readlink(filePath);
    } else {
      return fsPromises.readFile(filePath);
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
      throw new Error('[Error] The file being operated on does not exist.');
    }
    const dirname = dealDirname(path.dirname(filePath));
    if (!checkHiddenDirs(dirname)) {
      throw Error('[Error] cannot operate hidden directorys.');
    }
    const basename = path.basename(filePath);
    if (!checkHiddenFile(basename)) {
      throw Error('[Error] cannot operate hidden files.');
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
      throw new Error('[Error] The file being operated on does not exist.');
    }
    const dirname = dealDirname(path.dirname(filePath));
    if (!checkHiddenDirs(dirname)) {
      throw Error('[Error] cannot operate hidden directorys.');
    }
    const basename = path.basename(filePath);
    if (!checkHiddenFile(basename)) {
      throw Error('[Error] cannot operate hidden files.');
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
      throw new Error('[Error] The file being operated on does not exist.');
    }
    const dirname = dealDirname(path.dirname(filePath));
    if (!checkHiddenDirs(dirname)) {
      throw Error('[Error] cannot operate hidden directorys.');
    }
    const basename = path.basename(filePath);
    if (!checkHiddenFile(basename)) {
      throw Error('[Error] cannot operate hidden files.');
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
      throw Error('[Error] cannot operate hidden directorys.');
    }
    const basename = path.basename(filePath);
    if (!checkHiddenFile(basename)) {
      throw Error('[Error] cannot operate hidden files.');
    }
    if (!await existsPromise(dirname)) {
      await fsPromises.mkdir(dirname, { recursive: true, });
    }
    const {
      indexPath,
      reasonByteArray,
    } = this;
    const sortGatherings = getSortGatherings(place);
    const { length, } = sortGatherings;
    for (let i = 0; i < length; i += 1) {
      const [code, frequency] = sortGatherings[i];
      const indexAbsDirs = path.join(indexPath, getIndexRelDirs(code));
      if (!await existsPromise(indexAbsDirs)) {
        await fsPromises.mkdir(indexAbsDirs, { recursive: true, });
      }
      const depthName = Buffer.from(reasonByteArray.fromInt(i)).map((buffer) => toChar(buffer)).toString();
      const ptrsPath = path.join(indexAbsDirs, depthName);
      if (!await existsPromise(ptrsPath)) {
          await this.addIndexFile(ptrsPath, code, frequency, place, i, length - 1);
      } else {
        const ptrsHash = await this.getPtrsHash(ptrsPath);
        const frequencys = ptrsHash[code];
        if (Array.isArray(frequency)) {
          if (!frequencys.includes(frequcy)) {
            await this.addIndexFile(ptrsPath, code, frequency, place, i, length - 1);
          }
        } else {
          await this.addIndexFile(ptrsPath, code, frequency, place, i, length - 1);
        }
      }
    }
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
      throw new Error('[Error] The file being operated on does not exist.');
    }
    const dirname = dealDirname(path.dirname(filePath));
    if (!checkHiddenDirs(dirname)) {
      throw Error('[Error] Cannot operate hidden directorys.');
    }
    const basename = path.basename(filePath);
    if (!checkHiddenFile(basename)) {
      throw Error('[Error] Cannot operate hidden files.');
    }
    const fd = await openPromise(filePath, 'a');
    await writePromise(fd, data);
    await fsyncPromise(fd);
    await closePromise(fd);
  }

  async remove(place) {
    if (typeof place !== 'string') {
      throw new Error('[Error] The parameter place should be of string type.');
    }
    const { location, } = this;
    const filePath = path.join(location, place);
    const dirname = dealDirname(path.dirname(filePath));
    if (!checkHiddenDirs(dirname)) {
      throw Error('[Error] Cannot operate hidden directorys.');
    }
    const basename = path.basename(filePath);
    if (!checkHiddenFile(basename)) {
      throw Error('[Error] Cannot operate hidden files.');
    }
    if (!(path.extname(filePath).length >= 1)) {
      throw new Error('[Error] The file you are working with needs to have its file extension specified.');
    }
    const stats = await fsPromises.lstat(filePath);
    if (!stats.isSymbolicLink()) {
      if (!await existsPromise(filePath)) {
        throw new Error('[Error] The file being operated on does not exist.');
      }
      const {
        indexPath,
        reasonByteArray,
      } = this;
      const sortGatherings = getSortGatherings(place);
      for (let i = 0; i < sortGatherings.length; i += 1) {
        const [code] = sortGatherings[i];
        const indexAbsDirs = path.join(indexPath, getIndexRelDirs(code));
        const depthName = Buffer.from(reasonByteArray.fromInt(i)).map((buffer) => toChar(buffer)).toString();
        const ptrsPath = path.join(indexAbsDirs, depthName);
        await fsPromises.unlink(ptrsPath);
        await clearEmptyDirs(indexAbsDirs, '.index');
      }
    }
    await fsPromises.unlink(filePath);
    await clearEmptyDirs(dirname);
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
      throw Error('[Error] Cannot operate hidden directorys.');
    }
    const basename = path.basename(filePath);
    if (!checkHiddenFile(basename)) {
      throw Error('[Error] Cannot operate hidden files.');
    }
    if (!(path.extname(filePath).length >= 1)) {
      throw new Error('[Error] The file you are working with needs to have its file extension specified.');
    }
    if (!await existsPromise(filePath)) {
      throw new Error('[Error] The file being operated on does not exist.');
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
      throw Error('[Error] Cannot operate hidden directorys.');
    }
    const oldBasename = path.basename(oldFilePath);
    if (!checkHiddenFile(oldBasename)) {
      throw Error('[Error] Cannot operate hidden files.');
    }
    if (!(path.extname(oldFilePath).length >= 1)) {
      throw new Error('[Error] The file you are working with needs to have its file extension specified.');
    }
    if (!await existsPromise(oldFilePath)) {
      throw new Error('[Error] The file being operated on does not exist.');
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
      await clearEmptyDirs(oldDirname);
    }
  }

  async link(targetPlace, linkPlace) {
    if (typeof targetPlace !== 'string') {
      throw new Error('[Error] The parameter targetPlace should be of string type.');
    }
    const { location, } = this;
    const targetFilePath = path.join(location, targetPlace);
    const targetDirname = dealDirname(path.dirname(targetFilePath));
    if (!checkHiddenDirs(targetDirname)) {
      throw Error('[Error] Cannot operate hidden directorys.');
    }
    const targetBasename = path.basename(targetFilePath);
    if (!checkHiddenFile(targetBasename)) {
      throw Error('[Error] Cannot operate hidden files.');
    }
    if (!(path.extname(targetFilePath).length >= 1)) {
      throw new Error('[Error] The file you are working with needs to have its file extension specified.');
    }
    if (!await existsPromise(targetFilePath)) {
      throw new Error('[Error] The file being operated on does not exist.');
    }
    if (typeof linkPlace !== 'string') {
      throw new Error('[Error] The parameter linkPlace should be of string type.');
    }
    const linkFilePath = path.join(location, linkPlace);
    const linkDirname = dealDirname(path.dirname(linkFilePath));
    if (!checkHiddenDirs(linkDirname)) {
      throw Error('[Error] Cannot operate hidden directorys.');
    }
    const linkBasename = path.basename(linkFilePath);
    if (!checkHiddenFile(linkBasename)) {
      throw Error('[Error] Cannot operate hidden files.');
    }
    if (!(path.extname(linkFilePath).length >= 1)) {
      throw new Error('[Error] The file you are working with needs to have its file extension specified.');
    }
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
      throw Error('[Error] Cannot operate hidden directorys.');
    }
    const basename = path.basename(filePath);
    if (!checkHiddenFile(basename)) {
      throw Error('[Error] Cannot operate hidden files.');
    }
    if (!(path.extname(filePath).length >= 1)) {
      throw new Error('[Error] The file you are working with needs to have its file extension specified.');
    }
    if (!await existsPromise(filePath)) {
      throw new Error('[Error] The file being operated on does not exist.');
    }
    return await fsPromises.stat(filePath, { bigint: true, });
  }

  async getPtrsHash(ptrsPath) {
    const { nonZeroByteArray, } = this;
    const buffer = await fsPromises.readFile(ptrsPath);
    const ptrsHash = {};
    let bytes = [];
    let flag = 0;
    let key;
    buffer.forEach((byte) => {
      switch (byte) {
        case 0:
          switch (flag) {
            case 0:
              key = nonZeroByteArray.toInt(bytes);
              flag = 1;
              break;
            default:
              if (ptrsHash[key] === undefined) {
                ptrsHash[key] = [];
              }
              ptrsHash[key].push(nonZeroByteArray.toInt(bytes));
              flag = 0;
          }
          bytes = [];
          break;
        default:
          bytes.push(byte);
      }
    });
    return ptrsHash;
  }

  async addPtrToPtrs(ptrsPath, code, frequency) {
    const { nonZeroByteArray, } = this;
    const fd = await openPromise(ptrsPath, 'a');
    const ptrBufArr= [];
    ptrBufArr.push(nonZeroByteArray.fromInt(code));
    ptrBufArr.push(0);
    ptrBufArr.push(nonZeroByteArray.fromInt(frequency));
    ptrBufArr.push(0);
    await writePromise(fd, Buffer.from(ptrBufArr.flat()));
    await fsyncPromise(fd);
    await closePromise(fd);
  }

  async addIndexFile(ptrsPath, code, frequency, name, idx, last) {
    if (idx === last) {
      await this.addPtrToPtrs(ptrsPath, code, frequency);
      const namesDirPath = path.join(path.dirname(ptrsPath), String(code));
      if (!await existsPromise(namesDirPath)) {
        await fsPromises.mkdir(namesDirPath);
      }
      const namesPath = path.join(namesDirPath, String(frequency));
      await addNameToNames(namesPath, code, frequency, name);
    } else {
      await this.addPtrToPtrs(ptrsPath, code, frequency);
    }
  }
}

export default Storage;
