const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

const {
  getNotifications,
  markAsRead,
  markAllAsRead,
} = require('../controllers/notificationController');

// All routes require authentication
router.use(auth);

// GET /api/notifications - Get all notifications
router.get('/', getNotifications);

// PUT /api/notifications/read-all - Mark all as read (must be before /:notificationId)
router.put('/read-all', markAllAsRead);

// PUT /api/notifications/:notificationId/read - Mark single as read
router.put('/:notificationId/read', markAsRead);

module.exports = router;
