// ============================================================
// DATA STORE — localStorage-backed
// ============================================================
const KEYS = {
  adhesifs:'ldh_adhesifs', realisations:'ldh_realisations', kpi:'ldh_kpi',
  maquettes:'ldh_maquettes', social:'ldh_social', movements:'ldh_movements',
  zones:'ldh_zones', slots:'ldh_slots', documents:'ldh_documents', planning:'ldh_planning'
};

function load(key){ try{ return JSON.parse(localStorage.getItem(KEYS[key]))||[]; }catch(e){ return []; } }
function save(key,data){
  try{
    localStorage.setItem(KEYS[key],JSON.stringify(data));
    return true;
  }catch(e){
    storageError(e,key);
    return false;
  }
}

// Gestion centralisée des erreurs de stockage (quota plein, IndexedDB indisponible…)
function storageError(e,ctx){
  console.error('[Storage]',ctx||'',e);
  const isQuota=e&&(e.name==='QuotaExceededError'||e.name==='NS_ERROR_DOM_QUOTA_REACHED'||e.code===22);
  showToast(isQuota
    ?'⚠️ Stockage plein — la dernière sauvegarde a échoué. Exportez puis supprimez des documents volumineux.'
    :'⚠️ Erreur de sauvegarde ('+((e&&e.name)||'inconnue')+') — vos dernières modifications ne sont peut-être pas enregistrées.'
  ,'error');
}

// ============================================================
// INDEXEDDB — stockage des données volumineuses (documents, planning)
// localStorage (~5 Mo au total) est conservé pour les métadonnées légères ;
// les fichiers (dataURL) et le planning vivent désormais dans IndexedDB (quota en Go).
// ============================================================
const IDB={
  _db:null,
  open(){
    return new Promise((res,rej)=>{
      if(this._db)return res(this._db);
      if(!('indexedDB' in window))return rej(new Error('IndexedDB non supporté'));
      const req=indexedDB.open('lamberet-hub',1);
      req.onupgradeneeded=e=>{
        const db=e.target.result;
        if(!db.objectStoreNames.contains('documents'))db.createObjectStore('documents',{keyPath:'id'});
        if(!db.objectStoreNames.contains('kv'))db.createObjectStore('kv');
      };
      req.onsuccess=()=>{this._db=req.result;res(this._db);};
      req.onerror=()=>rej(req.error);
    });
  },
  _tx(store,mode,fn){
    return this.open().then(db=>new Promise((res,rej)=>{
      const tx=db.transaction(store,mode);
      const rq=fn(tx.objectStore(store));
      tx.oncomplete=()=>res(rq&&rq.result!==undefined?rq.result:undefined);
      tx.onerror=()=>rej(tx.error);
      tx.onabort=()=>rej(tx.error||new Error('Transaction annulée'));
    }));
  },
  getAllDocs(){ return this._tx('documents','readonly',s=>s.getAll()); },
  putDoc(doc){ return this._tx('documents','readwrite',s=>s.put(doc)); },
  putDocs(docs){ return this._tx('documents','readwrite',s=>{docs.forEach(d=>s.put(d));}); },
  deleteDoc(id){ return this._tx('documents','readwrite',s=>s.delete(id)); },
  clearDocs(){ return this._tx('documents','readwrite',s=>s.clear()); },
  kvGet(key){ return this._tx('kv','readonly',s=>s.get(key)); },
  kvSet(key,val){ return this._tx('kv','readwrite',s=>s.put(val,key)); },
  kvDelete(key){ return this._tx('kv','readwrite',s=>s.delete(key)); }
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
// SYNCHRO MULTI-ONGLETS
// - localStorage : événement 'storage' natif (déclenché dans les AUTRES onglets)
// - IndexedDB (documents, planning) : BroadcastChannel
// Deux onglets ouverts ne s'écrasent plus : chaque onglet recharge
// les données modifiées ailleurs et re-rend sa page courante.
// ============================================================
const syncChannel=('BroadcastChannel' in window)?new BroadcastChannel('lamberet-hub-sync'):null;
function broadcastSync(what){ if(syncChannel)try{syncChannel.postMessage({what});}catch(e){} }
function initTabSync(){
  window.addEventListener('storage',e=>{
    if(!e.key||!Object.values(KEYS).includes(e.key))return;
    loadAllData();
    renderPage(currentPage);
  });
  if(syncChannel)syncChannel.onmessage=async e=>{
    const what=e.data&&e.data.what;
    try{
      if(what==='docs'){
        docsCache=await IDB.getAllDocs();
        updateDocBadge();
        if(currentPage==='documents')renderDocuments();
      }else if(what==='planning'){
        const v=await IDB.kvGet('planning');
        planningStore=v!=null?v:null;
        if(currentPage==='planning')renderPlanning();
      }
    }catch(err){console.warn('[Sync]',err);}
  };
}

// Global data refs
let adhesifs=[], realisations=[], kpiData=[], maquettes=[], socialData=[], movements=[], zones=[], slots=[];

function loadAllData(){
  adhesifs=load('adhesifs');
  realisations=load('realisations');
  kpiData=load('kpi');
  maquettes=load('maquettes');
  socialData=load('social');
  movements=load('movements');
  zones=load('zones');
  slots=load('slots');
}

