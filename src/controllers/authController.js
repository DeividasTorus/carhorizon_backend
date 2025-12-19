// controllers/authController.js
const {
  createUser,
  findUserByEmail,
  findUserById,
  verifyPassword,
  updateUserPassword,
} = require('../models/userModel');

const { signToken } = require('../utils/jwt');

const PASSWORD_MIN_LEN = 8;

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

    if (String(password).length < PASSWORD_MIN_LEN) {
      return res
        .status(400)
        .json({ error: `Password must be at least ${PASSWORD_MIN_LEN} characters` });
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

/**
 * PUT /api/auth/change-password
 * Protected route - uses middleware/auth.js which sets req.user = { id }
 * Body: { currentPassword, newPassword }
 */
const changePassword = async (req, res, next) => {
  try {
    // ✅ suderinta su tavo middleware/auth.js
    const userId = req.user?.id;

    const { currentPassword, newPassword } = req.body || {};

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'currentPassword and newPassword required' });
    }

    if (String(newPassword).length < PASSWORD_MIN_LEN) {
      return res.status(400).json({ error: `Password must be at least ${PASSWORD_MIN_LEN} characters` });
    }

    const user = await findUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // ⚠️ findUserById PRIVALO grąžinti password_hash (tą jau sutvarkėm modelyje)
    const ok = await verifyPassword(currentPassword, user.password_hash);
    if (!ok) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    await updateUserPassword(userId, newPassword);

    return res.json({ ok: true, message: 'Password changed' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  register,
  login,
  changePassword,
};


