import fs from 'fs';

export default function openPromise(path, flag) {
  return new Promise((resolve, reject) => {
    fs.open(path, flag, (error, fd) => {
      if (error !== null) {
        reject(error);
      } else {
        resolve(fd);
      }
    });
  });
}
