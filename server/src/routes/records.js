const express = require('express');
const db = require('../db/connection');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Doit correspondre aux anciennes clés KEYS du front (store.js)
const ALLOWED_RESOURCES = new Set([
  'adhesifs', 'realisations', 'kpi', 'maquettes', 'social',
  'movements', 'zones', 'slots', 'planning'
]);

function checkResource(req, res, next) {
  if (!ALLOWED_RESOURCES.has(req.params.resource)) {
    return res.status(404).json({ error: 'Ressource inconnue' });
  }
  next();
}

// Toutes les routes exigent d'être authentifié
router.use(requireAuth);

// GET /api/records/:resource — liste complète (lecteur minimum)
router.get('/:resource', checkResource, (req, res) => {
  const rows = db.prepare('SELECT id, data, updated_at FROM records WHERE resource = ?')
    .all(req.params.resource);
  res.json(rows.map(r => ({ ...JSON.parse(r.data), _updated_at: r.updated_at })));
});

// PUT /api/records/:resource/:id — créer/remplacer un enregistrement (editeur minimum)
router.put('/:resource/:id', checkResource, requireRole('editeur'), (req, res) => {
  const { resource, id } = req.params;
  const data = JSON.stringify(req.body || {});
  db.prepare(`
    INSERT INTO records (resource, id, data, updated_by, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(resource, id) DO UPDATE SET data = excluded.data, updated_by = excluded.updated_by, updated_at = excluded.updated_at
  `).run(resource, id, data, req.user.id);
  res.json({ ok: true });
});

// DELETE /api/records/:resource/:id (editeur minimum)
router.delete('/:resource/:id', checkResource, requireRole('editeur'), (req, res) => {
  db.prepare('DELETE FROM records WHERE resource = ? AND id = ?').run(req.params.resource, req.params.id);
  res.status(204).end();
});

// PUT /api/records/:resource — remplace TOUTE la collection en une fois
// (pratique pour coller au comportement actuel de save() qui écrase tout le tableau)
router.put('/:resource', checkResource, requireRole('editeur'), (req, res) => {
  const { resource } = req.params;
  const items = Array.isArray(req.body) ? req.body : [];
  const tx = db.transaction((items) => {
    db.prepare('DELETE FROM records WHERE resource = ?').run(resource);
    const insert = db.prepare(`
      INSERT INTO records (resource, id, data, updated_by, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `);
    for (const item of items) {
      if (!item.id) continue;
      insert.run(resource, item.id, JSON.stringify(item), req.user.id);
    }
  });
  tx(items);
  res.json({ ok: true, count: items.length });
});

module.exports = router;
