import net from 'net';
import {
  ByteArray,
  getGTMNowString,
  getOwnIpAddresses,
  appendToLog,
} from 'manner.js/server';
import Storage from '~/class/Storage';

class DistribStorage extends Storage {
  constructor(location, options, port, allStorages) {
    super(location, options);
    this.dealParams(port, allStorages);
    this.request = null;
    this.count = 0;
    this.size = -1;
    this.state = 0;
    this.status = 0;
    this.params = [];
    this.byteArray = new ByteArray({ size: 256n, shift: 0n, });
    this.shiftOneByteArray = new ByteArray({ size: 256n, shift: 1n, });
    this.dealBuffer = this.dealBuffer.bind(this);
  }

  static async combine(distribStorages) {
    if (!Array.isArray(distribStorages)) {
      throw new Error('[Error] The parameter distribStorages should be of array type.');
    }
    const serverPromises = distribStorages.map((distribStorage) => {
      return distribStorage.setUpServer();
    });
    const clientsPromises = distribStorages.map((distribStorage) => {
      return distribStorage.setUpClients();
    });
    await Promise.all(serverPromises.concat(clientsPromises));
  }

  static async join(newDistribStorages, originDistribStorages) {
    if (!Array.isArray(newDistribStorages)) {
      throw new Error('[Error] The new distributed routings should beo fo array type..');
    }
    if (!Array.isArray(originDistribStorages)) {
      throw new Error('[Error] The origin distributed routings should be of array type.');
    }
    const serverPromises = newDistribStorages.map((distribStorage) => {
      return distribStorage.setUpServer();
    });
    const clientsPromises = newDistribStorages.map((distribStorage) => {
      return distribStorage.setUpClients();
    });
    const addPromises = originDistribStorages.map((originDistribStorage) => {
      return newDistribStorages.map((newDistribStorage) => {
        const { ip, port, } = newDistribStorage;
        originDistribStorage.addStorage(ip, port);
      });
    }).flat();
    await Promise.all(serverPromises.concat(clientsPromises).concat(addPromises));
  }

  static async release(distribStorages) {
    if (!Array.isArray(distribStorages)) {
      throw new Error('[Error] The parameter distribStorages should be of array type.');
    }
    distribStorages.forEach((distribStorage) => {
      distribStorage.closeClients();
      delete distribStorage.clients;
    });
    for (let i = 0; i < distribStorages.length; i += 1) {
      const distribStorage = distribStorages[i];
      await distribStorage.closeServer();
      delete distribStorage.server;
    }
    distribStorages.forEach((distribStorage) => {
      distribStorage.closeConnections();
      delete distribStorage.connections;
    });
  }

  getBinBuf(params) {
    if (!Array.isArray(params)) {
      throw new Error('[Error] The params parameter should be an array type.');
    }
    const { length, } = params;
    if (length !== 1 && length !== 4) {
      throw new Error('[Error] The length of the params parameter should be equal to one or four.');
    }
    const pbytes = [];
    const { shiftOneByteArray, } = this;
    params.forEach((param) => {
      switch (typeof param) {
        case 'boolean':
          switch (param) {
            case true:
              pbytes.push(Array.from(shiftOneByteArray.fromInt(1)));
              break;
            case false:
              pbytes.push(Array.from(shiftOneByteArray.fromInt(0)));
              break;
          }
          break;
        case 'string':
          pbytes.push(Array.from(Buffer.from(param)));
          break;
        case 'number':
          if (!Number.isInteger(param)) {
            throw new Error('[Error] If the param type is a number, ite should be an integer.');
          }
          pbytes.push(Array.from(shiftOneByteArray.fromInt(param)));
          break;
      }
      pbytes.push(0);
    });
    const buf = Buffer.from(pbytes.flat());
    return buf;
  }

  getResponsePromises(callback) {
    const { shiftOneByteArray, } = this;
    if (typeof callback !== 'function') {
      throw new Error('[Error] Parameter callback should be a funciton type.');
    }
    return this.getClients().map((client) => {
      callback(client);
      return new Promise((resolve, reject) => {
        client.on('data', (buf) => {
          const segments = [];
          let s = 0;
          for (let i = 0; i < buf.length; i += 1) {
            if (buf[i] === 0) {
              segments.push(buf.slice(s, i));
              s = i + 1;
            }
          }
          const bigInt1 = shiftOneByteArray.toInt(segments.shift());
          const code = Number(bigInt1);
          let params;
          switch (code) {
            case 0:
            case 2:
              params = segments.map((segment, index) => {
                switch (index) {
                  case 0: {
                    const bigInt2 = shiftOneByteArray.toInt(segment);
                    switch (bigInt2) {
                      case 1n:
                        return true;
                      case 0n:
                        return false;
                    }
                    break;
                  }
                  case 2:
                    return shiftOneByteArray.toInt(segment);
                  default:
                    return segment.toString();
                }
              });
              break;
            case 1:
              params = segments.map((segment, index) => {
                switch (index) {
                  case 0:
                  case 2:
                    return shiftOneByteArray.toInt(segment);
                  default:
                    return segment.toString();
                }
              });
              break;
          }
          resolve(params);
        });
      });
    });
  }

  dealParams(port, allStorages) {
    if (Number.isInteger(port) !== true) {
      throw new Error('[Error] The parameter port should be of integer type.');
    }
    if (!(port >= 0)) {
      throw new Error('[Error] Parameter id needs to be a postive integer.');
    }
    this.port = port;
    if (Array.isArray(allStorages) !== true) {
      throw new Error('[Error] The parameter all storages should be array type.');
    }
    const ipAddresses = getOwnIpAddresses();
    const locations = [];
    ipAddresses.forEach((ipAddress) => {
      const { ipv4, ipv6, } = ipAddress;
      locations.push(ipv4 + ':' + port);
      locations.push('[' + ipv6 + ']:' + port);
    });
    const hash = {};
    const storages = allStorages.filter((storage) => {
      const [_, port] = storage;
      if (hash[port] === undefined) {
        hash[port] = true;
      } else {
        throw new Error('[Error] A port can only be bound to one storage');
      }
      let flag = true;
      for (let i = 0; i< locations.length ; i += 1) {
        const location = locations[i];
        const [ip] = storage;
        if (net.isIPv4(ip)) {
          if (storage.join(':') === location) {
            const [ip] = storage;
            this.ip = ip;
            flag = false;
            break;
          }
        } else if (net.isIPv6(ip)) {
          const [ip, port] = storage;
          const formatStorage = ['[' + ip + ']', port];
          if (formatStorage.join(':') === location) {
            const [ip] = storage;
            this.ip = ip;
            flag = false;
            break;
          }
        }
      }
      return flag;
    });
    this.storages = storages;
  }

  getStorages() {
    const { storages, } = this;
    if (!Array.isArray(storages)) {
      throw new Error('[Error] The status of storages in distributed routing.');
    }
    return storages;
  }

  async closeServer() {
    try {
      await new Promise((resolve, reject) => {
        this.getServer().close(() => {
          resolve();
        });
      })
    } catch (error) {
    }
  }

  closeClients() {
    try {
      this.getClients().forEach((client) => {
        client.destroySoon();
      });
    } catch (error) {
    }
  }

  closeConnections() {
    try {
      const { connections, } = this;
      if (!Array.isArray(connections)) {
        throw new Error('[Error] The connections is not an array type or the combine is not complete.');
      }
      if (connections.length === 0) {
        throw new Error('[Error] The length of the connections is zero.Perhaps the combine was not completed;');
      }
      connections.forEach((connection) => {
        connection.destroySoon();
      });
    } catch (error) {
    }
  }

  getServer() {
    const { server, } = this;
    if (server === undefined) {
      throw new Error('[Error] The current distributed cluster is not combined and cannot obtain the server');
    }
    return server;
  }

  getConnections() {
    const { server, connections, } = this;
    if (server === undefined) {
      throw new Error('[Error] The current distributed cluster is not combined and cannot obtain the connections');
    }
    return connections;
  }

  getClients() {
    const { clients, } = this;
    if (clients === undefined) {
      throw new Error('[Error] The current distributed cluster is not combined and cannot obtain the clients');
    }
    return clients;
  }

  async setUpServer() {
    try {
      const {
        storages: {
          length,
        },
      } = this;
      this.connections = [];
      this.server = await new Promise((resolve, reject) => {
        const server = net.createServer((connection) => {
          const { count, } = this;
          if (count === length - 1) {
            connection.on('data', async (buf) => {
              await this.dealConnectionBuf(buf, connection);
            });
            this.connections.push(connection);
            this.count += 1;
            resolve(server);
          } else if (count < length - 1) {
            connection.on('data', async (buf) => {
              await this.dealConnectionBuf(buf, connection);
            });
            this.connections.push(connection);
            this.count += 1;
          } else if (count >= length) {
            const { request, } = this;
            if (request === null) {
              this.setRequest(connection);
              this.count += 1;
            }
          } else {
            connection.destroySoon();
          }
        });
        const { port, } = this;
        server.on('error', (error) => {
          throw error;
        });
        server.listen(port);
      });
      this.server = net.createServer((connection) => {
        this.request = connection;
      });
      const { server, } = this;
      return server;
    } catch (error) {
    }
  }

  getRestBuffer(buf) {
    const { length, } = buf;
    const { size, } = this;
    buf.subarray(size + 1, length);
  }

  dealRedirectBuffer(buf) {
    const { status, byteArray, } = this;
    switch (status) {
      case 1: {
        const index = buf.indexOf(0);
        this.method = buf.subarray(0, index + 1).toString();
        const { length, } = buf;
        this.dealRedirectBuffer(buf.subarray(index + 1, length));
        this.status = 0;
        break;
      }
      case 0: {
        this.type = byteArray.toInt(buf.subarray(0, 1));
        let { length, } = buf;
        buf = buf.subarray(1, length);
        const index = buf.indexOf(0);
        this.size = shiftOneByteArray.toInt(buf.subarray(0, index + 1));
        length = buf.length;
        buf = buf.subarray(index + 1, length);
        this.dealRedirectBuffer(buf);
        this.status = 2;
        break;
      }
      case 1: {
        const { size, type, } = this;
        switch (type) {
          case 0n: {
            const { size, } = this;
            const string = buf.subarray(0, size).toString();
            this.params.push(string);
            this.dealRedirectBuffer(this.getRestBuffer(buf));
            break;
          }
          case 1n: {
            const { size, } = this;
            const json = buf.subarray(0, size).toString();
            const { length, } = buf;
            const object = JSON.parse(json);
            this.params.push(object);
            this.dealRedirectBuffer(this.getRestBuffer(buf));
            break;
          }
          case 2n: {
            const { size, } = this;
            const int = Number(byteArray.toInt(buf.subarray(0, size)));
            const { length, } = buf;
            buf = buf.subarray(size + 1, length);
            this.params.push(int);
            this.dealRedirectBuffer(this.getRestBuffer(buf));
            break;
          }
          case 3n: {
            const { size, } = this;
            const bigInt = byteArray.toInt(buf.subarray(0, size));
            const { length, } = buf;
            this.params.push(bigInt);
            this.dealRedirectBuffer(this.getRestBuffer(buf));
            break;
          }
          case 4n: {
            const { size, } = this;
            const buffer = buf.subarray(0, size);
            const { length, } = buf;
            this.params.push(buffer);
            this.dealRedirectBuffer(this.getRestBuffer(buf));
            break;
          }
        }
        this.status = 1;
        break;
      }
    }
  }

  async dealDistribBuffer(buf) {
    const { length, } = buf;
    for (let i = 0; i < length; i += 1) {
      if (buf[i] === 91) {
        this.method = buf.subarray(0, i).toString();
        this.params = JSON.parse(buf.subarray(i, length).toString());
      }
    }
    const sites = await this.treatSitesDistrib();
    return sites;
  }

  async dealBuffer(buf) {
    const { state, } = this;
    switch (state) {
      case 0: {
        if (buf.subarray(0, 7).toString() === 'distrib') {
          const { length, } = buf;
          buf = buf.subarray(7, length);
          this.state = 2;
          await this.dealBuffer(buf);
        } else if (buf.subarray(0, 3).toString() === 'end') {
          this.state = 1;
        } else if (buf.subarray(0, 8).toString() === 'redirect') {
          const { length, } = buf;
          buf = buf.subarray(8, length);
          await this.dealBuffer(buf);
          this.state = 3;
        }
        break;
      }
      case 1: {
        this.dealRedirectBuffer(buf);
        const { method, params, request: connection, } = this;
        if (method !== '') {
          switch (method) {
            case 'realpath': {
              const string = await this[method](...params);
              connection.write(string);
              break;
            }
            case 'readData':
            case 'readBufferPiece': {
              const buffer = await this[method](...params);
              connection.write(buffer);
              break;
            }
            case 'glob':
            case 'readdir':
            case 'stats': {
              const stats = await this[method](...params);
              const json = JSON.stringify(stats);
              connection.write(json);
              break;
            }
            case 'diskOccupy': {
              const bigInt = await this[method](...params);
              connection.write(byteArray.fromInt(bigInt));
              break;
            }
            case 'access':
              try {
                await this[method](...params);
                connection.write(byteArray.fromInt(1));
              } catch (error) {
                connection.write(byteArray.fromInt(0));
              }
              break;
            default:
              await this[method](...params);
          }
        }
        this.status = 0;
        this.params = [];
        this.type = '';
        this.method = '';
        this.state = 0;
        this.count -= 1;
        connection.destorySoon();
        break;
      }
      case 2: {
        const sites = await this.dealDistribBuffer(buf);
        const string = JSON.stringify(sites);
        const { request: connection, } = this;
        connection.write(string);
        this.request = null;
        this.method = '';
        this.params = [];
        this.state = 0;
        break;
      }
      case 3:
        this.dealRedirectBuffer(buf);
        break;
    }
  }

  setRequest(connection) {
    this.request = connection;
    connection.on('data', this.dealBuffer);
    connection.on('close', () => {
      this.request = null;
    });
    connection.on('error', (error) => {
      this.request = null;
    });
  }

  async setUpClients() {
    try {
      const { storages, } = this;
      const clientPromises = storages.map((storage) => {
        const [ip, port] = storage;
        return new Promise((resolve, reject) => {
          const client = net.createConnection(port, ip, () => {
            client.ip = ip;
            client.port = port;
            resolve(client);
          });
          client.on('close', () => {
            const { ip, port, } = client;
            this.removeStorage(ip, port);
          });
        });
      });
      this.clients = await Promise.all(clientPromises);
      const { clients, } = this;
      return clients;
    } catch (error) {
    }
  }

  async dealConnectionBuf(buf, connection) {
    const segments = [];
    let s = 0;
    for (let i = 0; i < buf.length; i += 1) {
      if (buf[i] === 0) {
        segments.push(buf.slice(s, i));
        s = i + 1;
      }
    }
    const { shiftOneByteArray, } = this;
    const bigInt1 = shiftOneByteArray.toInt(segments.shift());
    const code = Number(bigInt1);
    const { ip, port, } = this;
    switch (code) {
      case 0: {
        const exists = await this.exists();
        connection.write(this.getBinBuf([0, exists, ip, port]));
        break;
      }
      case 1: {
        const available = await this.available();
        connection.write(this.getBinBuf([1, available, ip, port]));
        break;
      }
      default:
        throw new Error('[Error] The code value should be in the range [0, 1]');
    }
  }

  removeStorage(ip, port) {
    const { storages, } = this;
    for (let i = 0; i < storages.length; i += 1) {
      const [storageIp, storagePort] = storages[i];
      if (storageIp === ip && storagePort === port) {
        storages.splice(i, 1);
        const { clients, } = this;
        if (Array.isArray(clients)) {
          clients.splice(i, 1);
          clients[i].destroySoon();
        }
        break;
      }
    }
  }

  async addStorage(ip, port) {
    return new Promise((resolve, reject) => {
      const client = net.createConnection(port, ip, () => {
        client.ip = ip;
        client.port = port;
        resolve(client);
      });
      client.on('close', () => {
        const { ip, port, } = client;
        this.removeStorage(ip, port);
      });
      const { storages, clients, } = this;
      storages.push([ip, port]);
      clients.push(client);
    });
  }

  checkCombine() {
    const { server, clients, } = this;
    if (server === undefined || clients === undefined) {
      throw new Error('[Error] Distributed node integration is not yet complete.');
    }
  }

  async existsDistrib(place) {
    try {
      this.checkCombine();
      const exists = await this.exists(place);
      const responsePromises = this.getResponsePromises((client) => {
        client.write(this.getBinBuf([0]));
      });
      const existsMessages = await Promise.all(responsePromises);
      const { ip, port, } = this;
      existsMessages.push([exists, ip, BigInt(port)]);
      return existMessages;
    } catch (error) {
      throw error;
    }
  }

  async availableDistrib(place) {
    try {
      this.checkCombine();
      const available = await this.available(place);
      const responsePromises = this.getResponsePromises((client) => {
        client.write(this.getBinBuf([1]));
      });
      const availableMessages = await Promise.all(responsePromises);
      const { ip, port, } = this;
      availableMessages.push([BigInt(available), ip, BigInt(port)]);
      return availableMessages;
    } catch (error) {
      throw error;
    }
  }

  async presenceDistrib(place) {
    try {
      this.checkCombine();
      const presence = await this.presence(place);
      const responsePromises = this.getResponsePromises((client) => {
        client.write(this.getBinBuf([2]));
      });
      const presenceMessages = await Promise.all(responsePromises);
      const { ip, port, } = this;
      presenceMessages.push([presence, ip, BigInt(port)]);
      return presenceMessages;
    } catch (error) {
      throw error;
    }
  }

  async treatDontExistsDistrib(place) {
    const existsResults = await existsDistrib(place);
    return existsResults.every(([exists, ip, port]) => exists === false);
  }

  async treatDontPresenceDistrib(place) {
    const presenceResults = await presencejDistrib(place);
    return presenceResults.every(([exists, ip, port]) => presence === false);
  }

  async treatExistsDistrib(place) {
    let existsResults = await existsDistrib(place);
    existsResults = existsResults.filter(([exists, ip, port]) => exist === true);
    if (existsResults.length === 0) {
      throw new Error('[Error] The file to be operated on does not exist.');
    } else if (existsResults.length === 1) {
      const [existsResult] = existsResults;
      const [_, ip, port] = existsResult;
      return [ip, port];
    } else {
      throw new Error('[Error] Multiple files exist please chk system data is correct.')
    }
  }

  async treatPresenceDistrib(place) {
    let presenceResults = await presenceDistrib(place);
    presenceResults = presenceResults.filter(([presence, ip, port]) => presence === true);
    if (presenceResults.length === 0) {
      throw new Error('[Error] The directory to be operated on does not exist.');
    } else if (presenceResults.length === 1) {
      const [presenceResult] = presenceResults;
      const [_, ip, port] = presenceResult;
      return [ip, port];
    } else {
      throw new Error('[Error] Multiple files directory please chk system data is correct.')
    }
  }

  async treatAvailableDistrib(place) {
    const availableResults = await this.availableDistrib(place);
    let max = -Infinity;
    const site = [];
    availableResults.forEach(([available, ip, port]) => {
      if (available > max) {
        site[0] = ip;
        site[1] = Number(port);
      }
    });
    return site;
  }

  async treatSitesDistrib() {
    const sites = [];
    const { method, params, } = this;
    switch (method) {
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
      case 'readData': {
        const [place] = params;
        site = await this.treatExistsDistrib(place);
        sites.push(site);
        break;
      }
      case 'diskOccupy': {
        const [place] = params;
        const site1 = await this.treatExistDistrib(place);
        const site2 = await this.treatPresenceDistrib(place);
        if (site1 <= site2) {
          site = site2;
        } else {
          site = site1;
        }
        sites.push(site);
        break;
      }
      case 'addBuffer': {
        const [place] = params;
        site = await this.treatAvailableDistrib(place);
        sites.push(site);
        break;
      }
      case 'link':
      case 'rename': {
        const [place1, place2] = params;
        site = await treatAvaibleDistrib(place);
        sites.push(site);
        const dontExist = await this.treatDontExistsDistrib(place2);
        if (dontExist !== true) {
          throw new Error('[Error] The path currently being operated on already exists.');
        }
        break;
      }
      case 'mkdir':
      case 'rmdir':
      case 'readdir': {
        const [diectory] = params;
        site = await this.treatPresenceDistrib(directory);
        storages.forEach(([ip, port]) => sites.push([ip, port]));
        const { ip, port, } = this;
        sites.push([ip, port]);
        break;
      }
      case 'cp': {
        const [directory1, directory] = params;
        site = await treatAvaibleDistrib(directory1);
        sites.push(site);
        const dontExist = await this.treatDontPresenceDistrib(directory2);
        if (dontExist !== true) {
          throw new Error('[Error] The path currently being operated on already exists.');
        }
        break;
      }
      case 'glob': {
        const { storages, } = this;
        storages.forEach(([ip, port]) => sites.push([ip, port]));
        const { ip, port, } = this;
        sites.push([ip, port]);
        break;
      }
    }
    return sites;
  }
}

export default DistribStorage;
