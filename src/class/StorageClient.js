import detect from 'detect-port';
import ClientMethod from '~/decoration/ClientMethod';

class StorageClient {
  constructor(options = {}, allStorages) {
    if (typeof options !== 'object' && options !== null) {
      throw new Error('[Error] The parameter options should be of type object.');
    }
    const defaultOptions = {
      port: 49152,
    };
    this.options = Object.assign(defaultOptions, options);
    this.dealOptions();
    this.dealParams(allStorages);
    this.index = this.getRandomIndex();
  }

  getRandomIndex() {
    const {
      allStorages: {
        length,
      },
    } = this;
    return Math.ceil(Math.random() * length);
  }

  getNextIndex() {
    const {
      index,
      allStorages: {
        length,
      },
    } = this;
    if (index < length) {
      this.index += 1;
    } else {
      this.index = 0;
    }
    return this.index;
  }

  dealOptions() {
    const {
      options: {
        port,
      },
    } = this;
    if (port !== undefined) {
      if (!Number.isInteger(port)) {
        throw new Error('[Error] The parameter port should be of integer type.');
      }
      if (port < 49152 || port > 65535) {
        throw new Error('[Error] The range of parameter port should be [49152, 65535].')
      }
    }
  }

  async yieldPort() {
    const {
      options: {
        port,
      },
    } = this;
    if (port !== undefined) {
      for (let i = port; i < 65535; i += 1) {
        const realPort = await detect(i);
        if (i === realPort) {
          this.port = i;
          break;
        }
      }
    } else {
      for (let i = 49152; i <= 65535; i += 1) {
        const realPort = await detect(i);
        if (i === realPort) {
          this.port = i;
          break;
        }
      }
    }
  }

  dealParams(allStorages) {
    if (Array.isArray(allStorages) !== true) {
      throw new Error('[Error] The parameter all storages should be array type.');
    }
    this.allStorages = allStorages;
  }

  @ClientMethod
  async readData(place, options) {}

  @ClientMethod
  async readBufferPiece(place, position, length) {}

  @ClientMethod
  async writeBufferPiece(place, position, buffer) {}

  @ClientMethod
  async writeBuffer(place, buffer) {}

  @ClientMethod
  async addBuffer(place, buffer) {}

  @ClientMethod
  async appendData(place, data) {}

  @ClientMethod
  async remove(place) {}

  @ClientMethod
  async truncate(place, length) {}

  @ClientMethod
  async rename(oldPlace, newPlace) {}

  @ClientMethod
  async diskOccupy(place) {}

  @ClientMethod
  async cp(srcPath, destPath, options) {}

  @ClientMethod
  async link(targetPlace, linkPlace) {}

  @ClientMethod
  async stats(place) {}

  @ClientMethod
  async chmod(place, mod) {}

  @ClientMethod
  async chown(place, uid, gid) {}

  @ClientMethod
  async access(place, mod) {}

  @ClientMethod
  async realpath(place) {}

  @ClientMethod
  async readdir(directory, options) {}

  @ClientMethod
  async mkdir(directory) {}

  @ClientMethod
  async rmdir(directory) {}

  @ClientMethod
  async glob(pattern, options) {}
}

export default StorageClient;
