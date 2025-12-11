// controllers/authController.js
const {
  createUser,
  findUserByEmail,
  verifyPassword,
} = require('../models/userModel');
const { signToken } = require('../utils/jwt');

const buildUserResponse = (user) => {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    created_at: user.created_at,
  };
};

const register = async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const existing = await findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'User already exists' });
    }

    const user = await createUser(email, password);
    const token = signToken(user.id);

    return res.status(201).json({
      user: buildUserResponse(user),
      token,
    });
  } catch (err) {
    next(err);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = signToken(user.id);

    return res.json({
      user: buildUserResponse(user),
      token,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  register,
  login,
};

