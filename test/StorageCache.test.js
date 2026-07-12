import { Buffer, }from 'buffer';
import { describe, expect, test, } from '@jest/globals';
import StorageCache from '~/class/StorageCache';

describe('[Class] StorageCache;', () => {
  test('The object should be able to perform various caching operations', async () => {
    const storageCache = new StorageCache(null);
    storageCache.changeOptions('test-cache-opeartion/operation.txt', { blockSize: 6, });
    const blocks = storageCache.transformBlocks('test-cache-opeartion.txt', 'test string1test string2test string3test string4', 0);
    expect(JSON.stringify(blocks)).toMatch('fasdfasdsfasdf');
  });
});
