import fs from 'fs';

export default function writePromise(fd, buffer, options) {
  return new Promise((resolve, reject) => {
    fs.write(fd, buffer, options, (error) => {
      if (error !== null) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}
