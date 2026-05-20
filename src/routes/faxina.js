const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
  const { mes, ano } = req.query;
  let data = db.getAll('faxina');
  if (mes && ano) data = data.filter(f => f.mes === mes && f.ano === ano);
  res.json(data.sort((a, b) => a.nome.localeCompare(b.nome)));
});

router.get('/:id', (req, res) => {
  const fax = db.getById('faxina', req.params.id);
  if (!fax) return res.status(404).json({ error: 'Registro de faxina não encontrado' });
  res.json(fax);
});

router.post('/', (req, res) => {
  const { medium_id, nome, data, valor, presenca, pagamento, mes, ano } = req.body;
  if (!nome || !mes || !ano) return res.status(400).json({ error: 'Nome, mês e ano são obrigatórios' });
  const fax = db.insert('faxina', { medium_id: medium_id || null, nome, data: data || null, valor: valor || 0, presenca: presenca || 'feito', pagamento: pagamento || 'pago', mes, ano });
  res.status(201).json(fax);
});

router.put('/:id', (req, res) => {
  const existing = db.getById('faxina', req.params.id);
  if (!existing) return res.status(404).json({ error: 'Registro de faxina não encontrado' });
  const { medium_id, nome, data, valor, presenca, pagamento, mes, ano } = req.body;
  const fax = db.update('faxina', req.params.id, {
    medium_id: medium_id !== undefined ? medium_id : existing.medium_id,
    nome: nome || existing.nome,
    data: data !== undefined ? data : existing.data,
    valor: valor !== undefined ? valor : existing.valor,
    presenca: presenca !== undefined ? presenca : existing.presenca,
    pagamento: pagamento !== undefined ? pagamento : existing.pagamento,
    mes: mes !== undefined ? mes : existing.mes,
    ano: ano !== undefined ? ano : existing.ano
  });
  res.json(fax);
});

router.delete('/:id', (req, res) => {
  const deleted = db.delete('faxina', req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Registro de faxina não encontrado' });
  res.json({ message: 'Registro de faxina excluído com sucesso' });
});

module.exports = router;
