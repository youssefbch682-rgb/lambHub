const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/connection');
const { SECRET, requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login  { email, password }
router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis' });

  const user = db.prepare('SELECT * FROM users WHERE email = ? AND active = 1').get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Identifiants incorrects' });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    SECRET,
    { expiresIn: '12h' }
  );
  res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
});

// GET /api/auth/me — vérifie le token courant et renvoie l'utilisateur
router.get('/me', requireAuth, (req, res) => res.json({ user: req.user }));

// --- Gestion des comptes (réservée admin) ---

// GET /api/auth/users — liste des comptes
router.get('/users', requireAuth, requireRole('admin'), (req, res) => {
  const users = db.prepare('SELECT id, email, role, active, created_at FROM users ORDER BY created_at').all();
  res.json(users);
});

// POST /api/auth/users — créer un compte { email, password, role }
router.post('/users', requireAuth, requireRole('admin'), (req, res) => {
  const { email, password, role } = req.body || {};
  if (!email || !password || !['admin', 'editeur', 'lecteur'].includes(role)) {
    return res.status(400).json({ error: 'email, password et role (admin|editeur|lecteur) requis' });
  }
  const hash = bcrypt.hashSync(password, 10);
  try {
    const info = db.prepare(
      'INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)'
    ).run(email, hash, role);
    res.status(201).json({ id: info.lastInsertRowid, email, role });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) return res.status(409).json({ error: 'Cet email existe déjà' });
    throw e;
  }
});

// PATCH /api/auth/users/:id — activer/désactiver (= ouvrir/fermer l'accès) ou changer le rôle
router.patch('/users/:id', requireAuth, requireRole('admin'), (req, res) => {
  const { active, role } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

  if (typeof active === 'boolean') {
    db.prepare('UPDATE users SET active = ? WHERE id = ?').run(active ? 1 : 0, user.id);
  }
  if (role && ['admin', 'editeur', 'lecteur'].includes(role)) {
    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, user.id);
  }
  const updated = db.prepare('SELECT id, email, role, active FROM users WHERE id = ?').get(user.id);
  res.json(updated);
});

// DELETE /api/auth/users/:id — suppression définitive du compte
router.delete('/users/:id', requireAuth, requireRole('admin'), (req, res) => {
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

module.exports = router;
