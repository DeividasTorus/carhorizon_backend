const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

const {
  likeComment,
  deleteComment,
  editComment,
} = require('../controllers/postController');

// All routes require authentication
router.use(auth);

// PUT /api/comments/:commentId - edit comment
router.put('/:commentId', editComment);

// DELETE /api/comments/:commentId - delete comment
router.delete('/:commentId', deleteComment);

// POST /api/comments/:commentId/like - toggle comment like
router.post('/:commentId/like', likeComment);

module.exports = router;
