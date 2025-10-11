import fsPromises from 'fs/promises';
import fs from 'fs';
import path from 'path';
import existsPromise from '~/lib/util/existsPromise';
import readPromise from '~/lib/util/readPromise';
import writePromise from '~/lib/util/writePromise';
import fdatasyncPromise from '~/lib/util/fdatasyncPromise';
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

async function clearEmptyDirs(paths) {
  const dirs = paths.split(path.sep);
  while (true) {
    const site = dirs.join(path.sep);
    const directory = await fsPromises.opendir(site);
    const entry = await directory.read();
    await directory.close();
    if (entry === null) {
      await fsPromises.rmdir(site);
      dirs.pop();
    } else {
      break;
    }
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
    const dirname = path.dirname(filePath);
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
    const dirname = path.dirname(filePath);
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
    const dirname = path.dirname(filePath);
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
    const dirname = path.dirname(filePath);
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
    const dirname = path.dirname(filePath);
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
    const dirname = path.dirname(filePath);
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
    await fsPromises.unlink(filePath);
    await clearEmptyDirs(dirname);
  }
}

export default Storage;
