import StorageClient from '~/class/StorageClient';

class MultiStorageClient {
  constructor() {
    this.storageClients = [];
    this.index = 0;
  }

  addStorageClient(storageClient) {
    if (!(storageClient instanceof StorageClient)) {
      throw new Error('[Error] The type of storageClient added is incorrect.');
    }
    const {
      allStorages,
    } = storageClient;
    if (allStorages.length === 0) {
      throw new Error('[Error] Adding storageClient with an empty all storages has not practical effect.');
    }
    const { storageClients, } = this;
    storageClients.push(storageClient);
    const { length, } = storageClients;
    this.length = length;
  }

  async getNextIndex(place, type) {
    const {
      index,
      length,
    } = this;
    outerLoop: for (let i = 0; i <= length; i += 1) {
      if (i === length) {
        throw new Error('[Error] The path currently being operated on does not exist.');
      }
      if (index === length - 1) {
        this.index = 0;
      } else {
        this.index += 1;
      }
      const {
        index: nextIndex,
        storageClients,
      } = this;
      const storageClient = storageClients[nextIndex];
      switch (type) {
        case 0:
          if (await storageClient.exists(place)) {
            break outerLoop;
          }
          break;
        case 1:
          if (await storageClient.presence(place)) {
            break outerLoop;
          }
          break;
        case 2:
          if (await storageClient.exists(place)) {
            break outerLoop;
          }
          if (await storageClient.presence(place)) {
            break outerLoop;
          }
          break;
      }
    }
  }

  getStorageClient() {
    const { index, storageClients, } = this;
    return storageClients[index];
  }

  async callMultiMethod(name, ...params) {
    const {
      length,
    } = this;
    if (length === 0) {
      throw new Error('[Error] The current storageClients are empty,so the opeartion has on effect.');
    }
    switch (name) {
      case 'readData':
      case 'readBufferPiece':
      case 'stats':
      case 'access': {
        const [place] = params;
        this.getNextIndex(place, 0);
        break;
      }
      case 'realpath':
      case 'readdir': {
        const [directory] = params;
        this.getNextIndex(directory, 1);
        break;
      }
      case 'diskOccupy': {
        const [path] = params;
        this.getNextIndex(path, 2);
        break;
      }
    }
    switch (name) {
      case 'readData':
      case 'readBufferPiece':
      case 'stats':
      case 'access':
      case 'realpath':
      case 'diskOccupy':
      case 'readdir': {
        const storageClient = this.getStorageClient();
        return await storageClient[name];
      }
      case 'writeBufferPiece':
      case 'writeBuffer':
      case 'addBuffer':
      case 'appendData':
      case 'remove':
      case 'rename':
      case 'cp':
      case 'link':
      case 'chmod':
      case 'mkdir':
      case 'rmdir':
      case 'truncate': {
        const { storageClients, } = this;
        let result;
        for await (const storageClient of storageClients) {
          result = await storageClient[name];
        }
        return result;
      }
      case 'glob': {
        const { storageClients, } = this;
        const ans = [];
        for await (const storageClient of storageClients) {
          ans.push(await storageClient[name]);
        }
        let max = -Infinity;
        let maxPaths;
        ans.forEach((paths) => {
          const { length, } = paths;
          if (length > max) {
            max = length;
            maxPaths = paths;
          }
        });
        return maxPaths;
        break;
      }
    }
  }

  async readData(...params) {
    return await this.callMultiMethod('readData', ...params);
  }

  async readBufferPiece(...params) {
    return await this.callMultiMethod('readBufferPiece', ...params);
  }

  async writeBufferPiece(...params) {
  }

  async writeBuffer(...params) {
  }

  async addBuffer(...params) {
    await this.callMultiMethod('addBuffer', ...params);
  }

  async appendData(...params) {
  }

  async remove(...params) {
  }

  async truncate(...params) {
  }

  async rename(...params) {
  }

  async diskOccupy(...params) {
  }

  async cp(...params) {
  }

  async link(...params) {
  }

  async stats(...params) {
  }

  async chmod(...params) {
  }

  async chown(...params) {
  }

  async access(...params) {
  }

  async realpath(...params) {
  }

  async readdir(...params) {
  }

  async mkdir(...params) {
  }

  async rmdir(...params) {
  }

  async glob(...params) {
  }
}

export default MultiStorageClient;
