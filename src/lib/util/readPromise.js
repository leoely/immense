import fs from 'fs';

export default function readPromise(fd, options) {
  return new Promise((resolve, reject) => {
    const {
      length,
    } = options;
    const buffer = Buffer.alloc(length);
    fs.read(fd, buffer, options, (error) => {
      if (error !== null) {
        reject(error);
      } else {
        resolve(buffer);
      }
    });
  });
}
