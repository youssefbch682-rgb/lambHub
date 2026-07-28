// Crée les tables si elles n'existent pas. Idempotent : peut être relancé sans risque.
const db = require('./connection');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK(role IN ('admin','editeur','lecteur')),
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Table générique clé/valeur : on garde le même modèle que le localStorage
-- (une ligne = un enregistrement JSON) pour migrer sans réécrire toute la logique front.
-- 'resource' correspond aux anciennes clés KEYS (adhesifs, realisations, kpi, ...).
CREATE TABLE IF NOT EXISTS records (
  id          TEXT NOT NULL,
  resource    TEXT NOT NULL,
  data        TEXT NOT NULL,       -- JSON.stringify de l'objet
  updated_by  INTEGER REFERENCES users(id),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (resource, id)
);

CREATE TABLE IF NOT EXISTS documents (
  id          TEXT PRIMARY KEY,
  filename    TEXT NOT NULL,
  ext         TEXT,
  category    TEXT,
  size        INTEGER,
  data_url    TEXT,                -- contenu du fichier (base64) — cf. note README sur le stockage fichier
  meta        TEXT,                -- JSON: reste des métadonnées (tags, dossier, etc.)
  uploaded_by INTEGER REFERENCES users(id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_records_resource ON records(resource);
`);

console.log('✔ Migration terminée (tables créées si besoin).');
