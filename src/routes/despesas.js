const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
  const { mes, ano } = req.query;
  let data = db.getAll('despesas');
  if (mes && ano) data = data.filter(d => d.mes === mes && d.ano === ano);
  res.json(data.sort((a, b) => a.item.localeCompare(b.item)));
});

router.get('/:id', (req, res) => {
  const desp = db.getById('despesas', req.params.id);
  if (!desp) return res.status(404).json({ error: 'Despesa não encontrada' });
  res.json(desp);
});

router.post('/', (req, res) => {
  const { item, valor, parcela, divisao, status, mes, ano } = req.body;
  if (!item || valor === undefined) return res.status(400).json({ error: 'Item e valor são obrigatórios' });
  const desp = db.insert('despesas', { item, valor, parcela: parcela || '1/1', divisao: divisao || 1, status: status || 'aberta', mes: mes || '', ano: ano || '' });
  res.status(201).json(desp);
});

router.put('/:id', (req, res) => {
  const existing = db.getById('despesas', req.params.id);
  if (!existing) return res.status(404).json({ error: 'Despesa não encontrada' });
  const { item, valor, parcela, divisao, status, mes, ano } = req.body;
  const desp = db.update('despesas', req.params.id, {
    item: item !== undefined ? item : existing.item,
    valor: valor !== undefined ? valor : existing.valor,
    parcela: parcela !== undefined ? parcela : existing.parcela,
    divisao: divisao !== undefined ? divisao : existing.divisao,
    status: status !== undefined ? status : existing.status,
    mes: mes !== undefined ? mes : existing.mes,
    ano: ano !== undefined ? ano : existing.ano
  });
  res.json(desp);
});

router.delete('/:id', (req, res) => {
  const deleted = db.delete('despesas', req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Despesa não encontrada' });
  res.json({ message: 'Despesa excluída com sucesso' });
});

module.exports = router;
