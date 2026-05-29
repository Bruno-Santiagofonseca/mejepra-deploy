require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const db = require('./src/database');
const { verifyToken, optionalToken } = require('./src/middleware/auth');
const { authorize } = require('./src/middleware/rbac');
const authRouter = require('./src/routes/auth');
const mediunsRouter = require('./src/routes/mediuns');
const mensalidadesRouter = require('./src/routes/mensalidades');
const faxinaRouter = require('./src/routes/faxina');
const despesasRouter = require('./src/routes/despesas');
const trabalhosRouter = require('./src/routes/trabalhos');
const extrasRouter = require('./src/routes/extras');
const dashboardRouter = require('./src/routes/dashboard');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.CORS_ORIGIN || true, credentials: true }));
app.use(express.json({ limit: '10mb' }));

// HTTPS redirect (trust x-forwarded-proto for Render/reverse proxy)
app.use((req, res, next) => {
  if (req.headers['x-forwarded-proto'] === 'http' || (req.headers['x-forwarded-proto'] && req.headers['x-forwarded-proto'] !== 'https')) {
    return res.redirect(301, 'https://' + req.headers['host'] + req.url);
  }
  next();
});

// HSTS (only when not in dev)
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    next();
  });
}

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { error: 'Muitas tentativas. Tente novamente em 15 minutos.' }, standardHeaders: true, legacyHeaders: false });

// Disable cache for static files (HTML, JS, CSS)
app.use(express.static(path.join(__dirname, 'INTERFACE'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html') || filePath.endsWith('.js') || filePath.endsWith('.css')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

app.get('/service-worker.js', (req, res) => {
  res.type('application/javascript').sendFile(path.join(__dirname, 'INTERFACE', 'service-worker.js'));
});

app.get('/manifest.json', (req, res) => {
  res.type('application/manifest+json').sendFile(path.join(__dirname, 'INTERFACE', 'manifest.json'));
});

// Health check (no auth)
app.get('/api/health', async (req, res) => {
  try {
    const dbOk = await db.query('users', () => true).then(r => Array.isArray(r)).catch(() => false);
    res.json({ status: 'ok', uptime: process.uptime(), database: dbOk ? 'connected' : 'error', timestamp: new Date().toISOString() });
  } catch (e) {
    res.status(503).json({ status: 'error', message: e.message });
  }
});

app.use('/api/auth', authLimiter, authRouter);
app.use('/api/mediuns', verifyToken, authorize('admin', 'tesoureiro', 'consultor'), mediunsRouter);
app.use('/api/mensalidades', verifyToken, authorize('admin', 'tesoureiro', 'consultor'), mensalidadesRouter);
app.use('/api/faxina', verifyToken, authorize('admin', 'tesoureiro', 'consultor'), faxinaRouter);
app.use('/api/despesas', verifyToken, authorize('admin', 'tesoureiro', 'consultor'), despesasRouter);
app.use('/api/trabalhos', verifyToken, authorize('admin', 'tesoureiro', 'consultor'), trabalhosRouter);
app.use('/api/extras', verifyToken, authorize('admin', 'tesoureiro', 'consultor'), extrasRouter);
app.use('/api/dashboard', verifyToken, authorize('admin', 'tesoureiro', 'consultor'), dashboardRouter);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'INTERFACE', 'index.html'));
});

// Backup: export all data as JSON
app.get('/api/backup', verifyToken, authorize('admin', 'tesoureiro'), async (req, res) => {
  const tid = req.user.terreiro_id;
  const TABLES = ['mediuns', 'mensalidades', 'faxina', 'despesas', 'trabalhos', 'extras'];
  const backup = {};
  for (const t of TABLES) {
    backup[t] = await db.query(t, r => r.terreiro_id === tid);
  }
  res.setHeader('Content-Disposition', 'attachment; filename=centro360-backup-' + new Date().toISOString().slice(0,10) + '.json');
  res.json(backup);
});

// Restore: import data from JSON with automatic snapshot before
app.post('/api/restore', verifyToken, authorize('admin'), async (req, res) => {
  try {
    const tid = req.user.terreiro_id;
    const data = req.body;
    const TABLES = ['mediuns', 'mensalidades', 'faxina', 'despesas', 'trabalhos', 'extras'];

    // Create automatic backup snapshot before restore
    var snapshot = {};
    for (var t of TABLES) {
      snapshot[t] = await db.query(t, r => r.terreiro_id === tid);
    }
    var backupDir = path.join(__dirname, 'data', 'backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    var timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    var snapshotPath = path.join(backupDir, 'restore-snapshot-' + tid + '-' + timestamp + '.json');
    fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));
    console.log('Snapshot saved before restore:', snapshotPath);

    for (const t of TABLES) {
      if (data[t] && Array.isArray(data[t])) {
        const current = await db.query(t, r => r.terreiro_id === tid);
        for (const r of current) {
          await db.delete(t, r.id, req.user);
        }
        for (const r of data[t]) {
          const { created_at, updated_at, ...rest } = r;
          rest.terreiro_id = tid;
          await db.insert(t, rest, req.user);
        }
      }
    }
    if (db.resetSequences) {
      await db.resetSequences();
    }
    res.json({ success: true, message: 'Dados restaurados com sucesso. Snapshot salvo em ' + snapshotPath });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.use(function(err, req, res, next) {
  console.error('Erro n\u00e3o tratado:', err);
  res.status(500).json({ error: 'Erro interno do servidor.' });
});

// Initialize SQLite database, migrate from JSON if needed, then start server
db.init().then(() => {
  db.migrateFromJSON();
  db.initDefaults();
  console.log('SQLite database initialized');

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Centro360 Financeiro rodando em http://0.0.0.0:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
