const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', async (req, res) => {
  const { mes, ano } = req.query;
  let data = await db.getAll('mensalidades');
  if (mes && ano) data = data.filter(m => m.mes === mes && m.ano === ano);
  res.json(data.sort((a, b) => a.nome.localeCompare(b.nome)));
});

router.get('/:id', async (req, res) => {
  const mens = await db.getById('mensalidades', req.params.id);
  if (!mens) return res.status(404).json({ error: 'Mensalidade não encontrada' });
  res.json(mens);
});

router.post('/', async (req, res) => {
  const { medium_id, nome, valor, pago, status, mes, ano } = req.body;
  if (!nome || !mes || !ano) return res.status(400).json({ error: 'Nome, mês e ano são obrigatórios' });
  const mens = await db.insert('mensalidades', { medium_id: medium_id || null, nome, valor: valor || 0, pago: pago || 0, status: status || 'pendente', mes, ano });
  res.status(201).json(mens);
});

router.put('/:id', async (req, res) => {
  const existing = await db.getById('mensalidades', req.params.id);
  if (!existing) return res.status(404).json({ error: 'Mensalidade não encontrada' });
  const { medium_id, nome, valor, pago, status, mes, ano } = req.body;
  const mens = await db.update('mensalidades', req.params.id, {
    medium_id: medium_id !== undefined ? medium_id : existing.medium_id,
    nome: nome || existing.nome,
    valor: valor !== undefined ? valor : existing.valor,
    pago: pago !== undefined ? pago : existing.pago,
    status: status || existing.status,
    mes: mes !== undefined ? mes : existing.mes,
    ano: ano !== undefined ? ano : existing.ano
  });
  res.json(mens);
});

router.delete('/:id', async (req, res) => {
  const deleted = await db.delete('mensalidades', req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Mensalidade não encontrada' });
  res.json({ message: 'Mensalidade excluída com sucesso' });
});

module.exports = router;
