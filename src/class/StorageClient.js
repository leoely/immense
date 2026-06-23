import net from 'net';
import detect from 'detect-port';
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

  async callBigDataMethod(name, ...params) {
    const index = this.getNextIndex();
    const { allStorages, } = this;
    const [ip, port] = allStorages[index];
    const sites = await new Promise((resolve, reject) => {
      const client = net.createConnection(port, ip, async () => {
        console.log('client', client.localPort);
        //client.write(Buffer.from('distrib'));
        //client.write(Buffer.from(name));
        //const sitesBuffer = await dataPromise(client);
        //const sites = JSON.stringify(siteBuffer.toString());
        //resolve(sites);
        //client.destorySoon();
      });
    });
    //const promises = sites.map(([ip, port]) => {
      //return new Promise((resolve, reject) => {
        //const client = net.createConnection(port, ip, async () => {
          //client.write('redirect');
          //params.forEach((param) => {
            //switch (typeof param) {
              //case 'string':
                //client.write(byteArray.fromInt(0n));
                //break;
              //case 'object':
                //if (Buffer.isBuffer(param)) {
                  //client.write(byteArray.fromInt(4n));
                //} else {
                  //client.write(byteArray.fromInt(1n));
                //}
                //break;
              //case 'number':
                //client.write(byteArray.fromInt(2n));
                //break;
              //case 'bigint':
                //client.write(byteArray.fromInt(3n));
                //break;
            //}
            //client.write(param);
          //});
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
              //const bigInt = byteArray.toInt(buf);
              //resolve(bigInt);
              //break;
            //}
            //case 'access': {
              //const int = byteArray.toInt(buf);
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
          //client.destorySoon();
        //});
      //});
    //});
    //const returns = await Promise.all(promises);
    //const { length, } = returns;
    //switch (name) {
      //case 'glob': {
        //let paths = [];
        //returns.forEach((r) => {
          //paths = paths.concat(r);
        //});
        //break;
      //}
      //default:
        //return returns[0];
    //}
  }

  async readData(place, options) {
  }

  async readBufferPiece(place, position, length) {
  }

  async writeBufferPiece(place, position, buffer) {
    this.callBigDataMethod('writeBufferPiece', ...params);
  }

  async writeBuffer(...params) {
    this.callBigDataMethod('writeBuffer', ...params);
  }

  async addBuffer(...params) {
    this.callBigDataMethod('addBuffer', ...params);
  }

  async appendData(...params) {
    this.callBigDataMethod('appendData', ...params);
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
