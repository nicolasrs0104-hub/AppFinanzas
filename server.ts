import express from "express";
import { createServer as createViteServer } from "vite";
import pg from "pg";
import path from "path";
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Conexión a tu bóveda de Neon
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json());

  // 1. Inicializar la Base de Datos (¡Sin borrar datos!)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      date TEXT NOT NULL,
      amount REAL NOT NULL,
      description TEXT NOT NULL,
      account TEXT NOT NULL,
      to_account TEXT,
      category TEXT,
      type TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // 2. Insertar configuración inicial solo si está vacío
  const initialSettings = [
    ['salary', '1500'],
    ['debt', '298.56'],
    ['initial_yape', '25.61'],
    ['initial_plin', '137.56'],
    ['initial_casa', '0.0'],
    ['initial_mio', '0.0'],
    ['contract_extended', 'false']
  ];

  for (const [key, value] of initialSettings) {
    await pool.query(
      "INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING",
      [key, value]
    );
  }

  // Rutas de tu API
  app.get("/api/transactions", async (req, res) => {
    try {
      const result = await pool.query("SELECT * FROM transactions ORDER BY date DESC");
      res.json(result.rows);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Error al obtener transacciones" });
    }
  });

  app.post("/api/transactions", async (req, res) => {
    const { date, amount, description, account, to_account, category, type } = req.body;
    try {
      const result = await pool.query(
        "INSERT INTO transactions (date, amount, description, account, to_account, category, type) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id",
        [date, amount, description, account, to_account || null, category || null, type]
      );
      res.json({ id: result.rows[0].id });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Error al guardar transacción" });
    }
  });

  app.get("/api/settings", async (req, res) => {
    try {
      const result = await pool.query("SELECT * FROM settings");
      const settings = result.rows.reduce((acc: any, row: any) => {
        acc[row.key] = row.value;
        return acc;
      }, {});
      res.json(settings);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Error al obtener configuración" });
    }
  });

  app.post("/api/settings", async (req, res) => {
    const { key, value } = req.body;
    try {
      await pool.query(
        "INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
        [key, value]
      );
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Error al actualizar configuración" });
    }
  });

  // Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
  });
}

startServer();