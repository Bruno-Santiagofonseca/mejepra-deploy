const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./src/database');
const mediunsRouter = require('./src/routes/mediuns');
const mensalidadesRouter = require('./src/routes/mensalidades');
const faxinaRouter = require('./src/routes/faxina');
const despesasRouter = require('./src/routes/despesas');
const trabalhosRouter = require('./src/routes/trabalhos');
const extrasRouter = require('./src/routes/extras');
const dashboardRouter = require('./src/routes/dashboard');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

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

app.use('/api/mediuns', mediunsRouter);
app.use('/api/mensalidades', mensalidadesRouter);
app.use('/api/faxina', faxinaRouter);
app.use('/api/despesas', despesasRouter);
app.use('/api/trabalhos', trabalhosRouter);
app.use('/api/extras', extrasRouter);
app.use('/api/dashboard', dashboardRouter);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'INTERFACE', 'index.html'));
});

// Initialize SQLite database, migrate from JSON if needed, then start server
db.init().then(() => {
  db.migrateFromJSON();
  db.initDefaults();
  console.log('SQLite database initialized');

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Mejepra Financeiro rodando em http://0.0.0.0:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
