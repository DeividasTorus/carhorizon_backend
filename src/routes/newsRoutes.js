const express = require('express');
const router = express.Router();
const { listNews } = require('../controllers/newsController');
const { optionalAuth } = require('../middleware/auth');

// GET /api/news (optional auth - shows like status if logged in)
router.get('/', optionalAuth, listNews);

module.exports = router;
