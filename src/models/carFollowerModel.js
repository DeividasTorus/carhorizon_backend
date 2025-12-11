const pool = require('../config/db');

// Patikrina ar automobilis (followerCarId) seka kitą automobilį (followedCarId)
const isFollowing = async (followerCarId, followedCarId) => {
  const result = await pool.query(
    `SELECT id, follower_car_id, followed_car_id, followed_at
     FROM car_followers
     WHERE follower_car_id = $1 AND followed_car_id = $2`,
    [followerCarId, followedCarId]
  );
  return result.rows[0];
};

// Automobilis (followerCarId) pradeda sekti kitą automobilį (followedCarId)
const followCar = async (followerCarId, followedCarId) => {
  const result = await pool.query(
    `INSERT INTO car_followers (follower_car_id, followed_car_id)
     VALUES ($1, $2)
     ON CONFLICT (follower_car_id, followed_car_id) DO NOTHING
     RETURNING id, follower_car_id, followed_car_id, followed_at`,
    [followerCarId, followedCarId]
  );
  return result.rows[0];
};

// Automobilis (followerCarId) nustoja sekti kitą automobilį (followedCarId)
const unfollowCar = async (followerCarId, followedCarId) => {
  const result = await pool.query(
    `DELETE FROM car_followers
     WHERE follower_car_id = $1 AND followed_car_id = $2
     RETURNING id`,
    [followerCarId, followedCarId]
  );
  return result.rows[0];
};

// Gauna automobilio sekėjų skaičių (kiek automobilių seka šį automobilį)
const getFollowersCount = async (followedCarId) => {
  const result = await pool.query(
    `SELECT COUNT(*) as count
     FROM car_followers
     WHERE followed_car_id = $1`,
    [followedCarId]
  );
  return parseInt(result.rows[0].count, 10);
};

// Gauna automobilių, kuriuos seka šis automobilis (following count)
const getFollowingCount = async (followerCarId) => {
  const result = await pool.query(
    `SELECT COUNT(*) as count
     FROM car_followers
     WHERE follower_car_id = $1`,
    [followerCarId]
  );
  return parseInt(result.rows[0].count, 10);
};

module.exports = {
  isFollowing,
  followCar,
  unfollowCar,
  getFollowersCount,
  getFollowingCount,
};
