const express = require('express');
const db = require('../db/connection');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

function rowToDoc(row) {
  const meta = row.meta ? JSON.parse(row.meta) : {};
  return Object.assign({}, meta, {
    id: row.id, filename: row.filename, ext: row.ext,
    category: row.category, size: row.size, dataUrl: row.data_url,
  });
}

// GET /api/documents — liste complète (lecteur minimum)
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM documents').all();
  res.json(rows.map(rowToDoc));
});

// PUT /api/documents/:id — créer/remplacer (editeur minimum)
router.put('/:id', requireRole('editeur'), (req, res) => {
  const d = req.body || {};
  const { id, filename, ext, category, size, dataUrl, ...meta } = d;
  db.prepare(`
    INSERT INTO documents (id, filename, ext, category, size, data_url, meta, uploaded_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET filename=excluded.filename, ext=excluded.ext, category=excluded.category,
      size=excluded.size, data_url=excluded.data_url, meta=excluded.meta
  `).run(req.params.id, filename || '', ext || '', category || '', size || 0, dataUrl || null, JSON.stringify(meta), req.user.id);
  res.json({ ok: true });
});

// DELETE /api/documents/:id (editeur minimum)
router.delete('/:id', requireRole('editeur'), (req, res) => {
  db.prepare('DELETE FROM documents WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

// DELETE /api/documents — vide toute la collection (editeur minimum)
router.delete('/', requireRole('editeur'), (req, res) => {
  db.prepare('DELETE FROM documents').run();
  res.status(204).end();
});

module.exports = router;
