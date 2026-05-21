const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
  const { mes, ano } = req.query;
  let data = db.getAll('mensalidades');
  if (mes && ano) data = data.filter(m => m.mes === mes && m.ano === ano);
  res.json(data.sort((a, b) => a.nome.localeCompare(b.nome)));
});

router.get('/:id', (req, res) => {
  const mens = db.getById('mensalidades', req.params.id);
  if (!mens) return res.status(404).json({ error: 'Mensalidade não encontrada' });
  res.json(mens);
});

router.post('/', (req, res) => {
  const { medium_id, nome, valor, pago, status, mes, ano } = req.body;
  if (!nome || !mes || !ano) return res.status(400).json({ error: 'Nome, mês e ano são obrigatórios' });

  if (medium_id) {
    const existing = db.query('mensalidades', m => 
      m.medium_id === parseInt(medium_id) && m.mes === mes && m.ano === ano
    );
    if (existing && existing.length > 0) {
      // Se já existe, atualiza em vez de criar duplicado
      const mens = db.update('mensalidades', existing[0].id, {
        nome,
        valor: valor !== undefined ? valor : existing[0].valor,
        pago: pago !== undefined ? pago : existing[0].pago,
        status: status || existing[0].status
      });
      return res.status(200).json(mens);
    }
  }

  const mens = db.insert('mensalidades', { medium_id: medium_id ? parseInt(medium_id) : null, nome, valor: valor || 0, pago: pago || 0, status: status || 'pendente', mes, ano });
  res.status(201).json(mens);
});

router.put('/:id', (req, res) => {
  const existing = db.getById('mensalidades', req.params.id);
  if (!existing) return res.status(404).json({ error: 'Mensalidade não encontrada' });
  const { medium_id, nome, valor, pago, status, mes, ano } = req.body;
  const mens = db.update('mensalidades', req.params.id, {
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

router.delete('/:id', (req, res) => {
  const deleted = db.delete('mensalidades', req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Mensalidade não encontrada' });
  res.json({ message: 'Mensalidade excluída com sucesso' });
});

module.exports = router;
