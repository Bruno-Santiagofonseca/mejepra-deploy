const path = require('path');
const Database = require('better-sqlite3');

const DB_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DB_DIR, 'mejepra.db');

const db = new Database(DB_PATH);

// Enable WAL mode for better performance and crash safety
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const SCHEMA = {
  mediuns: `
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    tipo TEXT DEFAULT 'Médium',
    tel TEXT DEFAULT '',
    endereco TEXT DEFAULT '',
    email TEXT DEFAULT '',
    nasc TEXT DEFAULT '',
    obs TEXT DEFAULT '',
    iniciais TEXT DEFAULT '',
    data_cadastro TEXT DEFAULT '',
    status TEXT DEFAULT 'Ativo',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  `,
  mensalidades: `
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    medium_id INTEGER,
    nome TEXT NOT NULL,
    valor REAL DEFAULT 0,
    pago REAL DEFAULT 0,
    status TEXT DEFAULT 'pendente',
    mes TEXT DEFAULT '',
    ano TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  `,
  faxina: `
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    medium_id INTEGER,
    nome TEXT NOT NULL,
    data TEXT,
    valor REAL DEFAULT 0,
    presenca TEXT DEFAULT 'feito',
    pagamento TEXT DEFAULT 'pago',
    mes TEXT DEFAULT '',
    ano TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  `,
  despesas: `
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item TEXT NOT NULL,
    valor REAL NOT NULL,
    parcela TEXT DEFAULT '1/1',
    divisao INTEGER DEFAULT 1,
    status TEXT DEFAULT 'aberta',
    mes TEXT DEFAULT '',
    ano TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  `,
  trabalhos: `
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entidade TEXT NOT NULL,
    valor REAL NOT NULL,
    mes TEXT DEFAULT '',
    ano TEXT DEFAULT '',
    divisao INTEGER DEFAULT 1,
    pagamentos TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  `,
  extras: `
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo TEXT DEFAULT 'receita',
    item TEXT NOT NULL,
    valor REAL NOT NULL,
    parcela TEXT DEFAULT '1/1',
    qtd INTEGER DEFAULT 1,
    divisao INTEGER DEFAULT 1,
    mes TEXT DEFAULT '',
    ano TEXT DEFAULT '',
    pagamentos TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  `
};

function ensureTables() {
  for (const [table, schema] of Object.entries(SCHEMA)) {
    db.exec(`CREATE TABLE IF NOT EXISTS ${table} (${schema})`);
  }
}
ensureTables();

// Prepared statements for performance
const stmts = {};
for (const table of Object.keys(SCHEMA)) {
  stmts[`getAll_${table}`] = db.prepare(`SELECT * FROM ${table}`);
  stmts[`getById_${table}`] = db.prepare(`SELECT * FROM ${table} WHERE id = ?`);
  stmts[`delete_${table}`] = db.prepare(`DELETE FROM ${table} WHERE id = ?`);
}

function parseRow(row) {
  const result = { ...row };
  if (result.pagamentos && typeof result.pagamentos === 'string') {
    try { result.pagamentos = JSON.parse(result.pagamentos); } catch { result.pagamentos = {}; }
  }
  return result;
}

function parseRows(rows) {
  return rows.map(parseRow);
}

function serializeRow(record) {
  const copy = { ...record };
  if (copy.pagamentos && typeof copy.pagamentos !== 'string') {
    copy.pagamentos = JSON.stringify(copy.pagamentos);
  }
  return copy;
}

function generateId(table) {
  const row = db.prepare(`SELECT MAX(id) as maxId FROM ${table}`).get();
  return (row.maxId || 0) + 1;
}

const dbApi = {
  getAll(table) {
    const stmt = stmts[`getAll_${table}`];
    const rows = stmt.all();
    return parseRows(rows);
  },

  getById(table, id) {
    const stmt = stmts[`getById_${table}`];
    const row = stmt.get(parseInt(id));
    return row ? parseRow(row) : null;
  },

  insert(table, record) {
    const now = new Date().toISOString();
    const data = serializeRow(record);
    const columns = Object.keys(data);
    const placeholders = columns.map(() => '?').join(', ');
    const values = columns.map(c => data[c]);

    const stmt = db.prepare(`INSERT INTO ${table} (${columns.join(', ')}, created_at, updated_at) VALUES (${placeholders}, ?, ?)`);
    const result = stmt.run(...values, now, now);

    return this.getById(table, result.lastInsertRowid);
  },

  update(table, id, updates) {
    const existing = this.getById(table, id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const data = serializeRow(updates);
    const columns = Object.keys(data);
    const setClause = columns.map(c => `${c} = ?`).join(', ');
    const values = columns.map(c => data[c]);

    const stmt = db.prepare(`UPDATE ${table} SET ${setClause}, updated_at = ? WHERE id = ?`);
    stmt.run(...values, now, parseInt(id));

    return this.getById(table, id);
  },

  delete(table, id) {
    const stmt = stmts[`delete_${table}`];
    const result = stmt.run(parseInt(id));
    return result.changes > 0;
  },

  query(table, filterFn) {
    const rows = this.getAll(table);
    return rows.filter(filterFn);
  },

  initDefaults() {
    const mediuns = this.getAll('mediuns');
    if (mediuns.length === 0) {
      const defaults = [
        { nome: 'Ana Clara Silva', tipo: 'Médium', tel: '(11) 99999-0001', endereco: 'Rua A, 123', email: 'ana@email.com', nasc: '1990-03-15', obs: 'Incorporação', iniciais: 'AC', data_cadastro: '2023-03-01', status: 'Ativo' },
        { nome: 'Bento Ferreira', tipo: 'Médium', tel: '(11) 99999-0002', endereco: 'Rua B, 456', email: 'bento@email.com', nasc: '1985-07-22', obs: 'Vidência', iniciais: 'BF', data_cadastro: '2024-01-10', status: 'Ativo' },
        { nome: 'Carla Rodrigues', tipo: 'Médium', tel: '(11) 99999-0003', endereco: 'Rua C, 789', email: 'carla@email.com', nasc: '1992-11-02', obs: 'Psicografia', iniciais: 'CR', data_cadastro: '2022-06-20', status: 'Ativo' },
        { nome: 'Daniel Martins', tipo: 'Médium', tel: '(11) 99999-0004', endereco: 'Rua D, 321', email: 'daniel@email.com', nasc: '1988-05-18', obs: 'Curanderia', iniciais: 'DM', data_cadastro: '2024-09-05', status: 'Inativo' },
        { nome: 'Eduarda Lima', tipo: 'Médium', tel: '(11) 99999-0005', endereco: 'Rua E, 654', email: 'eduarda@email.com', nasc: '1995-02-28', obs: 'Incorporação', iniciais: 'EL', data_cadastro: '2023-02-14', status: 'Ativo' },
        { nome: 'Fernando Oliveira', tipo: 'Frequentador', tel: '(11) 99999-0006', endereco: 'Rua F, 987', email: 'fernando@email.com', nasc: '1982-09-10', obs: 'Hipnose', iniciais: 'FO', data_cadastro: '2024-10-01', status: 'Ativo' }
      ];
      defaults.forEach(d => this.insert('mediuns', d));
    }

    const mensalidades = this.getAll('mensalidades');
    if (mensalidades.length === 0) {
      const mediunsData = this.getAll('mediuns');
      const vals = [120, 100, 150, 80, 200, 90];
      const pagos = [120, 60, 150, 0, 200, 45];
      const stats = ['pago', 'parcial', 'pago', 'pendente', 'pago', 'parcial'];
      mediunsData.slice(0, 6).forEach((m, i) => {
        this.insert('mensalidades', { medium_id: m.id, nome: m.nome, valor: vals[i], pago: pagos[i], status: stats[i], mes: '05', ano: '2026' });
      });
    }

    const faxina = this.getAll('faxina');
    if (faxina.length === 0) {
      const mediunsData = this.getAll('mediuns');
      const nomes = ['Ana Clara Silva', 'Bento Ferreira', 'Carla Rodrigues', 'Daniel Martins', 'Eduarda Lima', 'Fernando Oliveira', 'Gabriela Santos', 'Heitor Costa', 'Isabela Nunes', 'João Pedro', 'Larissa Mendes', 'Marcos Tavares'];
      const presencas = ['feito', 'feito', 'falta', 'feito', 'feito', 'feito', 'falta', 'feito', 'falta', 'feito', 'feito', 'falta'];
      const pagamentos = ['pago', 'pago', 'nao_pago', 'nao_pago', 'pago', 'pago', 'nao_pago', 'pago', 'nao_pago', 'pago', 'pago', 'nao_pago'];
      nomes.forEach((n, i) => {
        const med = mediunsData.find(m => m.nome === n);
        this.insert('faxina', { medium_id: med ? med.id : null, nome: n, valor: 80, presenca: presencas[i], pagamento: pagamentos[i], mes: '05', ano: '2026' });
      });
    }

    const despesas = this.getAll('despesas');
    if (despesas.length === 0) {
      const items = [
        { item: 'Material escritório', valor: 230, parcela: '1/1', divisao: 1, status: 'paga', mes: '05', ano: '2026' },
        { item: 'Água', valor: 180, parcela: '1/1', divisao: 1, status: 'paga', mes: '05', ano: '2026' },
        { item: 'Energia elétrica', valor: 420, parcela: '1/1', divisao: 1, status: 'aberta', mes: '05', ano: '2026' },
        { item: 'Manutenção telhado', valor: 1200, parcela: '3/6', divisao: 1, status: 'parcial', mes: '05', ano: '2026' },
        { item: 'Alimentação evento', valor: 650, parcela: '1/1', divisao: 1, status: 'aberta', mes: '05', ano: '2026' },
        { item: 'Produtos limpeza', valor: 190, parcela: '1/1', divisao: 1, status: 'paga', mes: '05', ano: '2026' },
        { item: 'Móvel sala', valor: 1800, parcela: '2/5', divisao: 1, status: 'parcial', mes: '05', ano: '2026' },
        { item: 'Internet', valor: 150, parcela: '1/1', divisao: 1, status: 'aberta', mes: '05', ano: '2026' }
      ];
      items.forEach(d => this.insert('despesas', d));
    }

    const trabalhos = this.getAll('trabalhos');
    if (trabalhos.length === 0) {
      const items = [
        { entidade: 'Caboclo Tupinambá', valor: 300, mes: '05', ano: '2026', divisao: 5, status: 'realizado' },
        { entidade: 'Preta Velha Maria', valor: 250, mes: '05', ano: '2026', divisao: 4, status: 'realizado' },
        { entidade: 'Baiano Ventania', valor: 350, mes: '06', ano: '2026', divisao: 6, status: 'futuro' },
        { entidade: 'Indio Pena Branca', valor: 280, mes: '05', ano: '2026', divisao: 3, status: 'pendente' },
        { entidade: 'Boiadeiro Serra', valor: 320, mes: '05', ano: '2026', divisao: 5, status: 'realizado' },
        { entidade: 'Marujo Costa', valor: 200, mes: '06', ano: '2026', divisao: 4, status: 'futuro' },
        { entidade: 'Cigana Esmeralda', valor: 280, mes: '05', ano: '2026', divisao: 7, status: 'realizado' },
        { entidade: 'Mestre Quintino', valor: 400, mes: '05', ano: '2026', divisao: 6, status: 'realizado' }
      ];
      items.forEach(t => this.insert('trabalhos', t));
    }
  },

  // Migration helper: import from JSON files
  migrateFromJSON() {
    const fs = require('fs');
    const TABLES = ['mediuns', 'mensalidades', 'faxina', 'despesas', 'trabalhos', 'extras'];

    for (const table of TABLES) {
      const filePath = path.join(DB_DIR, `${table}.json`);
      if (!fs.existsSync(filePath)) continue;

      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (!Array.isArray(data) || data.length === 0) continue;

        // Check if table already has data
        const count = db.prepare(`SELECT COUNT(*) as cnt FROM ${table}`).get();
        if (count.cnt > 0) continue;

        console.log(`Migrating ${table}.json → SQLite (${data.length} records)`);

        const insert = db.transaction((rows) => {
          for (const row of rows) {
            const columns = Object.keys(row);
            const placeholders = columns.map(() => '?').join(', ');
            const values = columns.map(c => {
              const val = row[c];
              if (val === null || val === undefined) return null;
              if (typeof val === 'object') return JSON.stringify(val);
              return val;
            });
            db.prepare(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`).run(...values);
          }
        });

        insert(data);
      } catch (e) {
        console.error(`Error migrating ${table}:`, e.message);
      }
    }
  },

  close() {
    db.close();
  }
};

module.exports = dbApi;
