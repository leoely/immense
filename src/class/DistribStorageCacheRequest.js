import net from 'net';
import os from 'os';
import {
  ByteArray,
} from 'manner.js/server';
import DistribStorageCache from '~/class/DistribStorageCache';
import dataPromise from '~/lib/util/dataPromise';

function addDataFlag(flag, data) {
  if (!Number.isInteger(flag)) {
    throw new Error('[Error] The parameter flag should be an integer type');
  }
  if (!Buffer.isBuffer(data) && typeof data !== 'string') {
    throw new Error('[Error] The parameter buffer should be a buffer or string type.');
  }
  const fbytes = Buffer.from([flag]);
  if (Buffer.isBuffer(data)) {
    return Buffer.concat([fbytes, data]);
  } else {
    return Buffer.concat([fbytes, Buffer.from(data)]);
  }
}

class DistribStorageCacheRequest {
  constructor(options = {}, storageCacheOptions = {}) {
    if (typeof options !== 'object' && options !== null) {
      throw new Error('[Error] The parameter options should be of type object.');
    }
    const defaultOptions = {
    };
    this.options = Object.assign(defaultOptions, options);
    this.dealOptions();
    const {
      options: {
        alreadyUsedCore,
        startPort,
      },
    } = this;
    const cores = os.cpus().length - alreadyUsedCore;
    this.allStorageCaches = [];
    const {
      allStorageCaches,
    } = this;
    for (let i = 0; i < cores; i += 1) {
      allStorageCache.push(new StorageCache(storageCacheOption));
    }
    this.index = this.getRandomIndex();
  }

  dealOptions() {
    const {
      options: {
        alreadyUsedCore,
        startPort,
      },
    } = this;
    if (alreadyUsedCore === undefined) {
      throw new Error('[Error] The number of cores already in use will affect cache performance,please confirm first.');
    }
    if (!Number.isInteger(alreadyUsedCore)) {
      throw new Error('[Error] The option alreadyUsedCore should be an integer type.');
    }
    if (!(alreadyUsedCore >= 0)) {
      throw new Error('[Error] The option alreadyUsedCore should be an integer type.');
    }
  }

  getRandomIndex() {
    const {
      allStorages: {
        length,
      },
    } = this;
    return Math.ceil(Math.random() * (length - 1));
  }

  getNextIndex() {
    const {
      index,
      length,
    } = this;
    if (index === length - 1) {
      this.index = 0;
    } else {
      this.index += 1;
    }
    return this.index;
  }
}

export default DistribStorageCacheRequest;
