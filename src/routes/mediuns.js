const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', async (req, res) => {
  const mediuns = (await db.getAll('mediuns')).sort((a, b) => a.nome.localeCompare(b.nome));
  res.json(mediuns);
});

router.get('/:id', async (req, res) => {
  const medium = await db.getById('mediuns', req.params.id);
  if (!medium) return res.status(404).json({ error: 'Médium não encontrado' });
  res.json(medium);
});

router.post('/', async (req, res) => {
  const { nome, tipo, tel, endereco, email, nasc, obs } = req.body;
  if (!nome) return res.status(400).json({ error: 'Nome é obrigatório' });
  const iniciais = nome.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const dataCadastro = new Date().toISOString().slice(0, 10);
  const medium = await db.insert('mediuns', { nome, tipo: tipo || 'Médium', tel: tel || '', endereco: endereco || '', email: email || '', nasc: nasc || '', obs: obs || '', iniciais, data_cadastro: dataCadastro, status: 'Ativo' });
  res.status(201).json(medium);
});

router.put('/:id', async (req, res) => {
  const existing = await db.getById('mediuns', req.params.id);
  if (!existing) return res.status(404).json({ error: 'Médium não encontrado' });
  const { nome, tipo, tel, endereco, email, nasc, obs, data_cadastro, status } = req.body;
  const iniciais = nome ? nome.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : existing.iniciais;
  const medium = await db.update('mediuns', req.params.id, {
    nome: nome || existing.nome,
    tipo: tipo || existing.tipo,
    tel: tel !== undefined ? tel : existing.tel,
    endereco: endereco !== undefined ? endereco : existing.endereco,
    email: email !== undefined ? email : existing.email,
    nasc: nasc !== undefined ? nasc : existing.nasc,
    obs: obs !== undefined ? obs : existing.obs,
    iniciais,
    data_cadastro: data_cadastro || existing.data_cadastro,
    status: status || existing.status
  });
  res.json(medium);
});

router.delete('/:id', async (req, res) => {
  const deleted = await db.delete('mediuns', req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Médium não encontrado' });
  res.json({ message: 'Médium excluído com sucesso' });
});

module.exports = router;
