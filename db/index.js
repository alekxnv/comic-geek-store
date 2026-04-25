const { Pool } = require("pg");

let pool = null;

if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  });
  pool.on("error", (e) => console.error("PostgreSQL pool error:", e.message));
  console.log("PostgreSQL configurado via DATABASE_URL");
} else {
  console.log("DATABASE_URL não configurado — usando sistema de arquivos JSON");
}

async function query(text, params) {
  if (!pool) throw new Error("PostgreSQL não configurado");
  return pool.query(text, params);
}

module.exports = { query, pool };
