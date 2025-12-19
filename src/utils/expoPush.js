const axios = require('axios');

/**
 * Send push notification via Expo Push API
 * @param {string|string[]} expoPushTokens - Expo push token(s)
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} data - Optional data payload
 * @returns {Promise<object>} - Response from Expo API
 */
async function sendExoPush(expoPushTokens, title, body, data = {}) {
  if (!expoPushTokens) {
    console.warn('No push tokens provided');
    return null;
  }

  // Convert to array if single token
  if (!Array.isArray(expoPushTokens)) {
    expoPushTokens = [expoPushTokens];
  }

  // Filter out invalid tokens
  const validTokens = expoPushTokens.filter(token => 
    token && token.startsWith('ExponentPushToken[')
  );

  if (validTokens.length === 0) {
    console.warn('No valid Expo push tokens');
    return null;
  }

  try {
    const response = await axios.post('https://exp.host/--/api/v2/push/send', {
      to: validTokens,
      title,
      body,
      sound: 'default',
      badge: 1,
      priority: 'high',
      data
    }, {
      headers: {
        'Authorization': process.env.EXPO_ACCESS_TOKEN ? `Bearer ${process.env.EXPO_ACCESS_TOKEN}` : undefined,
        'Content-Type': 'application/json',
      }
    });

    console.log('✅ Push notification sent:', { title, recipientCount: validTokens.length });
    return response.data;
  } catch (error) {
    console.error('❌ Expo push error:', error.response?.data || error.message);
    return null;
  }
}

module.exports = { sendExoPush };
