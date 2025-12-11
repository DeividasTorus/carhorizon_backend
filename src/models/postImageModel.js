const pool = require('../config/db');

// Sukuria naują nuotrauko įrašą
const createPostImage = async (postId, imageUrl, displayOrder = 0) => {
  const result = await pool.query(
    `INSERT INTO post_images (post_id, image_url, display_order)
     VALUES ($1, $2, $3)
     RETURNING id, post_id, image_url, created_at, display_order`,
    [postId, imageUrl, displayOrder]
  );
  return result.rows[0];
};

// Gauna visos nuotraukos pagal post ID
const getPostImages = async (postId) => {
  const result = await pool.query(
    `SELECT id, post_id, image_url, created_at, display_order
     FROM post_images
     WHERE post_id = $1
     ORDER BY display_order ASC`,
    [postId]
  );
  return result.rows;
};

// Ištrina nuotraukų įrašą
const deletePostImage = async (imageId) => {
  const result = await pool.query(
    `DELETE FROM post_images
     WHERE id = $1
     RETURNING id`,
    [imageId]
  );
  return result.rows[0];
};

// Ištrina visos nuotraukos pagal post ID
const deletePostImages = async (postId) => {
  const result = await pool.query(
    `DELETE FROM post_images
     WHERE post_id = $1
     RETURNING id`,
    [postId]
  );
  return result.rows;
};

module.exports = {
  createPostImage,
  getPostImages,
  deletePostImage,
  deletePostImages,
};
