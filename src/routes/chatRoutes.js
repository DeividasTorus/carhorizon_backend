// src/routes/chatRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
    openChat,
    inbox,
    getMessages,
    postMessage,
    markRead,
    readStatus, // 👈
} = require('../controllers/chatController');

router.use(auth);

router.post('/open', openChat);
router.get('/inbox', inbox);

router.get('/:chatId/messages', getMessages);
router.post('/:chatId/messages', postMessage);
router.post('/:chatId/read', markRead);

// 👇 NAUJAS – read status
router.get('/:chatId/read-status', readStatus);

module.exports = router;

