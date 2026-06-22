import { constants } from 'node:fs/promises';
import childProcess from 'child_process';
import { Buffer, } from 'buffer';
import { describe, expect, test, } from '@jest/globals';
import { getOwnIpAddresses, wrapIpv6, } from 'manner.js/server';
import DistribStorage from '~/class/DistribStorage';
import StorageClient from '~/class/StorageClient';

describe('[Class] DistribStorage;', () => {
  test('DistribStorage should support IPv4 address.', async () => {
    const [ipAddress] = getOwnIpAddresses();
    const { ipv4, } = ipAddress;
    const storages = [
      [ipv4, 8000],
      [ipv4, 8001],
    ];
    const distribStorage1 = new DistribStorage('/tmp/test1', {
    }, 8000, storages);
    const distribStorage2 = new DistribStorage('/tmp/test2', {
    }, 8001, storages);
  });

  test('DistribStorage should support IPv6 address.', async () => {
    const [ipAddress] = getOwnIpAddresses();
    const { ipv6, } = ipAddress;
    const storages = [
      [wrapIpv6(ipv6), 8002],
      [wrapIpv6(ipv6), 8003],
    ];
    const distribStorage1 = new DistribStorage('/tmp/test3', {
    }, 8002, storages);
    const distribStorage2 = new DistribStorage('/tmp/test4', {
    }, 8003, storages);
  });

  test('DistribStorage should be able to perform big data related operations.', async () => {
    const [ipAddress] = getOwnIpAddresses();
    const { ipv4, } = ipAddress;
    const storages = [
      [ipv4, 8004],
      [ipv4, 8005],
    ];
    const distribStorage1 = new DistribStorage('/tmp/test1', {
    }, 8000, storages);
    const distribStorage2 = new DistribStorage('/tmp/test2', {
    }, 8001, storages);
    const storageClient = new StorageClient({
      port: 49152,
    }, storages);
    await storageClient.dealPort();
    await DistribStorage.combine([distribStorage1, distribStorage2]);
    await DistribStorage.release([distribStorage1, distribStorage2]);
  });
});
