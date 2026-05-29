function authorize() {
  var allowed = Array.from(arguments);
  return function(req, res, next) {
    if (!req.user || !req.user.role) {
      return res.status(403).json({ error: 'Acesso negado.' });
    }
    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({ error: 'Permissão insuficiente.' });
    }
    next();
  };
}

module.exports = { authorize };
