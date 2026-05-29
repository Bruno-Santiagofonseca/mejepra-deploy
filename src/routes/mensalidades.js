const express = require('express');
const router = express.Router();
const db = require('../database');
const { authorize } = require('../middleware/rbac');

function terreiro(req) { return req.user.terreiro_id; }

router.get('/', async (req, res) => {
  const tid = terreiro(req);
  const { mes, ano } = req.query;
  let data = await db.query('mensalidades', m => m.terreiro_id === tid);
  if (mes && ano) data = data.filter(m => m.mes === mes && m.ano === ano);
  res.json(data.sort((a, b) => a.nome.localeCompare(b.nome)));
});

router.get('/:id', async (req, res) => {
  const mens = await db.getById('mensalidades', req.params.id);
  if (!mens || mens.deleted_at || mens.terreiro_id !== terreiro(req)) return res.status(404).json({ error: 'Mensalidade não encontrada' });
  res.json(mens);
});

router.post('/', async (req, res) => {
  const tid = terreiro(req);
  const { medium_id, nome, valor, pago, status, mes, ano } = req.body;
  if (!nome || !mes || !ano) return res.status(400).json({ error: 'Nome, mês e ano são obrigatórios' });

  if (db.isPeriodLocked(mes, ano)) return res.status(403).json({ error: 'Período bloqueado. Não é possível modificar meses anteriores.' });

  if (medium_id) {
    const existing = await db.query('mensalidades', m => 
      m.medium_id === parseInt(medium_id, 10) && m.mes === mes && m.ano === ano && m.terreiro_id === tid
    );
    if (existing && existing.length > 0) {
      const mens = await db.update('mensalidades', existing[0].id, {
        nome,
        valor: valor !== undefined ? valor : existing[0].valor,
        pago: pago !== undefined ? pago : existing[0].pago,
        status: status || existing[0].status
      }, req.user);
      return res.status(200).json(mens);
    }
  }

  const mens = await db.insert('mensalidades', { medium_id: medium_id ? parseInt(medium_id, 10) : null, nome, valor: valor || 0, pago: pago || 0, status: status || 'pendente', mes, ano, terreiro_id: tid }, req.user);
  res.status(201).json(mens);
});

router.put('/:id', async (req, res) => {
  const existing = await db.getById('mensalidades', req.params.id);
  if (!existing || existing.terreiro_id !== terreiro(req)) return res.status(404).json({ error: 'Mensalidade não encontrada' });
  if (db.isPeriodLocked(existing.mes, existing.ano)) return res.status(403).json({ error: 'Período bloqueado. Não é possível modificar meses anteriores.' });
  const { medium_id, nome, valor, pago, status, mes, ano } = req.body;
  const mens = await db.update('mensalidades', req.params.id, {
    medium_id: medium_id !== undefined ? medium_id : existing.medium_id,
    nome: nome || existing.nome,
    valor: valor !== undefined ? valor : existing.valor,
    pago: pago !== undefined ? pago : existing.pago,
    status: status || existing.status,
    mes: mes !== undefined ? mes : existing.mes,
    ano: ano !== undefined ? ano : existing.ano
  }, req.user);
  res.json(mens);
});

router.delete('/:id', authorize('admin'), async (req, res) => {
  const existing = await db.getById('mensalidades', req.params.id);
  if (!existing || existing.terreiro_id !== terreiro(req)) return res.status(404).json({ error: 'Mensalidade não encontrada' });
  if (db.isPeriodLocked(existing.mes, existing.ano)) return res.status(403).json({ error: 'Período bloqueado. Não é possível modificar meses anteriores.' });
  const deleted = await db.delete('mensalidades', req.params.id, req.user);
  if (!deleted) return res.status(404).json({ error: 'Mensalidade não encontrada' });
  res.json({ message: 'Mensalidade excluída com sucesso' });
});

module.exports = router;
