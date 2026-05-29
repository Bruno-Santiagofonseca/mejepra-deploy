const express = require('express');
const router = express.Router();
const db = require('../database');
const { authorize } = require('../middleware/rbac');

function terreiro(req) { return req.user.terreiro_id; }

router.get('/', async (req, res) => {
  const tid = terreiro(req);
  const { mes, ano } = req.query;
  let data = await db.query('faxina', f => f.terreiro_id === tid);
  if (mes && ano) data = data.filter(f => f.mes === mes && f.ano === ano);
  res.json(data.sort((a, b) => a.nome.localeCompare(b.nome)));
});

router.get('/:id', async (req, res) => {
  const fax = await db.getById('faxina', req.params.id);
  if (!fax || fax.deleted_at || fax.terreiro_id !== terreiro(req)) return res.status(404).json({ error: 'Registro de faxina não encontrado' });
  res.json(fax);
});

router.post('/', async (req, res) => {
  const tid = terreiro(req);
  const { medium_id, nome, data, valor, presenca, pagamento, mes, ano } = req.body;
  if (!nome || !mes || !ano) return res.status(400).json({ error: 'Nome, mês e ano são obrigatórios' });
  if (db.isPeriodLocked(mes, ano)) return res.status(403).json({ error: 'Período bloqueado. Não é possível modificar meses anteriores.' });
  const fax = await db.insert('faxina', { medium_id: medium_id || null, nome, data: data || null, valor: valor || 0, presenca: presenca || 'feito', pagamento: pagamento || 'pago', mes, ano, terreiro_id: tid }, req.user);
  res.status(201).json(fax);
});

router.put('/:id', async (req, res) => {
  const existing = await db.getById('faxina', req.params.id);
  if (!existing || existing.terreiro_id !== terreiro(req)) return res.status(404).json({ error: 'Registro de faxina não encontrado' });
  if (db.isPeriodLocked(existing.mes, existing.ano)) return res.status(403).json({ error: 'Período bloqueado. Não é possível modificar meses anteriores.' });
  const { medium_id, nome, data, valor, presenca, pagamento, mes, ano } = req.body;
  const fax = await db.update('faxina', req.params.id, {
    medium_id: medium_id !== undefined ? medium_id : existing.medium_id,
    nome: nome || existing.nome,
    data: data !== undefined ? data : existing.data,
    valor: valor !== undefined ? valor : existing.valor,
    presenca: presenca !== undefined ? presenca : existing.presenca,
    pagamento: pagamento !== undefined ? pagamento : existing.pagamento,
    mes: mes !== undefined ? mes : existing.mes,
    ano: ano !== undefined ? ano : existing.ano
  }, req.user);
  res.json(fax);
});

router.delete('/:id', authorize('admin'), async (req, res) => {
  const existing = await db.getById('faxina', req.params.id);
  if (!existing || existing.terreiro_id !== terreiro(req)) return res.status(404).json({ error: 'Registro de faxina não encontrado' });
  if (db.isPeriodLocked(existing.mes, existing.ano)) return res.status(403).json({ error: 'Período bloqueado. Não é possível modificar meses anteriores.' });
  const deleted = await db.delete('faxina', req.params.id, req.user);
  if (!deleted) return res.status(404).json({ error: 'Registro de faxina não encontrado' });
  res.json({ message: 'Registro de faxina excluído com sucesso' });
});

module.exports = router;
