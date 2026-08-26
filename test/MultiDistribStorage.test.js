import { constants } from 'node:fs/promises';
import { Buffer, } from 'buffer';
import { describe, expect, test, } from '@jest/globals';
import { getOwnIpAddresses, } from 'manner.js/server';
import DistribStorage from '~/class/DistribStorage';
import StorageClient from '~/class/StorageClient';
import MultiStorageClient from '~/class/MultiStorageClient';

describe('[Class] MultiDistribStorage;', () => {
  test('The MultiDistribStorage should perform big data-related opearations.', async () => {
    const [ipAddress] = getOwnIpAddresses();
    const { ipv6, } = ipAddress;
    const storages1 = [
      [ipv6, 8008],
      [ipv6, 8009],
    ];
    const distribStorage1 = new DistribStorage('/tmp/test7', {
      develop: true,
      temporaryDiskAvailable: 100000,
    }, 8008, storages1);
    distribStorage1.setTemporaryDiskSwitch(true);
    const distribStorage2 = new DistribStorage('/tmp/test8', {
      develop: true,
      temporaryDiskAvailable: 100000,
    }, 8009, storages1);
    distribStorage2.setTemporaryDiskSwitch(true);
    const storages2 = [
      [ipv6, 8010],
      [ipv6, 8011],
    ];
    const distribStorage3 = new DistribStorage('/tmp/test9', {
      develop: true,
      temporaryDiskAvailable: 100000,
    }, 8010, storages2);
    distribStorage1.setTemporaryDiskSwitch(true);
    const distribStorage4 = new DistribStorage('/tmp/test10', {
      develop: true,
      temporaryDiskAvailable: 100000,
    }, 8011, storages2);
    distribStorage2.setTemporaryDiskSwitch(true);
    await DistribStorage.combine([distribStorage1, distribStorage2]);
    await DistribStorage.combine([distribStorage3, distribStorage4]);
    const multiStorageClient = new MultiStorageClient();
    const storageClient1 = new StorageClient({}, storages1);
    const storageClient2 = new StorageClient({}, storages2);
    multiStorageClient.addStorageClient(storageClient1);
    multiStorageClient.addStorageClient(storageClient2);
    await multiStorageClient.addBuffer('test-multi-bigdata-operation/operation.txt', Buffer.from('Perform related opeartions on multiple big data.'));
    //const data1 = await multiStorageClient.readData('test-multi-bigdata-operation/operation.txt');
    await DistribStorage.release([distribStorage1, distribStorage2]);
    await DistribStorage.release([distribStorage3, distribStorage4]);
  });
});
