import { Buffer, }from 'buffer';
import { describe, expect, test, } from '@jest/globals';
import StorageCache from '~/class/StorageCache';

describe('[Class] StorageCache;', () => {
  test('The object should be able to perform various caching operations', async () => {
    const storageCache = new StorageCache(null);
    storageCache.changeOptions('test-cache-opeartion/operation.txt', { blockSize: 6, });
    const blocks = storageCache.transformBlocks('test-cache-opeartion.txt', 'test string1test string2test string3test string4', 0);
    expect(JSON.stringify(blocks)).toMatch('[{\"type\":1,\"range\":[0,5],\"data\":\"test s\"},{\"type\":1,\"range\":[6,11],\"data\":\"tring1\"},{\"type\":1,\"range\":[12,17],\"data\":\"test s\"},{\"type\":1,\"range\":[18,23],\"data\":\"tring2\"},{\"type\":1,\"range\":[24,29],\"data\":\"test s\"},{\"type\":1,\"range\":[30,35],\"data\":\"tring3\"},{\"type\":1,\"range\":[36,41],\"data\":\"test s\"},{\"type\":1,\"range\":[42,47],\"data\":\"tring4\"}]');
  });
});
