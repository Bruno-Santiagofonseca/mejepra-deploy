const db = require('../db');

async function listMediuns() {
  return db.all('SELECT * FROM mediuns ORDER BY nome');
}

async function getMedium(id) {
  return db.get('SELECT * FROM mediuns WHERE id = ?', [id]);
}

async function createMedium(data) {
  const result = await db.run(
    'INSERT INTO mediuns (nome, tipo, tel) VALUES (?, ?, ?)',
    [data.nome, data.tipo || 'Médium', data.tel || '']
  );
  return getMedium(result.id);
}

async function updateMedium(id, data) {
  await db.run(
    'UPDATE mediuns SET nome = ?, tipo = ?, tel = ? WHERE id = ?',
    [data.nome, data.tipo, data.tel, id]
  );
  return getMedium(id);
}

async function deleteMedium(id) {
  const result = await db.run('DELETE FROM mediuns WHERE id = ?', [id]);
  return result.changes > 0;
}

module.exports = {
  listMediuns,
  getMedium,
  createMedium,
  updateMedium,
  deleteMedium
};
