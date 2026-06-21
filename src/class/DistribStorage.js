import net from 'net';
import {
  ByteArray,
  getGTMNowString,
  getOwnIpAddresses,
  appendToLog,
} from 'manner.js/server';
import Storage from '~/class/Storage';

const nonZeroByteArray = new ByteArray({ size: 256n, shift: 1n, });

function getBinBuf(params) {
  if (!Array.isArray(params)) {
    throw new Error('[Error] The params parameter should be an array type.');
  }
  const { length, } = params;
  if (length <= 1) {
    throw new Error('[Error] The length of the params parameter should be greater than or equal to two');
  }
  const pbytes = [];
  params.forEach((param) => {
    switch (typeof param) {
      case 'boolean':
        switch (param) {
          case true:
            pbytes.push(Array.from(nonZeroByteArray.fromInt(1)));
            break;
          case false:
            pbytes.push(Array.from(nonZeroByteArray.fromInt(0)));
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
        pbytes.push(Array.from(nonZeroByteArray.fromInt(param)));
        break;
    }
    pbytes.push(0);
  });
  const buf = Buffer.from(pbytes.flat());
  return buf;
}

class DistribStorage extends Storage {
  constructor(options, port, allStorages) {
    super(options);
    this.dealParams(port, allStorages);
    this.switch = 0;
    this.status = 0;
    this.params = [];
    this.byteArray = new ByteArray({ size: 256n, shift: 0n, });
    this.outputDistribTopology();
    this.dealBuffer = this.dealBuffer.bind(this);
    this.checkMemory();
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

  getResponsePromises(callback) {
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
          const bigInt1 = nonZeroByteArray.toInt(segments.shift());
          const code = Number(bigInt1);
          let params;
          switch (code) {
            case 1:
            case 0:
              params = segments.map((segment, index) => {
                switch (index) {
                  case 0: {
                    const bigInt2 = nonZeroByteArray.toInt(segment);
                    switch (bigInt2) {
                      case 1n:
                        return true;
                      case 0n:
                        return false;
                    }
                    break;
                  }
                  case 2:
                    return nonZeroByteArray.toInt(segment);
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
                    return nonZeroByteArray.toInt(segment);
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
        if (storage.join(':') === location) {
          const [ip] = storage;
          this.ip = ip;
          flag = false;
          break;
        }
      }
      return flag;
    });
    this.storages = storages;
  }

  outputDistribTopology() {
    const {
      options: {
        debug,
        logLevel,
      },
      fulmination,
    } = this;
    if (logLevel !== 0) {
      const storages = this.getStorages()
      if (storages.length > 0) {
        const storageTopologys = '[' + storages.join(', ') + ']';
        const { ip, port, } = this;
        this.appendToLog(
          ' || ████ Ip:' + ip + ' ████ & ████ Port:' + port + ' ████ & ████ TOPOLOGY:' + storageTopologys + ' ████ ||\n',
        );
      }
    }
    if (debug === true) {
      const storages = this.getStorages();
      if (Array.isArray(storages) && storages.length > 0) {
        const storageFulminations = storages.map((storage) => {
          return '(+) bold; dim: "b' + storage + '" (+): * | (+): *';
        }).join(' ').concat(' &');
        fulmination.scanAll([
          [`
            (+) blue; bold: * "&"& (+) bold: * DistribStorage (+) bold; dim: * show distributed topology. &
            (+) blue; bold: ** └─ (+) : * | (+) : *
            `, 0],
          [storageFulminations, 0],
        ]);
        console.log(getGTMNowString() + '\n');
      }
    }
  }

  outputDistribOperate(operate, location) {
    const {
      options: {
        logLevel,
        debug,
      },
    } = this;
    if (logLevel !== 0) {
      this.appendToLog(
        ' || ████ Location:' + location + ' ████ & ████ OPERATE:' + operate + ' ████ ||\n',
      );
    }
    if (debug === true) {
      this.debugDetail(`
        (+) bold; blue: * "&"& (+) green; bold: * Location (+) bold; dim: * ` + location + `. &
        (+) bold; blue: ** └─ (+): * | (+) bold: * operate (+) dim: : * ` + operate + `(+): * | &
      `);
    }
  }

  outputDistribOperateError(operate, locations, error) {
    const {
      options: {
        logLevel,
        debug,
      },
    } = this;
    if (logLevel !== 0) {
      locations.forEach((location) => {
        this.appendToLog(
          ' || ████ Location:' + location + ' ████ & ████ OPERATE:' + operate + ' ████ ||\n',
        );
      });
      this.addToLog(error.stack + '\n');
    }
    if (debug === true) {
      locations.forEach((location) => {
        this.debugDetail(`
          (+) bold; red: * !! (+) green; bold: * Location (+) bold; dim: * ` + location + `. &
          (+) bold; red: ** └─ (+): * | (+) bold: * operate (+) dim: : * ` + operate + `(+): * | &
        `);
      })
    }
    throw error;
  }

  outputDistribFunction(operate) {
    const {
      options: {
        logLevel,
        debug,
      },
    } = this;
    if (logLevel !== 0) {
      const { ip, port, } = this;
      this.appendToLog(
        ' || ████ Ip:' + ip + ' ████ & ████ Port:' + port +  ' ████ & ████ OPEARATE:' + operate + ' ████ ||\n',
      );
    }
    if (debug === true) {
      const { ip, port, } = this;
      this.debugDetail(`
        (+) bold; blue: * "&"& (+) green; bold: * Ip (+) bold; dim: * ` + ip + ` (+) green; bold: * Port (+) bold; dim: * ` + port + ` . &
        (+) bold; blue: ** └─ (+): * | (+) bold: * operate (+) dim: : * ` + operate + `(+): * | &
      `);
    }
  }

  outputDistribFunctionError(operate, error) {
    const {
      options: {
        logLevel,
        debug,
      },
    } = this;
    if (logLevel !== 0) {
      const { ip, port, } = this;
      this.appendToLog(
        ' || ████ Ip:' + ip + ' ████ & ████ Port:' + port +  ' ████ & ████ OPEARATE:' + operate + ' ████ ||\n',
      );
      this.addToLog(error.stack);
    }
    if (debug === true) {
      const { ip, port, } = this;
      this.debugDetail(`
        (+) bold; red: * !! (+) green; bold: * Ip (+) bold; dim: * ` + ip + ` (+) green; bold: * Port (+) bold; dim: * ` + port + ` . &
        (+) bold; red: ** └─ (+): * | (+) bold: * operate (+) dim: : * ` + operate + `(+): * | &
      `);
    }
    throw error;
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
      this.outputDistribFunction('close server');
    } catch (error) {
      this.outputDistribFunctionError('close server', error);
    }
  }

  closeClients() {
    try {
      this.getClients().forEach((client) => {
        client.destroySoon();
      });
      this.outputDistribFunction('close client');
    } catch (error) {
      this.outputDistribFunctionError('close client', error);
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
      this.outputDistribFunction('close connection');
    } catch (error) {
      this.outputDistribFunctionError('close connection', error);
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
      let count = 0;
      this.connections = [];
      this.server = await new Promise((resolve, reject) => {
        const server = net.createServer((connection) => {
          count += 1;
          if (count === length) {
            resolve(server);
          } else if (count < length) {
            connection.on('data', (buf) => {
              this.dealConnectionBuf(buf, connection);
            });
            this.connections.push(connection);
          } else {
            this.addRequest(connection);
          }
        });
        const { port, } = this;
        server.on('error', (error) => {
          throw error;
        });
        server.listen(port);
      });
      const { server, } = this;
      this.outputDistribFunction('setup client');
      this.checkMemory();
      return server;
    } catch (error) {
      this.outputDistribFunctionError('setup client', error);
    }
  }

  dealRequestBuffer(buf) {
    const { status, byteArray, } = this;
    switch (status) {
      case 0:
        this.type = byteArray.toInt(buf);
        this.status = 1;
        break;
      case 1: {
        const { type, } = this;
        switch (type) {
          case 0n: {
            const string = buf.toString();
            this.params.push(string);
            break;
          }
          case 1n: {
            const object = JSON.parse(buf.toString());
            this.params.push(object);
            break;
          }
          case 2n: {
            const int = Number(byteArray.toInt(buf));
            this.params.push(int);
            break;
          }
          case 3n: {
            const buffer = buf;
            this.params.push(buffer);
            break;
          }
        }
        this.status = 0;
        break;
      }
    }
  }

  async dealDistribBuffer(buf) {
    this.method = buf.toString();
    const sites = await this.treatSitesDistrib();
    return sites;
  }

  async dealBuffer(buf) {
    const { length, } = buf;
    switch (length) {
      case 7:
        if (buf.toString() === 'distrib') {
          this.switch = 1;
        }
        break;
      case 3:
        if (buf.toString() === 'end') {
          this.switch = 0;
        }
        break;
      case 6:
        if (buf.toString() === 'single') {
          this.switch = 2;
        }
        break;
    }
    const { switch, } = this;
    switch (switch) {
      case 0: {
        this.dealRequestBuffer(buf);
        const { method, params, } = this;
        if (method !== '') {
          switch (method) {
            case 'realpath': {
              const string = await this[method](...params);
              connection.send(Buffer.from(string));
              break;
            }
            case 'readData':
            case 'readBufferPiece': {
              const buffer = await this[method](...params);
              connection.send(buffer);
              break;
            }
            case 'stats': {
              const stats = await this[method](...params);
              const jsonString = JSON.string(stats);
              connection.send(Buffer.from(jsonString));
              break;
            }
            case 'diskOccupy': {
              const int = await this[method](...params);
              connection.send(byteArray.fromInt(int));
              break;
            }
            case 'access':
              try {
                await this[method](...params);
                connection.send(byteArray.fromInt(1));
              } catch (error) {
                connection.send(byteArray.fromInt(0));
              }
              break;
            default:
              await this[method](...params);
          }
        }
        this.status = 0;
        this.params = [];
        this.method = '';
        this.switch = 0;
        connection.destorySoon();
        break;
      }
      case 1: {
        const sites = await this.dealDistribBuffer(buf);
        const string = JSON.stringify(sites);
        connection.send(Buffer.from(string));
        break;
      }
      case 2:
        this.dealRequestBuffer(buf);
        break;
    }
  }

  addRequest(connection) {
    connection.on('data', this.dealBuffer);
    connection.on('close', () => {
      this.requests.filter((request) => connection !== request);
    });
    connection.on('error', () => {
      this.requests.filter((request) => connection !== request);
    });
    this.requests.push(connection);
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
      this.outputDistribFunction('setup client');
      this.checkMemory();
      return clients;
    } catch (error) {
      this.outputDistribFunctionError('setup client');
    }
  }

  dealConnectionBuf(buf, connection) {
    const segments = [];
    let s = 0;
    for (let i = 0; i < buf.length; i += 1) {
      if (buf[i] === 0) {
        segments.push(buf.slice(s, i));
        s = i + 1;
      }
    }
    const bigInt1 = nonZeroByteArray.toInt(segments.shift());
    const code = Number(bigInt1);
    switch (code) {
      case 0: {
        const exists = await this.exists();
        connection.write(getBinBuf([0, exists, ip, port]));
        break;
      }
      case 1: {
        const available = await this.getAvailable();
        connection.write(getBinBuf([1, available, ip, port]));
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
    this.outputDistribTopology();
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
    this.checkMemory();
    this.outputDistribTopology();
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
        client.write(getBinBuf([0]));
      });
      const existMessages = await Promise.all(responsePromises);
      return existMessages;
      this.outputDistribOperate('existDistrib', location);
    } catch (error) {
      this.outputDistribOperateError('existDistrib', [locaiton]);
    }
  }

  async availableDistrib(place) {
    try {
      this.checkCombine();
      const available = await this.available(place);
      const responsePromises = this.getResponsePromises((client) => {
        client.write(getBinBuf([1]));
      });
      const availableMessages = await Promise.all(repsonsePromises);
      return availableMessages;
      this.outputDistribOperate('getAvailableDistrib', location);
    } catch (error) {
      this.outputDistribOperateError('getAvailableDistrib', [locaiton]);
    }
  }

  async presenceDistrib(place) {
    try {
      this.checkCombine();
      const presence = await this.presence(place);
      const responsePromises = this.getResponsePromises((client) => {
        client.write(getBinBuf([2]));
      });
      const existMessages = await Promise.all(responsePromises);
      return existMessages;
      this.outputDistribOperate('presenceDistrib', location);
    } catch (error) {
      this.outputDistribOperateError('presenceDistrib', [locaiton]);
    }
  }

  async checkDontExistsDistrib(place) {
    const existsResults = await existsDistrib(place);
    return existsResults.every(([exists, ip, port]) => exists === false);
  }

  async checkDontPresenceDistrib(place) {
    const presenceResults = await presencejDistrib(place);
    return presenceResults.every(([exists, ip, port]) => presence === false);
  }

  async treatExistsDistrib(place) {
    const existsResults = await existsDistrib(place);
    const existsResults = existsResults.filter(([exists, ip, port]) => exist === true);
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
    const presenceResults = await presenceDistrib(place);
    const presenceResults = presenceResults.filter(([presence, ip, port]) => presence === true);
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

  async treatAvailableDistrib(place, options) {
    const availableResults = await avaiableDistrib();
    let max = -Infinity;
    const site = [];
    availableResults.forEach(([available, ip, port]) => {
      if (available > max) {
        site[0] = ip;
        site[1] = port;
      }
    });
    return ans;
  }

  async treatSitesDistrib(method, params) {
    const sites;
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
      case 'diskOccupy':
      case 'readData': {
        const [place] = params;
        site = await treatExistsDistrib(place);
        sites.push(site);
        break;
      }
      case 'addBuffer': {
        const [place] = params;
        site = await treatAvaibleDistrib(place);
        sites.push(site);
        break;
      }
      case 'link':
      case 'rename': {
        const [place1, place2] = params;
        site = await treatAvaibleDistrib(place);
        sites.push(site);
        const dontExist = await treatDontExistsDistrib(place2);
        if (dontExist !== true) {
          throw new Error('[Error] The path currently being operated on already exists.');
        }
        break;
      }
      case 'rmdir':
      case 'readdir': {
        const [diectory] = params;
        site = await treatPresenceDistrib(directory);
        sites.push(site);
        break;
      }
      case 'mkdir': {
        const [place] = params;
        site = await treatPresenceDistrib(directory);
        sites.push(site);
        break;
      }
      case 'cp': {
        const [directory1, directory] = params;
        site = await treatAvaibleDistrib(directory1);
        sites.push(site);
        const dontExist = await treatDontPresenceDistrib(directory2);
        if (dontExist !== true) {
          throw new Error('[Error] The path currently being operated on already exists.');
        }
        break;
      }
      case 'glob': {
        const { storages, } = this;
        storages.forEach(([ip, port] => sites.push[ip, port]));
        const { ip, port, } = this;
        sites.push([ip, port]);
        break;
      }
    }
  }
}

export default DistribStorage;
