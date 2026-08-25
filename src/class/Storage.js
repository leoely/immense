import fsPromises from 'fs/promises';
import fs from 'fs';
import os from 'os';
import path from 'path';
import Fulmination from 'fulmination';
import disk from 'diskusage';
import {
  NamespaceRouter,
} from 'advising.js';
import {
  ByteArray,
  logOutOfMemory,
  logInsufficientDiskSpace,
} from 'manner.js/server';
import radixSort from '~/lib/util/radixSort';
import ParameterError from '~/class/ParameterError';
import existsPromise from '~/lib/util/existsPromise';
import readPromise from '~/lib/util/readPromise';
import writePromise from '~/lib/util/writePromise';
import fsyncPromise from '~/lib/util/fsyncPromise';
import openPromise from '~/lib/util/openPromise';
import closePromise from '~/lib/util/closePromise';

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

function getCount(countHash, code, frequency) {
  let ans = 0n;
  const hash = countHash[code];
  if (hash !== undefined) {
    if (hash[frequency] !== undefined) {
      ans = hash[frequency];
    }
  }
  return ans;
}

function checkSingleHidden(fileName) {
  let ans = true;
  if (fileName.charAt(0) === '.') {
    ans = false;
  }
  return ans;
}

function checkMultipleHidden(paths) {
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
      const location = dirs.join(path.sep);
      const directory = await fsPromises.opendir(location);
      const entry = await directory.read();
      await directory.close();
      if (typeof end === 'string') {
        if (end === dirs[dirs.length - 1]) {
          break;
        }
      }
      if (entry === null) {
        await fsPromises.rmdir(location);
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
  return nameSet[place] === true;
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

function checkTransitByte(v1, v2, bytes) {
  const bytes1 = bytes.fromInt(v1);
  const bytes2 = bytes.fromInt(v2);
  const { length: length1, } = bytes1;
  const { length: length2, } = bytes2;
  return length1 === length2;
}

async function removeName(namesPath, place) {
  const buffer = await fsPromises.readFile(namesPath);
  let words = [];
  let bytes = [];
  let long;
  if (buffer.toString() === place) {
    await fsPromises.unlink(namesPath);
  } else {
    let idx;
    for (let i = 0; i < buffer.length; i += 1) {
      const byte = buffer[i];
      if (byte === 0) {
        const name = Buffer.from(bytes).toString();
        if (name !== place) {
          words = words.concat([bytes, 0]);
        } else {
          long = bytes.length;
          idx = i;
        }
        bytes = [];
      } else {
        bytes.push(byte);
      }
    }
    const { length: size, } = buffer;
    const { length, } = words;
    if (length === 0) {
      await fsPromises.unlink(namesPath);
    } else if (idx === size - 1) {
      await fsPromises.truncate(namesPath, buffer.length - long - 1);
    } else {
      const fd = await openPromise(namesPath, 'w');
      await writePromise(fd, Buffer.from(words.flat()));
      await fsyncPromise(fd);
      await closePromise(fd);
    }
  }
}

const coverDirectoryIndexKey = Symbol('coverDirectoryIndex');
const temporaryDiskAvailableKey = Symbol('temporaryDiskAvailable');
const temporaryUpdateDiskAvailableKey = Symbol('temporaryUpdateDiskAvailable');

class Storage {
  constructor(location, options = {}) {
    if (typeof location !== 'string') {
      throw new Error('[Error] The parameter location should be a string type.');
    }
    if (!path.isAbsolute(location)) {
      throw new Error('[Error] The location passed in should be an absolute path.');
    }
    if (!checkMultipleHidden(location)) {
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
      acquireAvailableDelta: false,
      temporaryDiskAvailable: -1,
      temporaryDiskSwitch: false,
      logPath: '/var/log/immense',
      develop: false,
      debug: false,
    };
    this.options = Object.assign(defaultOptions, options);
    this.dealOptions();
    const indexPath = path.join(location, '.index');
    if (!fs.existsSync(indexPath)) {
      fs.mkdirSync(indexPath);
    }
    this.notice = new NamespaceRouter({
      logLevel: 0,
      interception: undefined,
      debug: false,
      hideError: true,
    });
    this.indexPath = indexPath;
    this.shiftOneReasonBytes = new ByteArray({ size: 202n, shift: 1n, });
    this.shiftTwoBytes = new ByteArray({ size: 256n, shift: 2n, });
    this.fulmination = new Fulmination();
    const bytes = new ByteArray({ size: 202n, shift: 0n, });
    const {
      options: {
        debug,
      },
    } = this;
    if (debug === true) {
      const { fulmination, } = this;
      fulmination.scan(`
      [+] bold:
      |
      | **  ██╗███╗░░░███╗███╗░░░███╗███████╗███╗░░██╗░██████╗███████╗░░░░░░░░██╗░██████╗
      | **  ██║████╗░████║████╗░████║██╔════╝████╗░██║██╔════╝██╔════╝░░░░░░░░██║██╔════╝
      | **  ██║██╔████╔██║██╔████╔██║█████╗░░██╔██╗██║╚█████╗░█████╗░░░░░░░░░░██║╚█████╗░
      | **  ██║██║╚██╔╝██║██║╚██╔╝██║██╔══╝░░██║╚████║░╚═══██╗██╔══╝░░░░░██╗░░██║░╚═══██╗
      | **  ██║██║░╚═╝░██║██║░╚═╝░██║███████╗██║░╚███║██████╔╝███████╗██╗╚█████╔╝██████╔╝
      | **  ╚═╝╚═╝░░░░░╚═╝╚═╝░░░░░╚═╝╚══════╝╚═╝░░╚══╝╚═════╝░╚══════╝╚═╝░╚════╝░╚═════╝░
      `);
    }
    this.checkMemory();
  }

  dealOptions() {
    const {
      options: {
        minimumStorageCapacity,
        acquireAvailableDelta,
        temporaryDiskAvailable,
        develop,
      },
    } = this;
    if (!Number.isInteger(minimumStorageCapacity)) {
      throw new Error('[Error] The minimum storage capacity should be an integer type.');
    }
    if (!(minimumStorageCapacity > 0)) {
      throw new Error('[Error] The minimum storage capacity should be greater than zero.');
    }
    if (typeof acquireAvailableDelta !== 'boolean') {
      throw new Error('[Error] The acquire available delta should be of boolean type.')
    }
    if (typeof develop !== 'boolean') {
      throw new Error('[Error] The option develop should be of boolean type.');
    }
    if (!Number.isInteger(temporaryDiskAvailable)) {
      throw new Error('[Error] The temporary disk available should be an integer type.');
    }
  }

  static unwatchSync(watcher) {
    if (watcher.constructor.name !== 'FSWatcher') {
      throw new Error('[Error] The passed parameter watcher is not of type StatWatcher.');
    }
    watcher.close();
  }

  async acquireAvailableDelta(callback) {
    if (typeof callback !== 'function') {
      throw new Error('[Error] The parameter callback should be of function type.')
    }
    const {
      options: {
        acquireAvailableDelta,
      },
    } = this;
    if (acquireAvailableDelta === true) {
      this.beforeAvailable = await this.available(true);
    }
    await callback();
    if (acquireAvailableDelta === true) {
      const { beforeAvailable, } = this;
      const afterAvailable = await this.available(true);
      return beforeAvailable - afterAvailable;
    } else {
      return -1;
    }
  }

  async [temporaryUpdateDiskAvailableKey](availableDelta) {
    const {
      options: {
        temporaryDiskSwitch,
      },
    } = this;
    if (temporaryDiskSwitch === true) {
      this[temporaryDiskAvailableKey] -= availableDelta;
    }
  }

  async readData(place, options) {
    if (typeof place !== 'string') {
      throw new Error('[Error] The parameter place should be of string type.');
    }
    if (options !== undefined) {
      if (typeof options !== 'object') {
        throw new Error('[Error] The parameter options should be object type.');
      }
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
    if (!checkMultipleHidden(dirname)) {
      throw new Error('[Error] Cannot operate hidden directorys.');
    }
    const basename = path.basename(filePath);
    if (!checkSingleHidden(basename)) {
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
    if (!checkMultipleHidden(dirname)) {
      throw new Error('[Error] cannot operate hidden directorys.');
    }
    const basename = path.basename(filePath);
    if (!checkSingleHidden(basename)) {
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
    if (!checkMultipleHidden(dirname)) {
      throw new Error('[Error] cannot operate hidden directorys.');
    }
    const basename = path.basename(filePath);
    if (!checkSingleHidden(basename)) {
      throw new Error('[Error] cannot operate hidden files.');
    }
    const availableDelta = await this.acquireAvailableDelta(async () => {
      const fd = await openPromise(filePath, 'a');
      await writePromise(fd, buffer, { position, });
      await fsyncPromise(fd);
      await closePromise(fd);
    });
    this[temporaryUpdateDiskAvailableKey](availableDelta);
    await this.checkDisk();
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
    if (!checkMultipleHidden(dirname)) {
      throw new Error('[Error] cannot operate hidden directorys.');
    }
    const basename = path.basename(filePath);
    if (!checkSingleHidden(basename)) {
      throw new Error('[Error] cannot operate hidden files.');
    }
    const availableDelta = await this.acquireAvailableDelta(async () => {
      const fd = await openPromise(filePath, 'w');
      await writePromise(fd, buffer);
      await fsyncPromise(fd);
      await closePromise(fd);
    });
    this[temporaryUpdateDiskAvailableKey](availableDelta);
    await this.checkDisk();
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
    if (!checkMultipleHidden(dirname)) {
      throw new Error('[Error] cannot operate hidden directorys.');
    }
    const basename = path.basename(filePath);
    if (!checkSingleHidden(basename)) {
      throw new Error('[Error] cannot operate hidden files.');
    }
    if (!await existsPromise(dirname)) {
      await fsPromises.mkdir(dirname, { recursive: true, });
    }
    const availableDelta = await this.acquireAvailableDelta(async () => {
      await this.addEntireIndex(place);
      const fd = await openPromise(filePath, 'w');
      await writePromise(fd, buffer);
      await fsyncPromise(fd);
      await closePromise(fd);
    });
    this[temporaryUpdateDiskAvailableKey](availableDelta);
    await this.checkDisk();
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
    if (!checkMultipleHidden(dirname)) {
      throw new Error('[Error] Cannot operate hidden directorys.');
    }
    const basename = path.basename(filePath);
    if (!checkSingleHidden(basename)) {
      throw new Error('[Error] Cannot operate hidden files.');
    }
    const availableDelta = await this.acquireAvailableDelta(async () => {
      const fd = await openPromise(filePath, 'a');
      await writePromise(fd, data);
      await fsyncPromise(fd);
      await closePromise(fd);
    });
    this[temporaryUpdateDiskAvailableKey](availableDelta);
    await this.checkDisk();
  }

  async remove(place) {
    if (typeof place !== 'string') {
      throw new Error('[Error] The parameter place should be of string type.');
    }
    const { location, } = this;
    const filePath = path.join(location, place);
    const dirname = dealDirname(path.dirname(filePath));
    if (!checkMultipleHidden(dirname)) {
      throw new Error('[Error] Cannot operate hidden directorys.');
    }
    const basename = path.basename(filePath);
    if (!checkSingleHidden(basename)) {
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
    const availableDelta = await this.acquireAvailableDelta(async () => {
      await this.removeEntireIndex(place);
      await fsPromises.unlink(filePath);
      await clearEmptyDirs(dirname, '.index');
    });
    this[temporaryUpdateDiskAvailableKey](availableDelta);
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
    if (!checkMultipleHidden(dirname)) {
      throw new Error('[Error] Cannot operate hidden directorys.');
    }
    const basename = path.basename(filePath);
    if (!checkSingleHidden(basename)) {
      throw new Error('[Error] Cannot operate hidden files.');
    }
    if (!(path.extname(filePath).length >= 1)) {
      throw new Error('[Error] The file you are working with needs to have its file extension specified.');
    }
    if (!await existsPromise(filePath)) {
      throw new Error('[Error] The file being truncate does not exist.');
    }
    const availableDelta = await this.acquireAvailableDelta(async () => {
      await fsPromises.truncate(filePath, length);
    });
    this[temporaryUpdateDiskAvailableKey](availableDelta);
  }

  async rename(oldPlace, newPlace) {
    if (typeof oldPlace !== 'string') {
      throw new Error('[Error] The parameter oldPlace should be of string type.');
    }
    const { location, } = this;
    const oldFilePath = path.join(location, oldPlace);
    const oldDirname = dealDirname(path.dirname(oldFilePath));
    if (!checkMultipleHidden(oldDirname)) {
      throw new Error('[Error] Cannot operate hidden directorys.');
    }
    const oldBasename = path.basename(oldFilePath);
    if (!checkSingleHidden(oldBasename)) {
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
    if (!checkMultipleHidden(newDirname)) {
      throw Error('[Error] Cannot operate hidden directorys.');
    }
    const newBasename = path.basename(newFilePath);
    if (!checkSingleHidden(newBasename)) {
      throw Error('[Error] Cannot operate hidden files.');
    }
    if (!(path.extname(newFilePath).length >= 1)) {
      throw new Error('[Error] The file you are working with needs to have its file extension specified.');
    }
    if (await existsPromise(newFilePath)) {
      throw new Error('[Error] The renamed file path cannot exist.');
    }
    const availableDelta = await this.acquireAvailableDelta(async () => {
      await fsPromises.rename(oldFilePath, newFilePath);
      if (oldDirname !== newDirname) {
        await clearEmptyDirs(oldDirname, '.index');
      }
      await this.removeEntireIndex(oldPlace);
      await this.addEntireIndex(newPlace);
    });
    this[temporaryUpdateDiskAvailableKey](availableDelta);
    await this.checkDisk();
  }

  async diskOccupy(place) {
    if (typeof place !== 'string') {
      throw new Error('[Error] The parameter place should be of string type.');
    }
    const { location, } = this;
    const specialPath = path.join(location, place);
    const stats = await fsPromises.lstat(specialPath);
    if (stats.isFile()) {
      return stats.size;
    } else {
      let size = 0n;
      const nodes = await fsPromises.readdir(specialPath);
      for (const node of nodes) {
        const nodePath = path.join(specialPath, node);
        const stats = await fsPromises.lstat(nodePath, { bigint: true, });
        if (stats.isFile()) {
          size += stats.size;
        } else if (stats.isDirectory()) {
          size += await getDiskOccupy(nodePath);
        }
      }
      return size;
    }
  }

  async cp(srcPath, destPath, options) {
    if (typeof srcPath !== 'string') {
      throw new Error('[Error] The parameter srcPath should be of string type.');
    }
    if (typeof destPath !== 'string') {
      throw new Error('[Error] The parameter destPath should be of string type.');
    }
    if (options !== undefined) {
      if (typeof options !== 'object') {
        throw new Error('[Error] The parameter options should be object type.')
      }
    }
    const { location, } = this;
    const stats = await fsPromises.lstat(path.join(location, srcPath));
    if (stats.isFile() || stats.isSymbolicLink()) {
      const srcFilePath = path.join(location, srcPath);
      const srcDirname = dealDirname(path.dirname(srcFilePath));
      if (!checkMultipleHidden(srcDirname)) {
        throw new Error('[Error] Cannot operate hidden directorys.');
      }
      const srcBasename = path.basename(srcFilePath);
      if (!checkSingleHidden(srcBasename)) {
        throw new Error('[Error] Cannot operate hidden files.');
      }
      if (!(path.extname(srcFilePath).length >= 1)) {
        throw new Error('[Error] The file you are working with needs to have its file extension specified.');
      }
      if (!await existsPromise(srcFilePath)) {
        throw new Error('[Error] The file being cp does not exist.');
      }
      const destFilePath = path.join(location, destPath);
      const destDirname = dealDirname(path.dirname(destFilePath));
      if (!checkMultipleHidden(destDirname)) {
        throw Error('[Error] Cannot operate hidden directorys.');
      }
      const destBasename = path.basename(destFilePath);
      if (!checkSingleHidden(destBasename)) {
        throw Error('[Error] Cannot operate hidden files.');
      }
      if (!(path.extname(destFilePath).length >= 1)) {
        throw new Error('[Error] The file you are working with needs to have its file extension specified.');
      }
      if (await existsPromise(destFilePath)) {
        throw new Error('[Error] The cp file path cannot exist.');
      }
      const availableDelta = await this.acquireAvailableDelta(async () => {
        await fsPromises.cp(srcFilePath, destFilePath, options);
        await this.addEntireIndex(destPath);
      });
      this[temporaryUpdateDiskAvailableKey](availableDelta);
      await this.checkDisk();
    }
    if (stats.isDirectory()) {
      const srcPosition = path.join(location, srcPath);
      if (!checkMultipleHidden(srcPosition)) {
        throw new Error('[Error] Cannot operate hidden directorys.');
      }
      if (!await existsPromise(srcPosition)) {
        throw new Error('[Error] The path being cp does not exist.');
      }
      const destPosition = path.join(location, destPath);
      if (!checkMultipleHidden(destPosition)) {
        throw new Error('[Error] Cannot operate hidden directorys.');
      }
      const availableDelta = await this.acquireAvailableDelta(async () => {
        await fsPromises.cp(srcPosition, destPosition, options);
        await this[coverDirectoryIndexKey](destPath);
      });
      this[temporaryUpdateDiskAvailableKey](availableDelta);
      await this.checkDisk();
    }
  }

  async [coverDirectoryIndexKey](directory) {
    const { location, } = this;
    const dir = await fsPromises.opendir(path.join(location, directory));
    for await (const dirent of dir) {
      if (dirent.isFile() || dirent.isSymbolicLink()) {
        await this.addEntireIndex(path.join(directory, dirent.name));
      }
      if (dirent.isDirectory()) {
        await this[coverDirectoryIndexKey](path.join(directory, dirent.name));
      }
    }
    await this.checkDisk();
  }

  async link(targetPlace, linkPlace) {
    if (typeof targetPlace !== 'string') {
      throw new Error('[Error] The parameter targetPlace should be of string type.');
    }
    const { location, } = this;
    const targetFilePath = path.join(location, targetPlace);
    const targetDirname = dealDirname(path.dirname(targetFilePath));
    if (!checkMultipleHidden(targetDirname)) {
      throw new Error('[Error] Cannot operate hidden directorys.');
    }
    const targetBasename = path.basename(targetFilePath);
    if (!checkSingleHidden(targetBasename)) {
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
    if (!checkMultipleHidden(linkDirname)) {
      throw new Error('[Error] Cannot operate hidden directorys.');
    }
    const linkBasename = path.basename(linkFilePath);
    if (!checkSingleHidden(linkBasename)) {
      throw new Error('[Error] Cannot operate hidden files.');
    }
    if (!(path.extname(linkFilePath).length >= 1)) {
      throw new Error('[Error] The file you are working with needs to have its file extension specified.');
    }
    const availableDelta = await this.acquireAvailableDelta(async () => {
      await this.addEntireIndex(linkPlace);
      await fsPromises.symlink(targetFilePath, linkFilePath);
    });
    this[temporaryUpdateDiskAvailableKey](availableDelta);
    await this.checkDisk();
  }

  async stats(place) {
    if (typeof place !== 'string') {
      throw new Error('[Error] The parameter place should be of string type.');
    }
    const { location, } = this;
    const filePath = path.join(location, place);
    const dirname = dealDirname(path.dirname(filePath));
    if (!checkMultipleHidden(dirname)) {
      throw new Error('[Error] Cannot operate hidden directorys.');
    }
    const basename = path.basename(filePath);
    if (!checkSingleHidden(basename)) {
      throw new Error('[Error] Cannot operate hidden files.');
    }
    if (!(path.extname(filePath).length >= 1)) {
      throw new Error('[Error] The file you are working with needs to have its file extension specified.');
    }
    if (!await existsPromise(filePath)) {
      throw new Error('[Error] The file being get stats does not exist.');
    }
    const stat = await fsPromises.stat(filePath, { bigint: true, });
    return stat;
  }

  async chmod(place, mod) {
    if (typeof place !== 'string') {
      throw new Error('[Error] The parameter place should be of string type.');
    }
    if (typeof mod !== 'string') {
      throw new Error('[Error] The parameter mod should be of string type.');
    }
    const { location, } = this;
    const filePath = path.join(location, place);
    const dirname = dealDirname(path.dirname(filePath));
    if (!checkMultipleHidden(dirname)) {
      throw new Error('[Error] Cannot operate hidden directorys.');
    }
    const basename = path.basename(filePath);
    if (!checkSingleHidden(basename)) {
      throw new Error('[Error] Cannot operate hidden files.');
    }
    if (!(path.extname(filePath).length >= 1)) {
      throw new Error('[Error] The file you are working with needs to have its file extension specified.');
    }
    if (!await existsPromise(filePath)) {
      throw new Error('[Error] The file being chmod does not exist.');
    }
    const availableDelta = await this.acquireAvailableDelta(async () => {
      await fsPromises.chmod(filePath, mod);
    });
    this[temporaryUpdateDiskAvailableKey](availableDelta);
  }

  async chown(place, uid, gid) {
    if (typeof place !== 'string') {
      throw new Error('[Error] The parameter place should be of string type.');
    }
    if (!Number.isInteger(uid)) {
      throw new Error('[Error] The parameter uid should be an integer.');
    }
    if (!Number.isInteger(gid)) {
      throw new Error('[Error] The parameter gid should be an integer.');
    }
    const { location, } = this;
    const filePath = path.join(location, place);
    const dirname = dealDirname(path.dirname(filePath));
    if (!checkMultipleHidden(dirname)) {
      throw new Error('[Error] Cannot operate hidden directorys.');
    }
    const basename = path.basename(filePath);
    if (!checkSingleHidden(basename)) {
      throw new Error('[Error] Cannot operate hidden files.');
    }
    if (!(path.extname(filePath).length >= 1)) {
      throw new Error('[Error] The file you are working with needs to have its file extension specified.');
    }
    if (!await existsPromise(filePath)) {
      throw new Error('[Error] The file being chown does not exist.');
    }
    const availableDelta = await this.acquireAvailableDelta(async () => {
      await fsPromises.chown(filePath, uid, gid);
    });
    this[temporaryUpdateDiskAvailableKey](availableDelta);
    await this.checkDisk();
  }

  async access(place, mod) {
    if (typeof place !== 'string') {
      throw new ParameterError('[Error] The parameter place should be of string type.');
    }
    if (!Number.isInteger(mod)) {
      throw new ParameterError('[Error] The parameter mod should be an integer.');
    }
    const { location, } = this;
    const filePath = path.join(location, place);
    const dirname = dealDirname(path.dirname(filePath));
    if (!checkMultipleHidden(dirname)) {
      throw new ParameterError('[Error] Cannot operate hidden directorys.');
    }
    const basename = path.basename(filePath);
    if (!checkSingleHidden(basename)) {
      throw new ParameterError('[Error] Cannot operate hidden files.');
    }
    if (!(path.extname(filePath).length >= 1)) {
      throw new ParameterError('[Error] The file you are working with needs to have its file extension specified.');
    }
    if (!await existsPromise(filePath)) {
      throw new ParameterError('[Error] The file being access does not exist.');
    }
    await fsPromises.access(filePath, mod);
  }

  async realpath(place) {
    if (typeof place !== 'string') {
      throw new Error('[Error] The parameter place should be of string type.');
    }
    const { location, } = this;
    const filePath = path.join(location, place);
    const dirname = dealDirname(path.dirname(filePath));
    if (!checkMultipleHidden(dirname)) {
      throw new Error('[Error] Cannot operate hidden directorys.');
    }
    const basename = path.basename(filePath);
    if (!checkSingleHidden(basename)) {
      throw new Error('[Error] Cannot operate hidden files.');
    }
    if (!(path.extname(filePath).length >= 1)) {
      throw new Error('[Error] The file you are working with needs to have its file extension specified.');
    }
    if (!await existsPromise(filePath)) {
      throw new Error('[Error] The file being get real path does not exist.');
    }
    const stats = await fsPromises.lstat(filePath, { bigint: true, });
    if (!stats.isSymbolicLink()) {
      throw new Error('[Error] The realpath operation is not applied to symbolic linkes.');
    }
    let realpath;
    const availableDelta = await this.acquireAvailableDelta(async () => {
      realpath = await fsPromises.realpath(filePath);
    });
    this[temporaryUpdateDiskAvailableKey](availableDelta);
    return realpath;
  }

  async watch(place, options, listener) {
    if (typeof place !== 'string') {
      throw new Error('[Error] The parameter place should be of string type.');
    }
    if (options !== undefined) {
      if (typeof options !== 'object') {
        throw new Error('[Error] The parameter options should be object type.');
      }
    }
    const { location, } = this;
    const filePath = path.join(location, place);
    const dirname = dealDirname(path.dirname(filePath));
    const basename = path.basename(filePath);
    if (path.extname(filePath).length >= 1) {
      if (!checkMultipleHidden(dirname)) {
        throw new Error('[Error] Cannot operate hidden directorys.');
      }
      if (!checkSingleHidden(basename)) {
        throw new Error('[Error] Cannot operate hidden files.');
      }
      if (!await existsPromise(filePath)) {
        throw new Error('[Error] The file being watch does not exist.');
      }
      const watcher = fs.watch(filePath, options, listener);
      this.checkMemory();
      await this.checkDisk();
      return watcher;
    } else {
      const dirPath = filePath;
      if (!checkMultipleHidden(dirPath)) {
        throw new Error('[Error] Cannot operate hidden directorys.');
      }
      if (!await existsPromise(filePath)) {
        throw new Error('[Error] The path to the operation does not exist.');
      }
      fs.watch(dirPath, options, listener);
      this.checkMemory();
      await this.checkDisk();
      return watcher;
    }
  }

  async readdir(directory, options) {
    if (typeof directory !== 'string') {
      throw new Error('[Error] The parameter directory should be of string type.');
    }
    if (options !== undefined) {
      if (typeof options !== 'object') {
        throw new Error('[Error] The parameter options should be object type.');
      }
    }
    const { location, } = this;
    const position = path.join(location, directory);
    if (!checkMultipleHidden(position)) {
      throw new Error('[Error] Cannot operate hidden directorys.');
    }
    if (!await existsPromise(position)) {
      throw new Error('[Error] The path being read dir does not exist.');
    }
    let dirs;
    const availableDelta = await this.acquireAvailableDelta(async () => {
      dirs = await fsPromises.readdir(position, options);
    });
    this[temporaryUpdateDiskAvailableKey](availableDelta);
    return dirs;
  }

  async mkdir(directory) {
    if (typeof directory !== 'string') {
      throw new Error('[Error] The parameter directory should be of string type.');
    }
    const { location, } = this;
    const position = path.join(location, directory);
    if (!checkMultipleHidden(position)) {
      throw new Error('[Error] Cannot operate hidden directorys.');
    }
    const availableDelta = await this.acquireAvailableDelta(async () => {
      await fsPromises.mkdir(position);
    });
    this[temporaryUpdateDiskAvailableKey](availableDelta);
    await this.checkDisk();
  }

  async rmdir(directory, options) {
    if (typeof directory !== 'string') {
      throw new Error('[Error] The parameter directory should be of string type.');
    }
    const { location, } = this;
    const position = path.join(location, directory);
    if (!checkMultipleHidden(position)) {
      throw new Error('[Error] Cannot operate hidden directorys.');
    }
    if (!await existsPromise(position)) {
      throw new Error('[Error] The path being rmdir does not exist.');
    }
    const availableDelta = await this.acquireAvailableDelta(async () => {
      const dir = await fsPromises.opendir(position);
      for await (const dirent of dir) {
        const subDirectory = path.join(directory, dirent.name);
        if (dirent.isDirectory()) {
          await this.rmdir(subDirectory);
        }
        if (dirent.isFile() || dirent.isSymbolicLink()) {
          await this.removeEntireIndex(subDirectory);
          const filePath = path.join(location, subDirectory)
          await fsPromises.unlink(filePath);
        }
      }
      await fsPromises.rmdir(position);
    });
    this[temporaryUpdateDiskAvailableKey](availableDelta);
  }

  async glob(pattern, options) {
    if (typeof pattern !== 'string') {
      throw new Error('[Error] The parameter pattern should be of string type.');
    }
    const { location, } = this;
    if (options !== undefined) {
      if (typeof options !== 'object') {
        throw new Error('[Error] The parameter options should be object type.');
      }
      options = Object.assign(options, { cwd: location, });
    }
    if (options === undefined) {
      options = { cwd: location, };
    }
    const paths = [];
    const availableDelta = await this.acquireAvailableDelta(async () => {
      for await (const p of fsPromises.glob(pattern, options)) {
        const position = path.join(location, p);
        if (checkMultipleHidden(position)) {
          paths.push(p);
        }
      }
    });
    this[temporaryUpdateDiskAvailableKey](availableDelta);
    return paths;
  }

  async presence(directory) {
    if (typeof directory !== 'string') {
      throw new Error('[Error] The parameter directory should be of string type.');
    }
    const { location, } = this;
    const position = path.join(location, directory);
    if (!checkMultipleHidden(position)) {
      throw new Error('[Error] Cannot operate hidden directorys.');
    }
    return await existsPromise(position);
  }

  async diskUsage() {
    const { location, } = this;
    const diskUsage = await disk.check(location);
    return diskUsage;
  }

  async available(flag) {
    const {
      options: {
        temporaryDiskSwitch,
      },
    } = this;
    if (flag !== undefined) {
      if (typeof flag !== 'boolean') {
        throw new Error('[Error] The parameter flag should be of boolean type.');
      }
    }
    if (flag === undefined) {
      if (temporaryDiskSwitch === true) {
        return this[temporaryDiskAvailableKey];
      } else {
        const diskUsage = await this.diskUsage();
        return diskUsage.available;
      }
    } else {
      if (flag === true) {
        const diskUsage = await this.diskUsage();
        return diskUsage.available;
      } else {
        return this[temporaryDiskAvailableKey];
      }
    }
  }

  setTemporaryDiskSwitch(temporaryDiskSwitch) {
    if (typeof temporaryDiskSwitch !== 'boolean') {
      throw new Error('[Error] Parameter temporaryDiskSwtich should be of boolean type.');
    }
    this.options.temporaryDiskSwitch = temporaryDiskSwitch;
    const {
      options: {
        temporaryDiskAvailable,
      },
    } = this;
    if (temporaryDiskSwitch === true) {
      const {
        options,
      } = this;
      options.acquireAvailableDelta = true;
      this[temporaryDiskAvailableKey] = temporaryDiskAvailable;
    } else {
      options.acquireAvailableDelta = false;
    }
    this.checkMemory();
  }

  checkMemory() {
    const { options, } = this;
    if (options.safeMemoryCapacity === undefined) {
      options.safeMemoryCapacity = 0;
    }
    const {
      options: {
        safeMemoryCapacity,
      },
    } = this;
    const {
      temporaryMemorySwitch,
    } = this;
    let freemem = os.freemem();
    if (temporaryMemorySwitch === true) {
      freemem = safeMemoryCapacity;
    }
    let ans = false;
    if (freemem > safeMemoryCapacity) {
      ans = true;
    } else {
      const {
        notice,
      } = this;
      const callback = notice.gain('mem>chk');
      if (typeof callback === 'function') {
        const {
          global,
        } = this;
        callback(global);
      }
      logOutOfMemory(logPath, freemem);
    }
    return ans;
  }

  async checkDisk() {
    const { options, } = this;
    if (options.minimumStorageCapacity === undefined) {
      options.minimumStorageCapacity = 0;
    }
    const {
      options: {
        minimumStorageCapacity,
      },
    } = this;
    const available = await this.available();
    if (available <= minimumStorageCapacity) {
      const {
        notice,
      } = this;
      const callback = notice.gain('disk>rem');
      if (typeof callback === 'function') {
        const {
          global,
        } = this;
        callback(global);
      }
      const {
        options: {
          logPath,
        },
      } = this;
      logInsufficientDiskSpace(logPath, available);
    }
  }

  setTemporaryMemorySwitch(temporaryMemorySwitch) {
    if (typeof temporaryMemorySwitch !== 'boolean') {
      throw new Error('[Error] Parameter temporaryMemorySwitch should be of boolean type.');
    }
    this.temporaryMemorySwitch = temporaryMemorySwitch;
    this.checkMemory();
  }


  setGlobal(global) {
    this.global = global;
    this.checkMemory();
  }

  addSystemNotice(phrase, callback) {
    if (typeof phrase !== 'string') {
      throw new Error('[Error] The parameter phase should be a string type.');
    }
    if (typeof callback !== 'function') {
      throw new Error('[Error] The parameter callback should be a function type.');
    }
    switch (phrase) {
      case 'disk>rem':
      case 'mem>chk': {
        const { notice, } = this;
        notice.attach(phrase, callback);
        this.checkMemory();
        break;
      }
      case 'rm>storage': {
        const {
          constructor: {
            name,
          },
        } = this;
        switch (name) {
          case 'DistriStorage': {
            const { notice, } = Outputable;
            notice[phrase] = callback;
            this.checkMemory();
            break;
          }
          default:
            throw new Error('[Error] The remove storage phrase is limited to WebRouter and WebDistribRouter.');
        }
        break;
      }
      case 'add>storage': {
        const {
          constructor: {
            name,
          },
        } = this;
        switch (name) {
          case 'DistriStorage': {
            const { notice, } = Outputable;
            notice[phrase] = callback;
            this.checkMemory();
            break;
          }
          default:
            throw new Error('[Error] The add storage phrase is limited to WebRouter and WebDistribRouter.');
        }
        break;
      }
      default:
        throw new Error('[Error] The current system notification phrase does not exist.');
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
      const pointersPath = path.join(indexAbsoluteDir, depthName);
      let result;
      if (i === length - 1) {
        result = await this.checkIndexFile(pointersPath, code ,frequency, place);
      } else {
        result = await this.checkIndexFile(pointersPath, code ,frequency);
      }
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
    code = BigInt(code);
    const frequencies = pointerHash[code];
    if (Array.isArray(frequencies)) {
      frequency = BigInt(frequency);
      if (frequencies.includes(frequency)) {
        ans = true;
      }
    }
    return ans;
  }

  async checkIndexFile(pointersPath, code, frequency, name) {
    if (await existsPromise(pointersPath)) {
      if (name !== undefined) {
        const ans = await this.checkPointerInPointers(pointersPath, code, frequency);
        if (ans === false) {
          return false;
        }
        const namesDirectory = path.join(path.dirname(pointersPath), String(code));
        const namesPath = path.join(namesDirectory, String(frequency));
        return await checkNameInNames(namesPath, name);
      } else {
        return await this.checkPointerInPointers(pointersPath, code, frequency);
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
        }
      }
    }
    await this.checkDisk();
  }

  async addIndexFile(pointersPath, code, frequency, name) {
    if (name !== undefined) {
      await this.addPointerToPointers(pointersPath, code, frequency);
      const countsPath = getCountsPath(pointersPath);
      await this.addCountToCounts(countsPath, code, frequency);
      const namesDirectory = path.join(path.dirname(pointersPath), String(code));
      if (!await existsPromise(namesDirectory)) {
        await fsPromises.mkdir(namesDirectory);
      }
      const namesPath = path.join(namesDirectory, String(frequency));
      await addNameToNames(namesPath, code, frequency, name);
    } else {
      await this.addPointerToPointers(pointersPath, code, frequency);
      const countsPath = getCountsPath(pointersPath);
      await this.addCountToCounts(countsPath, code, frequency);
    }
  }

  async addCountToCounts(countsPath, code, frequency) {
    const { shiftTwoBytes, } = this;
    const words = [
      shiftTwoBytes.fromInt(code), 0,
      shiftTwoBytes.fromInt(frequency), 1, 3, 1, 0
    ];
    if (await existsPromise(countsPath)) {
      const fd = await openPromise(countsPath, 'a');
      await writePromise(fd, Buffer.from(words.flat()));
      await fsyncPromise(fd);
      await closePromise(fd);
    } else {
      const fd = await openPromise(countsPath, 'w');
      await writePromise(fd, Buffer.from(words.flat()));
      await fsyncPromise(fd);
      await closePromise(fd);
    }
  }

  async addPointerToPointers(pointersPath, code, frequency) {
    const { shiftTwoBytes, } = this;
    const words = [
      shiftTwoBytes.fromInt(code), 0,
      shiftTwoBytes.fromInt(frequency), 0
    ];
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
      count: -1,
    };
    for (let i = 0; i < buffer.length; i += 1) {
      const byte = buffer[i];
      if (byte === 0) {
        if (status === 0) {
          assemble.code = shiftTwoBytes.toInt(bytes);
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
          const count = shiftTwoBytes.toInt(bytes);
          bytes = [];
          const {
            code: code1,
            frequency: frequency1,
          } = assemble;
          if (code1 === code && frequency1 === frequency) {
            if (checkTransitByte(count, count + 1n, shiftTwoBytes)) {
              idx = i;
              assemble.count = count;
              update = true;
              break;
            } else {
              words = words.concat([
                shiftTwoBytes.fromInt(code1), 0,
                shiftTwoBytes.fromInt(frequency1), 1,
                shiftTwoBytes.fromInt(count + 1n), 1
              ]);
            }
          } else {
            words = words.concat([
              shiftTwoBytes.fromInt(code1), 0,
              shiftTwoBytes.fromInt(frequency1), 1,
              shiftTwoBytes.fromInt(count), 1
            ]);
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
      const pointersPath = path.join(indexAbsoluteDir, depthName);
      if (i === length - 1) {
        await this.removeIndexFile(pointersPath, code ,frequency, place);
      } else {
        await this.removeIndexFile(pointersPath, code ,frequency);
      }
    }
  }

  async removeIndexFile(pointersPath, code, frequency, name) {
    const ptrsDirPath = path.dirname(pointersPath);
    if (name !== undefined) {
      const namesDir = path.join(path.dirname(pointersPath), String(code));
      const namesPath = path.join(namesDir, String(frequency));
      await removeName(namesPath, name);
      await clearEmptyDirs(namesDir, '.index');
      const countsPath = getCountsPath(pointersPath);
      code = BigInt(code);
      frequency = BigInt(frequency);
      await this.reduceCount(countsPath, code, frequency);
      const countHash = await this.getCountHash(countsPath);
      if (getCount(countHash, code, frequency) === 0n) {
        await this.removePointerFromPointers(pointersPath, code, frequency);
        await clearEmptyDirs(ptrsDirPath, '.index');
      }
    } else {
      const countsPath = getCountsPath(pointersPath);
      code = BigInt(code);
      frequency = BigInt(frequency);
      await this.reduceCount(countsPath, code, frequency);
      const countHash = await this.getCountHash(countsPath);
      if (getCount(countHash, code, frequency) === 0n) {
        await this.removePointerFromPointers(pointersPath, code, frequency);
        await clearEmptyDirs(ptrsDirPath, '.index');
      }
    }
  }

  async removePointerFromPointers(pointersPath, code, frequency) {
    const { shiftTwoBytes, } = this;
    const buffer = await fsPromises.readFile(pointersPath);
    let words = [];
    let bytes = [];
    let status = 0;
    let code1;
    let reduce = false;
    for (let i = 0; i < buffer.length; i += 1) {
      const byte = buffer[i];
      if (byte === 0) {
        if (status === 0) {
          code1 = shiftTwoBytes.toInt(bytes);
          bytes = [];
          status = 1;
        } else if (status === 1) {
          const frequency1 = shiftTwoBytes.toInt(bytes);
          bytes = [];
          if (code === code1 && frequency === frequency1) {
            if (i === buffer.length - 2) {
              const { length: length1, } = shiftTwoBytes.fromInt(code1);
              const { length: length2, } = shiftTwoBytes.fromInt(frequency1);
              const size = buffer.length - 3 - length1 - length2;
              await fsPromises.truncate(countsPath, size);
              reduce = true;
            }
          } else {
            words = words.concat([
              shiftTwoBytes.fromInt(code1), 0,
              shiftTwoBytes.fromInt(frequency1), 0
            ]);
          }
          status = 0;
        }
      } else {
        bytes.push(byte);
      }
    }
    if (reduce === false) {
      if (words.length === 0) {
        await fsPromises.unlink(pointersPath);
        const ptrsDirPath = path.dirname(pointersPath);
        await clearEmptyDirs(ptrsDirPath, '.index');
      } else {
        const fd = await openPromise(pointersPath, 'w');
        await writePromise(fd, Buffer.from(words.flat()));
        await fsyncPromise(fd);
        await closePromise(fd);
      }
    }
  }

  async getCountHash(countsPath) {
    const countHash = {};
    if (await existsPromise(countsPath)) {
      const buffer = await fsPromises.readFile(countsPath);
      const { shiftTwoBytes, } = this;
      let bytes = [];
      let status = 0;
      const assemble = {
        frequency: -1,
        hash: null,
      };
      for (let i = 0; i < buffer.length; i += 1) {
        const byte = buffer[i];
        if (byte === 0) {
          if (status === 0) {
            const code = shiftTwoBytes.toInt(bytes);
            bytes = [];
            if (countHash[code] === undefined) {
              countHash[code] = {};
            }
            assemble.hash = countHash[code];
            status = 1;
          } else if (status === 3) {
            status = 0;
          }
        } else if (byte === 1) {
          if (status === 1) {
            assemble.frequency = shiftTwoBytes.toInt(bytes);
            bytes = [];
            status = 2;
          } else if (status === 2) {
            const count = shiftTwoBytes.toInt(bytes);
            bytes = [];
            const { hash, frequency, } = assemble;
            hash[frequency] = count;
            status = 3;
          }
        } else {
          bytes.push(byte);
        }
      }
    }
    return countHash;
  }

  async reduceCount(countsPath, code, frequency) {
    const { shiftTwoBytes, } = this;
    const buffer = await fsPromises.readFile(countsPath);
    let words = [];
    let bytes = [];
    let status = 0;
    let update = false;
    let remove = false;
    let idx;
    const assemble = {
      code: -1,
      frequency: -1,
      count: -1,
    };
    for (let i = 0; i < buffer.length; i += 1) {
      const byte = buffer[i];
      if (byte === 0) {
        if (status === 0) {
          assemble.code = shiftTwoBytes.toInt(bytes);
          bytes = [];
          status = 1;
        } else if (status === 3) {
          status = 0;
        }
      } else if (byte === 1) {
        if (status === 1) {
          assemble.frequency = shiftTwoBytes.toInt(bytes);
          bytes = [];
          status = 2
        } else if (status === 2) {
          const count = shiftTwoBytes.toInt(bytes);
          const {
            code: code1,
            frequency: frequency1,
          } = assemble;
          if (code === code1 && frequency === frequency1) {
            if (count === 1n) {
              if (i === buffer.length - 2) {
                assemble.count = count;
                idx = i;
                remove = true;
                break;
              }
            } else {
              if (checkTransitByte(count, count - 1n, shiftTwoBytes)) {
                assemble.count = count;
                idx = i;
                update = true;
                break;
              } else {
                words = words.concat([
                  shiftTwoBytes.fromInt(code1), 0,
                  shiftTwoBytes.fromInt(frequency1), 1,
                  shiftTwoBytes.fromInt(count - 1n), 1, 0
                ]);
              }
            }
          } else {
            words = words.concat([
              shiftTwoBytes.fromInt(code1), 0,
              shiftTwoBytes.fromInt(frequency1), 1,
              shiftTwoBytes.fromInt(count), 1, 0
            ]);
          }
          bytes = [];
          status = 3;
        }
      } else {
        bytes.push(byte);
      }
    }
    if (remove === true) {
      const { code, frequency, count, } = assemble
      const { length: length1, } = shiftTwoBytes.fromInt(code);
      const { length: length2, } = shiftTwoBytes.fromInt(frequency);
      const { length: length3, } = shiftTwoBytes.fromInt(count);
      const size = buffer.length - 4 - length1 - length2 - length3;
      if (size === 0) {
        await fsPromises.unlink(countsPath);
      } else {
        await fsPromises.truncate(countsPath, size);
      }
    } else {
      if (update === true) {
        const fd = await openPromise(countsPath, 'a');
        const { count, } = assemble;
        const buffer = Buffer.from(shiftTwoBytes.fromInt(count - 1n));
        const position = idx - buffer.length;
        await writePromise(fd, buffer, { position, });
        await fsyncPromise(fd);
        await closePromise(fd);
      } else {
        if (words.length === 0) {
          await fsPromises.unlink(countsPath);
        } else {
          const fd = await openPromise(countsPath, 'w');
          await writePromise(fd, Buffer.from(words.flat()));
          await fsyncPromise(fd);
          await closePromise(fd);
        }
      }
    }
  }
}

export default Storage;
