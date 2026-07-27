// ============================================================
// DONNÉES
// ============================================================
function renderDonnees(){
  loadAllData();
  const statusEl=document.getElementById('storageStatus');
  const entries=[
    ['adhesifs','Adhésifs',adhesifs.length],['realisations','Réalisations',realisations.length],
    ['kpi','Retours KPI',kpiData.length],['maquettes','Maquettes',maquettes.length],
    ['social','Publications sociales',socialData.length],['movements','Mouvements',movements.length],
    ['zones','Zones',zones.length],['slots','Emplacements',slots.length]
  ];
  statusEl.innerHTML=entries.map(([k,l,c])=>{
    const bytes=JSON.stringify(load(k)).length;
    return `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:var(--surface-2);border-radius:var(--r-s)"><span style="font-weight:600">${l}</span><div style="display:flex;gap:12px;align-items:center"><span class="mono">${c} entrées · ${(bytes/1024).toFixed(1)} Ko</span><button class="btn btn-ghost btn-sm" onclick="exportModule('${k}')">Exporter</button></div></div>`;
  }).join('');
  // Modules stockés en IndexedDB
  const docs=DocStorage.getAll();
  const docBytes=docs.reduce((s,d)=>s+(d.dataUrl?d.dataUrl.length:0)+500,0);
  const planSheets=planningStore&&planningStore.sheets?planningStore.sheets.length:0;
  statusEl.innerHTML+=`
    <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:var(--brand-soft);border-radius:var(--r-s)"><span style="font-weight:600">Documents <span class="mono" style="font-weight:400;font-size:11px;color:var(--ink-3)">(IndexedDB)</span></span><div style="display:flex;gap:12px;align-items:center"><span class="mono">${docs.length} fichiers · ${(docBytes/1024/1024).toFixed(1)} Mo</span><button class="btn btn-ghost btn-sm" onclick="exportDocsJSON()">Exporter</button></div></div>
    <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:var(--brand-soft);border-radius:var(--r-s)"><span style="font-weight:600">Planning <span class="mono" style="font-weight:400;font-size:11px;color:var(--ink-3)">(IndexedDB)</span></span><span class="mono">${planSheets} feuille(s)</span></div>`;
  // Quota réel du navigateur
  if(navigator.storage&&navigator.storage.estimate){
    navigator.storage.estimate().then(({usage,quota})=>{
      if(!usage||!quota)return;
      const pct=((usage/quota)*100).toFixed(1);
      statusEl.innerHTML+=`<div style="padding:8px 10px;font-size:11.5px;color:var(--ink-3)" class="mono">💽 Stockage navigateur : ${(usage/1024/1024).toFixed(1)} Mo utilisés sur ${(quota/1024/1024/1024).toFixed(1)} Go (${pct}%)</div>`;
    }).catch(()=>{});
  }
}

function exportAllData(){
  loadAllData();
  // Sauvegarde COMPLÈTE : inclut documents (avec aperçus) et planning.
  // C'est le vrai filet de sécurité — le fichier peut être volumineux si beaucoup de documents.
  const documents=DocStorage.getAll();
  const data={adhesifs,realisations,kpiData,maquettes,socialData,movements,zones,slots,documents,planning:planningStore,exportedAt:new Date().toISOString(),version:4};
  downloadJSON(data,'lamberet-hub-export-'+new Date().toISOString().slice(0,10)+'.json');
  const mb=(JSON.stringify(data).length/1024/1024).toFixed(1);
  showToast(`Export complet téléchargé (${mb} Mo — documents et planning inclus)`,'success');
}

function exportModule(key){
  const data=load(key);
  downloadJSON({[key]:data,exportedAt:new Date().toISOString()},`lamberet-${key}-${new Date().toISOString().slice(0,10)}.json`);
  showToast('Module exporté','success');
}

function downloadJSON(data,filename){
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=filename;a.click();
}

function importAllData(){
  document.getElementById('fileImportJSON').click();
}

function handleImportJSON(input){
  const file=input.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=function(e){
    try{
      const data=JSON.parse(e.target.result);
      if(data.adhesifs)save('adhesifs',data.adhesifs);
      if(data.realisations)save('realisations',data.realisations);
      if(data.kpiData)save('kpi',data.kpiData);
      if(data.maquettes)save('maquettes',data.maquettes);
      if(data.socialData)save('social',data.socialData);
      if(data.movements)save('movements',data.movements);
      if(data.zones)save('zones',data.zones);
      if(data.slots)save('slots',data.slots);
      // v4+ : restauration des documents et du planning (absents des exports v3)
      if(Array.isArray(data.documents)&&data.documents.length){
        const existing=DocStorage.getAll();
        const known=new Set(existing.map(d=>d.id));
        const merged=existing.concat(data.documents.filter(d=>!known.has(d.id)));
        DocStorage.saveAll(merged);
        updateDocBadge();
      }
      if(data.planning){ planningStore=data.planning; savePlanning(); }
      loadAllData();renderDonnees();renderDashboard();
      showToast(`Données importées avec succès (sauvegarde v${data.version||3})`,'success');
    }catch(err){showToast('Fichier JSON invalide','error');}
  };
  reader.readAsText(file);
  input.value='';
}

let csvTargetModule='adhesifs';
function importCSV(module){
  csvTargetModule=module;
  document.getElementById('fileImportCSV').click();
}

// ============================================================
// IMPORT CSV ROBUSTE
// - PapaParse : gère les virgules/points-virgules, guillemets, retours ligne dans les champs
// - Alias FR→schéma interne ("Quantité"→qty, "Fournisseur"→supplier…)
// - Validation : colonnes minimales requises par module
// - Déduplication : contre l'existant ET au sein du fichier
// - Encodage : re-lecture en Windows-1252 si l'UTF-8 produit des caractères invalides (export Excel FR)
// ============================================================
const CSV_SCHEMAS={
  adhesifs:{
    required:['name'],
    aliases:{nom:'name',adhesif:'name',reference:'ref',fournisseur:'supplier',couleur:'color',emplacement:'loc',quantite:'qty',rouleaux:'qty',longueur:'length',seuil:'min',seuil_alerte:'min',zone:'zone',etagere:'rack',commentaire:'comment'},
    dedupKey:r=>((r.ref||'')+'|'+(r.name||'')).toLowerCase()
  },
  realisations:{
    required:['client'],
    aliases:{secteur:'sector',annee:'year',statut:'status',vehicules:'qty',type_vehicule:'type',description:'desc'},
    dedupKey:r=>((r.client||'')+'|'+(r.year||'')+'|'+(r.type||'')).toLowerCase()
  },
  kpi:{
    required:['client'],
    aliases:{projet:'project',delai:'delay',vehicules:'vehicles',commentaire:'comment',avis:'comment'},
    dedupKey:r=>((r.client||'')+'|'+(r.date||'')).toLowerCase()
  },
  social:{
    required:['network','theme'],
    aliases:{reseau:'network',theme:'theme',sujet:'theme',statut:'status',portee:'reach'},
    dedupKey:r=>((r.network||'')+'|'+(r.date||'')+'|'+(r.theme||'')).toLowerCase()
  },
  maquettes:{
    required:['name'],
    aliases:{nom:'name',statut:'status',type_vehicule:'type'},
    dedupKey:r=>(r.name||'').toLowerCase()
  }
};

function normalizeCsvHeader(h){
  return String(h||'').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'') // retire les accents
    .replace(/[\s\-\.]+/g,'_').replace(/[^a-z0-9_]/g,'');
}

function handleImportCSV(input){
  const file=input.files[0];if(!file)return;
  input.value='';
  if(typeof Papa==='undefined'){showToast('Bibliothèque CSV non chargée — vérifiez la connexion internet','error');return;}
  readTextSmart(file,text=>parseCsvText(text));
}

// Lit en UTF-8, re-lit en Windows-1252 si des caractères invalides apparaissent (exports Excel FR)
function readTextSmart(file,cb){
  const r1=new FileReader();
  r1.onload=e=>{
    const text=e.target.result;
    if(text.includes('\uFFFD')){
      const r2=new FileReader();
      r2.onload=e2=>cb(e2.target.result);
      r2.onerror=()=>cb(text);
      r2.readAsText(file,'windows-1252');
    }else cb(text);
  };
  r1.onerror=()=>showToast('Impossible de lire le fichier','error');
  r1.readAsText(file,'utf-8');
}

function parseCsvText(text){
  const schema=CSV_SCHEMAS[csvTargetModule];
  if(!schema){showToast('Module inconnu pour l\'import CSV','error');return;}
  const res=Papa.parse(text,{
    header:true,
    skipEmptyLines:'greedy',
    transformHeader:h=>{
      const n=normalizeCsvHeader(h);
      return schema.aliases[n]||n;
    },
    transform:v=>typeof v==='string'?v.trim():v
  });
  if(res.errors&&res.errors.length){
    const fatal=res.errors.filter(e=>e.type!=='FieldMismatch');
    if(fatal.length){showToast(`Erreur CSV ligne ${(fatal[0].row??0)+2} : ${fatal[0].message}`,'error');return;}
  }
  const rows=res.data.filter(r=>Object.values(r).some(v=>v!==''&&v!=null));
  if(!rows.length){showToast('CSV vide ou invalide','error');return;}
  // Validation des colonnes requises
  const headers=Object.keys(rows[0]);
  const missing=schema.required.filter(c=>!headers.includes(c));
  if(missing.length){
    showToast(`Colonnes manquantes pour "${csvTargetModule}" : ${missing.join(', ')} — colonnes détectées : ${headers.slice(0,6).join(', ')}`,'error');
    return;
  }
  // Déduplication : contre l'existant et au sein du fichier
  loadAllData();
  const existing=load(csvTargetModule);
  const seen=new Set(existing.map(schema.dedupKey));
  let added=0,dupes=0,invalid=0;
  const toAdd=[];
  rows.forEach(r=>{
    if(schema.required.some(c=>!r[c])){invalid++;return;}
    const key=schema.dedupKey(r);
    if(seen.has(key)){dupes++;return;}
    seen.add(key);
    toAdd.push(Object.assign({id:uid()},r));
    added++;
  });
  if(!added){showToast(`Aucune nouvelle ligne — ${dupes} doublon(s), ${invalid} ligne(s) incomplète(s)`,'warn');return;}
  save(csvTargetModule,existing.concat(toAdd));
  loadAllData();
  renderDonnees();renderDashboard();
  const parts=[`${added} ligne(s) importée(s)`];
  if(dupes)parts.push(`${dupes} doublon(s) ignoré(s)`);
  if(invalid)parts.push(`${invalid} incomplète(s) ignorée(s)`);
  showToast(`${parts.join(' · ')} — ${csvTargetModule}`,'success');
}

function confirmReset(){
  showConfirm('⚠️ Réinitialiser toutes les données ?','Cette action supprime toutes les données locales (y compris documents et planning) de façon irréversible.',()=>{
    Object.values(KEYS).forEach(k=>localStorage.removeItem(k));
    docsCache=[];planningStore=null;
    IDB.clearDocs().catch(()=>{});
    IDB.kvDelete('planning').catch(()=>{});
    loadAllData();
    renderDashboard();renderDonnees();
    updateDocBadge();
    showToast('Données réinitialisées','success');
  });
}

