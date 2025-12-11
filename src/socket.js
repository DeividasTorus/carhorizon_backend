let io = null;

const setIO = (ioInstance) => {
  io = ioInstance;
};

const getIO = () => {
  return io;
};

// emitinam event'ą konkrečiam useriui
const emitToUser = (userId, event, payload) => {
  if (!io || !userId) return;
  io.to(`user_${userId}`).emit(event, payload);
};

module.exports = {
  setIO,
  getIO,
  emitToUser,
};

