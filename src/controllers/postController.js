const {
  createPost,
  getPostById,
  getFeed,
  getCarPosts,
  deletePost,
  getFeedCount,
  getCarPostsCount,
} = require('../models/postModel');
const {
  createPostImage,
  getPostImages,
  deletePostImages,
} = require('../models/postImageModel');
const { getCarById, getActiveCarForUser } = require('../models/carModel');
const pool = require('../config/db');
const path = require('path');
const fs = require('fs').promises;
const { getIO } = require('../socket');

// POST /api/posts/create (CAR-BASED)
const createUserPost = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { description, carId } = req.body;

    // Validacija
    if (!carId) {
      return res.status(400).json({ error: 'carId is required' });
    }

    if (!description || !description.trim()) {
      return res.status(400).json({ error: 'Description is required' });
    }

    // Patikrina ar automobilis egzistuoja ir priklauso vartotojui
    const car = await getCarById(carId);
    if (!car) {
      return res.status(404).json({ error: 'Car not found' });
    }

    if (car.user_id !== userId) {
      return res.status(403).json({ error: 'You do not own this car' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'At least one image is required' });
    }

    if (req.files.length > 10) {
      return res.status(400).json({ error: 'Maximum 10 images allowed' });
    }

    // Sukuria postą su car_id (be title)
    const post = await createPost(carId, userId, null, description.trim(), 'car_post');

    // Prideda nuotraukas
    const images = [];

    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      // Multer jau išsaugojo failą, dabar tik kuriame DB įrašą
      const imageUrl = `/uploads/posts/${file.filename}`;

      try {
        // Sukurti DB įrašą
        const image = await createPostImage(post.id, imageUrl, i);
        images.push(image);
      } catch (err) {
        console.error('Error creating image record:', err);
        // Tęsti su kitomis nuotraukomis, jei viena nepavyko
      }
    }

    return res.status(201).json({
      success: true,
      post: {
        id: post.id,
        car_id: post.car_id,
        user_id: post.user_id,
        title: post.title,
        description: post.description,
        created_at: post.created_at,
        is_published: post.is_published,
        post_type: post.post_type,
        car: {
          id: car.id,
          plate: car.plate,
          model: car.model,
          user_id: car.user_id,
        },
        images: images,
      },
    });
  } catch (err) {
    console.error('createUserPost error:', err);
    next(err);
  }
};

// GET /api/posts/:postId - Get single post
const getSinglePost = async (req, res, next) => {
  try {
    const postId = parseInt(req.params.postId);
    const userId = req.user?.id;
    let activeCarId = null;

    if (!postId || isNaN(postId)) {
      return res.status(400).json({ error: 'Invalid post ID' });
    }

    // Get active car if user is authenticated
    if (userId) {
      const activeCar = await getActiveCarForUser(userId);
      activeCarId = activeCar?.id || null;
    }

    // Get post with like/comment counts
    const result = await pool.query(
      `SELECT 
        p.*,
        EXISTS(
          SELECT 1 FROM post_likes 
          WHERE post_id = p.id AND car_id = $2
        ) as is_liked_by_user,
        (SELECT COUNT(*)::INTEGER FROM post_likes WHERE post_id = p.id) as likes_count,
        (SELECT COUNT(*)::INTEGER FROM post_comments WHERE post_id = p.id) as comments_count,
        json_build_object(
          'id', c.id,
          'plate', c.plate,
          'model', c.model,
          'avatar_url', c.avatar_url
        ) as car
      FROM posts p
      LEFT JOIN cars c ON p.car_id = c.id
      WHERE p.id = $1`,
      [postId, activeCarId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    const post = result.rows[0];

    // Get post images
    const images = await getPostImages(postId);
    post.images = images;

    return res.json(post);

  } catch (err) {
    console.error('getSinglePost error:', err);
    next(err);
  }
};

// GET /api/posts/feed
const getFeedPosts = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = parseInt(req.query.offset) || 0;
    const activeCarId = req.query.carId;

    // Validacija - carId yra privalomas
    if (!activeCarId) {
      return res.status(400).json({ error: 'carId parameter is required' });
    }

    // Patikrina ar ši mašina priklauso vartotojui
    const activeCar = await getCarById(activeCarId);
    if (!activeCar) {
      return res.status(404).json({ error: 'Car not found' });
    }

    if (activeCar.user_id !== userId) {
      return res.status(403).json({ error: 'You do not own this car' });
    }

    // Gauna postus - tų automobilių, kuriuos AKTYVI MAŠINA seka
    const posts = await getFeed(activeCarId, limit, offset);

    // Gauna bendrinį skaičių
    const total = await getFeedCount(activeCarId);

    // Prideda nuotraukas kiekvienam postui
    const enrichedPosts = await Promise.all(
      posts.map(async (post) => {
        const images = await getPostImages(post.id);
        return {
          id: post.id,
          car_id: post.car_id,
          user_id: post.user_id,
          title: post.title,
          description: post.description,
          created_at: post.created_at,
          updated_at: post.updated_at,
          is_published: post.is_published,
          post_type: post.post_type,
          car: {
            id: post.car_id,
            plate: post.car_plate,
            model: post.car_model,
            avatar_url: post.car_avatar_url,
            year: post.car_year,
            owner_id: post.car_owner_id,
          },
          author: {
            id: post.author_id,
            email: post.author_email,
          },
          images: images,
          likes_count: parseInt(post.likes_count) || 0,
          comments_count: parseInt(post.comments_count) || 0,
          is_liked_by_user: post.is_liked_by_me || false,
        };
      })
    );

    return res.json({
      success: true,
      posts: enrichedPosts,
      total: total,
      limit: limit,
      offset: offset,
    });
  } catch (err) {
    console.error('getFeedPosts error:', err);
    next(err);
  }
};

// GET /api/posts/car/:carId (RENAMED FROM getUserPostList)
const getCarPostList = async (req, res, next) => {
  try {
    const carId = parseInt(req.params.carId);
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = parseInt(req.query.offset) || 0;
    const userId = req.user?.id;
    let activeCarId = null;

    if (!carId || isNaN(carId)) {
      return res.status(400).json({ error: 'Invalid car ID' });
    }

    // Patikrina ar automobilis egzistuoja
    const car = await getCarById(carId);
    if (!car) {
      return res.status(404).json({ error: 'Car not found' });
    }

    // Get active car if user is authenticated
    if (userId) {
      const activeCar = await getActiveCarForUser(userId);
      activeCarId = activeCar?.id || null;
    }

    // Gauna postus
    const posts = await getCarPosts(carId, limit, offset, activeCarId);

    // Gauna bendrinį skaičių
    const total = await getCarPostsCount(carId);

    // Prideda nuotraukas kiekvienam postui
    const enrichedPosts = await Promise.all(
      posts.map(async (post) => {
        const images = await getPostImages(post.id);
        return {
          id: post.id,
          car_id: post.car_id,
          user_id: post.user_id,
          title: post.title,
          description: post.description,
          created_at: post.created_at,
          updated_at: post.updated_at,
          is_published: post.is_published,
          post_type: post.post_type,
          car: {
            id: post.car_id,
            plate: post.car_plate,
            model: post.car_model,
            avatar_url: post.car_avatar_url,
            owner_id: post.car_owner_id,
          },
          author: {
            id: post.author_id,
            email: post.author_email,
          },
          images: images,
          likes_count: parseInt(post.likes_count) || 0,
          comments_count: parseInt(post.comments_count) || 0,
          is_liked_by_user: post.is_liked_by_me || false,
        };
      })
    );

    return res.json({
      success: true,
      posts: enrichedPosts,
      total: total,
      limit: limit,
      offset: offset,
    });
  } catch (err) {
    console.error('getCarPostList error:', err);
    next(err);
  }
};

// DELETE /api/posts/:postId
const deleteUserPost = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const postId = parseInt(req.params.postId);

    if (!postId || isNaN(postId)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid post ID' 
      });
    }

    // Get user's active car
    const activeCar = await getActiveCarForUser(userId);
    if (!activeCar) {
      return res.status(400).json({
        success: false,
        error: 'No active car selected'
      });
    }

    // Get post
    const post = await getPostById(postId);
    if (!post) {
      return res.status(404).json({ 
        success: false,
        error: 'Post not found' 
      });
    }

    // Check if post belongs to user's active car
    if (post.car_id !== activeCar.id) {
      return res.status(403).json({ 
        success: false,
        error: 'Not authorized to delete this post' 
      });
    }

    // Get post images for file deletion
    const images = await getPostImages(postId);

    // Delete image files
    const postsDir = path.join(__dirname, '../../uploads/posts');
    for (const image of images) {
      try {
        const fileName = image.image_url.split('/').pop();
        const filePath = path.join(postsDir, fileName);
        await fs.unlink(filePath);
      } catch (err) {
        console.log('File deletion error for', image.image_url, ':', err.message);
      }
    }

    // Delete post images records
    await deletePostImages(postId);

    // Delete post (CASCADE will handle post_likes and post_comments)
    await deletePost(postId);

    return res.json({
      success: true,
      message: 'Post deleted successfully'
    });
  } catch (err) {
    console.error('deleteUserPost error:', err);
    next(err);
  }
};

// PUT /api/posts/:postId - Edit post
const editPost = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const postId = parseInt(req.params.postId);
    const { description } = req.body;

    if (!postId || isNaN(postId)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid post ID' 
      });
    }

    // Validate input
    if (!description || !description.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Description is required'
      });
    }

    // Get user's active car
    const activeCar = await getActiveCarForUser(userId);
    if (!activeCar) {
      return res.status(400).json({
        success: false,
        error: 'No active car selected'
      });
    }

    // Get post
    const post = await getPostById(postId);
    if (!post) {
      return res.status(404).json({ 
        success: false,
        error: 'Post not found' 
      });
    }

    // Check ownership
    if (post.car_id !== activeCar.id) {
      return res.status(403).json({ 
        success: false,
        error: 'Not authorized to edit this post' 
      });
    }

    // Update post
    const result = await pool.query(
      `UPDATE posts 
       SET description = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [description.trim(), postId]
    );

    return res.json({
      success: true,
      post: result.rows[0]
    });
  } catch (err) {
    console.error('editPost error:', err);
    next(err);
  }
};

// POST /api/posts/:postId/like - Toggle like on post
const likePost = async (req, res, next) => {
  try {
    const postId = parseInt(req.params.postId);
    const userId = req.user.id;

    if (!postId || isNaN(postId)) {
      return res.status(400).json({ success: false, error: 'Invalid post ID' });
    }

    // Get user's active car
    const pool = require('../config/db');
    const activeCarResult = await pool.query(
      'SELECT id FROM cars WHERE user_id = $1 AND is_active = true',
      [userId]
    );

    if (activeCarResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No active car found'
      });
    }

    const carId = activeCarResult.rows[0].id;

    // Check if post exists
    const post = await getPostById(postId);
    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }

    // Check if already liked
    const existingLike = await pool.query(
      'SELECT id FROM post_likes WHERE post_id = $1 AND car_id = $2',
      [postId, carId]
    );

    let liked;
    if (existingLike.rows.length > 0) {
      // Unlike
      await pool.query(
        'DELETE FROM post_likes WHERE post_id = $1 AND car_id = $2',
        [postId, carId]
      );
      liked = false;
    } else {
      // Like
      await pool.query(
        'INSERT INTO post_likes (post_id, car_id) VALUES ($1, $2)',
        [postId, carId]
      );
      liked = true;

      // Create notification (don't notify yourself)
      if (post.car_id !== carId) {
        const notifResult = await pool.query(
          `INSERT INTO notifications (recipient_car_id, actor_car_id, type, post_id, message)
           VALUES ($1, $2, 'like', $3, 'palaikino jūsų įrašą')
           RETURNING id`,
          [post.car_id, carId, postId]
        );

        // Get notification with actor details and emit
        const io = getIO();
        if (io) {
          const notificationDetails = await pool.query(
            `SELECT 
              n.*,
              c.plate as actor_name,
              c.avatar_url as actor_avatar,
              '0 Minutes' as time_ago
            FROM notifications n
            JOIN cars c ON c.id = n.actor_car_id
            WHERE n.id = $1`,
            [notifResult.rows[0].id]
          );

          if (notificationDetails.rows.length > 0) {
            io.emit('new_notification', notificationDetails.rows[0]);
          }
        }
      }
    }

    // Get updated likes count
    const likesCountResult = await pool.query(
      'SELECT COUNT(*) FROM post_likes WHERE post_id = $1',
      [postId]
    );

    const likesCount = parseInt(likesCountResult.rows[0].count);

    // Emit WebSocket event to all clients
    const io = getIO();
    if (io) {
      io.emit('post_liked', {
        post_id: postId,
        likes_count: likesCount,
        car_id: carId,
        liked: liked
      });
    }

    return res.json({
      success: true,
      liked,
      likesCount
    });

  } catch (err) {
    console.error('likePost error:', err);
    next(err);
  }
};

// POST /api/posts/:postId/comments - Add comment to post
const addComment = async (req, res, next) => {
  try {
    const postId = parseInt(req.params.postId);
    const userId = req.user.id;
    const { commentText } = req.body;

    if (!postId || isNaN(postId)) {
      return res.status(400).json({ success: false, error: 'Invalid post ID' });
    }

    // Validate comment text
    if (!commentText || commentText.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Comment text is required'
      });
    }

    if (commentText.length > 500) {
      return res.status(400).json({
        success: false,
        error: 'Comment cannot exceed 500 characters'
      });
    }

    // Get user's active car
    const pool = require('../config/db');
    const activeCarResult = await pool.query(
      'SELECT id FROM cars WHERE user_id = $1 AND is_active = true',
      [userId]
    );

    if (activeCarResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No active car found'
      });
    }

    const carId = activeCarResult.rows[0].id;

    // Check if post exists
    const post = await getPostById(postId);
    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }

    // Insert comment
    const result = await pool.query(
      `INSERT INTO post_comments (post_id, car_id, comment_text)
       VALUES ($1, $2, $3)
       RETURNING id, post_id, car_id, comment_text, created_at`,
      [postId, carId, commentText.trim()]
    );

    const comment = result.rows[0];

    // Get total comments count
    const commentsCountResult = await pool.query(
      'SELECT COUNT(*)::INTEGER FROM post_comments WHERE post_id = $1',
      [postId]
    );
    const commentsCount = commentsCountResult.rows[0].count;

    // Emit WebSocket event for comment count update
    const io = getIO();
    if (io) {
      io.emit('post_commented', {
        post_id: postId,
        comments_count: commentsCount
      });
    }

    // Create notification (don't notify yourself)
    if (post.car_id !== carId) {
      const notifResult = await pool.query(
        `INSERT INTO notifications (recipient_car_id, actor_car_id, type, post_id, comment_id, message)
         VALUES ($1, $2, 'comment', $3, $4, 'pakomentavo jūsų įrašą')
         RETURNING id`,
        [post.car_id, carId, postId, comment.id]
      );

      // Get notification with actor details and emit
      const notificationDetails = await pool.query(
        `SELECT 
          n.*,
          c.plate as actor_name,
          c.avatar_url as actor_avatar,
          '0 Minutes' as time_ago
        FROM notifications n
        JOIN cars c ON c.id = n.actor_car_id
        WHERE n.id = $1`,
        [notifResult.rows[0].id]
      );

      if (io && notificationDetails.rows.length > 0) {
        io.emit('new_notification', notificationDetails.rows[0]);
      }
    }

    // Get car details
    const carDetails = await pool.query(
      'SELECT id, plate, model, avatar_url FROM cars WHERE id = $1',
      [carId]
    );

    return res.status(201).json({
      success: true,
      comment: {
        ...comment,
        car: carDetails.rows[0],
        likes_count: 0,
        is_liked_by_me: false
      }
    });

  } catch (err) {
    console.error('addComment error:', err);
    next(err);
  }
};

// GET /api/posts/:postId/comments - Get comments for post
const getComments = async (req, res, next) => {
  try {
    const postId = parseInt(req.params.postId);
    const userId = req.user.id;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = parseInt(req.query.offset) || 0;

    if (!postId || isNaN(postId)) {
      return res.status(400).json({ success: false, error: 'Invalid post ID' });
    }

    // Get user's active car
    const pool = require('../config/db');
    const activeCarResult = await pool.query(
      'SELECT id FROM cars WHERE user_id = $1 AND is_active = true',
      [userId]
    );

    const myCarId = activeCarResult.rows.length > 0 ? activeCarResult.rows[0].id : null;

    // Get comments with car details and like info
    const comments = await pool.query(
      `SELECT 
        pc.id,
        pc.post_id,
        pc.car_id,
        pc.comment_text,
        pc.created_at,
        pc.updated_at,
        c.plate,
        c.model,
        c.avatar_url,
        (SELECT COUNT(*) FROM comment_likes WHERE comment_id = pc.id) as likes_count,
        EXISTS(
          SELECT 1 FROM comment_likes 
          WHERE comment_id = pc.id AND car_id = $2
        ) as is_liked_by_me
      FROM post_comments pc
      JOIN cars c ON pc.car_id = c.id
      WHERE pc.post_id = $1
      ORDER BY pc.created_at DESC
      LIMIT $3 OFFSET $4`,
      [postId, myCarId, limit, offset]
    );

    // Get total count
    const totalResult = await pool.query(
      'SELECT COUNT(*) FROM post_comments WHERE post_id = $1',
      [postId]
    );

    const formattedComments = comments.rows.map(row => ({
      id: row.id,
      post_id: row.post_id,
      car_id: row.car_id,
      comment_text: row.comment_text,
      created_at: row.created_at,
      updated_at: row.updated_at,
      car: {
        id: row.car_id,
        plate: row.plate,
        model: row.model,
        avatar_url: row.avatar_url
      },
      likes_count: parseInt(row.likes_count),
      is_liked_by_me: row.is_liked_by_me
    }));

    return res.json({
      success: true,
      comments: formattedComments,
      total: parseInt(totalResult.rows[0].count)
    });

  } catch (err) {
    console.error('getComments error:', err);
    next(err);
  }
};

// POST /api/comments/:commentId/like - Toggle like on comment
const likeComment = async (req, res, next) => {
  try {
    const commentId = parseInt(req.params.commentId);
    const userId = req.user.id;

    if (!commentId || isNaN(commentId)) {
      return res.status(400).json({ success: false, error: 'Invalid comment ID' });
    }

    // Get user's active car
    const pool = require('../config/db');
    const activeCarResult = await pool.query(
      'SELECT id FROM cars WHERE user_id = $1 AND is_active = true',
      [userId]
    );

    if (activeCarResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No active car found'
      });
    }

    const carId = activeCarResult.rows[0].id;

    // Check if comment exists
    const commentCheck = await pool.query(
      'SELECT id FROM post_comments WHERE id = $1',
      [commentId]
    );

    if (commentCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Comment not found' });
    }

    // Check if already liked
    const existingLike = await pool.query(
      'SELECT id FROM comment_likes WHERE comment_id = $1 AND car_id = $2',
      [commentId, carId]
    );

    let liked;
    if (existingLike.rows.length > 0) {
      // Unlike
      await pool.query(
        'DELETE FROM comment_likes WHERE comment_id = $1 AND car_id = $2',
        [commentId, carId]
      );
      liked = false;
    } else {
      // Like
      await pool.query(
        'INSERT INTO comment_likes (comment_id, car_id) VALUES ($1, $2)',
        [commentId, carId]
      );
      liked = true;
    }

    // Get updated likes count
    const likesCountResult = await pool.query(
      'SELECT COUNT(*) FROM comment_likes WHERE comment_id = $1',
      [commentId]
    );

    return res.json({
      success: true,
      liked,
      likesCount: parseInt(likesCountResult.rows[0].count)
    });

  } catch (err) {
    console.error('likeComment error:', err);
    next(err);
  }
};

// DELETE comment
const deleteComment = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const commentId = parseInt(req.params.commentId);

    if (!commentId || isNaN(commentId)) {
      return res.status(400).json({ error: 'Invalid comment ID' });
    }

    // Get user's active car
    const activeCar = await getActiveCarForUser(userId);
    if (!activeCar) {
      return res.status(400).json({ error: 'No active car found' });
    }

    const carId = activeCar.id;

    // Get comment details with post info
    const commentCheckResult = await pool.query(
      `SELECT pc.id, pc.car_id, pc.post_id, p.car_id as post_car_id
       FROM post_comments pc
       JOIN posts p ON pc.post_id = p.id
       WHERE pc.id = $1`,
      [commentId]
    );

    if (commentCheckResult.rows.length === 0) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    const comment = commentCheckResult.rows[0];
    const isCommentAuthor = comment.car_id === carId;
    const isPostAuthor = comment.post_car_id === carId;

    // Check permissions - comment author or post author can delete
    if (!isCommentAuthor && !isPostAuthor) {
      return res.status(403).json({ error: 'Not authorized to delete this comment' });
    }

    // Delete comment (cascade will delete comment_likes)
    await pool.query('DELETE FROM post_comments WHERE id = $1', [commentId]);

    // Get updated comments count
    const commentsCountResult = await pool.query(
      'SELECT COUNT(*)::INTEGER FROM post_comments WHERE post_id = $1',
      [comment.post_id]
    );
    const commentsCount = commentsCountResult.rows[0].count;

    // Emit WebSocket event for comment count update
    const io = getIO();
    if (io) {
      io.emit('post_commented', {
        post_id: comment.post_id,
        comments_count: commentsCount
      });
    }

    return res.json({
      success: true,
      message: 'Comment deleted successfully'
    });

  } catch (err) {
    console.error('deleteComment error:', err);
    next(err);
  }
};

// EDIT comment
const editComment = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const commentId = parseInt(req.params.commentId);
    const { commentText } = req.body;

    if (!commentId || isNaN(commentId)) {
      return res.status(400).json({ error: 'Invalid comment ID' });
    }

    // Validation
    if (!commentText || !commentText.trim()) {
      return res.status(400).json({ error: 'Comment text is required' });
    }

    if (commentText.trim().length > 500) {
      return res.status(400).json({ error: 'Comment cannot exceed 500 characters' });
    }

    // Get user's active car
    const activeCar = await getActiveCarForUser(userId);
    if (!activeCar) {
      return res.status(400).json({ error: 'No active car found' });
    }

    const carId = activeCar.id;

    // Get comment and verify ownership
    const commentCheckResult = await pool.query(
      'SELECT id, car_id FROM post_comments WHERE id = $1',
      [commentId]
    );

    if (commentCheckResult.rows.length === 0) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    const comment = commentCheckResult.rows[0];

    // Check if user owns this comment
    if (comment.car_id !== carId) {
      return res.status(403).json({ error: 'Not authorized to edit this comment' });
    }

    // Update comment
    const result = await pool.query(
      `UPDATE post_comments 
       SET comment_text = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, comment_text, updated_at`,
      [commentText.trim(), commentId]
    );

    return res.json({
      success: true,
      comment: result.rows[0]
    });

  } catch (err) {
    console.error('editComment error:', err);
    next(err);
  }
};

module.exports = {
  createUserPost,
  getSinglePost,
  getFeedPosts,
  getCarPostList,
  deleteUserPost,
  editPost,
  likePost,
  addComment,
  getComments,
  likeComment,
  deleteComment,
  editComment,
};
