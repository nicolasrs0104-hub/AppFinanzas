import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";

const db = new Database("finance.db");

// Initialize DB
db.exec(`
  DROP TABLE IF EXISTS transactions;
  DROP TABLE IF EXISTS settings;

  CREATE TABLE transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    amount REAL NOT NULL,
    description TEXT NOT NULL,
    account TEXT NOT NULL,
    to_account TEXT, -- For transfers
    category TEXT,
    type TEXT NOT NULL -- 'expense', 'income', 'payroll', 'transfer'
  );

  CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

// Initial settings
const insertSetting = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)");
insertSetting.run("salary", "1500");
insertSetting.run("debt", "298.56");
insertSetting.run("initial_yape", "25.61");
insertSetting.run("initial_plin", "137.56");
insertSetting.run("initial_casa", "0.0");
insertSetting.run("initial_mio", "0.0");
insertSetting.run("contract_extended", "false");

// Initial real transaction
db.prepare(
  "INSERT INTO transactions (date, amount, description, account, category, type) VALUES (?, ?, ?, ?, ?, ?)"
).run("2026-03-05", -18.50, "Gasto Inicial Real", "Yape", "🔄 Otros", "expense");

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/transactions", (req, res) => {
    const rows = db.prepare("SELECT * FROM transactions ORDER BY date DESC").all();
    res.json(rows);
  });

  app.post("/api/transactions", (req, res) => {
    const { date, amount, description, account, to_account, category, type } = req.body;
    const info = db.prepare(
      "INSERT INTO transactions (date, amount, description, account, to_account, category, type) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(date, amount, description, account, to_account || null, category || null, type);
    res.json({ id: info.lastInsertRowid });
  });

  app.get("/api/settings", (req, res) => {
    const rows = db.prepare("SELECT * FROM settings").all();
    const settings = rows.reduce((acc: any, row: any) => {
      acc[row.key] = row.value;
      return acc;
    }, {});
    res.json(settings);
  });

  app.post("/api/settings", (req, res) => {
    const { key, value } = req.body;
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(key, value);
    res.json({ success: true });
  });

  // Vite middleware for development
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
