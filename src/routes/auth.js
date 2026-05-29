const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const db = require('../database');
const { generateToken, verifyToken } = require('../middleware/auth');

router.post('/register', [
  body('nome').trim().notEmpty().withMessage('Nome \u00e9 obrigat\u00f3rio.'),
  body('email').trim().isEmail().withMessage('Email inv\u00e1lido.').normalizeEmail(),
  body('senha').isLength({ min: 6 }).withMessage('Senha deve ter no m\u00ednimo 6 caracteres.')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array().map(e => e.msg).join(' ') });
    }

    const { nome, email, senha, terreiro } = req.body;
    const existing = await db.query('users', function(u) { return u.email === email; });
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Email j\u00e1 cadastrado.' });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(senha, salt);

    var terreiroId = null;
    if (terreiro) {
      var t = await db.insert('terreiros', { nome: terreiro.trim() });
      terreiroId = t.id;
    } else {
      var t = await db.insert('terreiros', { nome: nome.split(' ')[0] + ' - Terreiro' });
      terreiroId = t.id;
    }

    var user = await db.insert('users', {
      nome: nome,
      email: email,
      password_hash: password_hash,
      terreiro_id: terreiroId,
      role: 'admin'
    });

    user = { ...user };
    delete user.password_hash;

    var token = generateToken(user);
    res.status(201).json({ user: user, token: token });
  } catch (e) {
    console.error('Erro ao registrar:', e);
    res.status(500).json({ error: 'Erro interno ao registrar.' });
  }
});

router.post('/login', [
  body('email').trim().isEmail().withMessage('Email inv\u00e1lido.').normalizeEmail(),
  body('senha').notEmpty().withMessage('Senha \u00e9 obrigat\u00f3ria.')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array().map(e => e.msg).join(' ') });
    }

    const { email, senha } = req.body;
    var users = await db.query('users', function(u) { return u.email === email; });
    if (users.length === 0) {
      await db.logAudit(null, email, 'LOGIN_FAIL', 'users', null, JSON.stringify({ reason: 'email_not_found', email }), null);
      return res.status(401).json({ error: 'Email ou senha inv\u00e1lidos.' });
    }

    var user = users[0];
    var valida = await bcrypt.compare(senha, user.password_hash);
    if (!valida) {
      await db.logAudit(user.id, user.nome, 'LOGIN_FAIL', 'users', user.id, JSON.stringify({ reason: 'wrong_password' }), user.terreiro_id);
      return res.status(401).json({ error: 'Email ou senha inv\u00e1lidos.' });
    }

    user = { ...user };
    delete user.password_hash;

    var token = generateToken(user);
    res.json({ user: user, token: token });
  } catch (e) {
    console.error('Erro ao fazer login:', e);
    res.status(500).json({ error: 'Erro interno ao fazer login.' });
  }
});

router.get('/me', verifyToken, async (req, res) => {
  try {
    var user = await db.getById('users', req.user.id);
    if (!user) return res.status(404).json({ error: 'Usu\u00e1rio n\u00e3o encontrado.' });
    delete user.password_hash;
    res.json(user);
  } catch (e) {
    res.status(500).json({ error: 'Erro interno.' });
  }
});

module.exports = router;
