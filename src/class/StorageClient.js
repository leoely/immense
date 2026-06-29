import net from 'net';
import {
  ByteArray,
} from 'manner.js/server';
import dataPromise from '~/lib/util/dataPromise';

class StorageClient {
  constructor(options = {}, allStorages) {
    if (typeof options !== 'object' && options !== null) {
      throw new Error('[Error] The parameter options should be of type object.');
    }
    const defaultOptions = {
    };
    this.options = Object.assign(defaultOptions, options);
    this.dealOptions();
    this.dealParams(allStorages);
    this.index = this.getRandomIndex();
    this.byteArray = new ByteArray({ size: 256n, shift: 0n, });
    this.shiftOneByteArray = new ByteArray({ size: 256n, shift: 1n, });
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
      allStorages: {
        length,
      },
    } = this;
    if (index === length - 1) {
      this.index = 0;
    } else {
      this.index += 1;
    }
    return this.index;
  }

  dealOptions() {
    const {
      options: {
        port,
      },
    } = this;
  }

  dealParams(allStorages) {
    if (Array.isArray(allStorages) !== true) {
      throw new Error('[Error] The parameter all storages should be array type.');
    }
    this.allStorages = allStorages;
  }

  writeBufferLength(client, buffer) {
    const { length, } = buffer;
    const { shiftOneByteArray, } = this;
    client.write(Buffer.from(shiftOneByteArray.fromInt(buffer.length)));
    client.write(Buffer.from([0]));
  }

  async callRemoteMethod(name, ...params) {
    const index = this.getNextIndex();
    const { allStorages, } = this;
    const [ip, port] = allStorages[index];
    const result = await new Promise((resolve, reject) => {
      const client = net.createConnection(port, ip, async () => {
        client.write('distrib');
        client.write(name);
        switch (name) {
          case 'realpath':
          case 'access':
          case 'chown':
          case 'chmod':
          case 'stats':
          case 'writeBuffer':
          case 'writeBufferPiece':
          case 'readBufferPiece':
          case 'appendData':
          case 'remove':
          case 'truncate':
          case 'readData':
          case 'addBuffer':
          case 'diskOccupy':
          case 'mkdir':
          case 'rmdir':
          case 'readdir':
            client.write(JSON.stringify(params.slice(0, 1)));
            break;
          case 'link':
          case 'rename':
            client.write(JSON.stringify(params.slice(0, 2)));
            break;
          case 'cp':
            client.write(JSON.stringify(params.slice(0, 3)));
            break;
          case 'glob':
            client.write(JSON.stringify([]));
            break;
        }
        const buffer = await dataPromise(client);
        const sites = JSON.parse(buffer.toString());
        resolve(sites);
        client.destroySoon();
      });
    });
    const [status, content] = result;
    let sites;
    if (status === 1) {
      sites = content;
    } else {
      throw new Error(content);
    }
    const { byteArray, shiftOneByteArray, } = this;
    const promises = sites.map(([ip, port]) => {
      return new Promise((resolve, reject) => {
        const client = net.createConnection(port, ip, async () => {
          client.write('redirect');
          client.write(name);
          client.write(Buffer.from([0]));
          params.forEach((param) => {
            switch (typeof param) {
              case 'string':
                client.write(Buffer.from(shiftOneByteArray.fromInt(0n)));
                break;
              case 'object':
                if (Buffer.isBuffer(param)) {
                  client.write(Buffer.from(shiftOneByteArray.fromInt(4n)));
                } else {
                  client.write(Buffer.from(shiftOneByteArray.fromInt(1n)));
                }
                break;
              case 'number':
                client.write(Buffer.from(shiftOneByteArray.fromInt(2n)));
                break;
              case 'bigint':
                client.write(Buffer.from(shiftOneByteArray.fromInt(3n)));
                break;
            }
            switch (typeof param) {
              case 'string': {
                const buffer = param;
                this.writeBufferLength(client, buffer);
                client.write(buffer);
                break;
              }
              case 'object':
                if (Buffer.isBuffer(param)) {
                  const buffer = param;
                  this.writeBufferLength(client, buffer);
                  client.write(param);
                } else {
                  const buffer =JSON.stringify(param);
                  this.writeBufferLength(client, buffer);
                  client.write(buffer);
                }
                break;
              case 'number':
              case 'bigint': {
                const buffer = Buffer.from(byteArray.fromInt(param));
                this.writeBufferLength(client, buffer);
                client.write(buffer);
                break;
              }
            }
          });
          client.write('end');
          let buffer = await dataPromise(client);
          const code = byteArray.toInt(buffer.subarray(0, 1));
          const { length, } = buffer;
          buffer = buffer.subarray(1, length);
          if (code === 0) {
            throw new Error(buffer.toString());
          } else {
            switch (name) {
              case 'realpath': {
                resolve(buffer.toString());
                break;
              }
              case 'readData': {
                const options = params[1];
                if (typeof options === 'object') {
                  const { encoding, } = options;
                  if (typeof encoding === 'string' && encoding.length > 0) {
                    resolve(buffer.toString());
                  } else {
                    resolve(buffer);
                  }
                }
                resolve(buffer);
                break;
              }
              case 'readBufferPiece': {
                resolve(buffer);
                break;
              }
              case 'glob':
              case 'readdir':
              case 'stats': {
                resolve(JSON.parse(buffer.toString()));
                break;
              }
              case 'diskOccupy': {
                const bigInt = shiftOneByteArray.toInt(buffer);
                resolve(bigInt);
                break;
              }
              case 'access': {
                const int = byteArray.toInt(buffer);
                switch (int) {
                  case 0n:
                    resolve(false);
                    break;
                  case 1n:
                    resolve(true);
                    break;
                }
              }
              default:
                resolve(undefined);
            }
          }
          client.destroySoon();
        });
      });
    });
    const returns = await Promise.all(promises);
    const { length, } = returns;
    switch (name) {
      case 'readdir':
      case 'glob': {
        let paths = [];
        returns.forEach((r) => {
          paths = paths.concat(r);
        });
        return paths;
      }
      default:
        return returns[0];
    }
  }

  async readData(...params) {
    if (params.length !== 2 && params.length !== 1) {
      throw new Error('[Error] The parameter form should be: async readData(place, [options]);');
    }
    return await this.callRemoteMethod('readData', ...params);
  }

  async readBufferPiece(...params) {
    if (params.length !== 3) {
      throw new Error('[Error] The parameter form should be: async readBufferPiece(place, position, length);');
    }
    return await this.callRemoteMethod('readBufferPiece', ...params);
  }

  async writeBufferPiece(...params) {
    if (params.length !== 3) {
      throw new Error('[Error] The parameter form should be: async writeBufferPiece(place, position, buffer);');
    }
    return await this.callRemoteMethod('writeBufferPiece', ...params);
  }

  async writeBuffer(...params) {
    if (params.length !== 2) {
      throw new Error('[Error] The parameter form should be: async writeBuffer(place, buffer);');
    }
    return await this.callRemoteMethod('writeBuffer', ...params);
  }

  async addBuffer(...params) {
    if (params.length !== 2) {
      throw new Error('[Error] The parameter form should be: async addBuffer(place, buffer);');
    }
    return await this.callRemoteMethod('addBuffer', ...params);
  }

  async appendData(...params) {
    if (params.length !== 2) {
      throw new Error('[Error] The parameter form should be: async appendData(place, data);');
    }
    return await this.callRemoteMethod('appendData', ...params);
  }

  async remove(...params) {
    if (params.length !== 1) {
      throw new Error('[Error] The parameter form should be: async remove(place);');
    }
    return await this.callRemoteMethod('remove', ...params);
  }

  async truncate(...params) {
    if (params.length !== 2) {
      throw new Error('[Error] The parameter form should be: async truncate(place, length);');
    }
    return await this.callRemoteMethod('truncate', ...params);
  }

  async rename(...params) {
    if (params.length !== 2) {
      throw new Error('[Error] The parameter form should be: async rename(oldPlace, newPlace);')
    }
    return await this.callRemoteMethod('rename', ...params);
  }

  async diskOccupy(...params) {
    if (params.length !== 1) {
      throw new Error('[Error] The parameter form should be: async diskOccupy(place);')
    }
    return await this.callRemoteMethod('diskOccupy', ...params);
  }

  async cp(...params) {
    if (params.length !== 3 && params.length !== 2) {
      throw new Error('[Error] The parameter form should be: async cp(srcPath, destPath, [options]);');
    }
    return await this.callRemoteMethod('cp', ...params);
  }

  async link(...params) {
    if (params.length !== 2) {
      throw new Error('[Error] The parameter form should be: async link(targetPlace, linkPlace);');
    }
    return await this.callRemoteMethod('link', ...params);
  }

  async stats(...params) {
    if (params.length !== 1) {
      throw new Error('[Error] The parameter form should be: async stats(place);');
    }
    return await this.callRemoteMethod('stats', ...params);
  }

  async chmod(...params) {
    if (params.length !== 2) {
      throw new Error('[Error] The parameter form should be: async chmod(place, mod);');
    }
    return await this.callRemoteMethod('chmod', ...params);
  }

  async chown(...params) {
    if (params.length !== 3) {
      throw new Error('[Error] The parameter form should be: async chown(place, uid, gid);');
    }
    return await this.callRemoteMethod('chown', ...params);
  }

  async access(...params) {
    if (params.length !== 2) {
      throw new Error('[Error] The parameter form should be: async access(place, mod);');
    }
    return await this.callRemoteMethod('access', ...params);
  }

  async realpath(...params) {
    if (params.length !== 1) {
      throw new Error('[Error] The parameter form should be: async realpath(place);');
    }
    return await this.callRemoteMethod('realpath', ...params);
  }

  async readdir(...params) {
    if (params.length !== 2 && params.length !== 1) {
      throw new Error('[Error] The parameter form should be: async readdir(directory, [options]);');
    }
    return await this.callRemoteMethod('readdir', ...params);
  }

  async mkdir(...params) {
    if (params.length !== 1) {
      throw new Error('[Error] The parameter form should be: async mkdir(directory);');
    }
    return await this.callRemoteMethod('mkdir', ...params);
  }

  async rmdir(...params) {
    if (params.length !== 1 && params.length !== 2) {
      throw new Error('[Error] The parameter form should be: async rmdir(directory, [options]);');
    }
    return await this.callRemoteMethod('rmdir', ...params);
  }

  async glob(...params) {
    if (params.length !== 2 && params.length !== 1) {
      throw new Error('[Error] The parameter form should be: async glob(pattern, [options]);');
    }
    return await this.callRemoteMethod('glob', ...params);
  }
}

export default StorageClient;
