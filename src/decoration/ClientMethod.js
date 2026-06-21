import net from 'net';

export default function ClientMethod(value, { kind, name, }) {
  return async (...params) => {
    const index = this.getNextIndex();
    const { allStorages, } = this;
    const [ip, port] = allStorages[index];
    const client = net.createConnection(port, ip, () => {
    });
  }
}
