import fsPromises from 'fs/promises';
import fs from 'fs';
import path from 'path';
import existsPromise from '~/lib/util/existsPromise';
import readPromise from '~/lib/util/readPromise';
import writePromise from '~/lib/util/writePromise';
import fdatasyncPromise from '~/lib/util/fdatasyncPromise';
import openPromise from '~/lib/util/openPromise';
import closePromise from '~/lib/util/closePromise';
import * as reasonByteArray from '~/lib/util/reasonByteArray';

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
    throw new Error('The parameter list should be an array type.');
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

function toReason(value) {
  value -= 33;
  switch (value) {
    case 96:
      value = 0;
      break;
    case 108:
      value = 1:
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
      value = 108:
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
  value -= 9;
  switch (value) {
    case 92 - 42:
      value = 43 - 42;
      break;
    case 63 - 42:
      value = 45 - 42;
      break;
    case 58 - 42:
      value = 48 - 42;
      break;
    case 124 - 42:
      value = 49 - 42;
      break;
    case 60 - 42:
      value = 50 - 42;
      break;
    case 62 - 42:
      value = 51 - 42;
      break;
    case 59 - 42:
      value = 52 - 42;
      break;
    case 61 - 42:
      value = 53 - 42;
      break;
  }
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
      throw new Error('[Error] The file you want to get does not exist.');
    }
    const dirname = dealDirname(path.dirname(filePath));
    if (!checkHiddenDirs(dirname)) {
      throw Error('[Error] Cannot operate hidden directorys.');
    }
    const basename = path.basename(filePath);
    if (!checkHiddenFile(basename)) {
      throw Error('[Error] Cannot operate hidden files.');
    }
    return fsPromises.readFile(filePath);
  }

  async readBufferPiece(place, position, length) {
    if (typeof place !== 'string') {
      throw new Error('[Error] The parameter place should be of string type.');
    }
    const { location, } = this;
    const filePath = path.join(location, place);
    if (!(path.extname(filePath).length >= 1)) {
      throw new error('[error] the added path does not correspond to the file type.');
    }
    if (!await existsPromise(filePath)) {
      throw new Error('[Error] The file you want to get does not exist.');
    }
    const dirname = dealDirname(path.dirname(filePath));
    if (!checkHiddenDirs(dirname)) {
      throw error('[error] cannot operate hidden directorys.');
    }
    const basename = path.basename(filePath);
    if (!checkHiddenFile(basename)) {
      throw error('[error] cannot operate hidden files.');
    }
    const fd = await openPromise(filePath, 'r');
    return await readPromise(fd, { position, length, });
  }

  async writeBufferPiece(place, position, buffer) {
    if (typeof place !== 'string') {
      throw new Error('[Error] The parameter place should be of string type.');
    }
    const { location, } = this;
    const filePath = path.join(location, place);
    if (!(path.extname(filePath).length >= 1)) {
      throw new error('[error] the added path does not correspond to the file type.');
    }
    if (!await existsPromise(filePath)) {
      throw new Error('[Error] The file you want to get does not exist.');
    }
    const dirname = dealDirname(path.dirname(filePath));
    if (!checkHiddenDirs(dirname)) {
      throw error('[error] cannot operate hidden directorys.');
    }
    const basename = path.basename(filePath);
    if (!checkHiddenFile(basename)) {
      throw error('[error] cannot operate hidden files.');
    }
    const fd = await openPromise(filePath, 'a');
    await writePromise(fd, buffer, { position, });
    await fdatasyncPromise(fd);
    await closePromise(fd);
  }

  async addBuffer(place, buffer) {
    if (typeof place !== 'string') {
      throw new Error('[Error] The parameter place should be of string type.');
    }
    const { location, } = this;
    const filePath = path.join(location, place);
    if (!(path.extname(filePath).length >= 1)) {
      throw new error('[error] the added path does not correspond to the file type.');
    }
    const dirname = dealDirname(path.dirname(filePath));
    if (!checkHiddenDirs(dirname)) {
      throw error('[error] cannot operate hidden directorys.');
    }
    const basename = path.basename(filePath);
    if (!checkHiddenFile(basename)) {
      throw error('[error] cannot operate hidden files.');
    }
    if (await existsPromise(filePath)) {
      throw new Error('[Error] The file to be created already exists.');
    }
    if (!await existsPromise(dirname)) {
      await fsPromises.mkdir(dirname, { recursive: true, });
    }
    const { indexPath, } = this;
    const sortGatherings = getSortGatherings(place);
    for (let i = 0; i < sortGatherings.length; i += 1) {
      const [code] = sortGatherings[i];
      const indexAbsDirs = path.join(indexPath, getIndexRelDirs(code));
      if (!await existsPromise(indexAbsDirs)) {
        await fsPromises.mkdir(indexAbsDirs, { recursive: true, });
      }
      const depthName = Buffer.from(byteArray.fromInt(toReason(i))).toString();
      const leafPath = path.join(indexAbsDirs, depthName);
    }
    const fd = await openPromise(filePath, 'w');
    await writePromise(fd, buffer);
    await fdatasyncPromise(fd);
    await closePromise(fd);
  }

  async appendData(place, data) {
    if (typeof place !== 'string') {
      throw new Error('[Error] The parameter place should be of string type.');
    }
    const { location, } = this;
    const filePath = path.join(location, place);
    if (!(path.extname(filePath).length >= 1)) {
      throw new Error('[Error] The added path does not correspond to the file type.');
    }
    if (!await existsPromise(filePath)) {
      throw new Error('[Error] The file to be added does not exist.');
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
    await fdatasyncPromise(fd);
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
      throw new Error('[Error] The added path does not correspond to the file type.');
    }
    if (!await existsPromise(filePath)) {
      throw new Error('[Error] The file to be deleted does not exist.');
    }
    const { indexPath, } = this;
    const sortGatherings = getSortGatherings(place);
    for (let i = 0; i < sortGatherings.length; i += 1) {
      const [code] = sortGatherings[i];
      const indexAbsDirs = path.join(indexPath, getIndexRelDirs(code));
      await clearEmptyDirs(indexAbsDirs, '.index');
    }
    await fsPromises.unlink(filePath);
    await clearEmptyDirs(dirname);
  }
}

export default Storage;
