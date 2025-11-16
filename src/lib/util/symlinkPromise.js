import fs from 'fs';

export default function symlinkPromise(target, path) {
  return new Promise((resolve, reject) => {
    fs.symlink(target, path, (err) => {
      if (err !== null) {
        resolve();
      } else {
        reject(err);
      }
    });
  });
}
