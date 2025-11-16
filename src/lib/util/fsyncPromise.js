import fs from 'fs';

export default function fsyncPromise(fd) {
  return new Promise((resolve, reject) => {
    fs.fsync(fd, (error) => {
      if (error !== null) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}
