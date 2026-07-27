// ============================================================
// ROADMAP
// ============================================================
function renderRoadmap(){
  const roadmap=[
    {v:'v1','en-cours':true,label:'Version 1 — localStorage',desc:'Application autonome sans backend. Toutes les données sont stockées dans le navigateur via localStorage. CRUD complet sur tous les modules, export/import JSON et CSV.',status:'En cours'},
    {v:'v2',label:'Version 2 — Import / Export avancé',desc:'Export CSV par module, synchronisation multi-onglets, historique des modifications, snapshots automatiques.',status:'Prévu'},
    {v:'v3',label:'Version 3 — Base de données',desc:'Migration vers PostgreSQL ou Supabase. API REST pour tous les modules. Stockage cloud des fichiers (images, PDF, maquettes AI).',status:'Future'},
    {v:'v4',label:'Version 4 — Comptes utilisateurs',desc:'Authentification (Supabase Auth / NextAuth). Rôles : Admin, Responsable, Consultant. Permissions par module.',status:'Future'},
    {v:'v5',label:'Version 5 — API Réseaux sociaux',desc:'Connexion Meta API (Facebook, Instagram), LinkedIn API. Import automatique des métriques de performance.',status:'Future'},
    {v:'v6',label:'Version 6 — Assistant IA connecté',desc:'IA connectée à la vraie base de données. Recherche sémantique sur les réalisations. Suggestions proactives. Interface en langage naturel.',status:'Future'}
  ];
  const colors={
    'En cours':'var(--success)','bg-cours':'var(--success-soft)',
    'Prévu':'var(--info)','bg-prevu':'var(--info-soft)',
    'Future':'var(--ink-3)','bg-future':'var(--surface-3)'
  };
  document.getElementById('roadmapList').innerHTML=roadmap.map(r=>`
    <div class="roadmap-item">
      <div class="roadmap-badge"><span class="tag ${r.status==='En cours'?'tag-success':r.status==='Prévu'?'tag-info':'tag-neutral'}" style="font-size:10.5px">${r.v}</span></div>
      <div class="roadmap-content">
        <div class="title">${r.label} <span style="font-size:11px;font-weight:500;color:var(--ink-3)">· ${r.status}</span></div>
        <div class="desc">${r.desc}</div>
      </div>
    </div>
  `).join('');
}

