// models/userModel.js
const pool = require('../config/db');
const bcrypt = require('bcryptjs');

const createUser = async (email, password) => {
  const hash = await bcrypt.hash(password, 10);
  const result = await pool.query(
    `INSERT INTO users (email, password_hash)
     VALUES ($1, $2)
     RETURNING id, email, created_at`,
    [email, hash]
  );
  return result.rows[0];
};

const findUserByEmail = async (email) => {
  const result = await pool.query(
    `SELECT id, email, created_at, password_hash
     FROM users
     WHERE email = $1`,
    [email]
  );
  return result.rows[0];
};

const findUserById = async (id) => {
  const result = await pool.query(
    `SELECT id, email, created_at
     FROM users
     WHERE id = $1`,
    [id]
  );
  return result.rows[0];
};

const verifyPassword = async (password, hash) => {
  return bcrypt.compare(password, hash);
};

module.exports = {
  createUser,
  findUserByEmail,
  findUserById,
  verifyPassword,
};
