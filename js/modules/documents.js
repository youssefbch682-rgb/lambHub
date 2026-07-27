// ============================================================
// ===== MODULE DOCUMENTS — GESTION DOCUMENTAIRE COMPLÈTE =====
// Storage abstraction layer (ready for future Supabase/S3/Azure/GCS/NAS migration)
// ============================================================
// Backend : IndexedDB, avec cache mémoire synchrone pour ne pas changer l'API
// utilisée par le reste de l'app (getAll() reste synchrone).
// Future: swap avec Supabase/S3/Azure/GCS/NAS sans toucher au reste :
// Supabase: supabase.storage.from('docs').upload(path, file)
// S3:       s3.putObject({ Bucket, Key: path, Body: file })
// Azure:    containerClient.uploadBlockBlob(path, file, size)
// NAS/Win:  fetch('/api/upload', { method:'POST', body: formData })
let docsCache=[];
const DocStorage = {
  // À appeler une fois au démarrage (voir INIT). Charge IndexedDB en mémoire
  // et migre automatiquement les documents historiques stockés en localStorage.
  async init(){
    try{ docsCache=await IDB.getAllDocs(); }
    catch(e){ storageError(e,'documents:init'); docsCache=[]; return; }
    // Migration one-shot depuis l'ancien stockage localStorage
    try{
      const raw=localStorage.getItem(KEYS.documents);
      if(raw){
        const legacy=JSON.parse(raw)||[];
        const known=new Set(docsCache.map(d=>d.id));
        const toMigrate=legacy.filter(d=>!known.has(d.id));
        if(toMigrate.length){
          await IDB.putDocs(toMigrate);
          docsCache=docsCache.concat(toMigrate);
        }
        localStorage.removeItem(KEYS.documents); // libère le quota localStorage
        if(toMigrate.length)showToast(`📦 ${toMigrate.length} document(s) migré(s) vers le nouveau stockage`,'success');
      }
    }catch(e){ console.warn('[DocStorage] migration localStorage ignorée',e); }
  },
  getAll(){ return docsCache; },
  saveAll(docs){
    docsCache=docs;
    IDB.clearDocs().then(()=>docs.length?IDB.putDocs(docs):null).then(()=>broadcastSync('docs')).catch(e=>storageError(e,'documents:saveAll'));
  },
  get(id){ return docsCache.find(d=>d.id===id)||null; },
  upsert(doc){
    const i=docsCache.findIndex(d=>d.id===doc.id);
    if(i>=0)docsCache[i]=doc; else docsCache.push(doc);
    IDB.putDoc(doc).then(()=>broadcastSync('docs')).catch(e=>storageError(e,'documents:upsert'));
    return doc;
  },
  delete(id){
    docsCache=docsCache.filter(d=>d.id!==id);
    IDB.deleteDoc(id).then(()=>broadcastSync('docs')).catch(e=>storageError(e,'documents:delete'));
  },
  deleteMany(ids){
    const set=new Set(ids);
    docsCache=docsCache.filter(d=>!set.has(d.id));
    Promise.all(ids.map(id=>IDB.deleteDoc(id))).then(()=>broadcastSync('docs')).catch(e=>storageError(e,'documents:deleteMany'));
  }
};

// File type helpers
const DOC_EXT_GROUPS={
  pdf:['pdf'],
  image:['png','jpg','jpeg','webp','tiff','tif','gif','bmp','svg'],
  design:['ai','eps','psd','xcf','sketch','fig'],
  office_doc:['doc','docx','odt','rtf','txt'],
  office_xls:['xls','xlsx','ods','csv'],
  office_ppt:['ppt','pptx','odp'],
  video:['mp4','mov','avi','mkv','wmv','webm'],
  archive:['zip','rar','7z','tar','gz']
};

function getDocGroup(ext){
  ext=(ext||'').toLowerCase();
  for(const[g,exts] of Object.entries(DOC_EXT_GROUPS)){if(exts.includes(ext))return g;}
  return 'other';
}

function getExtClass(ext){
  const g=getDocGroup(ext);
  const map={pdf:'ext-pdf',image:'ext-img',design:'ext-ai',office_doc:'ext-doc',office_xls:'ext-xls',office_ppt:'ext-ppt',video:'ext-vid',archive:'ext-zip'};
  return map[g]||'ext-default';
}

function getExtIcon(ext,size=20){
  const g=getDocGroup(ext);
  const icons={
    pdf:`<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/><polyline points="9 9 10 9 11 9"/></svg>`,
    image:`<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
    design:`<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>`,
    office_doc:`<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
    office_xls:`<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="17"/><line x1="16" y1="13" x2="8" y2="17"/></svg>`,
    office_ppt:`<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><rect x="8" y="12" width="8" height="6" rx="1"/></svg>`,
    video:`<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>`,
    archive:`<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>`,
    other:`<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`
  };
  return icons[g]||icons.other;
}

function fmtSize(bytes){
  bytes=+bytes||0;
  if(bytes>=1073741824)return(bytes/1073741824).toFixed(1)+' Go';
  if(bytes>=1048576)return(bytes/1048576).toFixed(1)+' Mo';
  if(bytes>=1024)return(bytes/1024).toFixed(1)+' Ko';
  return bytes+' o';
}

// Auto-detect metadata from filename
const CLIENT_HINTS=['DONATRANS','STEF','MERIEUX','PERRENOT','JACKY','SEB','BERTO','NORBERT','KUEHNE','NAGEL','GEODIS','DACHSER','DHL','SYSCO','METRO'];
// Exact-token vehicle codes (PO/SR/VUL must match a whole token, not a substring, to avoid false positives)
const VEHICLE_HINTS={PO:'Porteur',PORTEUR:'Porteur',SR:'Semi-remorque',SEMI:'Semi-remorque',SEMIREM:'Semi-remorque',MEGALI:'Semi-remorque',VUL:'Véhicule utilitaire léger',FOURGON:'Véhicule utilitaire léger',CITERNE:'Citerne'};
const OPTION_HINTS={FRIGO:'Frigorifique',HAYON:'Hayon',EASY:'Easy',FAST:'Fast'};
const COLOR_HINTS=['BLANC','BLEU','ROUGE','VERT','NOIR','ORANGE','JAUNE','GRIS','VIOLET','ROSE'];
const CAT_HINTS={MAQUETTE:'Maquette',BRIEF:'Brief',CHARTE:'Charte graphique',DEVIS:'Devis',CONTRAT:'Contrat',PHOTO:'Photo',VIDEO:'Vidéo',REALISATION:'Réalisation',REAL:'Réalisation'};

function autoDetectMeta(filename, folderName=''){
  const base=filename.replace(/\.[^.]+$/,'').toUpperCase();
  const parts=base.split(/[_\-\s\.]+/).filter(Boolean);
  const folderParts=folderName.toUpperCase().split(/[_\-\s\.\/]+/).filter(Boolean);
  const allParts=[...parts,...folderParts]; // exact tokens, used for exact-match codes (PO/SR/VUL/FRIGO/...)
  const joined=base+' '+folderName.toUpperCase(); // used for substring matches (client names, colors, categories)

  const yearPart=allParts.find(p=>/^20\d{2}$/.test(p))||'';
  const clientPart=CLIENT_HINTS.find(c=>joined.includes(c))||'';
  const vehicleEntry=Object.entries(VEHICLE_HINTS).find(([k])=>allParts.includes(k));
  const optionEntries=Object.entries(OPTION_HINTS).filter(([k])=>allParts.includes(k));
  const colorPart=COLOR_HINTS.filter(c=>joined.includes(c));
  const catEntry=Object.entries(CAT_HINTS).find(([k])=>joined.includes(k));
  const ext=filename.split('.').pop().toLowerCase();
  const group=getDocGroup(ext);

  let category=catEntry?catEntry[1]:'';
  if(!category){
    if(group==='image'||group==='design')category='Réalisation';
    else if(group==='video')category='Vidéo';
    else if(group==='office_doc')category='Brief';
    else category='Autre';
  }

  const tags=[];
  if(clientPart)tags.push(clientPart.charAt(0)+clientPart.slice(1).toLowerCase());
  if(vehicleEntry)tags.push(vehicleEntry[1]);
  optionEntries.forEach(([,label])=>tags.push(label));
  colorPart.forEach(c=>tags.push(c.charAt(0)+c.slice(1).toLowerCase()));
  if(yearPart)tags.push(yearPart);

  return {
    client:clientPart?clientPart.charAt(0)+clientPart.slice(1).toLowerCase():'',
    year:yearPart||new Date().getFullYear().toString(),
    vehicle:vehicleEntry?vehicleEntry[1]:'',
    options:optionEntries.map(([,l])=>l),
    tags:[...new Set(tags)],
    category
  };
}

// Pending imports (for classify modal)
let pendingDocs=[];
let docViewMode='grid';
let docCatFilter='';
let docSelection=new Set();
let activePreviewId=null;

// ============================================================
// IMPORT PIPELINE
// ============================================================
function triggerDocImport(){
  document.getElementById('fileImportDocs').click();
}

const MAX_INLINE_FILE_SIZE=50*1024*1024; // 50 Mo — stockage IndexedDB (quota en Go). Au-delà, on garde la fiche mais pas l'aperçu.

function handleDocFiles(files){
  if(!files||!files.length)return;
  const arr=Array.from(files);
  pendingDocs=[];
  arr.forEach(f=>{
    const ext=f.name.split('.').pop().toLowerCase();
    const relPath=f.webkitRelativePath||f.__relPath||'';
    const folderPath=relPath?relPath.split('/').slice(0,-1).join('/'):'';
    const meta=autoDetectMeta(f.name,folderPath);
    const group=getDocGroup(ext);
    const isImg=group==='image';
    const isVid=group==='video';
    const isPDF=ext==='pdf';
    const tooBig=f.size>MAX_INLINE_FILE_SIZE;
    const doc={
      id:uid(),
      originalName:f.name,
      name:f.name.replace(/\.[^.]+$/,''),
      ext,group,size:f.size,
      folderPath,
      importedAt:new Date().toISOString(),
      author:'Camille M.',
      client:meta.client,year:meta.year,vehicle:meta.vehicle,
      tags:meta.tags,category:meta.category,
      desc:'',project:'',
      favorite:false,archived:false,
      tooBig,
      // Actual file data as dataURL for preview (stored locally)
      dataUrl:null
    };
    pendingDocs.push({doc,file:f,isImg,isVid,isPDF,tooBig});
  });
  // Read all files as dataURLs, then show classify modal
  let done=0;
  if(pendingDocs.length===0)return;
  pendingDocs.forEach((p,i)=>{
    if(p.tooBig){ pendingDocs[i].doc.dataUrl=null; done++; if(done===pendingDocs.length)showClassifyModal(); return; }
    const reader=new FileReader();
    reader.onload=e=>{
      pendingDocs[i].doc.dataUrl=e.target.result;
      done++;
      if(done===pendingDocs.length){
        showClassifyModal();
      }
    };
    reader.onerror=()=>{done++;if(done===pendingDocs.length)showClassifyModal();};
    // Only read full dataUrl for previewable types (to save localStorage space)
    if(p.isImg||p.isVid||p.isPDF) reader.readAsDataURL(p.file);
    else{ pendingDocs[i].doc.dataUrl=null; done++; if(done===pendingDocs.length)showClassifyModal(); }
  });
  // Reset inputs so the same files/folders can be re-imported
  document.getElementById('fileImportDocs').value='';
  if(document.getElementById('fileImportDocsFolder'))document.getElementById('fileImportDocsFolder').value='';
}

function showClassifyModal(){
  const list=document.getElementById('classifyList');
  list.innerHTML=pendingDocs.map((p,i)=>{
    const d={...p.doc,ext:esc(p.doc.ext),originalName:esc(p.doc.originalName),folderPath:esc(p.doc.folderPath),client:esc(p.doc.client),year:esc(p.doc.year)};
    const extClass=getExtClass(p.doc.ext);
    return `<div class="classify-item" id="classify-row-${i}">
      <span class="tag ${extClass}" style="font-size:10px;padding:2px 6px">${d.ext}</span>
      <div style="min-width:0">
        <div style="font-weight:600;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${d.originalName}</div>
        <div style="font-size:11px;color:var(--ink-3)">${fmtSize(d.size)}${d.folderPath?' · 📁 '+d.folderPath:''}${d.tooBig?' · ⚠️ aperçu désactivé (fichier volumineux)':''}</div>
      </div>
      <input class="classify-mini-input" id="clf-client-${i}" value="${d.client}" placeholder="Client">
      <select class="classify-mini-input" id="clf-cat-${i}">
        ${['Réalisation','Maquette','Charte graphique','Brief','Devis','Contrat','Photo','Vidéo','Autre'].map(c=>`<option${c===d.category?' selected':''}>${c}</option>`).join('')}
      </select>
      <input class="classify-mini-input" id="clf-year-${i}" value="${d.year}" placeholder="Année" type="number">
    </div>`;
  }).join('');
  openModal('classify');
}

function confirmClassify(){
  const docs=DocStorage.getAll();
  pendingDocs.forEach((p,i)=>{
    p.doc.client=document.getElementById(`clf-client-${i}`)?.value||p.doc.client;
    p.doc.category=document.getElementById(`clf-cat-${i}`)?.value||p.doc.category;
    p.doc.year=document.getElementById(`clf-year-${i}`)?.value||p.doc.year;
    docs.push(p.doc);
  });
  DocStorage.saveAll(docs);
  closeModal('classify');
  pendingDocs=[];
  renderDocuments();
  updateDocBadge();
  showToast(`${docs.length} fichier(s) importé(s)`, 'success');
}

// ============================================================
// RENDER DOCUMENTS
// ============================================================
let docFilterActive={search:'',ext:'',cat:'',catTree:''};

function filterDocs(){
  docFilterActive.search=(document.getElementById('docSearch')?.value||'').toLowerCase();
  docFilterActive.ext=(document.getElementById('docFilterExt')?.value||'').toLowerCase();
  docFilterActive.cat=document.getElementById('docFilterCat')?.value||'';
  populateDocClientFilter();
  renderDocGrid();
}

function setDocCatFilter(cat,el){
  docFilterActive.catTree=cat;
  document.querySelectorAll('.doc-tree-item').forEach(i=>i.classList.remove('active'));
  if(el)el.classList.add('active');
  renderDocGrid();
}

function setDocView(mode,btn){
  docViewMode=mode;
  document.querySelectorAll('#page-documents .seg button').forEach(b=>b.classList.remove('is-on'));
  btn.classList.add('is-on');
  document.getElementById('docGridView').style.display=mode==='grid'?'grid':'none';
  document.getElementById('docListView').style.display=mode==='list'?'block':'none';
  renderDocGrid();
}

function getFilteredDocs(){
  let docs=DocStorage.getAll();
  const {search,ext,cat,catTree}=docFilterActive;

  if(catTree==='favorites') return docs.filter(d=>d.favorite&&!d.archived);
  if(catTree==='archived') return docs.filter(d=>d.archived);

  docs=docs.filter(d=>!d.archived);

  if(catTree&&catTree!=='') docs=docs.filter(d=>d.category===catTree);
  if(cat) docs=docs.filter(d=>d.category===cat||d.category.includes(cat));
  if(ext) docs=docs.filter(d=>d.ext===ext);
  const clientFilter=document.getElementById('docFilterClient')?.value||'';
  if(clientFilter) docs=docs.filter(d=>d.client===clientFilter);
  if(search) docs=docs.filter(d=>(d.name+d.originalName+(d.client||'')+(d.project||'')+(d.tags||[]).join(' ')+(d.desc||'')+d.ext+d.year).toLowerCase().includes(search));
  return docs;
}

function renderDocuments(){
  updateDocTreeCounts();
  populateDocClientFilter();
  renderDocKPI();
  renderDocGrid();
  renderDocFormatStats();
  updateDocBadge();
  setupDocDropzone();
}

function renderDocKPI(){
  const all=DocStorage.getAll().filter(d=>!d.archived);
  const totalSize=all.reduce((s,d)=>s+(+d.size||0),0);
  const favorites=all.filter(d=>d.favorite).length;
  const archived=DocStorage.getAll().filter(d=>d.archived).length;
  const types=new Set(all.map(d=>d.ext)).size;
  const kpiEl=document.getElementById('docKpiRow');
  if(!kpiEl)return;
  kpiEl.innerHTML=[
    {val:all.length,lbl:'Documents',cls:''},
    {val:fmtSize(totalSize),lbl:'Taille totale',cls:''},
    {val:types,lbl:'Formats',cls:''},
    {val:favorites,lbl:'Favoris',cls:'c-accent'},
    {val:archived,lbl:'Archivés',cls:'c-warn'}
  ].map(k=>`<div class="doc-kpi ${k.cls}"><div class="val">${k.val}</div><div class="lbl">${k.lbl}</div></div>`).join('');
}

function renderDocFormatStats(){
  const docs=DocStorage.getAll().filter(d=>!d.archived);
  const counts={};
  docs.forEach(d=>{counts[d.ext]=(counts[d.ext]||0)+1;});
  const el=document.getElementById('docFormatStats');
  if(!el)return;
  const sorted=Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const total=docs.length||1;
  el.innerHTML=sorted.map(([ext,c])=>`
    <div style="display:flex;align-items:center;gap:7px">
      <span class="tag ${getExtClass(ext)}" style="font-size:10px;padding:1px 5px;min-width:36px;justify-content:center">${ext}</span>
      <div class="progress" style="flex:1"><div class="progress-fill" style="width:${c/total*100}%;background:var(--brand)"></div></div>
      <span style="font-family:var(--font-m);font-size:10.5px;color:var(--ink-3)">${c}</span>
    </div>
  `).join('');
  if(!sorted.length)el.innerHTML='<div style="color:var(--ink-3);font-size:12px">Aucun fichier</div>';
}

function updateDocTreeCounts(){
  const docs=DocStorage.getAll();
  const active=docs.filter(d=>!d.archived);
  const set=id=>{ const el=document.getElementById(id); if(el)el.textContent=0; };
  const setV=(id,v)=>{ const el=document.getElementById(id); if(el)el.textContent=v; };
  setV('dt-count-all',active.length);
  setV('dt-count-real',active.filter(d=>d.category==='Réalisation').length);
  setV('dt-count-maq',active.filter(d=>d.category==='Maquette').length);
  setV('dt-count-charte',active.filter(d=>d.category==='Charte graphique').length);
  setV('dt-count-brief',active.filter(d=>d.category==='Brief'||d.category==='Devis').length);
  setV('dt-count-photo',active.filter(d=>d.category==='Photo').length);
  setV('dt-count-video',active.filter(d=>d.category==='Vidéo').length);
  setV('dt-count-archive',docs.filter(d=>d.archived).length);
  setV('dt-count-fav',active.filter(d=>d.favorite).length);
}

function updateDocBadge(){
  const el=document.getElementById('docBadge');
  if(el)el.textContent=DocStorage.getAll().filter(d=>!d.archived).length;
}

function populateDocClientFilter(){
  const docs=DocStorage.getAll();
  const clients=[...new Set(docs.map(d=>d.client).filter(Boolean))].sort();
  const sel=document.getElementById('docFilterClient');
  if(!sel)return;
  const current=sel.value;
  sel.innerHTML=`<option value="">Tous les clients</option>`+clients.map(c=>`<option value="${esc(c)}"${c===current?' selected':''}>${esc(c)}</option>`).join('');
  // Also populate preview datalist
  const dl=document.getElementById('dp_client_list');
  if(dl)dl.innerHTML=clients.map(c=>`<option value="${esc(c)}">`).join('');
}

function renderDocGrid(){
  const docs=getFilteredDocs();
  const emptyEl=document.getElementById('docEmptyState');
  const gridEl=document.getElementById('docGridView');
  const listEl=document.getElementById('docListBody');

  if(!docs.length){
    if(emptyEl)emptyEl.style.display='block';
    if(gridEl)gridEl.innerHTML='';
    if(listEl)listEl.innerHTML='';
    return;
  }
  if(emptyEl)emptyEl.style.display='none';

  // GRID VIEW
  if(gridEl && docViewMode==='grid'){
    gridEl.innerHTML=docs.map(_d=>{
      const d={..._d,originalName:esc(_d.originalName),name:esc(_d.name),client:esc(_d.client),project:esc(_d.project),category:esc(_d.category),ext:esc(_d.ext),tags:(_d.tags||[]).map(esc)};
      const extCls=getExtClass(_d.ext);
      const isImg=d.group==='image';
      const isVid=d.group==='video';
      const thumb=d.dataUrl&&isImg?`<img src="${d.dataUrl}" loading="lazy">`
        :d.dataUrl&&isVid?`<video src="${d.dataUrl}" muted></video>`
        :`<div class="doc-ext-badge ${extCls}">${d.ext.toUpperCase()}</div>`;
      const sel=docSelection.has(d.id);
      return `<div class="doc-card${sel?' selected':''}" onclick="toggleDocSelect(event,'${d.id}',this)" ondblclick="openDocPreview('${d.id}')">
        <div class="doc-card-check">✓</div>
        <div class="doc-card-fav" onclick="event.stopPropagation();toggleDocFavById('${d.id}')">${d.favorite?'⭐':'☆'}</div>
        <div class="doc-thumb">
          ${d.archived?'<div class="doc-archived-overlay">ARCHIVÉ</div>':''}
          ${thumb}
        </div>
        <div class="doc-body">
          <div class="doc-name" title="${d.originalName}">${d.name||d.originalName}</div>
          <div class="doc-meta">${fmtSize(d.size)} · ${d.year||'—'}</div>
          ${d.client?`<div class="doc-meta" style="font-weight:600;color:var(--brand);margin-top:2px">${d.client}</div>`:''}
          <div class="doc-tags">${(d.tags||[]).slice(0,3).map(t=>`<span class="tag tag-neutral" style="font-size:9.5px;padding:1px 5px">${t}</span>`).join('')}</div>
        </div>
        <div class="doc-actions">
          <button class="doc-action-btn" onclick="event.stopPropagation();openDocPreview('${d.id}')">👁 Voir</button>
          <button class="doc-action-btn" onclick="event.stopPropagation();downloadDocById('${d.id}')">⬇</button>
          <button class="doc-action-btn" onclick="event.stopPropagation();deleteDocById('${d.id}')">🗑</button>
        </div>
      </div>`;
    }).join('');
  }

  // LIST VIEW
  if(listEl && docViewMode==='list'){
    listEl.innerHTML=docs.map(_d=>{
      const d={..._d,originalName:esc(_d.originalName),name:esc(_d.name),client:esc(_d.client),project:esc(_d.project),category:esc(_d.category),ext:esc(_d.ext)};
      const sel=docSelection.has(_d.id);
      return `<div class="doc-list-row${sel?' selected':''}" onclick="toggleDocSelect(event,'${d.id}',this)" ondblclick="openDocPreview('${d.id}')">
        <div style="display:flex;align-items:center"><input type="checkbox" ${sel?'checked':''} onclick="event.stopPropagation();toggleDocSelect(event,'${d.id}',this.closest('.doc-list-row'))"></div>
        <div style="display:flex;align-items:center;justify-content:center"><span class="tag ${getExtClass(d.ext)}" style="font-size:9.5px;padding:1px 5px">${d.ext}</span></div>
        <div style="min-width:0">
          <div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12.5px">${d.name||d.originalName}</div>
          ${d.project?`<div style="font-size:11px;color:var(--ink-3)">${d.project}</div>`:''}
        </div>
        <div><span class="tag tag-neutral" style="font-size:10px">${d.category||'—'}</span></div>
        <div style="font-size:12px;font-weight:600;color:var(--brand)">${d.client||'—'}</div>
        <div class="mono" style="font-size:11px">${d.ext.toUpperCase()}</div>
        <div class="mono" style="font-size:11px">${fmtSize(d.size)}</div>
        <div style="display:flex;align-items:center;gap:6px">
          <span style="font-size:11px;color:var(--ink-3)">${d.importedAt?new Date(d.importedAt).toLocaleDateString('fr-FR'):''}</span>
          <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();openDocPreview('${d.id}')">👁</button>
          <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();downloadDocById('${d.id}')">⬇</button>
          <button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="event.stopPropagation();deleteDocById('${d.id}')">🗑</button>
        </div>
      </div>`;
    }).join('');
  }
}

// ============================================================
// SELECTION
// ============================================================
function toggleDocSelect(event,id,el){
  // Cmd/Ctrl+click or Shift+click = multi-select, regular click = open preview
  if(event.ctrlKey||event.metaKey||event.shiftKey){
    event.preventDefault();
    if(docSelection.has(id)) docSelection.delete(id);
    else docSelection.add(id);
    updateBatchBar();
    el.classList.toggle('selected',docSelection.has(id));
    const chk=el.querySelector('input[type=checkbox]');
    if(chk)chk.checked=docSelection.has(id);
  }
  // single click on card just opens preview (dblclick handles that via ondblclick)
  // but in list mode, single checkbox click is handled above
}

function clearDocSelection(){
  docSelection.clear();
  updateBatchBar();
  renderDocGrid();
}

function updateBatchBar(){
  const bar=document.getElementById('batchBar');
  const cnt=document.getElementById('batchCount');
  if(!bar)return;
  if(docSelection.size>0){bar.classList.add('visible');cnt.textContent=`${docSelection.size} sélectionné(s)`;}
  else{bar.classList.remove('visible');}
}

function batchDownload(){
  const ids=[...docSelection];
  ids.forEach(id=>{const d=DocStorage.get(id);if(d&&d.dataUrl)downloadDocById(id);});
  showToast(`${ids.length} fichier(s) téléchargé(s)`,'success');
}

function batchArchive(){
  const ids=[...docSelection];
  const docs=DocStorage.getAll();
  docs.forEach(d=>{if(ids.includes(d.id))d.archived=true;});
  DocStorage.saveAll(docs);
  clearDocSelection();
  renderDocuments();
  showToast(`${ids.length} fichier(s) archivé(s)`,'success');
}

function batchDelete(){
  showConfirm(`Supprimer ${docSelection.size} fichier(s) ?`,'Cette action est irréversible.',()=>{
    DocStorage.deleteMany([...docSelection]);
    clearDocSelection();
    renderDocuments();
    showToast('Supprimés','success');
  });
}

async function batchExportZip(){
  if(typeof JSZip==='undefined'){showToast('Bibliothèque ZIP non chargée — vérifiez la connexion internet','error');return;}
  const ids=[...docSelection];
  if(!ids.length){showToast('Aucun fichier sélectionné','warn');return;}
  showToast('Préparation du fichier ZIP…','');
  const zip=new JSZip();
  const manifest=[];
  ids.forEach(id=>{
    const d=DocStorage.get(id);
    if(!d)return;
    const folder=(d.client||d.category||'Divers').replace(/[\\/:*?"<>|]/g,'_');
    if(d.dataUrl){
      const base64=d.dataUrl.split(',')[1];
      zip.folder(folder).file(d.originalName||(d.name+'.'+d.ext), base64, {base64:true});
    } else {
      // Fichier volumineux ou non prévisualisable : on inclut une fiche descriptive à la place du binaire
      zip.folder(folder).file((d.name||d.originalName)+'.txt',
        `Fichier : ${d.originalName}\nClient : ${d.client||'-'}\nCatégorie : ${d.category||'-'}\nTaille : ${fmtSize(d.size)}\nImporté le : ${d.importedAt}\n\n(Aperçu/données binaires non conservées dans cette version localStorage — réimportez le fichier source pour l'inclure réellement.)`);
    }
    manifest.push({name:d.originalName,client:d.client,category:d.category,ext:d.ext,size:d.size});
  });
  zip.file('manifest.json', JSON.stringify(manifest,null,2));
  try{
    const blob=await zip.generateAsync({type:'blob'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url; a.download='lamberet-export-'+new Date().toISOString().slice(0,10)+'.zip';
    a.click();
    URL.revokeObjectURL(url);
    showToast(`ZIP généré — ${ids.length} fichier(s)`,'success');
  }catch(err){
    showToast('Erreur lors de la génération du ZIP : '+err.message,'error');
  }
}

// ============================================================
// PREVIEW PANEL
// ============================================================
function openDocPreview(id){
  const d=DocStorage.get(id);
  if(!d)return;
  activePreviewId=id;

  // Viewer
  const viewer=document.getElementById('docPreviewViewer');
  const isImg=d.group==='image';
  const isVid=d.group==='video';
  const isPDF=d.ext==='pdf';
  const isSVG=d.ext==='svg';

  if(d.dataUrl&&(isImg||isSVG)){
    viewer.innerHTML=`<img src="${d.dataUrl}" style="max-width:100%;max-height:100%;object-fit:contain">`;
  } else if(d.dataUrl&&isPDF){
    viewer.innerHTML=`<iframe src="${d.dataUrl}" style="width:100%;height:100%;border:none"></iframe>`;
  } else if(d.dataUrl&&isVid){
    viewer.innerHTML=`<video src="${d.dataUrl}" controls style="max-width:100%;max-height:100%"></video>`;
  } else {
    const g=getDocGroup(d.ext);
    viewer.innerHTML=`<div class="no-preview">${getExtIcon(d.ext,64)}<div style="margin-top:16px;font-size:15px;font-weight:600">.${esc(d.ext.toUpperCase())}</div><div style="margin-top:8px;font-size:13px">Aperçu non disponible</div><div style="margin-top:4px;font-size:11px">Téléchargez pour ouvrir avec l'application native</div></div>`;
  }

  // Info fields
  document.getElementById('dpName').textContent=d.name||d.originalName;
  document.getElementById('dpMeta').textContent=`${d.ext.toUpperCase()} · ${fmtSize(d.size)} · Importé le ${d.importedAt?new Date(d.importedAt).toLocaleDateString('fr-FR'):'—'}`;
  document.getElementById('dp_name').value=d.name||'';
  document.getElementById('dp_client').value=d.client||'';
  document.getElementById('dp_project').value=d.project||'';
  document.getElementById('dp_category').value=d.category||'Autre';
  document.getElementById('dp_tags').value=(d.tags||[]).join(', ');
  document.getElementById('dp_desc').value=d.desc||'';
  document.getElementById('dp_author').value=d.author||'';
  document.getElementById('dp_vehicle').value=d.vehicle||'';
  document.getElementById('dp_year').value=d.year||'';

  document.getElementById('docPreviewOverlay').classList.add('open');
}

function closeDocPreview(){
  document.getElementById('docPreviewOverlay').classList.remove('open');
  activePreviewId=null;
}

function updateDocMeta(field,value){
  // Live update (saved on "Sauvegarder" click)
}

function saveDocMeta(){
  if(!activePreviewId)return;
  const d=DocStorage.get(activePreviewId);
  if(!d)return;
  d.name=document.getElementById('dp_name').value||d.name;
  d.client=document.getElementById('dp_client').value;
  d.project=document.getElementById('dp_project').value;
  d.category=document.getElementById('dp_category').value;
  d.tags=document.getElementById('dp_tags').value.split(',').map(t=>t.trim()).filter(Boolean);
  d.desc=document.getElementById('dp_desc').value;
  d.author=document.getElementById('dp_author').value;
  d.vehicle=document.getElementById('dp_vehicle').value;
  d.year=document.getElementById('dp_year').value;
  DocStorage.upsert(d);
  renderDocuments();
  showToast('Métadonnées enregistrées','success');
}

function downloadDoc(){
  if(activePreviewId)downloadDocById(activePreviewId);
}

function downloadDocById(id){
  const d=DocStorage.get(id);
  if(!d){showToast('Fichier introuvable','error');return;}
  if(!d.dataUrl){showToast('Données du fichier non disponibles — ré-importez le fichier','warn');return;}
  const a=document.createElement('a');
  a.href=d.dataUrl;
  a.download=d.originalName||d.name+'.'+d.ext;
  a.click();
  showToast(`Téléchargement : ${d.originalName}`,'success');
}

function toggleDocFav(){
  if(activePreviewId)toggleDocFavById(activePreviewId);
}

function toggleDocFavById(id){
  const d=DocStorage.get(id);
  if(!d)return;
  d.favorite=!d.favorite;
  DocStorage.upsert(d);
  renderDocuments();
  showToast(d.favorite?'Ajouté aux favoris ⭐':'Retiré des favoris','success');
}

function archiveDoc(){
  if(!activePreviewId)return;
  showConfirm('Archiver ce document ?','Le fichier sera déplacé dans les archives.',()=>{
    const d=DocStorage.get(activePreviewId);
    if(d){d.archived=true;DocStorage.upsert(d);}
    closeDocPreview();
    renderDocuments();
    showToast('Document archivé','success');
  });
}

function deleteDocById(id){
  showConfirm('Supprimer ce document ?','Cette action est irréversible.',()=>{
    DocStorage.delete(id);
    if(activePreviewId===id)closeDocPreview();
    renderDocuments();
    showToast('Document supprimé','success');
  });
}

// ============================================================
// DRAG & DROP SETUP
// ============================================================
// Recursively reads a dropped DataTransferItemList, resolving folders into flat File[]
// while stamping each File with a synthetic __relPath so the folder structure (client
// sub-folders, alphabetical sub-folders, etc.) is preserved exactly like a real import.
function readDroppedEntries(items){
  return new Promise(resolve=>{
    const out=[]; let pending=0; let scanDone=false;
    function maybeResolve(){ if(scanDone&&pending===0)resolve(out); }
    function walk(entry,path){
      if(!entry)return;
      if(entry.isFile){
        pending++;
        entry.file(file=>{
          try{ Object.defineProperty(file,'__relPath',{value:path+file.name,writable:false}); }catch(e){ file.__relPath=path+file.name; }
          out.push(file); pending--; maybeResolve();
        },()=>{ pending--; maybeResolve(); });
      } else if(entry.isDirectory){
        pending++;
        const reader=entry.createReader();
        const readBatch=()=>{
          reader.readEntries(entries=>{
            if(!entries.length){ pending--; maybeResolve(); return; }
            entries.forEach(e2=>walk(e2,path+entry.name+'/'));
            readBatch(); // directories can return entries in batches
          },()=>{ pending--; maybeResolve(); });
        };
        readBatch();
      }
    }
    const list=Array.from(items);
    if(!list.length){ resolve(out); return; }
    list.forEach(item=>{
      const entry=item.webkitGetAsEntry&&item.webkitGetAsEntry();
      if(entry)walk(entry,'');
      else{ const f=item.getAsFile&&item.getAsFile(); if(f)out.push(f); }
    });
    scanDone=true; maybeResolve();
  });
}

function setupDocDropzone(){
  const dz=document.getElementById('docDropzone');
  if(!dz||dz._dzSetup)return;
  dz._dzSetup=true;
  dz.addEventListener('dragover',e=>{e.preventDefault();dz.classList.add('drag-over');});
  dz.addEventListener('dragleave',()=>dz.classList.remove('drag-over'));
  dz.addEventListener('drop',async e=>{
    e.preventDefault();dz.classList.remove('drag-over');
    if(e.dataTransfer.items&&e.dataTransfer.items.length&&e.dataTransfer.items[0].webkitGetAsEntry){
      const files=await readDroppedEntries(e.dataTransfer.items);
      if(files.length)handleDocFiles(files);
    } else if(e.dataTransfer.files.length){
      handleDocFiles(e.dataTransfer.files);
    }
  });
  // Also set up the whole page drop zone
  const page=document.getElementById('page-documents');
  if(page&&!page._dzSetup){
    page._dzSetup=true;
    page.addEventListener('dragover',e=>{e.preventDefault();});
    page.addEventListener('drop',async e=>{
      e.preventDefault();
      if(e.dataTransfer.items&&e.dataTransfer.items.length&&e.dataTransfer.items[0].webkitGetAsEntry){
        const files=await readDroppedEntries(e.dataTransfer.items);
        if(files.length)handleDocFiles(files);
      } else if(e.dataTransfer.files.length){
        handleDocFiles(e.dataTransfer.files);
      }
    });
  }
}

// ============================================================
// DOCUMENT EXPORT
// ============================================================
function exportDocsJSON(){
  const docs=DocStorage.getAll();
  // Export metadata only (not dataUrl) for a clean JSON
  const meta=docs.map(({dataUrl,...rest})=>rest);
  downloadJSON({documents:meta,exportedAt:new Date().toISOString()},'lamberet-documents-'+new Date().toISOString().slice(0,10)+'.json');
  showToast('Métadonnées documents exportées','success');
}

