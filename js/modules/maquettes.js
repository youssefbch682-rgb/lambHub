// ============================================================
// MODULE 5 — MAQUETTES
// ============================================================
let maqFilter='Tous';
function filterMaq(s,el){
  maqFilter=s;
  document.querySelectorAll('#page-maquettes .chip').forEach(c=>c.classList.remove('is-on'));
  el.classList.add('is-on');
  renderMaquettes();
}

const vehicleSVGPaths={
  'Semi-remorque':'<rect x="4" y="16" width="80" height="28" rx="3"/><rect x="84" y="10" width="30" height="34" rx="2"/><circle cx="28" cy="50" r="6"/><circle cx="58" cy="50" r="6"/><circle cx="98" cy="50" r="6"/>',
  'Porteur':'<rect x="10" y="14" width="50" height="28" rx="3"/><rect x="60" y="8" width="48" height="34" rx="2"/><circle cx="30" cy="48" r="6"/><circle cx="92" cy="48" r="6"/>',
  'VUL':'<rect x="8" y="20" width="60" height="24" rx="6"/><rect x="68" y="14" width="44" height="30" rx="3"/><circle cx="30" cy="50" r="6"/><circle cx="92" cy="50" r="6"/>',
  'Fourgon frigorifique':'<rect x="8" y="16" width="104" height="30" rx="4"/><circle cx="30" cy="50" r="6"/><circle cx="92" cy="50" r="6"/><line x1="8" y1="28" x2="112" y2="28"/>',
  'Citerne':'<ellipse cx="60" cy="30" rx="52" ry="18"/><rect x="84" y="10" width="30" height="28" rx="2"/><circle cx="28" cy="50" r="6"/><circle cx="92" cy="50" r="6"/>'
};

function renderMaquettes(){
  loadAllData();
  const filt=maqFilter==='Tous'?maquettes:maquettes.filter(m=>m.type===maqFilter);
  const now=new Date();
  const obsoletes=maquettes.filter(m=>{const d=new Date(m.date);return (now-d)/(1000*60*60*24*365)>1;}).length;
  const lastDate=maquettes.reduce((latest,m)=>!latest||new Date(m.date)>new Date(latest)?m.date:latest,null);
  document.getElementById('maqKpiGrid').innerHTML=`
    <div class="kpi-card c-success"><div class="kpi-header"><span class="kpi-label">Fonds disponibles</span></div><div class="kpi-val">${maquettes.length}</div></div>
    <div class="kpi-card c-warn"><div class="kpi-header"><span class="kpi-label">Obsolètes (>1 an)</span></div><div class="kpi-val" style="color:var(--warn)">${obsoletes}</div></div>
    <div class="kpi-card"><div class="kpi-header"><span class="kpi-label">Dernière MAJ</span></div><div class="kpi-val" style="font-size:16px">${lastDate||'—'}</div></div>
    <div class="kpi-card"><div class="kpi-header"><span class="kpi-label">Types</span></div><div class="kpi-val">${[...new Set(maquettes.map(m=>m.type))].length}</div></div>
  `;
  const grid=document.getElementById('maquetteGrid');
  if(!filt.length){grid.innerHTML=`<div style="grid-column:1/-1"><div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="5" width="18" height="14" rx="2"/></svg><div class="title">Aucun fond de maquette</div><div class="desc">Ajoutez votre premier fond de maquette.</div><button class="btn btn-primary" onclick="openMaquetteModal()">+ Ajouter</button></div></div>`;return;}
  grid.innerHTML=filt.map(_m=>{
    const m=escObj(_m);
    const path=vehicleSVGPaths[_m.type]||vehicleSVGPaths['Semi-remorque'];
    const isOld=m.date&&(now-new Date(m.date))/(1000*60*60*24*365)>1;
    return `<div class="maq-card">
      <div class="maq-thumb" style="background:${m.color||'#E8EEF6'}">
        <svg viewBox="0 0 120 60" fill="none" stroke="rgba(0,0,0,.25)" stroke-width="2" style="width:80%">${path}</svg>
      </div>
      <div class="maq-body">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
          <div style="font-size:13px;font-weight:700">${m.name}</div>
          ${isOld?'<span class="tag tag-warn">Obsolète</span>':''}
        </div>
        <div style="font-size:11.5px;color:var(--ink-3);margin-bottom:10px">${m.type} · ${m.version||'v1.0'} · ${m.format||'—'}</div>
        <div style="font-size:11px;color:var(--ink-3);margin-bottom:10px">Mise à jour : ${m.date||'—'} · ${m.status||'Actif'}</div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-ghost btn-sm" onclick="showToast('Téléchargement : aucun fichier joint','warn')">Télécharger</button>
          <button class="btn btn-ghost btn-sm" onclick='openMaquetteModal(maquettes.find(x=>x.id==="${m.id}"))'>✏️</button>
          <button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="deleteItem('maquettes','${m.id}')">🗑️</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function openMaquetteModal(m){
  document.getElementById('maqModalTitle').textContent=m?'Modifier le fond':'Ajouter un fond de maquette';
  document.getElementById('maqId').value=m?m.id:'';
  ['name','type','version','status','format','color','date','comment'].forEach(f=>{
    const el=document.getElementById(`maq_${f}`);
    if(el)el.value=m?m[f]||'':'';
  });
  if(!m){document.getElementById('maq_color').value='#E8EEF6';document.getElementById('maq_date').value=new Date().toISOString().slice(0,10);}
  openModal('maquette');
}

function saveMaquette(){
  const name=document.getElementById('maq_name').value.trim();
  if(!name){showToast('Nom obligatoire','error');return;}
  const id=document.getElementById('maqId').value||uid();
  const obj={id,name,type:document.getElementById('maq_type').value,version:document.getElementById('maq_version').value,
    status:document.getElementById('maq_status').value,format:document.getElementById('maq_format').value,
    color:document.getElementById('maq_color').value,date:document.getElementById('maq_date').value,
    comment:document.getElementById('maq_comment').value};
  loadAllData();
  const idx=maquettes.findIndex(m=>m.id===id);
  if(idx>=0)maquettes[idx]=obj;else maquettes.push(obj);
  save('maquettes',maquettes);
  closeModal('maquette');
  renderMaquettes();renderDashboard();
  showToast('Fond de maquette enregistré','success');
}

