// ============================================================
// INIT — vérifie l'authentification, puis démarre l'application
// (attend le backend SQLite avant le premier rendu).
// ============================================================
let planTableDebounced=()=>{};

async function startApp(){
  document.getElementById('pageDate').textContent=new Date().toLocaleDateString('fr-FR',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
  applyRolePermissions();
  await Promise.all([DocStorage.init(),initPlanning()]);
  await loadAllData();
  // Recherches debouncées (les bindings de function declarations sont réassignables)
  filterAdhesifs=debounce(filterAdhesifs,180);
  filterRealisations=debounce(filterRealisations,180);
  filterDocs=debounce(filterDocs,180);
  planTableDebounced=debounce(renderPlanningTable,200);
  // Synchro entre onglets / utilisateurs
  initTabSync();
  // Navigation par hash : lien direct #adhesifs, bouton retour du navigateur
  window.addEventListener('hashchange',()=>{
    const p=location.hash.slice(1);
    if(p&&p!==currentPage&&pageTitles[p])goTo(p);
  });
  const initial=location.hash.slice(1);
  if(initial&&pageTitles[initial]&&initial!=='dashboard')goTo(initial);
  else{renderDashboard();}
  updateDocBadge();
  // Garde-fou : import de documents en cours de classification non confirmé
  window.addEventListener('beforeunload',e=>{
    if(pendingDocs&&pendingDocs.length){e.preventDefault();e.returnValue='';}
  });
}

(async function boot(){
  const token=getToken();
  if(!token){ showLoginScreen(); return; }
  try{
    const {user}=await Api.me(); // vérifie que le token est toujours valide (pas révoqué par un admin)
    setCurrentUser(user);
    await startApp();
  }catch(e){
    showLoginScreen('Session expirée — reconnecte-toi.');
  }
})();
