const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

function openDatabase(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  return new sqlite3.Database(filePath, (err) => {
    if (err) {
      console.error('Erro ao abrir banco SQLite:', err.message);
      process.exit(1);
    }
  });
}

function initialize(db) {
  const createTable = `CREATE TABLE IF NOT EXISTS mediuns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    tipo TEXT DEFAULT 'Médium',
    tel TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  )`;

  db.run(createTable);
}

module.exports = { openDatabase, initialize };
