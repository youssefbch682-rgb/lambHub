const Database = require('better-sqlite3');
const path = require('path');

// DB_PATH pointe vers un fichier dans le volume Docker monté (voir docker-compose.yml)
// afin que les données survivent aux redéploiements du conteneur.
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/lamberet-hub.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL'); // meilleure tenue en écritures concurrentes multi-utilisateurs
db.pragma('foreign_keys = ON');

module.exports = db;
