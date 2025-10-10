import childProcess from 'child_process';
import { Buffer, }from 'buffer';
import { describe, expect, test, } from '@jest/globals';
import Storage from '~/class/Storage';

beforeAll(() => {
  childProcess.execSync('rm -rf /tmp/immense');
});

describe('[Class] Storage;', () => {
  test('Storage should be able to complete basic file operations.', async () => {
    const storage = new Storage('/tmp/immense');
    await storage.addBuffer('test-file-operation/operation.txt', Buffer.from('perform related file operations.'));
    const data = await storage.readData('test-file-operation/operation.txt');
    expect(data.toString()).toMatch('perform related file operations.');
  });
});
