const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const DB_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DB_DIR, 'mejepra.db');

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

let db;
let SQL;

async function initDB() {
  SQL = await initSqlJs();

  let dbBuffer;
  if (fs.existsSync(DB_PATH)) {
    dbBuffer = fs.readFileSync(DB_PATH);
  }

  if (dbBuffer && dbBuffer.length > 0) {
    db = new SQL.Database(dbBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA journal_mode = WAL');
  db.run('PRAGMA synchronous = NORMAL');

  createTables();
  saveDB();
}

function createTables() {
  const schema = {
    mediuns: `id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL, tipo TEXT DEFAULT 'Médium', tel TEXT DEFAULT '', endereco TEXT DEFAULT '', email TEXT DEFAULT '', nasc TEXT DEFAULT '', obs TEXT DEFAULT '', iniciais TEXT DEFAULT '', data_cadastro TEXT DEFAULT '', status TEXT DEFAULT 'Ativo', created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))`,
    mensalidades: `id INTEGER PRIMARY KEY AUTOINCREMENT, medium_id INTEGER, nome TEXT NOT NULL, valor REAL DEFAULT 0, pago REAL DEFAULT 0, status TEXT DEFAULT 'pendente', mes TEXT DEFAULT '', ano TEXT DEFAULT '', created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))`,
    faxina: `id INTEGER PRIMARY KEY AUTOINCREMENT, medium_id INTEGER, nome TEXT NOT NULL, data TEXT, valor REAL DEFAULT 0, presenca TEXT DEFAULT 'feito', pagamento TEXT DEFAULT 'pago', mes TEXT DEFAULT '', ano TEXT DEFAULT '', created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))`,
    despesas: `id INTEGER PRIMARY KEY AUTOINCREMENT, item TEXT NOT NULL, valor REAL NOT NULL, parcela TEXT DEFAULT '1/1', divisao INTEGER DEFAULT 1, divisao_mediums TEXT DEFAULT '[]', status TEXT DEFAULT 'aberta', mes TEXT DEFAULT '', ano TEXT DEFAULT '', created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))`,
    trabalhos: `id INTEGER PRIMARY KEY AUTOINCREMENT, entidade TEXT NOT NULL, valor REAL NOT NULL, mes TEXT DEFAULT '', ano TEXT DEFAULT '', divisao INTEGER DEFAULT 1, pagamentos TEXT DEFAULT '{}', created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))`,
    extras: `id INTEGER PRIMARY KEY AUTOINCREMENT, tipo TEXT DEFAULT 'receita', item TEXT NOT NULL, valor REAL NOT NULL, parcela TEXT DEFAULT '1/1', qtd INTEGER DEFAULT 1, divisao INTEGER DEFAULT 1, mes TEXT DEFAULT '', ano TEXT DEFAULT '', pagamentos TEXT DEFAULT '{}', created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))`
  };

  for (const [table, cols] of Object.entries(schema)) {
    db.run(`CREATE TABLE IF NOT EXISTS ${table} (${cols})`);
  }
}

function saveDB() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

function rowToObject(columns, values) {
  const obj = {};
  columns.forEach((col, i) => { obj[col] = values[i]; });
  if (obj.pagamentos && typeof obj.pagamentos === 'string') {
    try { obj.pagamentos = JSON.parse(obj.pagamentos); } catch { obj.pagamentos = {}; }
  }
  return obj;
}

function queryAll(table) {
  const result = db.exec(`SELECT * FROM ${table}`);
  if (result.length === 0) return [];
  return result[0].values.map(v => rowToObject(result[0].columns, v));
}

function queryOne(table, id) {
  const result = db.exec(`SELECT * FROM ${table} WHERE id = ?`, [parseInt(id)]);
  if (result.length === 0 || result[0].values.length === 0) return null;
  return rowToObject(result[0].columns, result[0].values[0]);
}

function serializeValue(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'object') return JSON.stringify(val);
  return val;
}

const dbApi = {
  async init() {
    await initDB();
  },

  getAll(table) {
    return queryAll(table);
  },

  getById(table, id) {
    return queryOne(table, id);
  },

  insert(table, record) {
    const now = new Date().toISOString();
    const columns = Object.keys(record);
    const values = columns.map(c => serializeValue(record[c]));
    const placeholders = columns.map(() => '?').join(', ');

    db.run(`INSERT INTO ${table} (${columns.join(', ')}, created_at, updated_at) VALUES (${placeholders}, ?, ?)`, [...values, now, now]);
    saveDB();

    const maxId = db.exec(`SELECT MAX(id) FROM ${table}`);
    const id = maxId.length > 0 && maxId[0].values.length > 0 ? maxId[0].values[0][0] : null;
    return id ? queryOne(table, id) : null;
  },

  update(table, id, updates) {
    const existing = queryOne(table, id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const columns = Object.keys(updates);
    const values = columns.map(c => serializeValue(updates[c]));
    const setClause = columns.map(c => `${c} = ?`).join(', ');

    db.run(`UPDATE ${table} SET ${setClause}, updated_at = ? WHERE id = ?`, [...values, now, parseInt(id)]);
    saveDB();

    return queryOne(table, id);
  },

  delete(table, id) {
    db.run(`DELETE FROM ${table} WHERE id = ?`, [parseInt(id)]);
    const changes = db.getRowsModified();
    saveDB();
    return changes > 0;
  },

  query(table, filterFn) {
    return queryAll(table).filter(filterFn);
  },

  migrateFromJSON() {
    const TABLES = ['mediuns', 'mensalidades', 'faxina', 'despesas', 'trabalhos', 'extras'];

    for (const table of TABLES) {
      const filePath = path.join(DB_DIR, `${table}.json`);
      if (!fs.existsSync(filePath)) continue;

      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (!Array.isArray(data) || data.length === 0) continue;

        const count = db.exec(`SELECT COUNT(*) as cnt FROM ${table}`);
        if (count[0].values[0][0] > 0) continue;

        console.log(`Migrating ${table}.json → SQLite (${data.length} records)`);

        for (const row of data) {
          const columns = Object.keys(row);
          const values = columns.map(c => {
            const val = row[c];
            if (val === null || val === undefined) return null;
            if (typeof val === 'object') return JSON.stringify(val);
            return val;
          });
          const placeholders = columns.map(() => '?').join(', ');
          db.run(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`, values);
        }
        saveDB();
      } catch (e) {
        console.error(`Error migrating ${table}:`, e.message);
      }
    }
  },

  initDefaults() {
    // No default data — client starts with clean database
  }
};

module.exports = dbApi;
