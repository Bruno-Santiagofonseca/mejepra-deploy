const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
  const { mes, ano } = req.query;
  let data = db.getAll('trabalhos');
  if (mes && ano) data = data.filter(t => t.mes === mes && t.ano === ano);
  res.json(data.sort((a, b) => a.entidade.localeCompare(b.entidade)));
});

router.get('/:id', (req, res) => {
  const trab = db.getById('trabalhos', req.params.id);
  if (!trab) return res.status(404).json({ error: 'Trabalho não encontrado' });
  res.json(trab);
});

router.post('/', (req, res) => {
  const { entidade, valor, mes, divisao, status } = req.body;
  if (!entidade || valor === undefined) return res.status(400).json({ error: 'Entidade e valor são obrigatórios' });
  const trab = db.insert('trabalhos', { entidade, valor, mes: mes || '', divisao: divisao || 1, status: status || 'realizado' });
  res.status(201).json(trab);
});

router.put('/:id', (req, res) => {
  const existing = db.getById('trabalhos', req.params.id);
  if (!existing) return res.status(404).json({ error: 'Trabalho não encontrado' });
  const { entidade, valor, mes, divisao, status } = req.body;
  const trab = db.update('trabalhos', req.params.id, {
    entidade: entidade || existing.entidade,
    valor: valor !== undefined ? valor : existing.valor,
    mes: mes !== undefined ? mes : existing.mes,
    divisao: divisao !== undefined ? divisao : existing.divisao,
    status: status || existing.status
  });
  res.json(trab);
});

router.delete('/:id', (req, res) => {
  const deleted = db.delete('trabalhos', req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Trabalho não encontrado' });
  res.json({ message: 'Trabalho excluído com sucesso' });
});

module.exports = router;
