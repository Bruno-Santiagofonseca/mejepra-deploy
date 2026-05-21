const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const DB_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const TABLES = ['mediuns', 'mensalidades', 'faxina', 'despesas', 'trabalhos', 'extras'];

const memoryCache = {};
let pgClient = null;
let usePostgres = false;

function readLocalTable(table) {
  const filePath = path.join(DB_DIR, `${table}.json`);
  if (!fs.existsSync(filePath)) {
    return [];
  }
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readTable(table) {
  return memoryCache[table] || [];
}

function writeTable(table, data) {
  memoryCache[table] = data;

  // Salvar no arquivo JSON local de forma assíncrona
  const filePath = path.join(DB_DIR, `${table}.json`);
  fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8', (err) => {
    if (err) console.error(`[DB] Erro ao salvar arquivo local para ${table}:`, err);
  });

  // Salvar no Postgres de forma assíncrona se estiver conectado
  if (usePostgres) {
    saveTableToDb(table);
  }
}

async function saveTableToDb(table) {
  if (!pgClient) return;
  try {
    const data = memoryCache[table];
    await pgClient.query(
      `INSERT INTO mejepra_data (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = $2`,
      [table, JSON.stringify(data)]
    );
  } catch (err) {
    console.error(`[DB] Erro ao sincronizar tabela ${table} com o Postgres:`, err);
  }
}

function generateId(table) {
  const data = readTable(table);
  if (data.length === 0) return 1;
  return Math.max(...data.map(r => r.id)) + 1;
}

const db = {
  async init() {
    const connectionString = process.env.DATABASE_URL || process.env.database_url || process.env.SUPABASE_DB_URL || process.env.supabase_db_url;

    // Inicializar o cache com arrays vazios
    TABLES.forEach(table => {
      memoryCache[table] = [];
    });

    if (connectionString) {
      console.log("[DB] Conexão com Postgres/Supabase detectada. Inicializando...");
      try {
        pgClient = new Client({
          connectionString,
          ssl: {
            rejectUnauthorized: false // Necessário para conexões do Supabase / Render
          }
        });
        await pgClient.connect();
        console.log("[DB] Conectado ao PostgreSQL/Supabase com sucesso!");

        // Garantir que a tabela mejepra_data existe
        await pgClient.query(`
          CREATE TABLE IF NOT EXISTS mejepra_data (
            key VARCHAR(50) PRIMARY KEY,
            value JSONB NOT NULL
          )
        `);

        // Carregar todas as tabelas para a memória cache
        for (const table of TABLES) {
          const res = await pgClient.query('SELECT value FROM mejepra_data WHERE key = $1', [table]);
          if (res.rows.length > 0) {
            memoryCache[table] = res.rows[0].value;
          } else {
            // Se não existir no banco de dados remoto, lê os dados locais iniciais
            const localData = readLocalTable(table);
            memoryCache[table] = localData;
            
            // Grava o backup local no banco para ficar sincronizado
            await pgClient.query(
              `INSERT INTO mejepra_data (key, value) VALUES ($1, $2)
               ON CONFLICT (key) DO UPDATE SET value = $2`,
              [table, JSON.stringify(localData)]
            );
          }
        }
        usePostgres = true;
      } catch (err) {
        console.error("[DB] Falha ao conectar ao PostgreSQL/Supabase. Usando fallback local JSON:", err);
        this.loadLocalData();
      }
    } else {
      console.log("[DB] Nenhuma string de conexão Postgres fornecida. Usando arquivos locais JSON.");
      this.loadLocalData();
    }

    // Inicializa valores padrão caso tabelas essenciais estejam vazias
    this.initDefaults();
  },

  loadLocalData() {
    TABLES.forEach(table => {
      memoryCache[table] = readLocalTable(table);
    });
  },

  getAll(table) {
    return readTable(table);
  },

  getById(table, id) {
    const data = readTable(table);
    return data.find(r => r.id === parseInt(id)) || null;
  },

  insert(table, record) {
    const data = readTable(table);
    const id = generateId(table);
    const now = new Date().toISOString();
    const newRecord = { id, created_at: now, updated_at: now, ...record };
    data.push(newRecord);
    writeTable(table, data);
    return newRecord;
  },

  update(table, id, updates) {
    const data = readTable(table);
    const idx = data.findIndex(r => r.id === parseInt(id));
    if (idx === -1) return null;
    data[idx] = { ...data[idx], ...updates, updated_at: new Date().toISOString() };
    writeTable(table, data);
    return data[idx];
  },

  delete(table, id) {
    const data = readTable(table);
    const filtered = data.filter(r => r.id !== parseInt(id));
    if (filtered.length === data.length) return false;
    writeTable(table, filtered);
    return true;
  },

  query(table, filterFn) {
    const data = readTable(table);
    return data.filter(filterFn);
  },

  initDefaults() {
    const mediuns = readTable('mediuns');
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

    const mensalidades = readTable('mensalidades');
    if (mensalidades.length === 0) {
      const mediunsData = readTable('mediuns');
      const vals = [120, 100, 150, 80, 200, 90];
      const pagos = [120, 60, 150, 0, 200, 45];
      const stats = ['pago', 'parcial', 'pago', 'pendente', 'pago', 'parcial'];
      mediunsData.slice(0, 6).forEach((m, i) => {
        this.insert('mensalidades', { medium_id: m.id, nome: m.nome, valor: vals[i], pago: pagos[i], status: stats[i], mes: '05', ano: '2026' });
      });
    }

    const faxina = readTable('faxina');
    if (faxina.length === 0) {
      const mediunsData = readTable('mediuns');
      const nomes = ['Ana Clara Silva', 'Bento Ferreira', 'Carla Rodrigues', 'Daniel Martins', 'Eduarda Lima', 'Fernando Oliveira', 'Gabriela Santos', 'Heitor Costa', 'Isabela Nunes', 'João Pedro', 'Larissa Mendes', 'Marcos Tavares'];
      const presencas = ['feito', 'feito', 'falta', 'feito', 'feito', 'feito', 'falta', 'feito', 'falta', 'feito', 'feito', 'falta'];
      const pagamentos = ['pago', 'pago', 'nao_pago', 'nao_pago', 'pago', 'pago', 'nao_pago', 'pago', 'nao_pago', 'pago', 'pago', 'nao_pago'];
      nomes.forEach((n, i) => {
        const med = mediunsData.find(m => m.nome === n);
        this.insert('faxina', { medium_id: med ? med.id : null, nome: n, valor: 80, presenca: presencas[i], pagamento: pagamentos[i], mes: '05', ano: '2026' });
      });
    }

    const despesas = readTable('despesas');
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

    const trabalhos = readTable('trabalhos');
    if (trabalhos.length === 0) {
      const items = [
        { entidade: 'Caboclo Tupinambá', valor: 300, mes: '05', ano: '2026', divisao: 5, status: 'realizado', participantes: [1, 2, 3, 4, 5] },
        { entidade: 'Preta Velha Maria', valor: 250, mes: '05', ano: '2026', divisao: 4, status: 'realizado', participantes: [1, 2, 3, 5] },
        { entidade: 'Baiano Ventania', valor: 350, mes: '06', ano: '2026', divisao: 6, status: 'futuro', participantes: [1, 2, 3, 4, 5, 6] },
        { entidade: 'Indio Pena Branca', valor: 280, mes: '05', ano: '2026', divisao: 3, status: 'pendente', participantes: [1, 2, 3] },
        { entidade: 'Boiadeiro Serra', valor: 320, mes: '05', ano: '2026', divisao: 5, status: 'realizado', participantes: [1, 2, 3, 4, 5] },
        { entidade: 'Marujo Costa', valor: 200, mes: '06', ano: '2026', divisao: 4, status: 'futuro', participantes: [1, 2, 3, 4] },
        { entidade: 'Cigana Esmeralda', valor: 280, mes: '05', ano: '2026', divisao: 7, status: 'realizado', participantes: [1, 2, 3, 4, 5, 6, 7] },
        { entidade: 'Mestre Quintino', valor: 400, mes: '05', ano: '2026', divisao: 6, status: 'realizado', participantes: [1, 2, 3, 4, 5, 6] }
      ];
      items.forEach(t => this.insert('trabalhos', t));
    }
  }
};

module.exports = db;
