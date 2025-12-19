const pool = require('../config/db');
const { getActiveCarForUser } = require('../models/carModel');

// GET /api/notifications - Get all notifications
const getNotifications = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Get user's active car
    const activeCar = await getActiveCarForUser(userId);
    if (!activeCar) {
      return res.json({
        success: true,
        notifications: [],
        unread_count: 0
      });
    }

    const activeCarId = activeCar.id;

    // Clean old notifications before fetching
    // Delete notifications for old posts (>30 days) or orphan notifications
    await pool.query(
      `DELETE FROM notifications n
       WHERE n.recipient_car_id = $1 AND (
         -- Case 1: Notification linked to old post (>30 days)
         (n.post_id IS NOT NULL AND EXISTS (
           SELECT 1 FROM posts p 
           WHERE p.id = n.post_id 
           AND p.created_at < NOW() - INTERVAL '30 days'
         ))
         -- Case 2: Follow notifications older than 60 days
         OR (n.type = 'follow' AND n.created_at < NOW() - INTERVAL '60 days')
         -- Case 3: Post deleted (orphan notification)
         OR (n.post_id IS NOT NULL AND NOT EXISTS (
           SELECT 1 FROM posts p WHERE p.id = n.post_id
         ))
       )`,
      [activeCarId]
    );

    // Fetch notifications
    const result = await pool.query(
      `SELECT 
        n.*,
        c.plate as actor_name,
        CASE 
          WHEN n.created_at > NOW() - INTERVAL '1 minute' THEN '0 Minutes'
          WHEN n.created_at > NOW() - INTERVAL '1 hour' THEN 
            EXTRACT(MINUTE FROM NOW() - n.created_at)::INTEGER || ' Minutes'
          WHEN n.created_at > NOW() - INTERVAL '1 day' THEN 
            EXTRACT(HOUR FROM NOW() - n.created_at)::INTEGER || ' Hours'
          WHEN n.created_at > NOW() - INTERVAL '1 week' THEN 
            EXTRACT(DAY FROM NOW() - n.created_at)::INTEGER || ' Days'
          ELSE 
            EXTRACT(DAY FROM NOW() - n.created_at)::INTEGER || ' Days'
        END as time_ago
      FROM notifications n
      LEFT JOIN cars c ON n.actor_car_id = c.id
      WHERE n.recipient_car_id = $1
      ORDER BY n.created_at DESC
      LIMIT 50`,
      [activeCarId]
    );

    // Count unread
    const unreadResult = await pool.query(
      'SELECT COUNT(*)::INTEGER as count FROM notifications WHERE recipient_car_id = $1 AND is_read = false',
      [activeCarId]
    );

    return res.json({
      success: true,
      notifications: result.rows,
      unread_count: unreadResult.rows[0].count
    });

  } catch (err) {
    console.error('getNotifications error:', err);
    next(err);
  }
};

// PUT /api/notifications/:notificationId/read - Mark as read
const markAsRead = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const notificationId = parseInt(req.params.notificationId);

    if (!notificationId || isNaN(notificationId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid notification ID'
      });
    }

    // Get user's active car
    const activeCar = await getActiveCarForUser(userId);
    if (!activeCar) {
      return res.status(400).json({
        success: false,
        error: 'No active car selected'
      });
    }

    const activeCarId = activeCar.id;

    // Update notification (only if it belongs to user)
    await pool.query(
      'UPDATE notifications SET is_read = true WHERE id = $1 AND recipient_car_id = $2',
      [notificationId, activeCarId]
    );

    return res.json({
      success: true,
      message: 'Notification marked as read'
    });

  } catch (err) {
    console.error('markAsRead error:', err);
    next(err);
  }
};

// PUT /api/notifications/read-all - Mark all as read
const markAllAsRead = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Get user's active car
    const activeCar = await getActiveCarForUser(userId);
    if (!activeCar) {
      return res.status(400).json({
        success: false,
        error: 'No active car selected'
      });
    }

    const activeCarId = activeCar.id;

    // Update all notifications
    await pool.query(
      'UPDATE notifications SET is_read = true WHERE recipient_car_id = $1 AND is_read = false',
      [activeCarId]
    );

    return res.json({
      success: true,
      message: 'All notifications marked as read'
    });

  } catch (err) {
    console.error('markAllAsRead error:', err);
    next(err);
  }
};

// POST /api/notifications/push-token - Save Expo push token
const savePushToken = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { expoPushToken } = req.body;

    if (!expoPushToken) {
      return res.status(400).json({
        success: false,
        error: 'expoPushToken is required'
      });
    }

    // Validate Expo token format
    if (!expoPushToken.startsWith('ExponentPushToken[')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Expo push token format'
      });
    }

    // Get user's active car
    const activeCar = await getActiveCarForUser(userId);
    if (!activeCar) {
      return res.status(400).json({
        success: false,
        error: 'No active car selected'
      });
    }

    const activeCarId = activeCar.id;

    // Update car's push token
    await pool.query(
      'UPDATE cars SET expo_push_token = $1 WHERE id = $2',
      [expoPushToken, activeCarId]
    );

    console.log(`✅ Push token saved for car ${activeCarId}`);

    return res.json({
      success: true,
      message: 'Push token saved successfully'
    });

  } catch (err) {
    console.error('savePushToken error:', err);
    next(err);
  }
};

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
  savePushToken,
};
