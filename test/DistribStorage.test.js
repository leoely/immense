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
      temporaryDiskAvailable: 5000,
    }, 8006, storages);
    distribStorage1.setTemporaryDiskSwitch(true);
    const distribStorage2 = new DistribStorage('/tmp/test6', {
      temporaryDiskAvailable: 5000,
    }, 8007, storages);
    distribStorage2.setTemporaryDiskSwitch(true);
    const storageClient = new StorageClient({
      port: 49152,
    }, storages);
    await storageClient.yieldPort();
    await DistribStorage.combine([distribStorage1, distribStorage2]);
    await storageClient.addBuffer('test-bigdata-operation/operation.txt', Buffer.from('perform big data related operations.'));
    await DistribStorage.release([distribStorage1, distribStorage2]);
  });
});
