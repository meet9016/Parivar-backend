let _io = null;

module.exports = {
  init: (httpServer) => {
    const { Server } = require('socket.io');
    _io = new Server(httpServer, {
      cors: { origin: '*', methods: ['GET', 'POST'] }
    });

    _io.on('connection', (socket) => {

      // CLIENT SENDS userId to join their personal room 
      socket.on('join', (userId) => {
        if (userId) socket.join(`user_${userId}`);
        socket.join('broadcast'); 
      });

      socket.on('disconnect', () => {});
    });

    return _io;
  },
  getIO: () => {
    if (!_io) throw new Error('Socket.io not initialized');
    return _io;
  }
};
