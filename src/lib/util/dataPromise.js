export default function dataPromise(socket) {
  return new Promise((resolve, reject) => {
    socket.once('data', (data) => {
      socket.removeAllListeners('data');
      resolve(data);
    });
  });
}
