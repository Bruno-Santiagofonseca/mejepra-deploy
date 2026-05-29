const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');
const { Pool } = require('pg');

const DB_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DB_DIR, 'centro360.db');
const TABLES = ['users', 'terreiros', 'mediuns', 'mensalidades', 'faxina', 'despesas', 'trabalhos', 'extras', 'audit_log'];
const DATA_TABLES = ['mediuns', 'mensalidades', 'faxina', 'despesas', 'trabalhos', 'extras'];
const USE_PG = !!process.env.DATABASE_URL;

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

let db;
let SQL;
let pool;

const SCHEMA = {
  users: `id SERIAL PRIMARY KEY, nome TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, terreiro_id INTEGER, role TEXT DEFAULT 'admin', created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()`,
  terreiros: `id SERIAL PRIMARY KEY, nome TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()`,
  mediuns: `id SERIAL PRIMARY KEY, nome TEXT NOT NULL, tipo TEXT DEFAULT 'Médium', tel TEXT DEFAULT '', endereco TEXT DEFAULT '', email TEXT DEFAULT '', nasc TEXT DEFAULT '', obs TEXT DEFAULT '', iniciais TEXT DEFAULT '', data_cadastro TEXT DEFAULT '', status TEXT DEFAULT 'Ativo', terreiro_id INTEGER DEFAULT 1, created_by INTEGER DEFAULT NULL, updated_by INTEGER DEFAULT NULL, deleted_at TIMESTAMPTZ DEFAULT NULL, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()`,
  mensalidades: `id SERIAL PRIMARY KEY, medium_id INTEGER, nome TEXT NOT NULL, valor REAL DEFAULT 0, pago REAL DEFAULT 0, status TEXT DEFAULT 'pendente', mes TEXT DEFAULT '', ano TEXT DEFAULT '', terreiro_id INTEGER DEFAULT 1, created_by INTEGER DEFAULT NULL, updated_by INTEGER DEFAULT NULL, deleted_at TIMESTAMPTZ DEFAULT NULL, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()`,
  faxina: `id SERIAL PRIMARY KEY, medium_id INTEGER, nome TEXT NOT NULL, data TEXT, valor REAL DEFAULT 0, presenca TEXT DEFAULT 'feito', pagamento TEXT DEFAULT 'pago', mes TEXT DEFAULT '', ano TEXT DEFAULT '', terreiro_id INTEGER DEFAULT 1, created_by INTEGER DEFAULT NULL, updated_by INTEGER DEFAULT NULL, deleted_at TIMESTAMPTZ DEFAULT NULL, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()`,
  despesas: `id SERIAL PRIMARY KEY, item TEXT NOT NULL, valor REAL NOT NULL, parcela TEXT DEFAULT '1/1', divisao INTEGER DEFAULT 1, divisao_mediums TEXT DEFAULT '[]', pagamentos JSONB DEFAULT '{}'::jsonb, status TEXT DEFAULT 'aberta', mes TEXT DEFAULT '', ano TEXT DEFAULT '', parcela_atual INTEGER DEFAULT 1, total_parcelas INTEGER DEFAULT 1, despesa_original_id INTEGER, terreiro_id INTEGER DEFAULT 1, created_by INTEGER DEFAULT NULL, updated_by INTEGER DEFAULT NULL, deleted_at TIMESTAMPTZ DEFAULT NULL, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()`,
  trabalhos: `id SERIAL PRIMARY KEY, entidade TEXT NOT NULL, valor REAL NOT NULL, mes TEXT DEFAULT '', ano TEXT DEFAULT '', divisao INTEGER DEFAULT 1, pagamentos JSONB DEFAULT '{}'::jsonb, terreiro_id INTEGER DEFAULT 1, created_by INTEGER DEFAULT NULL, updated_by INTEGER DEFAULT NULL, deleted_at TIMESTAMPTZ DEFAULT NULL, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()`,
  extras: `id SERIAL PRIMARY KEY, tipo TEXT DEFAULT 'receita', item TEXT NOT NULL, valor REAL NOT NULL, parcela TEXT DEFAULT '1/1', qtd INTEGER DEFAULT 1, divisao INTEGER DEFAULT 1, mes TEXT DEFAULT '', ano TEXT DEFAULT '', pagamentos JSONB DEFAULT '{}'::jsonb, terreiro_id INTEGER DEFAULT 1, created_by INTEGER DEFAULT NULL, updated_by INTEGER DEFAULT NULL, deleted_at TIMESTAMPTZ DEFAULT NULL, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()`,
  audit_log: `id SERIAL PRIMARY KEY, user_id INTEGER, user_name TEXT, action TEXT NOT NULL, table_name TEXT NOT NULL, record_id INTEGER, changes TEXT, terreiro_id INTEGER, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()`
};

const JSON_COLUMNS = ['pagamentos', 'divisao_mediums'];
const INTEGER_COLUMNS = ['id', 'medium_id', 'divisao', 'qtd', 'terreiro_id'];
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
  migrateAddTerreiroId();
  migrateAddSoftDelete();
  migrateAddAuditLogUpdatedAt();
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

function migrateAddTerreiroId() {
  var dataTables = ['mediuns', 'mensalidades', 'faxina', 'despesas', 'trabalhos', 'extras'];
  for (var t of dataTables) {
    try {
      db.run("ALTER TABLE " + t + " ADD COLUMN terreiro_id INTEGER DEFAULT 1");
    } catch (e) {}
  }
}

function migrateAddSoftDelete() {
  for (var t of DATA_TABLES) {
    try { db.run("ALTER TABLE " + t + " ADD COLUMN deleted_at TEXT DEFAULT NULL"); } catch (e) {}
    try { db.run("ALTER TABLE " + t + " ADD COLUMN created_by INTEGER DEFAULT NULL"); } catch (e) {}
    try { db.run("ALTER TABLE " + t + " ADD COLUMN updated_by INTEGER DEFAULT NULL"); } catch (e) {}
  }
}

function migrateAddAuditLogUpdatedAt() {
  try { db.run("ALTER TABLE audit_log ADD COLUMN updated_at TEXT DEFAULT NULL"); } catch (e) {}
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

async function queryAll(table, includeDeleted) {
  validateTable(table);
  var filterDeleted = !includeDeleted && DATA_TABLES.includes(table) ? ' WHERE deleted_at IS NULL' : '';
  if (USE_PG) {
    const result = await pool.query(`SELECT * FROM ${table}${filterDeleted}`);
    return result.rows.map(normalizeRow);
  }

  const result = db.exec(`SELECT * FROM ${table}${filterDeleted}`);
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

async function insert(table, record, user) {
  validateTable(table);
  if (user && DATA_TABLES.includes(table)) record.created_by = user.id;
  const now = new Date().toISOString();
  const columns = Object.keys(record);
  const values = columns.map((c) => serializeValue(record[c], c));

  if (USE_PG) {
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    const query = `INSERT INTO ${table} (${columns.join(', ')}, created_at, updated_at) VALUES (${placeholders}, $${columns.length + 1}, $${columns.length + 2}) RETURNING *`;
    const params = [...values, now, now];
    const result = await pool.query(query, params);
    var inserted = normalizeRow(result.rows[0]);
    if (user && DATA_TABLES.includes(table)) logAudit(user.id, user.nome, 'CREATE', table, inserted.id, null, user.terreiro_id);
    return inserted;
  }

  const placeholders = columns.map(() => '?').join(', ');
  db.run(`INSERT INTO ${table} (${columns.join(', ')}, created_at, updated_at) VALUES (${placeholders}, ?, ?)`, [...values, now, now]);
  saveDB();

  const maxId = db.exec(`SELECT MAX(id) FROM ${table}`);
  const id = maxId.length > 0 && maxId[0].values.length > 0 ? maxId[0].values[0][0] : null;
  var result = id ? await queryOne(table, id) : null;
  if (user && DATA_TABLES.includes(table) && id) logAudit(user.id, user.nome, 'CREATE', table, id, null, user.terreiro_id);
  return result;
}

async function update(table, id, updates, user) {
  validateTable(table);
  const existing = await queryOne(table, id);
  if (!existing) return null;

  if (user && DATA_TABLES.includes(table)) updates.updated_by = user.id;
  const now = new Date().toISOString();
  const columns = Object.keys(updates);
  const values = columns.map((c) => serializeValue(updates[c], c));
  const setClause = columns.map((c, i) => `${c} = ${USE_PG ? `$${i + 1}` : '?'}`).join(', ');

  if (USE_PG) {
    const query = `UPDATE ${table} SET ${setClause}, updated_at = $${columns.length + 1} WHERE id = $${columns.length + 2} RETURNING *`;
    const params = [...values, now, parseInt(id, 10)];
    const result = await pool.query(query, params);
    var updated = result.rows.length > 0 ? normalizeRow(result.rows[0]) : null;
    if (user && DATA_TABLES.includes(table) && updated) {
      var diff = buildDiff(existing, updated);
      if (diff) logAudit(user.id, user.nome, 'UPDATE', table, id, diff, user.terreiro_id);
    }
    return updated;
  }

  db.run(`UPDATE ${table} SET ${setClause}, updated_at = ? WHERE id = ?`, [...values, now, parseInt(id, 10)]);
  saveDB();
  var updated = await queryOne(table, id);
  if (user && DATA_TABLES.includes(table) && updated) {
    var diff = buildDiff(existing, updated);
    if (diff) logAudit(user.id, user.nome, 'UPDATE', table, id, diff, user.terreiro_id);
  }
  return updated;
}

function buildDiff(before, after) {
  var changes = {};
  for (var k of Object.keys(after)) {
    if (k === 'created_at' || k === 'updated_at' || k === 'updated_by') continue;
    var bv = before[k], av = after[k];
    if (JSON.stringify(bv) !== JSON.stringify(av)) changes[k] = { from: bv, to: av };
  }
  return Object.keys(changes).length > 0 ? changes : null;
}

async function deleteRow(table, id, user) {
  validateTable(table);
  if (DATA_TABLES.includes(table)) {
    var existing = await queryOne(table, id);
    if (!existing) return false;
    var now = new Date().toISOString();
    var result = await update(table, id, { deleted_at: now }, user);
    if (result && user) logAudit(user.id, user.nome, 'DELETE', table, id, buildDiff(existing, {}), user.terreiro_id);
    return !!result;
  }
  return hardDelete(table, id);
}

async function hardDelete(table, id) {
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

function isPeriodLocked(mes, ano) {
  var hoje = new Date();
  var mesAtual = hoje.getMonth() + 1;
  var anoAtual = hoje.getFullYear();
  var mesNum = parseInt(mes, 10);
  var anoNum = parseInt(ano, 10);
  return anoNum < anoAtual || (anoNum === anoAtual && mesNum < mesAtual);
}

async function logAudit(userId, userName, action, tableName, recordId, changes, terreiroId) {
  try {
    await insert('audit_log', {
      user_id: userId,
      user_name: userName || '',
      action: action,
      table_name: tableName,
      record_id: recordId,
      changes: changes ? JSON.stringify(changes) : null,
      terreiro_id: terreiroId || null
    });
  } catch (e) {
    console.error('Erro ao registrar auditoria:', e.message);
  }
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

async function resetSequences() {
  if (!USE_PG || !pool) return;
  for (const table of TABLES) {
    try {
      await pool.query(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 1))`);
      console.log(`[DB] Sequence reset for table '${table}'`);
    } catch (err) {
      console.error(`[DB] Failed to reset sequence for table '${table}':`, err);
    }
  }
}

const dbApi = {
  init: initDB,
  getAll: queryAll,
  getById: queryOne,
  insert,
  update,
  delete: deleteRow,
  hardDelete: hardDelete,
  query,
  logAudit,
  isPeriodLocked,
  migrateFromJSON,
  initDefaults,
  resetSequences
};

module.exports = dbApi;
