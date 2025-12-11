const {
  createCar,
  getCarsByUser,
  getCarById,
  findCarByPlate,
  setActiveCarForUser, // 👈 NAUJA funkcija iš carModel
} = require('../models/carModel');
const {
  isFollowing,
  followCar,
  unfollowCar,
  getFollowersCount,
  getFollowingCount,
} = require('../models/carFollowerModel');
const { getCarPostsCount } = require('../models/postModel');
const pool = require('../config/db');
const path = require('path');
const { getIO } = require('../socket');

// POST /api/cars
const addCar = async (req, res, next) => {
  try {
    const { plate, model } = req.body || {};
    if (!plate) {
      return res.status(400).json({ error: 'Plate is required' });
    }

    // Sukuriam mašiną. is_active pagal schema.sql default = FALSE
    const car = await createCar(req.user.id, plate, model);

    // 👇 Jei norėtum, galima čia padaryti PIRMĄ auto aktyviu,
    // bet pagal tavo idėją aktyvų auto žmogus RANKA pasirinks garaže.
    // Todėl čia specialiai NIEKO nedarom su is_active.

    return res.status(201).json(car);
  } catch (err) {
    next(err);
  }
};

// GET /api/cars/my
const getMyCars = async (req, res, next) => {
  try {
    const cars = await getCarsByUser(req.user.id);
    // cars masyve dabar bus ir is_active laukas
    return res.json(cars);
  } catch (err) {
    next(err);
  }
};

// GET /api/cars/:id
const getCar = async (req, res, next) => {
  try {
    const car = await getCarById(req.params.id);
    if (!car) {
      return res.status(404).json({ error: 'Car not found' });
    }
    return res.json(car);
  } catch (err) {
    next(err);
  }
};

// GET /api/cars/search?plate=ABC123
// Paieška pagal numerį VISAI sistemai (naudojama, kai ieškai kito vairuotojo)
// Normaluoja numerį: ABC 123 → ABC123 (be tarpų)
// Grąžina savininko informaciją su avatar_url
const searchCarByPlate = async (req, res, next) => {
  try {
    const plate = (req.query.plate || '').trim();
    if (!plate) {
      return res.status(400).json({ error: 'Query "plate" is required' });
    }

    const car = await findCarByPlate(plate);
    if (!car) {
      return res.status(404).json({ error: 'Car not found' });
    }

    console.log('🔍 Search result for plate:', plate, '→ Car:', car);

    // Grąžiname visus reikalingus duomenis su savininko info ir car avatar
    return res.json({
      id: car.id,
      plate: car.plate,
      model: car.model,
      bio: car.bio,
      avatar_url: car.avatar_url,
      user_id: car.user_id,
      userId: car.user_id, // Alternative property name for compatibility
      is_active: car.is_active,
      createdAt: car.created_at,
      owner: {
        id: car.owner_id,
        name: car.owner_email || 'User'
      }
    });
  } catch (err) {
    next(err);
  }
};

// PUT /api/cars/active
// Body: { carId }
// Nustato, kuris USERIO automobilis yra aktyvus (garažo pasirinkimas)
const setActiveCar = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { carId } = req.body || {};

    if (!carId) {
      return res.status(400).json({ error: 'carId is required' });
    }

    const car = await getCarById(carId);
    if (!car) {
      return res.status(404).json({ error: 'Car not found' });
    }

    // Saugumo patikra – žmogus negali pasidaryti aktyviu kito žmogaus auto
    if (car.user_id !== userId) {
      return res.status(403).json({ error: 'This car does not belong to you' });
    }

    // 👉 Čia bus logika carModel pusėje:
    // - visiems mano auto: is_active = false
    // - šitam konkrečiam: is_active = true
    const updatedCar = await setActiveCarForUser(userId, carId);

    // Grąžinam atnaujintą auto (su is_active = true)
    return res.json(updatedCar);
  } catch (err) {
    next(err);
  }
};

// GET /api/cars/:carId/follow-status
const getFollowStatus = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const targetCarId = parseInt(req.params.carId);
    const activeCarId = parseInt(req.query.activeCarId);

    if (!targetCarId || isNaN(targetCarId)) {
      return res.status(400).json({ error: 'Invalid car ID' });
    }

    if (!activeCarId || isNaN(activeCarId)) {
      return res.status(400).json({ error: 'activeCarId query parameter is required' });
    }

    // Patikrina ar aktyvi mašina priklauso vartotojui
    const activeCar = await getCarById(activeCarId);
    if (!activeCar) {
      return res.status(404).json({ error: 'Active car not found' });
    }

    if (activeCar.user_id !== userId) {
      return res.status(403).json({ error: 'You do not own this car' });
    }

    // Tikrina ar AKTYVI MAŠINA seka TARGET mašiną
    const follow = await isFollowing(activeCarId, targetCarId);

    return res.json({
      success: true,
      isFollowing: !!follow,
      followedAt: follow ? follow.followed_at : null,
    });
  } catch (err) {
    console.error('getFollowStatus error:', err);
    next(err);
  }
};

// POST /api/cars/:carId/follow
const followCarAction = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const targetCarId = parseInt(req.params.carId);
    const activeCarId = parseInt(req.body.activeCarId || req.query.activeCarId);

    if (!targetCarId || isNaN(targetCarId)) {
      return res.status(400).json({ error: 'Invalid car ID' });
    }

    if (!activeCarId || isNaN(activeCarId)) {
      return res.status(400).json({ error: 'activeCarId is required in body or query' });
    }

    // Patikrina ar aktyvi mašina priklauso vartotojui
    const activeCar = await getCarById(activeCarId);
    if (!activeCar) {
      return res.status(404).json({ error: 'Active car not found' });
    }

    if (activeCar.user_id !== userId) {
      return res.status(403).json({ error: 'You do not own this car' });
    }

    // Patikrina ar target automobilis egzistuoja
    const targetCar = await getCarById(targetCarId);
    if (!targetCar) {
      return res.status(404).json({ error: 'Target car not found' });
    }

    // Negalima sekti savo pačios mašinos
    if (activeCarId === targetCarId) {
      return res.status(400).json({ error: 'Cannot follow your own car' });
    }

    // Patikrina ar jau seka
    const existing = await isFollowing(activeCarId, targetCarId);
    if (existing) {
      return res.status(400).json({ error: 'Already following this car' });
    }

    // Sukuria follow įrašą - MAŠINA seka MAŠINĄ
    await followCar(activeCarId, targetCarId);

    // Create notification
    const notifResult = await pool.query(
      `INSERT INTO notifications (recipient_car_id, actor_car_id, type, message)
       VALUES ($1, $2, 'follow', 'pradėjo sekti jus')
       RETURNING id`,
      [targetCarId, activeCarId]
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

    return res.json({
      success: true,
      message: 'Now following this car',
      isFollowing: true,
    });
  } catch (err) {
    console.error('followCar error:', err);
    next(err);
  }
};

// POST /api/cars/:carId/unfollow
const unfollowCarAction = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const targetCarId = parseInt(req.params.carId);
    const activeCarId = parseInt(req.body.activeCarId || req.query.activeCarId);

    if (!targetCarId || isNaN(targetCarId)) {
      return res.status(400).json({ error: 'Invalid car ID' });
    }

    if (!activeCarId || isNaN(activeCarId)) {
      return res.status(400).json({ error: 'activeCarId is required in body or query' });
    }

    // Patikrina ar aktyvi mašina priklauso vartotojui
    const activeCar = await getCarById(activeCarId);
    if (!activeCar) {
      return res.status(404).json({ error: 'Active car not found' });
    }

    if (activeCar.user_id !== userId) {
      return res.status(403).json({ error: 'You do not own this car' });
    }

    // Ištrinti follow įrašą - MAŠINA nustoja sekti MAŠINĄ
    const deleted = await unfollowCar(activeCarId, targetCarId);
    if (!deleted) {
      return res.status(400).json({ error: 'Not following this car' });
    }

    return res.json({
      success: true,
      message: 'Unfollowed successfully',
      isFollowing: false,
    });
  } catch (err) {
    console.error('unfollowCar error:', err);
    next(err);
  }
};

// GET /api/cars/:carId (atnaujintas su stats)
const getCarProfile = async (req, res, next) => {
  try {
    const carId = parseInt(req.params.carId);

    if (!carId || isNaN(carId)) {
      return res.status(400).json({ error: 'Invalid car ID' });
    }

    const car = await getCarById(carId);
    if (!car) {
      return res.status(404).json({ error: 'Car not found' });
    }

    // Gauti statistiką
    const postsCount = await getCarPostsCount(carId);
    const followersCount = await getFollowersCount(carId);

    return res.json({
      success: true,
      car: {
        id: car.id,
        plate: car.plate,
        model: car.model,
        bio: car.bio,
        avatar_url: car.avatar_url,
        user_id: car.user_id,
        owner_id: car.user_id,
        created_at: car.created_at,
        is_active: car.is_active,
        owner: {
          id: car.owner_id || car.user_id,
          email: car.owner_email,
        },
        stats: {
          posts_count: postsCount,
          followers_count: followersCount,
        },
      },
    });
  } catch (err) {
    console.error('getCarProfile error:', err);
    next(err);
  }
};

// GET /api/cars/:carId/stats - Gauna automobilio statistiką
const getCarStats = async (req, res, next) => {
  try {
    const carId = parseInt(req.params.carId);

    if (!carId || isNaN(carId)) {
      return res.status(400).json({
        error: 'Invalid carId parameter',
        success: false,
      });
    }

    // Patikrinti ar automobilis egzistuoja
    const car = await getCarById(carId);
    if (!car) {
      return res.status(404).json({
        error: 'Car not found',
        success: false,
      });
    }

    // 1. FOLLOWERS - Kiek mašinų seka šį automobilį
    const followersCount = await getFollowersCount(carId);

    // 2. FOLLOWING - Kiek mašinų šis automobilis seka
    const followingCount = await getFollowingCount(carId);

    // 3. POSTS - Kiek postų šis automobilis sukūrė
    const postsCount = await getCarPostsCount(carId);

    res.json({
      success: true,
      followers_count: followersCount,
      following_count: followingCount,
      posts_count: postsCount,
    });

    console.log(
      `Car ${carId} stats: followers=${followersCount}, following=${followingCount}, posts=${postsCount}`
    );
  } catch (err) {
    console.error('getCarStats error:', err);
    res.status(500).json({
      error: 'Failed to fetch car stats',
      message: err.message,
      success: false,
    });
  }
};

// GET /api/cars/:carId/followers - sąrašas, kas seka šį automobilį
const getCarFollowers = async (req, res, next) => {
  try {
    const carId = parseInt(req.params.carId);

    if (!carId || isNaN(carId)) {
      return res.status(400).json({ success: false, error: 'Invalid carId' });
    }

    // užtikriname, kad automobilis egzistuoja
    const car = await getCarById(carId);
    if (!car) {
      return res.status(404).json({ success: false, error: 'Car not found' });
    }

    const result = await pool.query(
      `SELECT c.id, c.plate, c.model, c.avatar_url
       FROM car_followers cf
       JOIN cars c ON c.id = cf.follower_car_id
       WHERE cf.followed_car_id = $1
       ORDER BY c.plate ASC`,
      [carId]
    );

    return res.json({ success: true, followers: result.rows });
  } catch (err) {
    console.error('getCarFollowers error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch followers' });
  }
};

// GET /api/cars/:carId/following - sąrašas, ką šis automobilis seka
const getCarFollowing = async (req, res, next) => {
  try {
    const carId = parseInt(req.params.carId);

    if (!carId || isNaN(carId)) {
      return res.status(400).json({ success: false, error: 'Invalid carId' });
    }

    // užtikriname, kad automobilis egzistuoja
    const car = await getCarById(carId);
    if (!car) {
      return res.status(404).json({ success: false, error: 'Car not found' });
    }

    const result = await pool.query(
      `SELECT c.id, c.plate, c.model, c.avatar_url
       FROM car_followers cf
       JOIN cars c ON c.id = cf.followed_car_id
       WHERE cf.follower_car_id = $1
       ORDER BY c.plate ASC`,
      [carId]
    );

    return res.json({ success: true, following: result.rows });
  } catch (err) {
    console.error('getCarFollowing error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch following' });
  }
};

// PUT /api/cars/:carId/avatar - Upload automobilio avataro
const uploadCarAvatar = async (req, res, next) => {
  try {
    const carId = parseInt(req.params.carId);
    const userId = req.user?.id;

    if (!carId || isNaN(carId)) {
      return res.status(400).json({ success: false, error: 'Invalid carId' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    // Patikrinti ar automobilis priklauso šiam useriui
    const car = await getCarById(carId);
    
    if (!car) {
      return res.status(404).json({ success: false, error: 'Car not found' });
    }

    if (car.user_id !== userId) {
      return res.status(403).json({ success: false, error: 'Not your car' });
    }

    // Naujojo failo kelias (Multer jau išsaugojo failą)
    const newAvatarPath = `/uploads/cars/${req.file.filename}`;
    const newFilename = req.file.filename;

    // Ištrink SENUS car avatar failus (bet ne naują!)
    const fs = require('fs').promises;
    const uploadsDir = path.join(__dirname, '../uploads/cars');
    const carPrefix = `car-${carId}`;
    
    try {
      const files = await fs.readdir(uploadsDir);
      const deletePromises = files
        .filter(file => file.startsWith(carPrefix) && file !== newFilename) // Skip naują failą
        .map(file => fs.unlink(path.join(uploadsDir, file)));
      
      if (deletePromises.length > 0) {
        await Promise.all(deletePromises);
        console.log(`✅ Deleted ${deletePromises.length} old avatar(s) for car ${carId}`);
      }
    } catch (err) {
      console.log('⚠️ Error cleaning old avatars:', err.message);
    }

    // Išsaugoti naują avatar_url į DB
    await pool.query(
      'UPDATE cars SET avatar_url = $1 WHERE id = $2',
      [newAvatarPath, carId]
    );

    console.log(`✅ Car ${carId} avatar updated:`, newAvatarPath);

    return res.json({
      success: true,
      avatar_url: newAvatarPath,
      message: 'Car avatar uploaded successfully'
    });

  } catch (error) {
    console.error('uploadCarAvatar error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to upload car avatar',
      message: error.message
    });
  }
};

// PUT /api/cars/:carId/bio - Update car bio
const updateCarBio = async (req, res, next) => {
  try {
    const carId = parseInt(req.params.carId);
    const userId = req.user?.id;
    const { bio } = req.body;

    if (!carId || isNaN(carId)) {
      return res.status(400).json({ success: false, error: 'Invalid carId' });
    }

    // Validate bio length
    if (bio && bio.length > 150) {
      return res.status(400).json({
        success: false,
        error: 'Bio cannot exceed 150 characters'
      });
    }

    // Check if car exists and belongs to user
    const car = await getCarById(carId);
    
    if (!car) {
      return res.status(404).json({ success: false, error: 'Car not found' });
    }

    if (car.user_id !== userId) {
      return res.status(403).json({ success: false, error: "You don't own this car" });
    }

    // Update bio
    const result = await pool.query(
      'UPDATE cars SET bio = $1 WHERE id = $2 RETURNING id, user_id, plate, model, bio, avatar_url, created_at, is_active',
      [bio || null, carId]
    );

    console.log(`✅ Car ${carId} bio updated`);

    return res.json({
      success: true,
      message: 'Bio updated successfully',
      car: result.rows[0]
    });

  } catch (error) {
    console.error('Update bio error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update bio',
      message: error.message
    });
  }
};

// DELETE /api/cars/:carId - Delete car
const deleteCar = async (req, res, next) => {
  try {
    const carId = parseInt(req.params.carId);
    const userId = req.user?.id;

    if (!carId || isNaN(carId)) {
      return res.status(400).json({ success: false, error: 'Invalid carId' });
    }

    // Check if car exists and belongs to user
    const car = await getCarById(carId);
    
    if (!car) {
      return res.status(404).json({ success: false, error: 'Car not found' });
    }

    if (car.user_id !== userId) {
      return res.status(403).json({ success: false, error: "You don't own this car" });
    }

    // Check if this is the user's last car
    const userCarsResult = await pool.query(
      'SELECT COUNT(*) FROM cars WHERE user_id = $1',
      [userId]
    );

    if (parseInt(userCarsResult.rows[0].count) <= 1) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete your last car. You must have at least one car.'
      });
    }

    // If this is the active car, set another car as active
    if (car.is_active) {
      const anotherCar = await pool.query(
        'SELECT id FROM cars WHERE user_id = $1 AND id != $2 LIMIT 1',
        [userId, carId]
      );

      if (anotherCar.rows.length > 0) {
        await pool.query(
          'UPDATE cars SET is_active = false WHERE user_id = $1',
          [userId]
        );
        
        await pool.query(
          'UPDATE cars SET is_active = true WHERE id = $1',
          [anotherCar.rows[0].id]
        );
      }
    }

    // Delete related data (CASCADE should handle most, but being explicit)
    await pool.query('DELETE FROM car_followers WHERE follower_car_id = $1 OR followed_car_id = $1', [carId]);
    await pool.query('DELETE FROM posts WHERE car_id = $1', [carId]);

    // Delete avatar file if exists
    if (car.avatar_url) {
      const fs = require('fs').promises;
      const uploadsDir = path.join(__dirname, '../uploads/cars');
      const carPrefix = `car-${carId}`;
      
      try {
        const files = await fs.readdir(uploadsDir);
        const deletePromises = files
          .filter(file => file.startsWith(carPrefix))
          .map(file => fs.unlink(path.join(uploadsDir, file)));
        
        if (deletePromises.length > 0) {
          await Promise.all(deletePromises);
          console.log(`✅ Deleted avatar files for car ${carId}`);
        }
      } catch (err) {
        console.log('⚠️ Error deleting avatar files:', err.message);
      }
    }

    // Finally, delete the car
    await pool.query('DELETE FROM cars WHERE id = $1', [carId]);

    console.log(`✅ Car ${carId} deleted`);

    return res.json({
      success: true,
      message: 'Car deleted successfully',
      deletedCarId: carId
    });

  } catch (error) {
    console.error('Delete car error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete car',
      message: error.message
    });
  }
};

module.exports = {
  addCar,
  getMyCars,
  getCar: getCarProfile,
  searchCarByPlate,
  setActiveCar,
  getFollowStatus,
  followCarAction,
  unfollowCarAction,
  getCarStats,
  getCarFollowers,
  getCarFollowing,
  uploadCarAvatar,
  updateCarBio,
  deleteCar,
};


