const pool = require('../config/db');

// Sukuria naują postą (CAR-BASED) - title is now optional/nullable
const createPost = async (carId, userId, title, description, postType = 'car_post') => {
  const result = await pool.query(
    `INSERT INTO posts (car_id, user_id, title, description, is_published, post_type)
     VALUES ($1, $2, $3, $4, true, $5)
     RETURNING id, car_id, user_id, title, description, created_at, updated_at, is_published, post_type`,
    [carId, userId, title, description, postType]
  );
  return result.rows[0];
};

// Gauna postą pagal ID
const getPostById = async (postId) => {
  const result = await pool.query(
    `SELECT id, car_id, user_id, title, description, created_at, updated_at, is_published, post_type
     FROM posts
     WHERE id = $1`,
    [postId]
  );
  return result.rows[0];
};

// Gauna sekamų automobilių postus (Feed) - CAR-TO-CAR following
// activeCarId - kuri mašina nori matyti savo feed'ą
const getFeed = async (activeCarId, limit = 20, offset = 0) => {
  const result = await pool.query(
    `SELECT 
       p.id, 
       p.car_id,
       p.user_id, 
       p.title, 
       p.description, 
       p.created_at, 
       p.updated_at, 
       p.is_published, 
       p.post_type,
       u.id as author_id,
       u.email as author_email,
       c.id as car_id,
       c.plate as car_plate,
       c.model as car_model,
       c.avatar_url as car_avatar_url,
       c.user_id as car_owner_id,
       (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) as likes_count,
       (SELECT COUNT(*) FROM post_comments WHERE post_id = p.id) as comments_count,
       EXISTS(
         SELECT 1 FROM post_likes 
         WHERE post_id = p.id AND car_id = $1
       ) as is_liked_by_me
     FROM posts p
     JOIN car_followers cf ON p.car_id = cf.followed_car_id
     JOIN users u ON p.user_id = u.id
     JOIN cars c ON p.car_id = c.id
     WHERE cf.follower_car_id = $1 
       AND p.is_published = true
     ORDER BY p.created_at DESC
     LIMIT $2 OFFSET $3`,
    [activeCarId, limit, offset]
  );
  return result.rows;
};

// Gauna vieno automobilio postus - CAR-BASED
const getCarPosts = async (carId, limit = 20, offset = 0, activeCarId = null) => {
  const result = await pool.query(
    `SELECT 
       p.id, 
       p.car_id,
       p.user_id, 
       p.title, 
       p.description, 
       p.created_at, 
       p.updated_at, 
       p.is_published, 
       p.post_type,
       u.id as author_id,
       u.email as author_email,
       c.id as car_id,
       c.plate as car_plate,
       c.model as car_model,
       c.avatar_url as car_avatar_url,
       c.user_id as car_owner_id,
       (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) as likes_count,
       (SELECT COUNT(*) FROM post_comments WHERE post_id = p.id) as comments_count,
       EXISTS(
         SELECT 1 FROM post_likes 
         WHERE post_id = p.id AND car_id = $4
       ) as is_liked_by_me
     FROM posts p
     JOIN users u ON p.user_id = u.id
     JOIN cars c ON p.car_id = c.id
     WHERE p.car_id = $1 
       AND p.is_published = true
     ORDER BY p.created_at DESC
     LIMIT $2 OFFSET $3`,
    [carId, limit, offset, activeCarId]
  );
  return result.rows;
};

// Ištrina postą
const deletePost = async (postId) => {
  const result = await pool.query(
    `DELETE FROM posts
     WHERE id = $1
     RETURNING id`,
    [postId]
  );
  return result.rows[0];
};

// Gauna bendrinį postų skaičių sekamų automobilių (CAR-TO-CAR)
const getFeedCount = async (activeCarId) => {
  const result = await pool.query(
    `SELECT COUNT(*) as count
     FROM posts p
     JOIN car_followers cf ON p.car_id = cf.followed_car_id
     WHERE cf.follower_car_id = $1 
       AND p.is_published = true`,
    [activeCarId]
  );
  return parseInt(result.rows[0].count, 10);
};

// Gauna bendrinį automobilio postų skaičių
const getCarPostsCount = async (carId) => {
  const result = await pool.query(
    `SELECT COUNT(*) as count
     FROM posts
     WHERE car_id = $1 
       AND is_published = true`,
    [carId]
  );
  return parseInt(result.rows[0].count, 10);
};

module.exports = {
  createPost,
  getPostById,
  getFeed,
  getCarPosts,
  deletePost,
  getFeedCount,
  getCarPostsCount,
};
