const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

const {
  getNotifications,
  markAsRead,
  markAllAsRead,
  savePushToken,
} = require('../controllers/notificationController');

// All routes require authentication
router.use(auth);

// POST /api/notifications/push-token - Save Expo push token
router.post('/push-token', savePushToken);

// GET /api/notifications - Get all notifications
router.get('/', getNotifications);

// PUT /api/notifications/read-all - Mark all as read (must be before /:notificationId)
router.put('/read-all', markAllAsRead);

// PUT /api/notifications/:notificationId/read - Mark single as read
router.put('/:notificationId/read', markAsRead);

module.exports = router;
