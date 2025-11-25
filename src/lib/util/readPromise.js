import fs from 'fs';

export default function readPromise(fd, options) {
  if (typeof options !== 'object') {
    throw new Error('[Error] Option objecs need to be passed.');
  }
  return new Promise((resolve, reject) => {
    const {
      length,
    } = options;
    if (!Number.isInteger(length)) {
      throw new Error('[Error] The option length should be an integer.');
    }
    if (!(length >= 0)) {
      throw new Error('[Error] The option length should be greater than or equal to zero.');
    }
    const buffer = Buffer.alloc(length);
    fs.read(fd, buffer, options, (error, bytesRead, buffer) => {
      if (error !== null) {
        reject(error);
      } else {
        resolve(buffer);
      }
    });
  });
}
