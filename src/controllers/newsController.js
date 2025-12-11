const { getAllNews } = require('../models/newsModel');
const { getPostImages } = require('../models/postImageModel');
const { getActiveCarForUser } = require('../models/carModel');

const listNews = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    let activeCarId = 0;

    // Get active car if user is authenticated
    if (userId) {
      const activeCar = await getActiveCarForUser(userId);
      activeCarId = activeCar?.id || 0;
    }

    // Get all news posts with like data
    const posts = await getAllNews(activeCarId);

    // Enrich posts with images
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
          is_liked_by_me: post.is_liked_by_me || false,
        };
      })
    );

    return res.json(enrichedPosts);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listNews,
};
