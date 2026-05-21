const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', async (req, res) => {
  const { mes, ano } = req.query;
  let data = await db.getAll('despesas');
  if (mes && ano) data = data.filter(d => d.mes === mes && d.ano === ano);
  res.json(data.sort((a, b) => a.item.localeCompare(b.item)));
});

router.get('/:id', async (req, res) => {
  const desp = await db.getById('despesas', req.params.id);
  if (!desp) return res.status(404).json({ error: 'Despesa não encontrada' });
  res.json(desp);
});

router.post('/', async (req, res) => {
  const { item, valor, parcela, divisao, status, mes, ano, divisao_mediums, pagamentos } = req.body;
  if (!item || valor === undefined) return res.status(400).json({ error: 'Item e valor são obrigatórios' });
  const desp = await db.insert('despesas', { item, valor, parcela: parcela || '1/1', divisao: divisao || 1, status: status || 'aberta', mes: mes || '', ano: ano || '', divisao_mediums: divisao_mediums || [], pagamentos: pagamentos || {} });
  res.status(201).json(desp);
});

router.put('/:id', async (req, res) => {
  const existing = await db.getById('despesas', req.params.id);
  if (!existing) return res.status(404).json({ error: 'Despesa não encontrada' });
  const { item, valor, parcela, divisao, status, mes, ano, divisao_mediums, pagamentos } = req.body;
  const desp = await db.update('despesas', req.params.id, {
    item: item !== undefined ? item : existing.item,
    valor: valor !== undefined ? valor : existing.valor,
    parcela: parcela !== undefined ? parcela : existing.parcela,
    divisao: divisao !== undefined ? divisao : existing.divisao,
    status: status !== undefined ? status : existing.status,
    mes: mes !== undefined ? mes : existing.mes,
    ano: ano !== undefined ? ano : existing.ano,
    divisao_mediums: divisao_mediums !== undefined ? divisao_mediums : existing.divisao_mediums,
    pagamentos: pagamentos !== undefined ? pagamentos : existing.pagamentos
  });
  res.json(desp);
});

router.delete('/:id', async (req, res) => {
  const deleted = await db.delete('despesas', req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Despesa não encontrada' });
  res.json({ message: 'Despesa excluída com sucesso' });
});

module.exports = router;
