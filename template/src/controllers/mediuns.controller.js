const service = require('../services/mediuns.service');

async function list(req, res, next) {
  try {
    const rows = await service.listMediuns();
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function get(req, res, next) {
  try {
    const medium = await service.getMedium(req.params.id);
    if (!medium) return res.status(404).json({ error: 'Médium não encontrado' });
    res.json(medium);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { nome, tipo, tel } = req.body;
    if (!nome) return res.status(400).json({ error: 'Nome é obrigatório' });
    const medium = await service.createMedium({ nome, tipo, tel });
    res.status(201).json(medium);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const { nome, tipo, tel } = req.body;
    if (!nome) return res.status(400).json({ error: 'Nome é obrigatório' });
    const medium = await service.updateMedium(req.params.id, { nome, tipo, tel });
    res.json(medium);
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const deleted = await service.deleteMedium(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Médium não encontrado' });
    res.json({ message: 'Excluído com sucesso' });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, get, create, update, remove };
