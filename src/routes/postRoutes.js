const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const uploadPostImages = require('../config/multerPostImages');

const {
  createUserPost,
  getSinglePost,
  getFeedPosts,
  getCarPostList,
  deleteUserPost,
  editPost,
  likePost,
  addComment,
  getComments,
} = require('../controllers/postController');
const { optionalAuth } = require('../middleware/auth');

// POST /api/posts/create (requires auth)
router.post('/create', auth, uploadPostImages.array('images', 10), createUserPost);

// GET /api/posts/feed - sekamų automobilių postai (requires auth)
router.get('/feed', auth, getFeedPosts);

// GET /api/posts/car/:carId - konkretaus automobilio postai (optional auth)
router.get('/car/:carId', optionalAuth, getCarPostList);

// GET /api/posts/:postId - single post (optional auth)
router.get('/:postId', optionalAuth, getSinglePost);

// POST /api/posts/:postId/like - toggle like (requires auth)
router.post('/:postId/like', auth, likePost);

// POST /api/posts/:postId/comments - add comment (requires auth)
router.post('/:postId/comments', auth, addComment);

// GET /api/posts/:postId/comments - get comments (requires auth)
router.get('/:postId/comments', auth, getComments);

// PUT /api/posts/:postId - edit post (requires auth)
router.put('/:postId', auth, editPost);

// DELETE /api/posts/:postId (requires auth)
router.delete('/:postId', auth, deleteUserPost);

module.exports = router;
