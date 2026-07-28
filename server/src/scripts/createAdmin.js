// Crée (ou met à jour) le premier compte admin à partir de variables d'environnement.
// Usage : ADMIN_EMAIL=toi@lamberet.fr ADMIN_PASSWORD=xxxx npm run seed:admin
require('dotenv').config();
require('../db/migrate');
const bcrypt = require('bcryptjs');
const db = require('../db/connection');

const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;

if (!email || !password) {
  console.error('⚠️  Définis ADMIN_EMAIL et ADMIN_PASSWORD (dans .env ou en ligne de commande).');
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 10);
const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);

if (existing) {
  db.prepare('UPDATE users SET password_hash = ?, role = ?, active = 1 WHERE id = ?')
    .run(hash, 'admin', existing.id);
  console.log(`✔ Compte admin existant mis à jour : ${email}`);
} else {
  db.prepare('INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)')
    .run(email, hash, 'admin');
  console.log(`✔ Compte admin créé : ${email}`);
}
