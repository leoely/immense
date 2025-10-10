import fs from 'fs';

export default function closePromise(fd) {
  return new Promise((resolve, reject) => {
    fs.close(fd, (error) => {
      if (error !== null) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}
