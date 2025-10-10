import fs, { constants, } from 'fs';

export default function existsPromise(path) {
  return new Promise((resolve, reject) => {
    fs.access(path, constants.F_OK, (error) => {
      resolve(!error);
    });
  });
}
