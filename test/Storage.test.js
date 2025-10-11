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
    let data = await storage.readData('test-file-operation/operation.txt');
    expect(data.toString()).toMatch('perform related file operations.');
    let buffer = await storage.readBufferPiece('test-file-operation/operation.txt', 8, 7);
    expect(buffer.toString()).toMatch('related');
    await storage.writeBufferPiece('/test-file-operation/operation.txt', 21, Buffer.from('OPERATIONS'));
    data = await storage.readData('test-file-operation/operation.txt');
    expect(data.toString()).toMatch('perform related file OPERATIONS.');
    await storage.appendData('test-file-operation/operation.txt', ' etc');
    data = await storage.readData('test-file-operation/operation.txt');
    expect(data.toString()).toMatch('perform related file OPERATIONS. etc');
    await storage.remove('test-file-operation/operation.txt');
    expect(childProcess.execSync('ls /tmp/immense').toString()).toMatch('');
  });
});
