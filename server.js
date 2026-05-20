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
app.use(express.static(path.join(__dirname, 'INTERFACE')));

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

// Migrate from JSON files to SQLite (one-time)
db.migrateFromJSON();

// Initialize default data if tables are empty
db.initDefaults();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Mejepra Financeiro rodando em http://0.0.0.0:${PORT}`);
});
