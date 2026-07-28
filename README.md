# Lamberet Decoration Hub

Application de gestion interne (stock adhésifs, réalisations, KPI, réseaux sociaux, maquettes, assistant IA, gestion documentaire, planning). Front en **vanilla HTML/CSS/JS**, backend **Node/Express + SQLite**, déployable en un seul `docker-compose up`.

## Architecture

```
Navigateurs (postes Lamberet)
        │  HTTPS (via nginx)
        ▼
┌─────────────────────┐        ┌──────────────────────────┐
│ frontend (nginx)     │──/api─▶│ backend (Node/Express)    │
│ sert index.html/css/js│        │ auth JWT + rôles          │
└─────────────────────┘        │ SQLite (better-sqlite3)   │
                                 └──────────────┬───────────┘
                                                 ▼
                                      volume Docker persistant
                                      (lamberet_hub_data)
```

- **Un seul point d'entrée** : `http://<serveur>:8080` (nginx sert le front et fait proxy vers `/api`)
- **Toutes les données** (adhésifs, réalisations, documents, planning…) vivent désormais dans SQLite côté serveur — plus de localStorage/IndexedDB navigateur.
- **Comptes utilisateurs avec rôles** : `admin`, `editeur`, `lecteur`.

## Structure du projet

```
lamberet-hub/
├── docker-compose.yml       # orchestration frontend + backend + volume SQLite
├── Dockerfile.frontend       # image nginx servant le front
├── nginx.conf                # sert les fichiers statiques + proxy /api → backend
├── .env.example               # JWT_SECRET à copier en .env
├── index.html / css/ / js/    # front (inchangé dans sa structure, cf. détail plus bas)
└── server/                    # backend
    ├── Dockerfile
    ├── package.json
    ├── .env.example            # JWT_SECRET + ADMIN_EMAIL/PASSWORD pour le 1er compte
    └── src/
        ├── index.js             # point d'entrée Express
        ├── db/
        │   ├── connection.js     # ouverture SQLite (mode WAL)
        │   └── migrate.js        # création des tables (idempotent)
        ├── middleware/auth.js    # vérification JWT + rôle, révocation immédiate
        ├── routes/
        │   ├── auth.js            # login, gestion des comptes (admin)
        │   ├── records.js         # CRUD générique (adhésifs, réalisations, kpi…)
        │   └── documents.js       # documents (fichiers, potentiellement volumineux)
        └── scripts/createAdmin.js # crée/réinitialise le premier compte admin
```

### Front — détail (inchangé)

```
css/base.css | components.css | modules.css | ui.css | documents.css
js/core/     → api.js (client HTTP), authUI.js (écran de connexion),
                store.js (cache mémoire + sync API), navigation.js, helpers.js
js/modules/  → un fichier par module métier (adhesifs, documents, planning, …)
js/app.js    → vérifie la session puis démarre l'app (boot)
```

## Déploiement (docker-compose)

```bash
cp .env.example .env
```

Édite le fichier `.env` et remplis **3 valeurs** :

```
JWT_SECRET=une-valeur-aleatoire-longue    # génère-la avec : openssl rand -base64 48
ADMIN_EMAIL=toi@lamberet.fr
ADMIN_PASSWORD=un-mot-de-passe-solide
```

Puis lance :

```bash
docker compose up -d --build
```

Le compte admin est **créé automatiquement au démarrage** à partir de `ADMIN_EMAIL`/`ADMIN_PASSWORD` — pas besoin de commande supplémentaire. Connecte-toi directement sur `http://<adresse-du-serveur>:8080` avec ces identifiants.

Depuis l'app (page **Direction** → panneau « Comptes équipe »), tu peux ensuite créer les comptes du reste de l'équipe et choisir leur rôle.

> Tu peux laisser `ADMIN_EMAIL`/`ADMIN_PASSWORD` dans le `.env` en permanence : au redémarrage du conteneur, le mot de passe n'est réécrit que si tu changes cette valeur dans `.env` — donc si tu changes ton mot de passe depuis l'app, il ne sera pas écrasé au prochain redémarrage tant que le `.env` ne change pas lui aussi.

Sans passer par l'UI, tu peux aussi créer des comptes directement en API :

```bash
curl -X POST http://<serveur>:8080/api/auth/users \
  -H "Authorization: Bearer <ton_token_admin>" \
  -H "Content-Type: application/json" \
  -d '{"email":"collegue@lamberet.fr","password":"xxxx","role":"editeur"}'
```

## Rôles et permissions

| Rôle      | Lecture | Écriture (créer/modifier/supprimer) | Gestion des comptes |
|-----------|---------|--------------------------------------|----------------------|
| `lecteur` | ✔       | ✘                                     | ✘                     |
| `editeur` | ✔       | ✔                                     | ✘                     |
| `admin`   | ✔       | ✔                                     | ✔                     |

**Ouvrir/fermer l'accès de quelqu'un à tout moment** : dans le panneau admin (ou via `PATCH /api/auth/users/:id` avec `{"active":false}`). C'est **immédiat** — même si la personne a un token de session encore valide (12h), l'accès est coupé à la requête suivante, pas seulement à sa prochaine connexion. Voir `src/middleware/auth.js`.

## Sauvegardes

Toute la donnée vit dans le volume Docker `lamberet_hub_data` (fichier SQLite). C'est **ce volume** qu'il faut sauvegarder régulièrement, par exemple :

```bash
docker compose exec backend sh -c "cp /app/data/lamberet-hub.db /app/data/backup-$(date +%F).db"
docker cp lamberet-hub-backend:/app/data/backup-$(date +%F).db ./backups/
```

À planifier en cron sur le serveur Lamberet, avec copie vers ton stockage cloud (OneDrive/kDrive…) pour une sauvegarde hors du serveur.

## Développement local (sans Docker)

```bash
cd server
cp .env.example .env   # remplis JWT_SECRET
npm install
npm run migrate
npm run seed:admin     # avec ADMIN_EMAIL/ADMIN_PASSWORD dans .env
npm start               # API sur http://localhost:4000

# dans un autre terminal, sers le front (ex. avec live-server ou python)
python3 -m http.server 8080
# et adapte js/core/api.js → window.LDH_API_BASE = 'http://localhost:4000/api'
```

## Limites actuelles / prochaines étapes

- Le panneau **admin de gestion des comptes** existe côté API (`/api/auth/users`) mais n'a pas encore d'écran dédié dans l'UI — à brancher dans le module Direction ou Données.
- Les documents volumineux sont stockés en base64 dans SQLite (simple, mais pas idéal au-delà de quelques centaines de Mo cumulés) — une évolution possible est de stocker les fichiers sur disque/volume et de ne garder que le chemin en base.
- SQLite convainc très bien pour un usage interne (dizaines d'utilisateurs simultanés grâce au mode WAL) ; au-delà, envisager PostgreSQL.
