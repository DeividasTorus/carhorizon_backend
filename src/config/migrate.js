const fs = require('fs');
const path = require('path');
const pool = require('./db');

async function runMigrations() {
  try {
    console.log("📦 Running SQL migrations...");

    const schema = fs.readFileSync(path.join(__dirname, '../../sql/schema.sql'), 'utf8');
    await pool.query(schema);
    console.log("✅ Schema created");

    const seed = fs.readFileSync(path.join(__dirname, '../../sql/seed.sql'), 'utf8');
    await pool.query(seed);
    console.log("🌱 Seed data inserted");

    // Run additional migration for title field
    const migration = fs.readFileSync(path.join(__dirname, '../../sql/migration_remove_title.sql'), 'utf8');
    await pool.query(migration);
    console.log("🔄 Migration applied: title field made nullable");

    console.log("🎉 Database ready!");
  } catch (err) {
    console.error("❌ Migration error:", err);
  } finally {
    await pool.end();
  }
}

runMigrations();
