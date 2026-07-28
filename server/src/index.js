require('dotenv').config();
require('./db/migrate'); // s'assure que les tables existent au démarrage

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const db = require('./db/connection');

// Création/mise à jour automatique du compte admin au démarrage, si les
// variables ADMIN_EMAIL / ADMIN_PASSWORD sont fournies (typiquement depuis
// docker-compose.yml). Pratique : pas besoin de lancer une commande à part.
// Si le compte existe déjà avec ce mot de passe, cette étape ne fait rien
// (aucun risque à laisser ces variables en permanence dans le compose).
(function ensureAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return;

  const hash = bcrypt.hashSync(password, 10);
  const existing = db.prepare('SELECT id, password_hash FROM users WHERE email = ?').get(email);
  if (existing) {
    // Ne réécrit que si le mot de passe défini dans docker-compose a changé,
    // pour ne pas invalider silencieusement un mot de passe changé depuis l'UI.
    if (!bcrypt.compareSync(password, existing.password_hash)) {
      db.prepare('UPDATE users SET password_hash = ?, role = ?, active = 1 WHERE id = ?')
        .run(hash, 'admin', existing.id);
      console.log(`✔ Compte admin mis à jour : ${email}`);
    }
  } else {
    db.prepare('INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)')
      .run(email, hash, 'admin');
    console.log(`✔ Compte admin créé automatiquement : ${email}`);
  }
})();

const authRoutes = require('./routes/auth');
const recordsRoutes = require('./routes/records');
const documentsRoutes = require('./routes/documents');

const app = express();
app.use(cors());
app.use(express.json({ limit: '25mb' })); // documents en base64 peuvent être volumineux

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRoutes);
app.use('/api/records', recordsRoutes);
app.use('/api/documents', documentsRoutes);

// Erreurs non gérées → JSON propre plutôt qu'un stacktrace HTML
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Erreur serveur' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`✔ API Lamberet Hub sur le port ${PORT}`));
