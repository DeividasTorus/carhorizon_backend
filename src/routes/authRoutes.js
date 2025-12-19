const express = require('express');
const router = express.Router();

const { register, login, changePassword } = require('../controllers/authController');
const auth = require('../middleware/auth');

// /api/auth/register
router.post('/register', register);

// /api/auth/login
router.post('/login', login);

// ✅ /api/auth/change-password (protected)
router.put('/change-password', auth, changePassword);

module.exports = router;

