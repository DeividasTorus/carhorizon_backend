// routes/userRoutes.js
const express = require('express');
const router = express.Router();

const auth = require('../middleware/auth');
const { getMe } = require('../controllers/userController');

// visi /api/users maršrutai reikalauja auth
router.use(auth);

// GET /api/users/me
router.get('/me', getMe);

module.exports = router;
