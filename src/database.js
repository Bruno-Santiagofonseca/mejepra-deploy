const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');
const { Pool } = require('pg');

const DB_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DB_DIR, 'mejepra.db');
const TABLES = ['mediuns', 'mensalidades', 'faxina', 'despesas', 'trabalhos'];
const USE_PG = !!process.env.DATABASE_URL;

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

let db;
let SQL;
let pool;

const SCHEMA = {
  mediuns: `id SERIAL PRIMARY KEY, nome TEXT NOT NULL, tipo TEXT DEFAULT 'Médium', tel TEXT DEFAULT '', endereco TEXT DEFAULT '', email TEXT DEFAULT '', nasc TEXT DEFAULT '', obs TEXT DEFAULT '', iniciais TEXT DEFAULT '', data_cadastro TEXT DEFAULT '', status TEXT DEFAULT 'Ativo', created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()`,
  mensalidades: `id SERIAL PRIMARY KEY, medium_id INTEGER, nome TEXT NOT NULL, valor REAL DEFAULT 0, pago REAL DEFAULT 0, status TEXT DEFAULT 'pendente', mes TEXT DEFAULT '', ano TEXT DEFAULT '', created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()`,
  faxina: `id SERIAL PRIMARY KEY, medium_id INTEGER, nome TEXT NOT NULL, data TEXT, valor REAL DEFAULT 0, presenca TEXT DEFAULT 'feito', pagamento TEXT DEFAULT 'pago', mes TEXT DEFAULT '', ano TEXT DEFAULT '', created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()`,
  despesas: `id SERIAL PRIMARY KEY, item TEXT NOT NULL, valor REAL NOT NULL, parcela TEXT DEFAULT '1/1', divisao INTEGER DEFAULT 1, divisao_mediums TEXT DEFAULT '[]', pagamentos JSONB DEFAULT '{}'::jsonb, status TEXT DEFAULT 'aberta', mes TEXT DEFAULT '', ano TEXT DEFAULT '', parcela_atual INTEGER DEFAULT 1, total_parcelas INTEGER DEFAULT 1, despesa_original_id INTEGER, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()`,
  trabalhos: `id SERIAL PRIMARY KEY, entidade TEXT NOT NULL, valor REAL NOT NULL, mes TEXT DEFAULT '', ano TEXT DEFAULT '', divisao INTEGER DEFAULT 1, pagamentos JSONB DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()`,
  extras: `id SERIAL PRIMARY KEY, tipo TEXT DEFAULT 'receita', item TEXT NOT NULL, valor REAL NOT NULL, parcela TEXT DEFAULT '1/1', qtd INTEGER DEFAULT 1, divisao INTEGER DEFAULT 1, mes TEXT DEFAULT '', ano TEXT DEFAULT '', pagamentos JSONB DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()`
};

const JSON_COLUMNS = ['pagamentos', 'divisao_mediums'];
const INTEGER_COLUMNS = ['id', 'medium_id', 'divisao', 'qtd'];
const FLOAT_COLUMNS = ['valor', 'pago'];

function validateTable(table) {
  if (!TABLES.includes(table)) throw new Error(`Invalid table: ${table}`);
}

async function initDB() {
  if (USE_PG) {
    await initPG();
  } else {
    await initSQLite();
  }
}

async function initSQLite() {
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
  migrateAddPagamentosColumn();
  migrateAddParcelaColumns();
  saveDB();
}

function migrateAddPagamentosColumn() {
  try {
    db.run("ALTER TABLE despesas ADD COLUMN pagamentos TEXT DEFAULT '{}'");
    console.log('Added pagamentos column to despesas table');
  } catch (e) {
    // Column already exists, ignore
  }
}

function migrateAddParcelaColumns() {
  try {
    db.run("ALTER TABLE despesas ADD COLUMN parcela_atual INTEGER DEFAULT 1");
    console.log('Added parcela_atual column');
  } catch (e) {}
  try {
    db.run("ALTER TABLE despesas ADD COLUMN total_parcelas INTEGER DEFAULT 1");
    console.log('Added total_parcelas column');
  } catch (e) {}
  try {
    db.run("ALTER TABLE despesas ADD COLUMN despesa_original_id INTEGER");
    console.log('Added despesa_original_id column');
  } catch (e) {}
}

async function initPG() {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  await pool.query('SELECT 1');
  await createPgTables();
  await migrateFromOldMejepraData();
}

async function createPgTables() {
  for (const [table, columns] of Object.entries(SCHEMA)) {
    await pool.query(`CREATE TABLE IF NOT EXISTS ${table} (${columns})`);
  }
}

async function migrateFromOldMejepraData() {
  if (!USE_PG || !pool) return;
  try {
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'mejepra_data'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log("[DB Migration] Old table 'mejepra_data' does not exist. Skipping migration.");
      return;
    }

    console.log("[DB Migration] Old table 'mejepra_data' found! Checking if migration is needed...");

    // We check if the 'mediuns' table has any records to decide if we need to migrate
    const countCheck = await pool.query("SELECT COUNT(*) FROM mediuns");
    const mediunsCount = parseInt(countCheck.rows[0].count, 10);
    
    if (mediunsCount > 0) {
      console.log("[DB Migration] New relational tables already contain data. Skipping migration.");
      return;
    }

    console.log("[DB Migration] New tables are empty. Commencing migration from 'mejepra_data' to dedicated SQL tables...");

    // Get all valid columns for active tables from information_schema
    const columnsCheck = await pool.query(`
      SELECT table_name, column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public'
    `);
    
    const validColumnsMap = {};
    for (const row of columnsCheck.rows) {
      if (!validColumnsMap[row.table_name]) {
        validColumnsMap[row.table_name] = [];
      }
      validColumnsMap[row.table_name].push(row.column_name);
    }

    const res = await pool.query("SELECT key, value FROM mejepra_data");
    
    for (const row of res.rows) {
      const table = row.key;
      const data = row.value;
      
      if (!TABLES.includes(table)) {
        console.log(`[DB Migration] Skipping table '${table}' as it is not in the current active tables list.`);
        continue;
      }
      
      if (!Array.isArray(data) || data.length === 0) {
        console.log(`[DB Migration] Table '${table}' has no records in 'mejepra_data'.`);
        continue;
      }

      console.log(`[DB Migration] Migrating ${data.length} records into table '${table}'...`);

      const validCols = validColumnsMap[table] || [];

      for (const record of data) {
        const allColumns = Object.keys(record);
        const columns = allColumns.filter(c => validCols.includes(c));
        
        if (columns.length === 0) continue;

        const values = columns.map(c => {
          const val = record[c];
          if (val === null || val === undefined) return null;
          if (typeof val === 'object') return JSON.stringify(val);
          return val;
        });
        
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
        const insertQuery = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders}) ON CONFLICT (id) DO NOTHING`;
        
        await pool.query(insertQuery, values);
      }

      // Reset sequence for SERIAL id (safely using a subquery so it works on empty tables or tables of any size)
      await pool.query(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 1))`);
      console.log(`[DB Migration] Table '${table}' successfully migrated and sequence reset!`);
    }
    
    console.log("[DB Migration] Migration from 'mejepra_data' completed successfully! 🎉");
  } catch (err) {
    console.error("[DB Migration] Error during migration from 'mejepra_data':", err);
  }
}

function createTables() {
  for (const [table, cols] of Object.entries(SCHEMA)) {
    const sqliteCols = cols
      .replace(/SERIAL PRIMARY KEY/g, 'INTEGER PRIMARY KEY AUTOINCREMENT')
      .replace(/TIMESTAMPTZ DEFAULT now\(\)/g, "TEXT DEFAULT (datetime('now'))")
      .replace(/JSONB DEFAULT '\{\}'::jsonb/g, "TEXT DEFAULT '{}' ");
    db.run(`CREATE TABLE IF NOT EXISTS ${table} (${sqliteCols})`);
  }
}

function saveDB() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

function normalizeRow(row) {
  const normalized = { ...row };

  for (const key of Object.keys(normalized)) {
    const value = normalized[key];
    if (value === null || value === undefined) continue;

    if (JSON_COLUMNS.includes(key)) {
      if (typeof value === 'string') {
        try { normalized[key] = JSON.parse(value); } catch { normalized[key] = key === 'divisao_mediums' ? [] : {}; }
      }
      continue;
    }

    if (INTEGER_COLUMNS.includes(key) && typeof value === 'string') {
      normalized[key] = parseInt(value, 10);
      continue;
    }

    if (FLOAT_COLUMNS.includes(key) && typeof value === 'string') {
      normalized[key] = parseFloat(value);
      continue;
    }
  }

  return normalized;
}

function rowToObject(columns, values) {
  const obj = {};
  columns.forEach((col, i) => { obj[col] = values[i]; });
  return normalizeRow(obj);
}

function serializeValue(val, column) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'object') {
    return JSON.stringify(val);
  }
  return val;
}

async function queryAll(table) {
  validateTable(table);
  if (USE_PG) {
    const result = await pool.query(`SELECT * FROM ${table}`);
    return result.rows.map(normalizeRow);
  }

  const result = db.exec(`SELECT * FROM ${table}`);
  if (result.length === 0) return [];
  return result[0].values.map(v => rowToObject(result[0].columns, v));
}

async function queryOne(table, id) {
  validateTable(table);
  if (USE_PG) {
    const result = await pool.query(`SELECT * FROM ${table} WHERE id = $1`, [parseInt(id, 10)]);
    if (result.rows.length === 0) return null;
    return normalizeRow(result.rows[0]);
  }

  const result = db.exec(`SELECT * FROM ${table} WHERE id = ?`, [parseInt(id, 10)]);
  if (result.length === 0 || result[0].values.length === 0) return null;
  return rowToObject(result[0].columns, result[0].values[0]);
}

async function insert(table, record) {
  validateTable(table);
  const now = new Date().toISOString();
  const columns = Object.keys(record);
  const values = columns.map((c) => serializeValue(record[c], c));

  if (USE_PG) {
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    const query = `INSERT INTO ${table} (${columns.join(', ')}, created_at, updated_at) VALUES (${placeholders}, $${columns.length + 1}, $${columns.length + 2}) RETURNING *`;
    const params = [...values, now, now];
    const result = await pool.query(query, params);
    return normalizeRow(result.rows[0]);
  }

  const placeholders = columns.map(() => '?').join(', ');
  db.run(`INSERT INTO ${table} (${columns.join(', ')}, created_at, updated_at) VALUES (${placeholders}, ?, ?)`, [...values, now, now]);
  saveDB();

  const maxId = db.exec(`SELECT MAX(id) FROM ${table}`);
  const id = maxId.length > 0 && maxId[0].values.length > 0 ? maxId[0].values[0][0] : null;
  return id ? queryOne(table, id) : null;
}

async function update(table, id, updates) {
  validateTable(table);
  const existing = await queryOne(table, id);
  if (!existing) return null;

  const now = new Date().toISOString();
  const columns = Object.keys(updates);
  const values = columns.map((c) => serializeValue(updates[c], c));
  const setClause = columns.map((c, i) => `${c} = ${USE_PG ? `$${i + 1}` : '?'}`).join(', ');

  if (USE_PG) {
    const query = `UPDATE ${table} SET ${setClause}, updated_at = $${columns.length + 1} WHERE id = $${columns.length + 2} RETURNING *`;
    const params = [...values, now, parseInt(id, 10)];
    const result = await pool.query(query, params);
    return result.rows.length > 0 ? normalizeRow(result.rows[0]) : null;
  }

  db.run(`UPDATE ${table} SET ${setClause}, updated_at = ? WHERE id = ?`, [...values, now, parseInt(id, 10)]);
  saveDB();
  return queryOne(table, id);
}

async function deleteRow(table, id) {
  validateTable(table);
  if (USE_PG) {
    const result = await pool.query(`DELETE FROM ${table} WHERE id = $1`, [parseInt(id, 10)]);
    return result.rowCount > 0;
  }

  db.run(`DELETE FROM ${table} WHERE id = ?`, [parseInt(id, 10)]);
  const changes = db.getRowsModified();
  saveDB();
  return changes > 0;
}

async function query(table, filterFn) {
  const rows = await queryAll(table);
  return rows.filter(filterFn);
}

async function migrateFromJSON() {
  for (const table of TABLES) {
    const filePath = path.join(DB_DIR, `${table}.json`);
    if (!fs.existsSync(filePath)) continue;

    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (!Array.isArray(data) || data.length === 0) continue;

      const count = USE_PG ? await pool.query(`SELECT COUNT(*) FROM ${table}`) : db.exec(`SELECT COUNT(*) as cnt FROM ${table}`);
      const currentCount = USE_PG ? parseInt(count.rows[0].count, 10) : count[0].values[0][0];
      if (currentCount > 0) continue;

      console.log(`Migrating ${table}.json → database (${data.length} records)`);

      for (const row of data) {
        const columns = Object.keys(row);
        const values = columns.map((c) => {
          const val = row[c];
          if (val === null || val === undefined) return null;
          if (typeof val === 'object') return JSON.stringify(val);
          return val;
        });

        if (USE_PG) {
          const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
          await pool.query(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`, values);
        } else {
          const placeholders = columns.map(() => '?').join(', ');
          db.run(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`, values);
        }
      }

      if (!USE_PG) saveDB();
    } catch (e) {
      console.error(`Error migrating ${table}:`, e.message);
    }
  }
}

async function initDefaults() {
  // No default data — client starts with clean database
}

const dbApi = {
  init: initDB,
  getAll: queryAll,
  getById: queryOne,
  insert,
  update,
  delete: deleteRow,
  query,
  migrateFromJSON,
  initDefaults
};

module.exports = dbApi;
