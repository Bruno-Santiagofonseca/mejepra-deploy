const express = require('express');
const router = express.Router();
const db = require('../database');
const { authorize } = require('../middleware/rbac');

function terreiro(req) { return req.user.terreiro_id; }

router.get('/', async (req, res) => {
  const tid = terreiro(req);
  const { mes, ano } = req.query;
  let data = await db.query('extras', e => e.terreiro_id === tid);
  if (mes && ano) data = data.filter(e => e.mes === mes && e.ano === ano);
  res.json(data.sort((a, b) => a.item.localeCompare(b.item)));
});

router.get('/:id', async (req, res) => {
  const extra = await db.getById('extras', req.params.id);
  if (!extra || extra.deleted_at || extra.terreiro_id !== terreiro(req)) return res.status(404).json({ error: 'Item extra não encontrado' });
  res.json(extra);
});

router.post('/', async (req, res) => {
  const tid = terreiro(req);
  const { tipo, item, valor, parcela, qtd, divisao, mes, ano, pagamentos } = req.body;
  if (!item || valor === undefined) return res.status(400).json({ error: 'Item e valor são obrigatórios' });
  if (mes && ano && db.isPeriodLocked(mes, ano)) return res.status(403).json({ error: 'Período bloqueado. Não é possível modificar meses anteriores.' });
  const extra = await db.insert('extras', { tipo: tipo || 'receita', item, valor, parcela: parcela || '1/1', qtd: qtd || 1, divisao: divisao || 1, mes: mes || '', ano: ano || '', pagamentos: pagamentos || {}, terreiro_id: tid }, req.user);
  res.status(201).json(extra);
});

router.put('/:id', async (req, res) => {
  const existing = await db.getById('extras', req.params.id);
  if (!existing || existing.terreiro_id !== terreiro(req)) return res.status(404).json({ error: 'Item extra não encontrado' });
  if (db.isPeriodLocked(existing.mes, existing.ano)) return res.status(403).json({ error: 'Período bloqueado. Não é possível modificar meses anteriores.' });
  const { tipo, item, valor, parcela, qtd, divisao, mes, ano, pagamentos } = req.body;
  const extra = await db.update('extras', req.params.id, {
    tipo: tipo !== undefined ? tipo : existing.tipo,
    item: item !== undefined ? item : existing.item,
    valor: valor !== undefined ? valor : existing.valor,
    parcela: parcela !== undefined ? parcela : existing.parcela,
    qtd: qtd !== undefined ? qtd : existing.qtd,
    divisao: divisao !== undefined ? divisao : existing.divisao,
    mes: mes !== undefined ? mes : existing.mes,
    ano: ano !== undefined ? ano : existing.ano,
    pagamentos: pagamentos !== undefined ? pagamentos : existing.pagamentos
  }, req.user);
  res.json(extra);
});

router.delete('/:id', authorize('admin'), async (req, res) => {
  const existing = await db.getById('extras', req.params.id);
  if (!existing || existing.terreiro_id !== terreiro(req)) return res.status(404).json({ error: 'Item extra não encontrado' });
  if (db.isPeriodLocked(existing.mes, existing.ano)) return res.status(403).json({ error: 'Período bloqueado. Não é possível modificar meses anteriores.' });
  const deleted = await db.delete('extras', req.params.id, req.user);
  if (!deleted) return res.status(404).json({ error: 'Item extra não encontrado' });
  res.json({ message: 'Item extra excluído com sucesso' });
});

module.exports = router;
