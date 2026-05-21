const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', async (req, res) => {
  const { mes, ano } = req.query;
  let data = await db.getAll('trabalhos');
  if (mes && ano) data = data.filter(t => t.mes === mes && t.ano === ano);
  res.json(data.sort((a, b) => a.entidade.localeCompare(b.entidade)));
});

router.get('/:id', async (req, res) => {
  const trab = await db.getById('trabalhos', req.params.id);
  if (!trab) return res.status(404).json({ error: 'Trabalho não encontrado' });
  res.json(trab);
});

router.post('/', async (req, res) => {
  const { entidade, valor, mes, ano, divisao, pagamentos } = req.body;
  if (!entidade || valor === undefined) return res.status(400).json({ error: 'Entidade e valor são obrigatórios' });
  const trab = await db.insert('trabalhos', { entidade, valor, mes: mes || '', ano: ano || '', divisao: divisao || 1, pagamentos: pagamentos || {} });
  res.status(201).json(trab);
});

router.put('/:id', async (req, res) => {
  const existing = await db.getById('trabalhos', req.params.id);
  if (!existing) return res.status(404).json({ error: 'Trabalho não encontrado' });
  const { entidade, valor, mes, ano, divisao, pagamentos } = req.body;
  const trab = await db.update('trabalhos', req.params.id, {
    entidade: entidade || existing.entidade,
    valor: valor !== undefined ? valor : existing.valor,
    mes: mes !== undefined ? mes : existing.mes,
    ano: ano !== undefined ? ano : existing.ano,
    divisao: divisao !== undefined ? divisao : existing.divisao,
    pagamentos: pagamentos !== undefined ? pagamentos : existing.pagamentos
  });
  res.json(trab);
});

router.delete('/:id', async (req, res) => {
  const deleted = await db.delete('trabalhos', req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Trabalho não encontrado' });
  res.json({ message: 'Trabalho excluído com sucesso' });
});

module.exports = router;
