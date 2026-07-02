import { constants } from 'node:fs/promises';
import childProcess from 'child_process';
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
    const storages = [
      [ipv6, 8008],
      [ipv6, 8009],
    ];
    const distribStorage1 = new DistribStorage('/tmp/test7', {
      develop: true,
      temporaryDiskAvailable: 100000,
    }, 8008, storages);
    distribStorage1.setTemporaryDiskSwitch(true);
    const distribStorage2 = new DistribStorage('/tmp/test8', {
      develop: true,
      temporaryDiskAvailable: 100000,
    }, 8009, storages);
    distribStorage2.setTemporaryDiskSwitch(true);
    const distribStorage3 = new DistribStorage('/tmp/test9', {
      develop: true,
      temporaryDiskAvailable: 100000,
    }, 8008, storages);
    distribStorage1.setTemporaryDiskSwitch(true);
    const distribStorage4 = new DistribStorage('/tmp/test10', {
      develop: true,
      temporaryDiskAvailable: 100000,
    }, 8009, storages);
    distribStorage2.setTemporaryDiskSwitch(true);
    await DistribStorage.combine([distribStorage1, distribStorage2]);
    await DistribStorage.combine([distribStorage3, distribStorage4]);
    await DistribStorage.release([distribStorage1, distribStorage2]);
    await DistribStorage.release([distribStorage3, distribStorage4]);
  });
});
