import net from 'net';
import {
  getGTMNowString,
  getOwnIpAddresses,
  nonZeroByteArray,
  appendToLog,
} from 'manner.js/server';
import Storage from '~/class/Storage';

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
  constructor(options, port, allRouters) {
    super(options);
    this.dealParams(port, allRouters);
    this.outputDistribTopology();
    this.checkMemory();
  }

  static async combine(distribRouters) {
    if (!Array.isArray(distribRouters)) {
      throw new Error('[Error] The parameter distribRouters should be of array type.');
    }
    const serverPromises = distribRouters.map((distribRouter) => {
      return distribRouter.setUpServer();
    });
    const clientsPromises = distribRouters.map((distribRouter) => {
      return distribRouter.setUpClients();
    });
    await Promise.all(serverPromises.concat(clientsPromises));
  }

  static async join(newDistribRouters, originDistribRouters) {
    if (!Array.isArray(newDistribRouters)) {
      throw new Error('[Error] The new distributed routings should beo fo array type..');
    }
    if (!Array.isArray(originDistribRouters)) {
      throw new Error('[Error] The origin distributed routings should be of array type.');
    }
    const serverPromises = newDistribRouters.map((distribRouter) => {
      return distribRouter.setUpServer();
    });
    const clientsPromises = newDistribRouters.map((distribRouter) => {
      return distribRouter.setUpClients();
    });
    const addPromises = originDistribRouters.map((originDistribRouter) => {
      return newDistribRouters.map((newDistribRouter) => {
        const { ip, port, } = newDistribRouter;
        originDistribRouter.addRouter(ip, port);
      });
    }).flat();
    await Promise.all(serverPromises.concat(clientsPromises).concat(addPromises));
  }

  static async release(distribRouters) {
    if (!Array.isArray(distribRouters)) {
      throw new Error('[Error] The parameter distribRouters should be of array type.');
    }
    distribRouters.forEach((distribRouter) => {
      distribRouter.closeClients();
      delete distribRouter.clients;
    });
    for (let i = 0; i < distribRouters.length; i += 1) {
      const distribRouter = distribRouters[i];
      await distribRouter.closeServer();
      delete distribRouter.server;
    }
    distribRouters.forEach((distribRouter) => {
      distribRouter.closeConnections();
      delete distribRouter.connections;
    });
  }

  getAckPromises(callback) {
    if (typeof callback !== 'function') {
      throw new Error('[Error] Parameter callback should be a funciton type.');
    }
    return this.getClients().map((client) => {
      callback(client);
      return new Promise((resolve, reject) => {
        client.on('data', (buf) => {
          const data = buf.toString();
          switch (data) {
            case 'ack':
              resolve();
              break;
          }
        });
      });
    });
  }

  dealParams(port, allRouters) {
    if (Number.isInteger(port) !== true) {
      throw new Error('[Error] The parameter port should be of integer type.');
    }
    if (!(port >= 0)) {
      throw new Error('[Error] Parameter id needs to be a postive integer.');
    }
    this.port = port
    if (Array.isArray(allRouters) !== true) {
      throw new Error('[Error] The parameter all routers should be array type.');
    }
    const ipAddresses = getOwnIpAddresses();
    const locations = [];
    ipAddresses.forEach((ipAddress) => {
      const { ipv4, ipv6, } = ipAddress;
      locations.push(ipv4 + ':' + port);
      locations.push('[' + ipv6 + ']:' + port);
    });
    const hash = {};
    const routers = allRouters.filter((router) => {
      const [_, port] = router;
      if (hash[port] === undefined) {
        hash[port] = true;
      } else {
        throw new Error('[Error] A port can only be bound to one router');
      }
      let flag = true;
      for (let i = 0; i< locations.length ; i += 1) {
        const location = locations[i];
        if (router.join(':') === location) {
          const [ip] = router;
          this.ip = ip;
          flag = false;
          break;
        }
      }
      return flag;
    });
    this.routers = routers;
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
      const routers = this.getRouters()
      if (routers.length > 0) {
        const routerTopologys = '[' + routers.join(', ') + ']';
        const { ip, port, } = this;
        this.appendToLog(
          ' || ████ Ip:' + ip + ' ████ & ████ Port:' + port + ' ████ & ████ TOPOLOGY:' + routerTopologys + ' ████ ||\n',
        );
      }
    }
    if (debug === true) {
      const routers = this.getRouters();
      if (Array.isArray(routers) && routers.length > 0) {
        const routerFulminations = routers.map((router) => {
          return '(+) bold; dim: "b' + router + '" (+): * | (+): *';
        }).join(' ').concat(' &');
        fulmination.scanAll([
          [`
            (+) blue; bold: * "&"& (+) bold: * DistribRouter (+) bold; dim: * show distributed topology. &
            (+) blue; bold: ** └─ (+) : * | (+) : *
            `, 0],
          [routerFulminations, 0],
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

  getRouters() {
    const { routers, } = this;
    if (!Array.isArray(routers)) {
      throw new Error('[Error] The status of routers in distributed routing.');
    }
    return routers;
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
        routers: {
          length,
        },
      } = this;
      let count = 0;
      this.connections = [];
      this.server = await new Promise((resolve, reject) => {
        const server = net.createServer((connection) => {
          connection.on('data', (buf) => {
            this.dealConnectionBuf(buf, connection);
          });
          count += 1;
          this.connections.push(connection);
          if (count === length) {
            resolve(server);
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

  async setUpClients() {
    try {
      const { routers, } = this;
      const clientPromises = routers.map((router) => {
        const [ip, port] = router;
        return new Promise((resolve, reject) => {
          const client = net.createConnection(port, ip, () => {
            client.ip = ip;
            client.port = port;
            resolve(client);
          });
          client.on('close', () => {
            const { ip, port, } = client;
            this.removeRouter(ip, port);
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
    let params;
    switch (code) {
      case 0:
      case 4:
      case 5:
        params = segments.map((segment, index) => {
          switch (index) {
            case 0:
              return nonZeroByteArray.toInt(segment);
            default:
              return segment.toString();
          }
        });
        break;
      case 1:
      case 2:
      case 3:
        params = segments.map((segment, index) => {
          return segment.toString();
        });
        break;
    }
    switch (code) {
      case 0: {
        const [bigInt2, ...rests] = params;
        const type = Number(bigInt2);
        switch (type) {
          case 0: {
            if (rests.length !== 2) {
              throw new Error('[Error] The remaining parameter lengths do not match convertion.');
            }
            const [location, content] = rests;
            this.attach(location, JSON.parse(content));
            connection.write('ack');
            break;
          }
          case 1: {
            if (rests.length !== 2) {
              throw new Error('[Error] The remaining parameter lengths do not match convertion.');
            }
            const [location, content] = rests;
            this.attach(location, new Function(content));
            connection.write('ack');
            break;
          }
          default:
            throw new Error('[Error] Type values should be in the range [0, 1].');
        }
        break;
      }
      case 1: {
        if (params.length !== 2) {
          throw new Error('[Error] The parameter lengths do not match convertion.');
        }
        const [location1, location2] = params;
        this.exchange(location1, location2);
        connection.write('ack');
        break;
      }
      case 2: {
        if (params.length !== 1) {
          throw new Error('[Error] The parameters lengths do not match convertion.');
        }
        const [location] = params;
        this.ruin(location);
        connection.write('ack');
        break;
      }
      case 3:
        this.ruinAll(params);
        connection.write('ack');
        break;
      case 4: {
        const [bigInt2, ...rests] = params;
        const type = Number(bigInt2);
        switch (type) {
          case 0: {
            if (rests.length !== 2) {
              throw new Error('[Error] The remaining parameter lengths do not match convertion.');
            }
            const [location, content] = rests;
            this.replace(location, JSON.parse(content));
            connection.write('ack');
            break;
          }
          case 1: {
            if (rests.length !== 2) {
              throw new Error('[Error] The remaining parameter lengths do not match convertion.');
            }
            const [location, content] = rests;
            this.replace(location, new Function(content));
            connection.write('ack');
            break;
          }
          default:
            throw new Error('[Error] Type values should be in the range [0, 1].');
        }
        break;
      }
      case 5: {
        const [bigInt2, ...rests] = params;
        const type = Number(bigInt2);
        switch (type) {
          case 0: {
            if (rests.length !== 2) {
              throw new Error('[Error] The remaining parameter lengths do not match convertion.');
            }
            const [location, content] = rests;
            this.revise(location, JSON.parse(content));
            connection.write('ack');
            break;
          }
          case 1: {
            if (rests.length !== 2) {
              throw new Error('[Error] The remaining parameter lengths do not match convertion.');
            }
            const [location, content] = rests;
            this.revise(location, new Function(content));
            connection.write('ack');
            break;
          }
          default:
            throw new Error('[Error] Type values should be in the range [0, 1].');
        }
        break;
      }
      default:
        throw new Error('[Error] The code value should be in the range [0, 5]');
    }
  }

  removeRouter(ip, port) {
    const { routers, } = this;
    for (let i = 0; i < routers.length; i += 1) {
      const [routerIp, routerPort] = routers[i];
      if (routerIp === ip && routerPort === port) {
        routers.splice(i, 1);
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

  async addRouter(ip, port) {
    return new Promise((resolve, reject) => {
      const client = net.createConnection(port, ip, () => {
        client.ip = ip;
        client.port = port;
        resolve(client);
      });
      client.on('close', () => {
        const { ip, port, } = client;
        this.removeRouter(ip, port);
      });
      const { routers, clients, } = this;
      routers.push([ip, port]);
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

  async existsDistrib(location, content) {
    try {
      this.checkCombine();
      this.attach(location, content);
      switch (typeof content) {
        case 'function': {
          const ackPromises = this.getAckPromises((client) => {
            client.write(getBinBuf([0, 1, location, content.toString()]));
          });
          await Promise.all(ackPromises);
          break;
        }
        default: {
          const ackPromises = this.getAckPromises((client) => {
            client.write(getBinBuf([0, 0, location, JSON.stringify(content)]));
          });
          await Promise.all(ackPromises);
        }
      }
      this.outputDistribOperate('attachDistrib', location);
    } catch (error) {
      this.outputDistribOperateError('attachDistrib', [locaiton]);
    }
  }

  async getDiskUsageDistrib(location, content) {
    try {
      this.checkCombine();
      this.attach(location, content);
      switch (typeof content) {
        case 'function': {
          const ackPromises = this.getAckPromises((client) => {
            client.write(getBinBuf([0, 1, location, content.toString()]));
          });
          await Promise.all(ackPromises);
          break;
        }
        default: {
          const ackPromises = this.getAckPromises((client) => {
            client.write(getBinBuf([0, 0, location, JSON.stringify(content)]));
          });
          await Promise.all(ackPromises);
        }
      }
      this.outputDistribOperate('attachDistrib', location);
    } catch (error) {
      this.outputDistribOperateError('attachDistrib', [locaiton]);
    }
  }
}

export default DistribStorage;
