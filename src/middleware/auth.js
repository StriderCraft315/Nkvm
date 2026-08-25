const authService = require('../services/authService');
const { settings } = require('../lib/db');

function getUserFromReq(req) {
  let token = req.cookies ? req.cookies.token : null;
  if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.slice(7);
  }
  if (!token && req.query && req.query.token) {
    token = req.query.token;
  }
  if (!token) return null;
  const payload = authService.verifyToken(token);
  if (!payload) return null;
  const user = authService.findById(Number(payload.sub));
  if (!user) return null;
  if (user.suspended) return null;
  return user;
}

function requireAuth(req, res, next) {
  const user = getUserFromReq(req);
  if (!user) {
    if (req.xhr || req.path.startsWith('/api') || req.headers.accept?.includes('application/json')) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    return res.redirect('/login');
  }
  req.user = user;
  next();
}

function optionalAuth(req, res, next) {
  req.user = getUserFromReq(req);
  next();
}

function requireAdmin(req, res, next) {
  const user = req.user || getUserFromReq(req);
  if (!user) {
    if (req.xhr || req.path.startsWith('/api') || req.headers.accept?.includes('application/json')) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    return res.redirect('/login');
  }
  if (user.role !== 'admin' && !user.root_admin) {
    if (req.xhr || req.path.startsWith('/api') || req.headers.accept?.includes('application/json')) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    return res.status(403).render('error/403', { code: 403, title: 'Forbidden', message: 'You do not have permission to access this page.', settings: settings.all(), user });
  }
  req.user = user;
  next();
}

function apiAuth(req, res, next) {
  const user = getUserFromReq(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  req.user = user;
  next();
}

function apiAdmin(req, res, next) {
  const user = getUserFromReq(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  if (user.role !== 'admin' && !user.root_admin) return res.status(403).json({ error: 'Forbidden' });
  req.user = user;
  next();
}

module.exports = { requireAuth, optionalAuth, requireAdmin, apiAuth, apiAdmin, getUserFromReq };
