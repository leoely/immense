import fs from 'fs';

export default function statPromise(path) {
  return new Promise((resolve, reject) => {
    fs.stat(path, (err, stats) => {
      if (err !== null) {
        reject(error);
      } else {
        resolve(stats);
      }
    });
  });
}
