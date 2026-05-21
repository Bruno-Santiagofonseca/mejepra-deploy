const fs = require('fs');
const path = require('path');
const db = require('../src/database');

async function main() {
  await db.init();
  await db.migrateFromJSON();

  const tables = ['mediuns', 'mensalidades', 'faxina', 'despesas', 'trabalhos'];
  const backup = {};

  for (const table of tables) {
    backup[table] = await db.getAll(table);
  }

  const fileName = `backup-mejepra-${new Date().toISOString().slice(0, 10)}.json`;
  const filePath = path.join(__dirname, '..', 'data', fileName);
  fs.writeFileSync(filePath, JSON.stringify(backup, null, 2), 'utf8');
  console.log(`Backup criado em: ${filePath}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
