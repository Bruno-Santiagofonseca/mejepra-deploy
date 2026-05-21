const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const mediunsRoutes = require('./routes/mediuns.routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/mediuns', mediunsRoutes);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`Template rodando em http://localhost:${config.port}`);
});
