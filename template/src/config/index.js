const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

module.exports = {
  port: process.env.PORT || 3001,
  databaseFile: path.resolve(process.env.DATABASE_FILE || 'data/template.db')
};
