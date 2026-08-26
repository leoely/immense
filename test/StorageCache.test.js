import { Buffer, }from 'buffer';
import { describe, expect, test, } from '@jest/globals';
import StorageCache from '~/class/StorageCache';

describe('[Class] StorageCache;', () => {
  test('The object should be able to perform various caching operations', async () => {
    const storageCache = new StorageCache(null);
    storageCache.changeOptions('test-cache-operation/operation.txt', { blockSize: 6, });
    const blocks = storageCache.transformBlocks('test-cache-opeartion.txt', 'test string1test string2test string3test string4', 0);
    expect(JSON.stringify(blocks)).toMatch('[{\"index\":0,\"type\":1,\"range\":[0,5],\"data\":\"test s\"},{\"index\":1,\"type\":1,\"range\":[6,11],\"data\":\"tring1\"},{\"index\":2,\"type\":1,\"range\":[12,17],\"data\":\"test s\"},{\"index\":3,\"type\":1,\"range\":[18,23],\"data\":\"tring2\"},{\"index\":4,\"type\":1,\"range\":[24,29],\"data\":\"test s\"},{\"index\":5,\"type\":1,\"range\":[30,35],\"data\":\"tring3\"},{\"index\":6,\"type\":1,\"range\":[36,41],\"data\":\"test s\"},{\"index\":7,\"type\":1,\"range\":[42,47],\"data\":\"tring4\"}]');
    await storageCache.instillBlocks('test-cache-operation/operation.txt', blocks);
    const cache1 = storageCache.getBlocks('test-cache-operation/operation.txt', [5, 20]);
    expect(JSON.stringify(cache1)).toMatch('fasdffadsfadsfasdfsad');
  });
});
