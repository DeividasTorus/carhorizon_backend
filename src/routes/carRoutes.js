const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const auth = require('../middleware/auth');
const {
    addCar,
    getMyCars,
    getCar,
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
} = require('../controllers/carController');

// Multer config for car avatars
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads/cars/'));
  },
  filename: (req, file, cb) => {
    // Unikalus failo vardas su timestamp - kiekvieną kartą naujas
    const carId = req.params.carId;
    const ext = path.extname(file.originalname);
    const timestamp = Date.now();
    const filename = `car-${carId}-${timestamp}${ext}`;
    cb(null, filename);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG and WebP images are allowed'), false);
  }
};

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter
});

router.use(auth);

// automobiliai
router.post('/', addCar);
router.get('/my', getMyCars);
router.get('/search', searchCarByPlate);

// aktyvus automobilis
router.put('/active', setActiveCar);

// car following
router.get('/:carId/follow-status', getFollowStatus);
router.post('/:carId/follow', followCarAction);
router.post('/:carId/unfollow', unfollowCarAction);

// car stats (prieš :carId route, su auth middleware)
router.get('/:carId/stats', auth, getCarStats);

// car followers/following sąrašai
router.get('/:carId/followers', getCarFollowers);
router.get('/:carId/following', getCarFollowing);

// car avatar upload
router.put('/:carId/avatar', upload.single('avatar'), uploadCarAvatar);

// car bio update
router.put('/:carId/bio', updateCarBio);

// car delete
router.delete('/:carId', deleteCar);

// car profilis (gale, kad neperrašytų kitus routes)
router.get('/:carId', getCar);

module.exports = router;

