# Lamberet Decoration Hub

Application de gestion interne (stock adhésifs, réalisations, KPI, réseaux sociaux, maquettes, assistant IA, gestion documentaire, planning) en **vanilla HTML/CSS/JS** — aucun framework, aucun build step. Il suffit d'ouvrir `index.html` dans un navigateur (ou de servir le dossier avec n'importe quel serveur statique).

## Structure du projet

```
lamberet-hub/
├── index.html                  # Structure HTML + chargement CSS/JS
├── css/
│   ├── base.css                # Variables :root, resets, shell, sidebar, topbar
│   ├── components.css          # Cartes KPI, tags, toolbar, segments, tables, progress
│   ├── modules.css             # Plan entrepôt, planning, galerie, social, chat IA, direction
│   ├── ui.css                  # Drawer, modales, toasts, tabs, confirm, roadmap
│   └── documents.css           # Module gestion documentaire + gestion données
├── js/
│   ├── core/
│   │   ├── store.js            # localStorage + IndexedDB, uid(), esc(), synchro multi-onglets
│   │   ├── navigation.js       # Navigation entre pages + système d'onglets
│   │   └── helpers.js          # Helpers génériques (deleteItem, toasts, modales…)
│   ├── modules/
│   │   ├── dashboard.js
│   │   ├── adhesifs.js         # Stock adhésifs + plan entrepôt 2D + mouvements
│   │   ├── realisations.js
│   │   ├── kpi.js
│   │   ├── social.js
│   │   ├── maquettes.js
│   │   ├── assistant.js        # Assistant IA (connexion via backend proxy)
│   │   ├── direction.js
│   │   ├── donnees.js          # Gestion données + import CSV robuste
│   │   ├── roadmap.js
│   │   ├── documents.js        # Gestion documentaire complète
│   │   └── planning.js         # Import Excel, édition, export, impression
│   └── app.js                  # Boot asynchrone (attend IndexedDB avant le 1er rendu)
├── assets/                     # Images / ressources statiques (vide pour l'instant)
└── README.md
```

## ⚠️ Ordre de chargement des scripts

Le projet utilise des **scripts classiques** (pas de modules ES) car le HTML contient ~260 gestionnaires inline (`onclick="..."`) qui nécessitent des fonctions **globales**. L'ordre des `<script>` dans `index.html` doit être respecté :

1. **Librairies CDN** (xlsx, jszip, papaparse) — dans le `<head>`
2. **`js/core/*`** — store, navigation, helpers
3. **`js/modules/*`** — les modules métier (ordre indifférent entre eux)
4. **`js/app.js`** — toujours en **dernier** : c'est lui qui démarre l'application

Toute nouvelle fonctionnalité : créer un fichier dans `js/modules/`, l'ajouter dans `index.html` **avant** `app.js`.

## Lancer en local

Double-clic sur `index.html`, ou pour un serveur local :

```bash
npx serve .
# ou
python3 -m http.server 8000
```

## Données

- **localStorage** : métadonnées légères (préfixe `ldh_`)
- **IndexedDB** (`lamberet-hub`) : documents volumineux et planning
- Synchro multi-onglets via `BroadcastChannel`

Les données restent dans le navigateur de l'utilisateur — pensez à utiliser l'export (module « Gestion données ») pour les sauvegardes.
