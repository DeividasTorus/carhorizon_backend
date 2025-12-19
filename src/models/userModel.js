// models/userModel.js
const pool = require('../config/db');
const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 10;

const createUser = async (email, password) => {
  const hash = await bcrypt.hash(password, SALT_ROUNDS);

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

  return result.rows[0] || null;
};

const findUserById = async (id) => {
  // ✅ būtina grąžinti password_hash, nes changePassword turi patikrinti currentPassword
  const result = await pool.query(
    `SELECT id, email, created_at, password_hash
     FROM users
     WHERE id = $1`,
    [id]
  );

  return result.rows[0] || null;
};

const verifyPassword = async (password, hash) => {
  return bcrypt.compare(password, hash);
};

const updateUserPassword = async (id, newPassword) => {
  const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  const result = await pool.query(
    `UPDATE users
     SET password_hash = $1
     WHERE id = $2
     RETURNING id, email, created_at`,
    [newHash, id]
  );

  return result.rows[0] || null;
};

module.exports = {
  createUser,
  findUserByEmail,
  findUserById,
  verifyPassword,
  updateUserPassword,
};

