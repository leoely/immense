import detect from 'detecd-port';
import client from '~/decoration/client';

class StorageClient {
  constructor(options, allStorages) {
    if (typeof options !== 'object' && options !== null) {
      throw new Error('[Error] The parameter options should be of type object.');
    }
    const defaultOptions = {
      port: 49152,
    };
    this.options = Object.assign(defaultOptions, options);
    this.dealOptions();
    this.dealParams(allStorages);
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

  @client
  async readData() {}
}

export default StorageClient;
