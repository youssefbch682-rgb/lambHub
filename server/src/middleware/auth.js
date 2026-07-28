const jwt = require('jsonwebtoken');
const db = require('../db/connection');

const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  throw new Error('JWT_SECRET manquant — défini-le dans .env (voir .env.example)');
}

// Vérifie le token ET re-contrôle en base que le compte est toujours actif.
// Important : un JWT reste valide jusqu'à son expiration (12h) même si tu
// désactives le compte entretemps — sans cette vérification en base, la
// personne garderait l'accès jusqu'à expiration du token. Ce lookup SQLite
// est très bon marché (clé primaire), donc on peut se permettre de le faire
// à chaque requête pour une révocation immédiate.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Non authentifié' });

  let payload;
  try {
    payload = jwt.verify(token, SECRET); // { id, email, role }
  } catch (e) {
    return res.status(401).json({ error: 'Token invalide ou expiré' });
  }

  const user = db.prepare('SELECT id, email, role, active FROM users WHERE id = ?').get(payload.id);
  if (!user || !user.active) {
    return res.status(401).json({ error: 'Accès révoqué' });
  }

  req.user = { id: user.id, email: user.email, role: user.role };
  next();
}

// Rôles hiérarchiques : admin > editeur > lecteur
const RANK = { lecteur: 1, editeur: 2, admin: 3 };

// requireRole('editeur') laisse passer editeur ET admin, mais bloque lecteur
function requireRole(minRole) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Non authentifié' });
    if (RANK[req.user.role] < RANK[minRole]) {
      return res.status(403).json({ error: 'Accès refusé — rôle insuffisant' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole, SECRET };
