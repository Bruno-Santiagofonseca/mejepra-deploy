const fs = require('fs');
const path = require('path');
const db = require('../src/database');

async function main() {
  const fileArg = process.argv[2] || 'data/backup-mejepra.json';
  const filePath = path.isAbsolute(fileArg) ? fileArg : path.join(__dirname, '..', fileArg);
  if (!fs.existsSync(filePath)) {
    console.error(`Arquivo não encontrado: ${filePath}`);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  await db.init();
  await db.migrateFromJSON();

  const tables = ['mediuns', 'mensalidades', 'faxina', 'despesas', 'trabalhos'];
  for (const table of tables) {
    if (data[table] && Array.isArray(data[table])) {
      const current = await db.getAll(table);
      for (const row of current) {
        await db.delete(table, row.id);
      }
      for (const row of data[table]) {
        const { created_at, updated_at, ...rest } = row;
        await db.insert(table, rest);
      }
    }
  }

  console.log(`Restauração concluída a partir de: ${filePath}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
