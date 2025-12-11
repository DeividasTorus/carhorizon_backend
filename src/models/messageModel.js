const pool = require('../config/db');

const createMessage = async (chatId, senderId, text) => {
  const result = await pool.query(
    `INSERT INTO messages (chat_id, sender_id, text)
     VALUES ($1, $2, $3)
     RETURNING id, chat_id, sender_id, text, created_at`,
    [chatId, senderId, text]
  );
  return result.rows[0];
};

const getMessagesByChat = async (chatId) => {
  const result = await pool.query(
    `SELECT id, chat_id, sender_id, text, created_at
     FROM messages
     WHERE chat_id = $1
     ORDER BY created_at ASC`,
    [chatId]
  );
  return result.rows;
};

module.exports = {
  createMessage,
  getMessagesByChat,
};
