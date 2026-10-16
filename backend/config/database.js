const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;
const pool = connectionString
  ? new Pool({
      connectionString,
      ssl: /neon\.tech|supabase\.(co|com)/.test(connectionString) ? { rejectUnauthorized: false } : false,
    })
  : null;

async function query(text, params = []) {
  if (!pool) {
    throw new Error('DATABASE_URL is not configured. Set it in the project .env file.');
  }

  return pool.query(text, params);
}

module.exports = {
  pool,
  query,
};
