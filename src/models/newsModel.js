const pool = require('../config/db');

const getAllNews = async (activeCarId = 0) => {
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
       c.year as car_year,
       c.user_id as car_owner_id,
       (SELECT COUNT(*)::INTEGER FROM post_likes WHERE post_id = p.id) as likes_count,
       (SELECT COUNT(*)::INTEGER FROM post_comments WHERE post_id = p.id) as comments_count,
       EXISTS(
         SELECT 1 FROM post_likes 
         WHERE post_id = p.id AND car_id = $1
       ) as is_liked_by_me
     FROM posts p
     JOIN users u ON p.user_id = u.id
     JOIN cars c ON p.car_id = c.id
     WHERE p.is_published = true
     ORDER BY p.created_at DESC
     LIMIT 50`,
    [activeCarId]
  );
  return result.rows;
};

module.exports = {
  getAllNews,
};
