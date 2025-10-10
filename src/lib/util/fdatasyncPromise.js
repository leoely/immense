import fs from 'fs';

export default function fdatasyncPromise(fd) {
  return new Promise((resolve, reject) => {
    fs.fdatasync(fd, (error) => {
      if (error !== null) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}
