// ============================================================
// DATA STORE — backed par l'API SQLite (auparavant localStorage)
// Les signatures load(key)/save(key,data) sont conservées à l'identique
// pour que les modules existants n'aient RIEN à changer.
// Stratégie : cache mémoire chargé au boot (loadAllData), écriture
// optimiste (l'UI se met à jour immédiatement) + synchro serveur en
// arrière-plan avec toast d'erreur en cas d'échec réseau.
// ============================================================
const RESOURCES = ['adhesifs','realisations','kpi','maquettes','social','movements','zones','slots','planning'];

const _cache = {}; // rempli par loadAllData()

function load(key){ return _cache[key] || []; }

function save(key,data){
  _cache[key] = data; // optimiste : rendu immédiat, pas d'attente réseau
  Api.putResourceAll(key,data).catch(e=>storageError(e,key));
  return true;
}

// Gestion centralisée des erreurs de stockage (réseau coupé, session expirée…)
function storageError(e,ctx){
  console.error('[Storage]',ctx||'',e);
  showToast('⚠️ Échec de synchronisation ('+(ctx||'')+') — vérifie ta connexion. Vos dernières modifications ne sont peut-être pas enregistrées sur le serveur.','error');
}

// ============================================================
// DOCUMENTS & PLANNING — toujours servis par le backend, mais via
// des endpoints dédiés (fichiers volumineux). Interface IDB.* conservée
// pour compatibilité avec le module documents.js.
// ============================================================
const IDB={
  getAllDocs(){ return apiFetch('/documents'); },
  putDoc(doc){ return apiFetch('/documents/'+doc.id,{method:'PUT',body:JSON.stringify(doc)}); },
  putDocs(docs){ return Promise.all(docs.map(d=>IDB.putDoc(d))); },
  deleteDoc(id){ return apiFetch('/documents/'+id,{method:'DELETE'}); },
  clearDocs(){ return apiFetch('/documents',{method:'DELETE'}); },
  kvGet(key){ return apiFetch('/records/planning').then(rows=>{
    const row = rows.find(r=>r.id==='main'); return row ? row : null;
  }); },
  kvSet(key,val){ return Api.putResourceAll('planning',[Object.assign({id:'main'},val)]); },
  kvDelete(key){ return Api.putResourceAll('planning',[]); }
};

// UID generator
function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,7); }

// ============================================================
// ÉCHAPPEMENT HTML — toute donnée saisie par l'utilisateur doit passer
// par esc() avant d'être injectée dans un template innerHTML.
// escObj() renvoie une copie de l'objet avec tous les champs texte échappés
// (les ids générés par uid() sont alphanumériques, l'échappement est neutre).
// ============================================================
function esc(s){ return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function escObj(o){
  if(!o||typeof o!=='object')return o;
  const r=Array.isArray(o)?[]:{};
  for(const k in o){
    const v=o[k];
    r[k]=typeof v==='string'?esc(v):Array.isArray(v)?v.map(x=>typeof x==='string'?esc(x):x):v;
  }
  return r;
}

// Debounce générique (recherches)
function debounce(fn,ms){
  let t;
  return function(...args){ clearTimeout(t); t=setTimeout(()=>fn.apply(this,args),ms); };
}

// ============================================================
// SYNCHRO MULTI-ONGLETS / MULTI-UTILISATEURS
// Avec un backend partagé, plusieurs personnes peuvent modifier en même
// temps : on repolle légèrement au retour sur l'onglet plutôt que de
// dépendre uniquement des évènements navigateur locaux.
// ============================================================
const syncChannel=('BroadcastChannel' in window)?new BroadcastChannel('lamberet-hub-sync'):null;
function broadcastSync(what){ if(syncChannel)try{syncChannel.postMessage({what});}catch(e){} }
function initTabSync(){
  if(syncChannel)syncChannel.onmessage=e=>{
    const what=e.data&&e.data.what;
    if(what==='docs' && currentPage==='documents') renderDocuments();
    else if(what==='planning' && currentPage==='planning') renderPlanning();
    else { loadAllData().then(()=>renderPage(currentPage)); }
  };
  // Recharge les données quand on revient sur l'onglet, pour voir les
  // modifications faites entretemps par un collègue.
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible'){
      loadAllData().then(()=>renderPage(currentPage));
    }
  });
}

// Global data refs
let adhesifs=[], realisations=[], kpiData=[], maquettes=[], socialData=[], movements=[], zones=[], slots=[];

// Devient asynchrone (appel réseau) : app.js attend cette promesse avant
// le premier rendu. Les modules qui lisaient adhesifs/realisations/... de
// façon synchrone continuent de fonctionner car ces variables sont
// réassignées une fois les données arrivées.
async function loadAllData(){
  const results = await Promise.all(RESOURCES.map(r=>Api.getResource(r).catch(e=>{storageError(e,r);return [];})));
  RESOURCES.forEach((r,i)=>{ _cache[r]=results[i]; });
  adhesifs=_cache.adhesifs; realisations=_cache.realisations; kpiData=_cache.kpi;
  maquettes=_cache.maquettes; socialData=_cache.social; movements=_cache.movements;
  zones=_cache.zones; slots=_cache.slots;
}
