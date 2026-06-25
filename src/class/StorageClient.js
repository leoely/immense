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
      port: 49152,
    };
    this.options = Object.assign(defaultOptions, options);
    this.dealOptions();
    this.dealParams(allStorages);
    this.index = this.getRandomIndex();
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
    if (port !== undefined) {
      if (!Number.isInteger(port)) {
        throw new Error('[Error] The parameter port should be of integer type.');
      }
      if (port < 49152 || port > 65535) {
        throw new Error('[Error] The range of parameter port should be [49152, 65535].')
      }
    }
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

  async callBigDataMethod(name, ...params) {
    const index = this.getNextIndex();
    const { allStorages, } = this;
    const [ip, port] = allStorages[index];
    const sites = await new Promise((resolve, reject) => {
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
          case 'cp':
          case 'link':
          case 'rename':
            client.write(JSON.stringify(params.slice(0, 2)));
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
    const { shiftOneByteArray, } = this;
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
                client.write(Buffer.from([0]));
                break;
              case 'object':
                if (Buffer.isBuffer(param)) {
                  client.write(Buffer.from(shiftOneByteArray.fromInt(4n)));
                } else {
                  client.write(Buffer.from(shiftOneByteArray.fromInt(1n)));
                }
                client.write(Buffer.from([0]));
                break;
              case 'number':
                client.write(Buffer.from(shiftOneByteArray.fromInt(2n)));
                client.write(Buffer.from([0]));
                break;
              case 'bigint':
                client.write(Buffer.from(shiftOneByteArray.fromInt(3n)));
                client.write(Buffer.from([0]));
                break;
            }
            switch (typeof param) {
              case 'string': {
                const buffer = Buffer.from(param);
                this.writeBufferLength(client, buffer);
                client.write(Buffer.from(param));
                break;
              }
              case 'object':
                if (Buffer.isBuffer(param)) {
                  const buffer = param;
                  this.writeBufferLength(client, buffer);
                  client.write(param);
                } else {
                  const buffer = Buffer.from(JSON.stringify(param));
                  this.writeBufferLength(client, buffer);
                  client.write(buffer);
                }
                break;
              case 'number':
              case 'bigint': {
                const buffer = Buffer.from(shiftOneByteArray.fromInt(param));
                writeBufferLength(client, buffer);
                client.write();
                break;
              }
            }
            client.write(param);
          });
          resolve();
          //client.write(Buffer.from('end'));
          //const buffer = await dataPromise(client);
          //switch (method) {
            //case 'realpath': {
              //resolve(buf.toString());
              //break;
            //}
            //case 'readData': {
              //const options = params[1];
              //if (typeof options === 'object') {
                //const { encoding, } = options;
                //if (typeof encoding === 'string' && encoding.length > 0) {
                  //resolve(buffer.toString());
                //}
              //}
              //resolve(buffer);
              //break;
            //}
            //case 'readBufferPiece': {
              //resolve(buffer);
              //break;
            //}
            //case 'glob':
            //case 'readdir':
            //case 'stats': {
              //resolve(JSON.stringify(buf.toString()));
              //break;
            //}
            //case 'diskOccupy': {
              //const bigInt = shiftOneByteArray.toInt(buf);
              //resolve(bigInt);
              //break;
            //}
            //case 'access': {
              //const int = shiftOneByteArray.toInt(buf);
              //switch (int) {
                //case 0n:
                  //resolve(false);
                  //break;
                //case 1n:
                  //resolve(true);
                  //break;
              //}
            //}
            //default:
              //resolve();
          //}
          client.destroySoon();
        });
      });
    });
    const returns = await Promise.all(promises);
    const { length, } = returns;
    switch (name) {
      case 'glob': {
        let paths = [];
        returns.forEach((r) => {
          paths = paths.concat(r);
        });
        break;
      }
      default:
        return returns[0];
    }
  }

  async readData(place, options) {
  }

  async readBufferPiece(place, position, length) {
  }

  async writeBufferPiece(place, position, buffer) {
    return this.callBigDataMethod('writeBufferPiece', ...params);
  }

  async writeBuffer(...params) {
    return this.callBigDataMethod('writeBuffer', ...params);
  }

  async addBuffer(...params) {
    return this.callBigDataMethod('addBuffer', ...params);
  }

  async appendData(...params) {
    return this.callBigDataMethod('appendData', ...params);
  }

  async remove(place) {
  }

  async truncate(place, length) {
  }

  async rename(oldPlace, newPlace) {
  }

  async diskOccupy(place) {
  }

  async cp(srcPath, destPath, options) {
  }

  async link(targetPlace, linkPlace) {
  }

  async stats(place) {
  }

  async chmod(place, mod) {
  }

  async chown(place, uid, gid) {
  }

  async access(place, mod) {
  }

  async realpath(place) {
  }

  async readdir(directory, options) {
  }

  async mkdir(directory) {
  }

  async rmdir(directory) {
  }

  async glob(pattern, options) {
  }
}

export default StorageClient;
