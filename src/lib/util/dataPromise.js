export default function dataPromise(socket) {
  return new Promise((resolve, reject) => {
    socket.on('data', (data) => {
      socket.removeAllListeners('data');
      resolve(data);
    });
  });
}
