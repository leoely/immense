import fs from 'fs';

export default function readPromise(fd, options) {
  return new Promise((resolve, reject) => {
    if (typeof options === 'object') {
      const {
        length,
      } = options;
      if (Number.isInteger(length)) {
        const buffer = Buffer.alloc(length);
        fs.read(fd, buffer, options, (error, bytesRead, buffer) => {
          if (error !== null) {
            reject(error);
          } else {
            resolve(buffer);
          }
        });
      } else {
        fs.read(fd, options, (error, bytesRead, buffer) => {
          if (error !== null) {
            reject(error);
          } else {
            resolve(buffer);
          }
        });
      }
    } else {
      fs.read(fd, (error, bytesRead, buffer) => {
        if (error !== null) {
          reject(error);
        } else {
          resolve(buffer);
        }
      });
    }
  });
}
