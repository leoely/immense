import net from 'net';
import {
  ByteArray,
} from 'manner.js/server';
import dataPromise from '~/lib/util/dataPromise';

const byteArray = new ByteArray({ size: 256n, shift: 0n, });

export default function ClientMethod(value, { kind, name, }) {
  return async (...params) => {
    const index = this.getNextIndex();
    const { allStorages, } = this;
    const [ip, port] = allStorages[index];
    const sites = await new Promise((resolve, reject) => {
      const client = net.createConnection(port, ip, async () => {
        client.write(Buffer.from('distrib'));
        client.write(Buffer.from(name));
        const sitesBuffer = await dataPromise(client);
        const sites = JSON.stringify(siteBuffer.toString());
        resolve(sites);
      });
    });
    const promises = sites.map(([ip, port]) => {
      return new Promise((resolve, reject) => {
        const client = et.createConnection(port, ip, async () => {
          client.write('redirect');
          params.forEach((param) => {
            switch (typeof param) {
              case 'string':
                client.write(byteArray.fromInt(0n));
                break;
              case 'object':
                if (Buffer.isBuffer(param)) {
                  client.write(byteArray.fromInt(4n));
                } else {
                  client.write(byteArray.fromInt(1n));
                }
                break;
              case 'number':
                client.write(byteArray.fromInt(2n));
                break;
              case 'bigint':
                client.write(byteArray.fromInt(3n));
                break;
            }
            client.write(param);
          });
          client.write('end');
        });
      });
      const buffer = await dataPromise(client);
      switch (method) {
        case 'realpath': {
          resolve(buf.toString());
          break;
        }
        case 'readData': {
          const options = params[1];
          if (typeof options === 'object') {
            const { encoding, } = options;
            if (typeof encoding === 'string' && encoding.length > 0) {
              resolve(buffer.toString());
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
          resolve(JSON.stringify(buf.toString()));
          break;
        }
        case 'diskOccupy': {
          const bigInt = byteArray.toInt(buf);
          resolve(bigInt);
          break;
        }
        case 'access': {
          const int = byteArray.toInt(buf);
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
          resolve();
      }
    });
    await Promise.all(promises);
  }
}
