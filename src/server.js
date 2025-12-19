require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const errorHandler = require('./middleware/errorHandler');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes'); // 👈 NAUJAS
const carRoutes = require('./routes/carRoutes');
const chatRoutes = require('./routes/chatRoutes');
const newsRoutes = require('./routes/newsRoutes');
const postRoutes = require('./routes/postRoutes'); // 👈 NAUJAS POST ROUTES
const commentRoutes = require('./routes/commentRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const { verifyToken } = require('./utils/jwt');
const { setIO } = require('./socket');

const app = express();

// Globalus request loggeris

app.use(express.json());
// Globalus request loggeris (po express.json)
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`, req.body);
  next();
});

const allowedOrigin = process.env.CLIENT_ORIGIN || '*';

app.use(
  cors({
    origin: allowedOrigin,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);


// Health
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// --------- API ROUTES ---------

// Auth (register, login)
app.use('/api/auth', authRoutes);

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({
    success: true,
    message: 'API is working!',
    timestamp: new Date().toISOString()
  });
});

// Users (me, avatar, future profile stuff)
app.use('/api/users', userRoutes); // 👈 DABAR TURI /api/users/me ir /api/users/me/avatar

// Cars
app.use('/api/cars', carRoutes);

// Chats
app.use('/api/chats', chatRoutes);

// News
app.use('/api/news', newsRoutes);

// Posts
app.use('/api/posts', postRoutes);

// Comments
app.use('/api/comments', commentRoutes);

// Notifications
app.use('/api/notifications', notificationRoutes);

// --------- STATIC FILES (avatars) ---------

// Avatarų ir kitų upload'ų servinimas
// Pvz. DB saugo /uploads/avatars/user_1_123.jpg
// Frontas pasiekia http://SERVER:PORT/uploads/avatars/user_1_123.jpg
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --------- ERROR HANDLER ---------

app.use(errorHandler);

// ----- SOCKET.IO -----
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: allowedOrigin,
    methods: ['GET', 'POST'],
  },
});

// JWT auth per socketą
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) {
    return next(new Error('Auth token missing'));
  }
  try {
    const decoded = verifyToken(token);
    socket.userId = decoded.id;
    next();
  } catch (err) {
    console.error('Socket auth error', err.message);
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  const userId = socket.userId;

  if (!userId) {
    socket.disconnect();
    return;
  }

  console.log('Socket connected for user', userId);
  // user room
  socket.join(`user_${userId}`);

  socket.on('disconnect', () => {
    console.log('Socket disconnected for user', userId);
  });
});

setIO(io);

// Start
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`CarHorizon backend running on port ${PORT}`);
});

module.exports = app;


