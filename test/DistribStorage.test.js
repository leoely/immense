import { constants } from 'node:fs/promises';
import childProcess from 'child_process';
import { Buffer, } from 'buffer';
import { describe, expect, test, } from '@jest/globals';
import { getOwnIpAddresses, } from 'manner.js/server';
import DistribStorage from '~/class/DistribStorage';
import StorageClient from '~/class/StorageClient';

describe('[Class] DistribStorage;', () => {
  test('DistribStorage should support IPv4 address.', async () => {
    const [ipAddress] = getOwnIpAddresses();
    const { ipv4, } = ipAddress;
    const storages = [
      [ipv4, 8002],
      [ipv4, 8003],
    ];
    const distribStorage1 = new DistribStorage('/tmp/test1', {
    }, 8002, storages);
    const distribStorage2 = new DistribStorage('/tmp/test2', {
    }, 8003, storages);
    await DistribStorage.combine([distribStorage1, distribStorage2]);
    await DistribStorage.release([distribStorage1, distribStorage2]);
  });

  test('DistribStorage should support IPv6 address.', async () => {
    const [ipAddress] = getOwnIpAddresses();
    const { ipv6, } = ipAddress;
    const storages = [
      [ipv6, 8004],
      [ipv6, 8005],
    ];
    const distribStorage1 = new DistribStorage('/tmp/test3', {
    }, 8004, storages);
    const distribStorage2 = new DistribStorage('/tmp/test4', {
    }, 8005, storages);
    await DistribStorage.combine([distribStorage1, distribStorage2]);
    await DistribStorage.release([distribStorage1, distribStorage2]);
  });

  test('DistribStorage should be able to perform big data related operations.', async () => {
    const [ipAddress] = getOwnIpAddresses();
    const { ipv6, } = ipAddress;
    const storages = [
      [ipv6, 8006],
      [ipv6, 8007],
    ];
    const distribStorage1 = new DistribStorage('/tmp/test5', {
      develop: true,
      temporaryDiskAvailable: 100000,
    }, 8006, storages);
    distribStorage1.setTemporaryDiskSwitch(true);
    const distribStorage2 = new DistribStorage('/tmp/test6', {
      develop: true,
      temporaryDiskAvailable: 100000,
    }, 8007, storages);
    distribStorage2.setTemporaryDiskSwitch(true);
    const storageClient = new StorageClient({}, storages);
    await DistribStorage.combine([distribStorage1, distribStorage2]);
    let exists = await storageClient.exists('test-bigdata-operation/backup.txt');
    expect(exists).toBe(false);
    await storageClient.addBuffer('test-bigdata-operation/operation.txt', Buffer.from('perform big data related operations.'));
    let data = await storageClient.readData('test-bigdata-operation/operation.txt');
    expect(data.toString()).toMatch('perform big data related operations.');
    let buffer = await storageClient.readBufferPiece('test-bigdata-operation/operation.txt', 2, 5);
    expect(buffer.toString()).toMatch('rform');
    await storageClient.writeBufferPiece('test-bigdata-operation/operation.txt', 5, Buffer.from('write piece buffer'));
    data = await storageClient.readData('test-bigdata-operation/operation.txt');
    expect(data.toString()).toMatch('perfowrite piece bufferd operations.');
    await storageClient.writeBuffer('test-bigdata-operation/operation.txt', Buffer.from('write buffer'));
    data = await storageClient.readData('test-bigdata-operation/operation.txt');
    expect(data.toString()).toMatch('write buffer');
    await storageClient.appendData('test-bigdata-operation/operation.txt', Buffer.from(' append data'));
    data = await storageClient.readData('test-bigdata-operation/operation.txt');
    expect(data.toString()).toMatch('write buffer append data');
    await storageClient.truncate('test-bigdata-operation/operation.txt', 10);
    data = await storageClient.readData('test-bigdata-operation/operation.txt');
    expect(data.toString()).toMatch('write buff');
    await storageClient.rename('test-bigdata-operation/operation.txt', 'test-bigdata-operation/operation1.txt');
    data = await storageClient.readData('test-bigdata-operation/operation1.txt');
    expect(data.toString()).toMatch('write buff');
    const diskOccupy = await storageClient.diskOccupy('test-bigdata-operation/operation1.txt');
    expect(diskOccupy).toBe(9n);
    await storageClient.link('test-bigdata-operation/operation1.txt', 'test-bigdata-operation/link.txt');
    data = await storageClient.readData('test-bigdata-operation/link.txt');
    expect(data.toString()).toMatch('write buff');
    const stats = await storageClient.stats('test-bigdata-operation/operation1.txt');
    expect(Number.isInteger(stats.mtimeNs)).toBe(true);
    await storageClient.chmod('test-bigdata-operation/operation1.txt', '775');
    await storageClient.chown('test-bigdata-operation/operation1.txt', 502, 0);
    const access = await storageClient.access('test-bigdata-operation/operation1.txt', constants.R_OK);
    expect(access).toBe(true);
    const realpath = await storageClient.realpath('test-bigdata-operation/link.txt');
    expect(realpath).toMatch('/private/tmp/test6/test-bigdata-operation/operation1.txt');
    await storageClient.addBuffer('test-bigdata-operation/backup.txt', Buffer.from('perform big data related operations.'));
    data = await storageClient.readData('test-bigdata-operation/backup.txt');
    expect(data.toString()).toMatch('perform big data related operations.');
    //const files = await storageClient.readdir('test-bigdata-operation');
    //expect(JSON.stringify(files)).toMatch('[\"link.txt\",\"operation1.txt\",\"backup.txt\"]');
    //await storageClient.cp('test-bigdata-operation', 'test-bigdata-operation-backup', { recursive: true, });
    //await storageClient.rmdir('test-bigdata-operation-backup');
    //let presence = await storageClient.presence('test-bigdata-operation-backup');
    //expect(presence).toBe(false);
    //await storageClient.mkdir('test-bigdata-operation-new');
    //presence = await storageClient.presence('test-bigdata-operation-new');
    //expect(presence).toBe(true);
    //await storageClient.rmdir('test-bigdata-operation-new');
    //const paths = await storageClient.glob('**/*.txt');
    //expect(JSON.stringify(paths)).toMatch('[\"test-bigdata-operation/backup.txt\",\"test-bigdata-operation/link.txt\",\"test-bigdata-operation/operation1.txt\"]');
    //exists = await storageClient.exists('test-bigdata-operation/backup.txt');
    //expect(exists).toBe(true);
    //await storageClient.remove('test-bigdata-operation/backup.txt');
    //await storageClient.remove('test-bigdata-operation/link.txt');
    //await storageClient.remove('test-bigdata-operation/operation1.txt');
    //await DistribStorage.release([distribStorage1, distribStorage2]);
  }, 7000);
});
