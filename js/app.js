// ============================================================
// INIT — boot asynchrone (IndexedDB doit être chargé avant le premier rendu)
// ============================================================
let planTableDebounced=()=>{};
(async function boot(){
  document.getElementById('pageDate').textContent=new Date().toLocaleDateString('fr-FR',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
  await Promise.all([DocStorage.init(),initPlanning()]);
  loadAllData();
  // Recherches debouncées (les bindings de function declarations sont réassignables)
  filterAdhesifs=debounce(filterAdhesifs,180);
  filterRealisations=debounce(filterRealisations,180);
  filterDocs=debounce(filterDocs,180);
  planTableDebounced=debounce(renderPlanningTable,200);
  // Synchro entre onglets
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
})();
