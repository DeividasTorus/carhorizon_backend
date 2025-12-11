const pool = require('../config/db');

// Sukuria naują automobilį (pagal schema.sql is_active default = FALSE)
const createCar = async (userId, plate, model) => {
  const result = await pool.query(
    `INSERT INTO cars (user_id, plate, model)
     VALUES ($1, $2, $3)
     RETURNING id, user_id, plate, model, bio, avatar_url, created_at, is_active`,
    [userId, plate, model || null]
  );
  return result.rows[0];
};

// Visi vartotojo automobiliai (įskaitant is_active)
const getCarsByUser = async (userId) => {
  const result = await pool.query(
    `SELECT id, user_id, plate, model, bio, avatar_url, created_at, is_active
     FROM cars
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );
  return result.rows;
};

// Vienas automobilis pagal id
const getCarById = async (id) => {
  const result = await pool.query(
    `SELECT id, user_id, plate, model, bio, avatar_url, created_at, is_active
     FROM cars
     WHERE id = $1`,
    [id]
  );
  return result.rows[0];
};

// Globali paieška pagal numerį (naudojama, kai ieškai kito vairuotojo auto)
// Normaluoja numerį: ABC 123 → ABC123
// Grąžina ir savininko informaciją (id, email, avatar_url)
const findCarByPlate = async (plate) => {
  // Normaluojame numerį - pašaliname visus tarpus
  const normalizedPlate = plate.toUpperCase().replace(/\s/g, '');
  
  const result = await pool.query(
    `SELECT 
      c.id, 
      c.user_id, 
      c.plate, 
      c.model, 
      c.bio,
      c.avatar_url, 
      c.created_at, 
      c.is_active,
      u.id as owner_id,
      u.email as owner_email
     FROM cars c
     JOIN users u ON c.user_id = u.id
     WHERE REPLACE(UPPER(c.plate), ' ', '') = $1
     LIMIT 1`,
    [normalizedPlate]
  );
  return result.rows[0];
};

// Nustato, kuris vartotojo automobilis yra aktyvus (garažo pasirinkimas)
// - visiems to userio auto: is_active = FALSE
// - pasirinktai mašinai: is_active = TRUE
// Darom transakcijoje, kad viskas būtų tvarkinga.
const setActiveCarForUser = async (userId, carId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1) visus šito userio auto padarom neaktyvius
    await client.query(
      `UPDATE cars
       SET is_active = FALSE
       WHERE user_id = $1`,
      [userId]
    );

    // 2) pasirinktą auto padarom aktyviu
    const result = await client.query(
      `UPDATE cars
       SET is_active = TRUE
       WHERE user_id = $1
         AND id = $2
       RETURNING id, user_id, plate, model, bio, avatar_url, created_at, is_active`,
      [userId, carId]
    );

    await client.query('COMMIT');
    return result.rows[0] || null;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// Gauna aktyvų automobilį vartotojo
const getActiveCarForUser = async (userId) => {
  const result = await pool.query(
    `SELECT id, user_id, plate, model, bio, avatar_url, created_at, is_active
     FROM cars
     WHERE user_id = $1 AND is_active = true`,
    [userId]
  );
  return result.rows[0] || null;
};

module.exports = {
  createCar,
  getCarsByUser,
  getCarById,
  findCarByPlate,
  setActiveCarForUser,
  getActiveCarForUser,
};


