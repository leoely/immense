import { describe, expect, test, } from '@jest/globals';
import { getOwnIpAddresses, getAddress, } from 'manner.js/server';
import DistribStorage from '~/class/DistribStorage';
import StorageClient from '~/class/StorageClient';
import StorageCache from '~/class/StorageCache';

describe('[Class] StorageCache;', () => {
  test('The StorageCache should be able to perform instill related operations', async () => {
    const storageCache = new StorageCache(null);
    storageCache.changeOptions('test-instill-operation/operation.txt', { blockSize: 6, });
    const blocks = storageCache.transformBlocks('test-instill-operation/opeartion.txt', 'test string1test string2test string3test string4', 0);
    expect(JSON.stringify(blocks)).toMatch('[{\"index\":0,\"type\":1,\"range\":[0,5],\"data\":\"test s\"},{\"index\":1,\"type\":1,\"range\":[6,11],\"data\":\"tring1\"},{\"index\":2,\"type\":1,\"range\":[12,17],\"data\":\"test s\"},{\"index\":3,\"type\":1,\"range\":[18,23],\"data\":\"tring2\"},{\"index\":4,\"type\":1,\"range\":[24,29],\"data\":\"test s\"},{\"index\":5,\"type\":1,\"range\":[30,35],\"data\":\"tring3\"},{\"index\":6,\"type\":1,\"range\":[36,41],\"data\":\"test s\"},{\"index\":7,\"type\":1,\"range\":[42,47],\"data\":\"tring4\"}]');
    await storageCache.instillBlocks('test-instill-operation/operation.txt', blocks);
    const cache1 = storageCache.getBlocks('test-instill-operation/operation.txt', [5, 20]);
    expect(JSON.stringify(cache1)).toMatch('[\"s\",\"tring1\",\"test s\",\"tri\"]');
    const cache2 = storageCache.getBlocks('test-instill-operation/operation.txt', [7, 22]);
    expect(JSON.stringify(cache2)).toMatch('[\"ring1\",\"test s\",\"tring\"]');
    const cache3 = storageCache.getBlocks('test-instill-operation/operation.txt', [2, 9]);
    expect(JSON.stringify(cache3)).toMatch('[\"st s\",\"trin\"]');
    const cache4 = storageCache.getBlocks('test-instill-operation/operation.txt', [25, 29]);
    expect(JSON.stringify(cache4)).toMatch('[\"est s\"]');
    const cache5 = storageCache.getBlocks('test-instill-operation/operation.txt', [4, 28]);
    expect(JSON.stringify(cache5)).toMatch('[\" s\",\"tring1\",\"test s\",\"tring2\",\"test \"]');
  });

  test('The StorageCache should be able to be instill inverted type.', async () => {
    const storageCache = new StorageCache({ connection: true, });
    storageCache.changeOptions('test-instill-operation/operation.txt', { blockSize: 6, });
    const blocks = storageCache.transformBlocks('test-instill-operation/opeartion.txt', 'test', 1);
    expect(JSON.stringify(blocks)).toMatch('[{\"index\":0,\"type\":1,\"range\":[1,4],\"data\":\"est\"}]');
    const [ipAddress] = getOwnIpAddresses();
    const { ipv6, } = ipAddress;
    const storages = [
      [ipv6, 8013],
      [ipv6, 8014],
    ];
    const distribStorage1 = new DistribStorage('/tmp/test15', {
      develop: true,
      temporaryDiskAvailable: 100000,
    }, 8013, storages);
    distribStorage1.setTemporaryDiskSwitch(true);
    const distribStorage2 = new DistribStorage('/tmp/test16', {
      develop: true,
      temporaryDiskAvailable: 100000,
    }, 8014, storages);
    distribStorage2.setTemporaryDiskSwitch(true);
    await DistribStorage.combine([distribStorage1, distribStorage2]);
    const storageClient = new StorageClient({ listen: true, }, storages);
    await storageCache.instillBlocks('test-instill-operation/operation.txt', blocks);
    const cache1 = storageCache.getBlocks('test-instill-operation/operation.txt', [0, 5]);
    expect(JSON.stringify(cache1)).toMatch('[\"s\",\"tring1\",\"test s\",\"tri\"]');
    await DistribStorage.release([distribStorage1, distribStorage2]);
  });

  //test('The StorageCache should be able to perform various add related operations', async () => {
    //const storageCache = new StorageCache(null);
    //storageCache.changeOptions('test-add-operation/operation.txt', { blockSize: 6, });
  //});
});
