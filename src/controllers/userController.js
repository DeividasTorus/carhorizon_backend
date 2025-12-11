// controllers/userController.js
const pool = require('../config/db');
const { findUserById } = require('../models/userModel');

const buildUserResponse = (user) => {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    created_at: user.created_at,
  };
};

// GET /api/users/me
const getMe = async (req, res, next) => {
  try {
    const user = await findUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'Not found' });
    }

    return res.json({
      user: buildUserResponse(user),
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getMe,
};
