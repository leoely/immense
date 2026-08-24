import EventEmitter from 'events';
import net from 'net';
import {
  logUncaughtException,
  ByteArray,
  getGTMNowString,
  getOwnIpAddresses,
  getAddress,
  appendToLog,
} from 'manner.js/server';
import Storage from '~/class/Storage';
import ParameterError from '~/class/ParameterError';

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

const bindedEventKey = Symbol('bindedEvent');

class DistribStorage extends Storage {
  constructor(location, options, port, allStorages) {
    super(location, options);
    this.dealParams(port, allStorages);
    this.count = 0;
    this.size = -1;
    this.state = 0;
    this.status = 0;
    this.params = [];
    this.count = 0;
    this.byteArray = new ByteArray({ size: 256n, shift: 0n, });
    this.shiftOneByteArray = new ByteArray({ size: 256n, shift: 1n, });
    this.eventEmitter = new EventEmitter();
    this.dealRequestBuffer = this.dealRequestBuffer.bind(this);
    this.dealReceiveBuffer = this.dealReceiveBuffer.bind(this);
    this.dealReceiveAndSendBuffer = this.dealReceiveAndSendBuffer.bind(this);
    this.bindEvent();
  }

  static async combine(distribStorages) {
    if (!Array.isArray(distribStorages)) {
      throw new Error('[Error] The parameter distribStorages should be of array type.');
    }
    const startPromises = distribStorages.map((distribStorage) => {
      return distribStorage.start();
    });
    await Promise.all(startPromises);
  }

  static async join(newDistribStorages, originDistribStorages, allStorages) {
    originDistribStorages.forEach((originDistribStorage) => {
      originDistribStorage.setAllStorages(allStorages);
    });
    distribStorages = originDistribStorages.concat(newDistribStorages);
    distribStorages.forEach((distribStorage, index) => {
      distribStoragee.index = index;
    });
    await DistribStorage.combine(newDistribStorages);
  }

  static async release(distribStorages) {
    if (!Array.isArray(distribStorages)) {
      throw new Error('[Error] The parameter distribStorages should be of array type.');
    }
    distribStorages.forEach((distribStorage) => {
      distribStorage.closeClients();
      delete distribStorage.clients;
    });
    distribStorages.forEach((distribStorage) => {
      distribStorage.closeConnections();
      delete distribStorage.connections;
    });
    for (let i = 0; i < distribStorages.length; i += 1) {
      const distribStorage = distribStorages[i];
      await distribStorage.closeServer();
      delete distribStorage.server;
    }
  }

  bindEvent() {
    const {
      options: {
        logPath,
      },
    } = this;
    if (process[bindedEventKey] !== true) {
      process.once('uncaughtException', async (error, origin) => {
        await this.close();
        logUncaughtException(logPath, error);
        throw error;
      });
      process.once('exit', async (code) => {
        await this.close();
      });
      process[bindedEventKey] = true;
    }
  }

  async close() {
    try {
      const { ip, port, } = this;
      await this.removeStorageDistrib([ip, port]);
      this.closeClients();
      delete this.clients;
      this.closeConnections();
      delete this.connections;
      this.closeServer();
      delete this.server;
    } catch (error) {
    }
  }

  async start() {
    try {
      const serverPromise = this.setUpServer();
      const clientsPromise = this.setUpClients();
      await Promise.all([serverPromise, clientsPromise]);
      this.setUpSockets(true);
      const {
        notice,
        global,
      } = this;
      const callback = notice.gain('add>storage');
      if (typeof callback === 'function') {
        if (global !== undefined) {
          callback(global, ip, port);
        }
      }
      this.checkMemory();
    } catch (error) {
    }
  }

  getBinBuf(params) {
    if (!Array.isArray(params)) {
      throw new Error('[Error] The params parameter should be an array type.');
    }
    const { length, } = params;
    if (length !== 1 && length !== 2 && length !== 4) {
      throw new Error('[Error] The length of the params parameter should be equal to one,two or four.');
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
            throw new Error('[Error] If the param type is a number, it should be an integer.');
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
    const { eventEmitter, } = this;
    return this.getSockets().map((socket) => {
      return new Promise((resolve, reject) => {
        callback(socket);
        eventEmitter.once('data:receive', (buf) => {
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
                    return Number(shiftOneByteArray.toInt(segment));
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
                    return Number(shiftOneByteArray.toInt(segment));
                  default:
                    return segment.toString();
                }
              });
              break;
            case 3:
              params = segments.map((segment, index) => {
                switch (index) {
                  case 1:
                    return Number(shiftOneByteArray.toInt(segment));
                  case 0:
                    return segment.toString();
                }
              });
              break;
            case 4:
              params = segments.map((segment, index) => {
                switch (index) {
                  case 0:
                    return segment.toString();
                  case 1:
                    return new Function('return ' + segment.toString())();
                }
              });
              break;
          }
          resolve(params);
        });
      });
    });
  }

  setAllStorages(allStroages) {
    if (Array.isArray(allStoragees) !== true) {
      throw new Error('[Error] The parameter all Storages should be array type.');
    }
    const { port, } = this;
    const ipAddresses = getOwnIpAddresses();
    const locations = [];
    ipAddresses.forEach((ipAddress) => {
      const { ipv4, ipv6, } = ipAddress;
      locations.push(getAddress(ipv4, port));
      locations.push(getAddress(ipv6, port));
    });
    const hash = {};
    allStorages = allStorages.map((storage, index) => {
      const [ip, port] = storage;
      return [ip, port, index];
    });
    const storages = allStorages.filter((storage, index) => {
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
        if (getAddress(ip, port) === location) {
          const [ip] = storage;
          this.index = index;
          this.ip = ip;
          flag = false;
          break;
        }
      }
      return flag;
    });
    const { ip, } = this;
    this.address = getAddress(ip, this.port);
    this.storages = storages;
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
      locations.push(getAddress(ipv4, port));
      locations.push(getAddress(ipv6, port));
    });
    const hash = {};
    allStorages = allStorages.map((storage, index) => {
      const [ip, port] = storage;
      return [ip, port, index];
    });
    const storages = allStorages.filter((storage, index) => {
      const [_, port] = storage;
      if (hash[port] === undefined) {
        hash[port] = true;
      } else {
        throw new Error('[Error] A port can only be bound to one storage.');
      }
      let flag = true;
      for (let i = 0; i< locations.length ; i += 1) {
        const location = locations[i];
        const [ip] = storage;
        if (getAddress(ip, port) === location) {
          const [ip] = storage;
          this.index = index;
          this.ip = ip;
          flag = false;
          break;
        }
      }
      return flag;
    });
    const { ip, } = this;
    this.address = getAddress(ip, this.port);
    this.storages = storages;
  }

  getStorages() {
    const { storages, } = this;
    if (!Array.isArray(storages)) {
      throw new Error('[Error] The current internal storage state is abnormal.');
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

  getSockets() {
    this.checkCombine();
    return this.sockets;
  }

  dealReceiveAndSendBuffer(buffer, socket) {
    const flag = buffer[0];
    const {
      length,
    } = buffer;
    buffer = buffer.subarray(1, length);
    switch (flag) {
      case 0: {
        const {
          eventEmitter,
        } = this;
        eventEmitter.emit('data:receive', buffer);
        break;
      }
      case 1:
        this.dealReceiveBuffer(buffer, socket);
        break;
      case 2:
        this.dealRequestBuffer(buffer, socket);
        break;
    }
  }

  getRestBuffer(buffer) {
    const { length, } = buffer;
    const { size, } = this;
    return buffer.subarray(size, length);
  }

  dealRedirectBuffer(buffer, socket) {
    const { status, byteArray, shiftOneByteArray, } = this;
    switch (status) {
      case 0: {
        const index = buffer.indexOf(0);
        this.method = buffer.subarray(0, index + 1).toString();
        const { method, } = this;
        this.method = method.substring(0, method.length - 1);
        const { length, } = buffer;
        this.status = 1;
        this.dealRedirectBuffer(buffer.subarray(index + 1, length), socket);
        break;
      }
      case 1: {
        if (buffer.toString() === 'end') {
          this.state = 1;
          this.dealRequestBuffer(buffer, socket);
          break;
        }
        this.type = shiftOneByteArray.toInt(buffer.subarray(0, 1));
        let { length, } = buffer;
        buffer = buffer.subarray(1, length);
        const index = buffer.indexOf(0);
        this.size = Number(shiftOneByteArray.toInt(buffer.subarray(0, index)));
        length = buffer.length;
        buffer = buffer.subarray(index + 1, length);
        this.status = 2;
        this.dealRedirectBuffer(buffer, socket);
        break;
      }
      case 2: {
        const { size, type, } = this;
        switch (type) {
          case 0n: {
            const { size, } = this;
            const string = buffer.subarray(0, size).toString();
            this.params.push(string);
            this.status = 1;
            this.dealRedirectBuffer(this.getRestBuffer(buffer), socket);
            break;
          }
          case 1n: {
            const { size, } = this;
            const json = buffer.subarray(0, size).toString();
            const { length, } = buffer;
            const object = JSON.parse(json);
            this.params.push(object);
            this.status = 1;
            this.dealRedirectBuffer(this.getRestBuffer(buffer), socket);
            break;
          }
          case 2n: {
            const { size, } = this;
            const int = Number(byteArray.toInt(buffer.subarray(0, size)));
            const { length, } = buffer;
            this.params.push(int);
            this.status = 1;
            this.dealRedirectBuffer(this.getRestBuffer(buffer), socket);
            break;
          }
          case 3n: {
            const { size, } = this;
            const bigInt = byteArray.toInt(buffer.subarray(0, size));
            const { length, } = buffer;
            this.params.push(bigInt);
            this.status = 1;
            this.dealRedirectBuffer(this.getRestBuffer(buffer), socket);
            break;
          }
          case 4n: {
            const { size, } = this;
            const restBuffer = buffer.subarray(0, size);
            const { length, } = restBuffer;
            this.params.push(restBuffer);
            this.status = 1;
            this.dealRedirectBuffer(this.getRestBuffer(buffer), socket);
            break;
          }
        }
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

  async dealError(socket, callback) {
    callback.bind(this);
    try {
      data = await callback();
      socket.write(Buffer.from([1]));
      socket.write(data);
    } catch (error) {
      const {
        options: {
          develop,
        },
      } = this;
      if (develop === true) {
        throw error;
      } else {
        socket.write(Buffer.from([0]));
        socket.write(error.message);
      }
    }
  }

  async dealRequestBuffer(buffer, socket) {
    const { state, } = this;
    switch (state) {
      case 0: {
        if (buffer.subarray(0, 7).toString() === 'distrib') {
          const { length, } = buffer;
          buffer = buffer.subarray(7, length);
          this.state = 2;
          await this.dealRequestBuffer(buffer, socket);
        } else if (buffer.subarray(0, 8).toString() === 'redirect') {
          const { length, } = buffer;
          buffer = buffer.subarray(8, length);
          this.state = 3;
          await this.dealRequestBuffer(buffer, socket);
        }
        break;
      }
      case 1: {
        let { method, params, } = this;
        if (method !== '') {
          const { length, } = method;
          switch (method) {
            case 'realpath': {
              await this.dealError(socket, async () => {
                return await this[method](...params);
              });
              break;
            }
            case 'readData':
            case 'readBufferPiece': {
              await this.dealError(socket, async () => {
                return await this[method](...params);
              });
              break;
            }
            case 'glob':
            case 'readdir': {
              await this.dealError(socket, async () => {
                const array = await this[method](...params);
                return JSON.stringify(array);
              });
              break;
            }
            case 'stats': {
              await this.dealError(socket, async () => {
                const stats = await this[method](...params);
                return JSON.stringify(stats, (key, value) => {
                  return typeof value === 'bigint' ? Number(value) : value;
                });
              });
              break;
            }
            case 'diskOccupy': {
              const { byteArray, } = this;
              await this.dealError(socket, async () => {
                const bigInt = await this[method](...params);
                return Buffer.from(byteArray.fromInt(bigInt));
              });
              break;
            }
            case 'access':
              try {
                const { byteArray, } = this;
                await this[method](...params);
                socket.write(Buffer.from([1]));
                socket.write(Buffer.from(byteArray.fromInt(1)));
              } catch (error) {
                const {
                  options: {
                    develop,
                  }
                } = this;
                if (develop === true) {
                  throw error;
                } else {
                  if (error instanceof ParameterError) {
                    socket.write(Buffer.from([0]));
                    socket.write(error.message);
                  } else {
                    socket.write(Buffer.from([1]));
                    socket.write(byteArray.fromInt(0));
                  }
                }
              }
              break;
            default:
              try {
                await this[method](...params);
                socket.write(Buffer.from([1]));
                socket.write('u');
              } catch (error) {
                const {
                  options: {
                    develop,
                  },
                } = this;
                if (develop === true) {
                  throw error;
                } else {
                  socket.write(Buffer.from([0]));
                  socket.write(error.message);
                }
              }
          }
        }
        this.resetAllStatus();
        break;
      }
      case 2: {
        try {
          const sites = await this.dealDistribBuffer(buffer, socket);
          socket.write(JSON.stringify([1, sites]));
        } catch (error) {
          const {
            options: {
              develop,
            },
          } = this;
          if (develop === true) {
            throw error;
          } else {
            socket.write(JSON.stringify([0, error.message]));
          }
        }
        this.resetMethodStatus();
        break;
      }
      case 3:
        this.status = 0;
        this.dealRedirectBuffer(buffer, socket);
        break;
    }
  }

  resetAllStatus() {
    this.status = 0;
    this.type = '';
    this.resetMethodStatus();
  }

  resetMethodStatus() {
    this.method = '';
    this.state = 0;
    this.params = [];
    this.count -= 1;
  }

  async setUpServer() {
    try {
      const {
        storages: {
          length,
        },
      } = this;
      this.connections = [];
      const { index, } = this;
      if (length - index === 0) {
        this.server = net.createServer((connection) => {
          this.count += 1;
          const { count, } = this;
          if (count <= length - index) {
            this.connections.push(connection);
            connection.on('close', () => {
              this.removeConnection(connection);
            });
          } else {
            connection.on('data', (buffer) => {
              this.dealReceiveAndSendBuffer(buffer, connection);
            });
            connection.on('error', (error) => {
              console.log(error.stack);
            });
            this.setUpSockets(false);
          }
        });
        const { server, } = this;
        server.on('error', (error) => {
          throw error;
        });
        const { port, } = this;
        server.listen(port);
      } else {
        this.server = await new Promise((resolve, reject) => {
          const server = net.createServer((connection) => {
            this.count += 1;
            connection.on('close', () => {
              this.removeConnection(connection);
            });
            const { count, } = this;
            if (count < length - index) {
              this.connections.push(connection);
            } else if (count === length - index) {
              this.connections.push(connection);
              resolve(server);
            } else if (count > length - index) {
              connection.on('data', (buffer) => {
                this.dealReceiveAndSendBuffer(buffer, connection);
              });
              connection.on('error', (error) => {
                console.log(error.stack);
              });
              this.setUpSockets(false);
            }
          });
          const { port, } = this;
          server.on('error', (error) => {
            throw error;
          });
          server.listen(port);
        });
      }
    } catch (error) {
    }
  }

  async setUpClients() {
    try {
      const { storages, index, } = this;
      const clientPromises = [];
      storages.map((storage) => {
        const [_1, _2, i] = storage;
        if (index > i && i >= 0) {
          const [ip, port] = storage;
          const clientPromise = new Promise((resolve, reject) => {
            const client = net.createConnection(port, ip, () => {
              client.ip = ip;
              client.port = port;
              resolve(client);
            });
            client.on('close', () => {
              const { ip, port, } = client;
              this.removeClient(client);
            });
          });
          clientPromises.push(clientPromise);
        }
      });
      this.clients = await Promise.all(clientPromises);
    } catch (error) {
    }
  }

  setUpSockets(bind) {
    if (typeof bind !== 'boolean') {
      throw new Error('[Error] The parameter bind should be boolean type.');
    }
    try {
      const { clients, connections, } = this;
      this.sockets = clients.concat(connections);
      if (bind === true) {
        const { sockets, } = this;
        sockets.forEach((socket) => {
          socket.on('data', (buffer) => {
            this.dealReceiveAndSendBuffer(buffer, socket);
          });
          socket.on('error', (error) => {
            console.log(error.stack);
          });
        })
      }
    } catch (error) {
    }
  }

  async dealReceiveBuffer(buffer, socket) {
    const segments = [];
    let s = 0;
    for (let i = 0; i < buffer.length; i += 1) {
      if (buffer[i] === 0) {
        segments.push(buffer.slice(s, i));
        s = i + 1;
      }
    }
    const { shiftOneByteArray, } = this;
    const bigInt1 = shiftOneByteArray.toInt(segments.shift());
    const code = Number(bigInt1);
    let params;
    switch (code) {
      case 1:
        params = [];
        break;
      case 0:
      case 2:
        params = segments.map((segment, index) => {
          switch (index) {
            case 0:
              return segment.toString();
          }
        });
      case 3:
        params = segments.map((segment, index) => {
          switch (index) {
            case 0:
              return segment.toString();
            case 1:
              return shiftOneByteArray.toInt(segment);
          }
        });
        break;
    }
    const { ip, port, } = this;
    switch (code) {
      case 0: {
        if (params.length !== 1) {
          throw new Error('[Error] The parameters length should be equal to one.');
        }
        const place = params[0];
        const exists = await this.exists(place);
        socket.write(addDataFlag(0, this.getBinBuf([0, exists, ip, port])));
        break;
      }
      case 1: {
        if (params.length !== 0) {
          throw new Error('[Error] The parameters length should be equal to zero.');
        }
        const available = await this.available();
        socket.write(addDataFlag(0, this.getBinBuf([1, available, ip, port])));
        break;
      }
      case 2: {
        if (params.length !== 1) {
          throw new Error('[Error] The parameters length should be equal to one.');
        }
        const place = params[0];
        const presence = await this.presence(place);
        socket.write(addDataFlag(0, this.getBinBuf([2, presence, ip, port])));
        break;
      }
      case 3: {
        if (params.length !== 2) {
          throw new Error('[Error] The parameters length should be equal to two.');
        }
        const storage = params;
        await this.removeStorage(storage);
        socket.write(addDataFlag(0, this.getBinBuf([2, 'ack'])));
      }
      case 4: {
        if (params.length !== 2) {
          throw new Error('[Error] The parameter length should be equal to two.');
        }
        const [phrase, callback] = params;
        this.addSystemNotice(phrase, callback);
        socket.write(addBufferFlag(0, Buffer.from('ack')));
        break;
      }
      default:
        throw new Error('[Error] The code value should be in the range [0, 1]');
    }
  }

  removeClient(client) {
    try {
      const { clients, } = this;
      if (clients !== undefined) {
        for (let i = 0; i < clients.length; i += 1) {
          const currentClient = clients[i];
          if (client === currentClient) {
            clients.splice(i, 1);
            currentClient.destroySoon();
            this.setUpSockets(false);
            break;
          }
        }
      }
    } catch (error) {
    }
  }

  removeConnection(connection) {
    try {
      const { connections, } = this;
      if (connections !== undefined) {
        for (let i = 0; i < clients.length; i += 1) {
          const currentConneciton = connections[i];
          if (connection === connections[i]) {
            connections.splice(i, 1);
            currentConnection.destroySoon();
            this.setUpSockets(false);
            break;
          }
        }
      }
    } catch (error) {
    }
  }

  removeStorage([ip, port]) {
    const { storages, } = this;
    this.storages = storages.filter(([rIp, rPort]) => {
      if (rIp === ip && rPort === port) {
        return false;
      } else {
        return true;
      }
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
      const responsePromises = this.getResponsePromises((socket) => {
        socket.write(addDataFlag(1, this.getBinBuf([0, place])));
      });
      const existsMessages = await Promise.all(responsePromises);
      const { ip, port, } = this;
      existsMessages.push([exists, ip, port]);
      return existsMessages;
    } catch (error) {
      throw error;
    }
  }

  async availableDistrib() {
    try {
      this.checkCombine();
      const available = await this.available();
      const responsePromises = this.getResponsePromises((socket) => {
        socket.write(addDataFlag(1, this.getBinBuf([1])));
      });
      const availableMessages = await Promise.all(responsePromises);
      const { ip, port, } = this;
      availableMessages.push([available, ip, port]);
      return availableMessages;
    } catch (error) {
      throw error;
    }
  }

  async presenceDistrib(place) {
    try {
      this.checkCombine();
      const presence = await this.presence(place);
      const responsePromises = this.getResponsePromises((socket) => {
        socket.write(addDataFlag(1, this.getBinBuf([2, place])));
      });
      const presenceMessages = await Promise.all(responsePromises);
      const { ip, port, } = this;
      presenceMessages.push([presence, ip, port]);
      return presenceMessages;
    } catch (error) {
      throw error;
    }
  }

  async removeStorageDistrib(storage) {
    try {
      this.checkCombine();
      this.removeStorage(storage);
      const [ip, port] = storage;
      const {
        notice,
        global,
      } = this;
      const callback = notice.gain('rm>table');
      if (typeof callback === 'function') {
        if (global !== undefined) {
          callback(global, ip, port);
        }
      }
      const repsonsePromises = this.getResponsePromises((socket) => {
        socket.write(addDataFlag(1, getBinBuf([3, ip, port])));
      });
      const ackMessages = await Promise.all(responsePromises);
      ackMessages.forEach((ackMessage) => {
        if (ackMessage !== 'ack') {
          throw new Error('The deletion of storage was not completely successful.');
        }
      });
    } catch (error) {
    }
  }

  async addSystemNoticeDistrib(phrase, callback) {
    try {
      this.checkCombine();
      this.addSystemNotice(phrase, callback);
      const ackPromises = this.getAckPromises((socket) => {
        socket.write(addBufferFlag(1, getBinBuf([4, phrase, callback.toString()])));
      });
      await Promise.all(ackPromises);
      this.outputDistribFunction('addSystemNotice distrib');
    } catch (error) {
      this.outputDistribFunctionError('addSystemNotice distrib', error);
    }
  }

  async treatDontExistsDistrib(place) {
    const existsResults = await this.existsDistrib(place);
    return existsResults.every(([exists, ip, port]) => exists === false);
  }

  async treatDontPresenceDistrib(place) {
    const presenceResults = await this.presenceDistrib(place);
    return presenceResults.every(([presence, ip, port]) => presence === false);
  }

  async treatExistsDistrib(place, error) {
    let existsResults = await this.existsDistrib(place);
    existsResults = existsResults.filter(([exists, ip, port]) => exists === true);
    if (existsResults.length === 0) {
      if (error === true) {
        throw new Error('[Error] The file to be operated on does not exist.');
      }
    } else if (existsResults.length === 1) {
      const [existsResult] = existsResults;
      const [_, ip, port] = existsResult;
      return [ip, port];
    } else {
      if (error === true) {
        throw new Error('[Error] Multiple files exist please check system data is correct.')
      }
    }
  }

  async treatPresenceDistrib(place, error) {
    let presenceResults = await this.presenceDistrib(place);
    presenceResults = presenceResults.filter(([presence, ip, port]) => presence === true);
    if (presenceResults.length === 0) {
      if (error === true) {
        throw new Error('[Error] The directory to be operated on does not exist.');
      }
      return [];
    } else if (presenceResults.length >= 1) {
      return presenceResults.map(([_, ip, port]) => {
        return [ip, port];
      });
    }
  }

  async treatAvailableDistrib() {
    const availableResults = await this.availableDistrib();
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
    let sites = [];
    const { method, params, } = this;
    switch (method) {
      case 'exists': {
        const [place] = params;
        const site = await this.treatExistsDistrib(place, false);
        if (site !== undefined) {
          sites.push(site);
        }
        break;
      }
      case 'presence': {
        const [directory] = params;
        const sites1 = await this.treatPresenceDistrib(directory, false);
        if (sites1.length !== 0) {
          sites = sites.concat(sites1);
        }
        break;
      }
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
        const site = await this.treatExistsDistrib(place);
        sites.push(site);
        break;
      }
      case 'diskOccupy': {
        const [place] = params;
        const site = await this.treatExistsDistrib(place, false);
        const sites2 = await this.treatPresenceDistrib(place);
        const { length: length2, } = sites2;
        if (site === undefined) {
          sites = sites.concat(sites2);
        } else {
          sites.push(site);
        }
        break;
      }
      case 'mkdir':
      case 'addBuffer': {
        const [place] = params;
        const site = await this.treatAvailableDistrib();
        sites.push(site);
        break;
      }
      case 'link':
      case 'rename': {
        const [place1, place2] = params;
        const site = await this.treatExistsDistrib(place1);
        sites.push(site);
        const dontExists = await this.treatDontExistsDistrib(place2);
        if (dontExists !== true) {
          throw new Error('[Error] The path currently being operated on already exists.');
        }
        break;
      }
      case 'rmdir':
      case 'readdir': {
        const [directory] = params;
        const sites1 = await this.treatPresenceDistrib(directory);
        sites = sites1.concat(sites);
        break;
      }
      case 'cp': {
        const [path1, path2, options] = params;
        const site = await this.treatExistsDistrib(path1, false);
        if (site === undefined) {
          const sites1 = await this.treatPresenceDistrib(path1);
          sites = sites.concat(sites1);
          const dontExists = await this.treatDontPresenceDistrib(path2);
          if (dontExists !== true) {
            throw new Error('[Error] The directory currently being operated on already exists.');
          }
          const {
            recursive,
          } = options;
          if (recursive !== true) {
            throw new Error('[Error] To copy directory,need to set recursive to true.');
          }
        } else {
          sites.push(site);
          const dontExists = await this.treatDontExistsDistrib(path2);
          if (dontExists !== true) {
            throw new Error('[Error] The file currently being operated on already exists.');
          }
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
