export default function dataPromise(socket) {
  return new Promise((resolve, reject) => {
    socket.on('data', (data) => {
      resolve(reject);
    });
  });
}
