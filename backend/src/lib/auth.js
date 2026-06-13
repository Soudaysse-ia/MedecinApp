import jwt from 'jsonwebtoken';
import db from '../db.js';

const SECRET = process.env.JWT_SECRET || 'dev-secret-a-changer-en-production';
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || '12h';

export function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN });
}

export function verifyToken(token) {
  return jwt.verify(token, SECRET);
}

// Middleware : exige un token valide, peuple req.user
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentification requise' });
  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    return res.status(401).json({ error: 'Session invalide ou expiree' });
  }

  // Verifie que le compte existe toujours et n'a pas ete desactive par l'admin
  const u = db.prepare('SELECT id, active FROM users WHERE id = ?').get(payload.id);
  if (!u) return res.status(401).json({ error: 'Compte introuvable' });
  if (!u.active) return res.status(403).json({ error: 'Acces desactive. Contactez l\'administrateur.' });

  // Trace la derniere activite (utilise pour "actif maintenant" cote admin)
  db.prepare("UPDATE users SET last_seen = datetime('now') WHERE id = ?").run(u.id);

  req.user = payload;
  next();
}

// Middleware : restreint l'acces a certains roles
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Acces refuse pour ce role' });
    }
    next();
  };
}
