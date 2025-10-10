import fs from 'fs';

export default function readPromise(fd, buffer, options) {
  return new Promise((resolve, reject) => {
    const buffer = Buffer.alloc(0);
    fs.read(fd, buffer, options, (error) => {
      if (error !== null) {
        reject(error);
      } else {
        resolve(buffer);
      }
    });
  });
}
