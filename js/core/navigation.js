// ============================================================
// NAVIGATION
// ============================================================
const pageTitles={dashboard:'Dashboard',adhesifs:'Stock adhésifs',realisations:'Réalisations',kpi:'KPI Satisfaction',maquettes:'Fonds de maquette',social:'Réseaux sociaux',assistant:'Assistant IA',direction:'Vue Direction',donnees:'Gestion données',roadmap:'Roadmap',documents:'Gestion documentaire',planning:'Planning'};

let currentPage='dashboard';
function goTo(page){
  currentPage=page;
  if(location.hash!=='#'+page)location.hash=page; // assigner un hash identique ne déclenche pas hashchange
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  const el=document.querySelector(`[data-page="${page}"]`);
  if(el)el.classList.add('active');
  const nav=document.getElementById(`nav-${page}`);
  if(nav)nav.classList.add('active');
  document.getElementById('pageTitle').textContent=pageTitles[page]||page;
  renderPage(page);
}

function renderPage(page){
  if(page==='dashboard')renderDashboard();
  else if(page==='adhesifs'){renderAdhesifs();renderWarehouse();renderMovements();}
  else if(page==='realisations')renderGallery();
  else if(page==='kpi')renderKPI();
  else if(page==='maquettes')renderMaquettes();
  else if(page==='social')renderSocial();
  else if(page==='direction')renderDirection();
  else if(page==='donnees')renderDonnees();
  else if(page==='roadmap')renderRoadmap();
  else if(page==='assistant')renderAIStatus();
  else if(page==='documents')renderDocuments();
  else if(page==='planning')renderPlanning();
}

// ============================================================
// TABS
// ============================================================
function switchTab(prefix,tab){
  document.querySelectorAll(`[id^="tab-${prefix}-"]`).forEach(t=>t.classList.remove('active-tab'));
  document.querySelectorAll(`[data-tab^="${prefix}-"]`).forEach(b=>b.classList.remove('active-tab'));
  const el=document.getElementById(`tab-${prefix}-${tab}`);
  if(el)el.classList.add('active-tab');
  const btn=document.querySelector(`[data-tab="${prefix}-${tab}"]`);
  if(btn)btn.classList.add('active-tab');
}

