const { Server } = require('socket.io');

let io = null;

function init(server) {
  io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
    }
  });

  io.on('connection', (socket) => {
    socket.on('join:restaurant', (restaurantId) => {
      if (restaurantId) socket.join(`restaurant:${restaurantId}`);
    });

    socket.on('join:kitchen', (restaurantId) => {
      if (restaurantId) socket.join(`kitchen:${restaurantId}`);
    });

    socket.on('join:table', ({ restaurantId, tableNumber }) => {
      if (restaurantId && tableNumber) {
        socket.join(`table:${restaurantId}:${tableNumber}`);
      }
    });
  });

  return io;
}

function getIO() {
  if (!io) {
    throw new Error("Socket.io hali initsializatsiya qilinmagan!");
  }
  return io;
}

function emitToRestaurant(restaurantId, event, data) {
  if (io && restaurantId) {
    io.to(`restaurant:${restaurantId}`).emit(event, data);
  }
}

function emitToKitchen(restaurantId, event, data) {
  if (io && restaurantId) {
    io.to(`kitchen:${restaurantId}`).emit(event, data);
  }
}

function emitToTable(restaurantId, tableNumber, event, data) {
  if (io && restaurantId && tableNumber) {
    io.to(`table:${restaurantId}:${tableNumber}`).emit(event, data);
  }
}

function emitGlobal(event, data) {
  if (io) {
    io.emit(event, data);
  }
}

module.exports = {
  init,
  getIO,
  emitToRestaurant,
  emitToKitchen,
  emitToTable,
  emitGlobal
};
