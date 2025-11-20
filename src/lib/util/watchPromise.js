import fs from 'fs';

export default function watchPromise(filename, options, listener) {
  return new Promise((resolve, reject) => {
    resolve(fs.watch(filename, options, listener));
  });
}
