// ============================================================
// MODULE 2 — RÉALISATIONS
// ============================================================
let realSectorFilter='Tous';

function filterRealSector(s,el){
  realSectorFilter=s;
  document.querySelectorAll('#page-realisations .chip').forEach(c=>c.classList.remove('is-on'));
  el.classList.add('is-on');
  renderGallery();
}

function filterRealisations(){
  renderGallery();
}

const sectorColors={
  'Transport alimentaire':'tag-success','Logistique':'tag-brand','Pharma':'tag-purple',
  'Distribution':'tag-info','Autre':'tag-neutral'
};
const gradients=['linear-gradient(135deg,#0B3660,#1A5296)','linear-gradient(135deg,#E8501A,#F07030)','linear-gradient(135deg,#1F7A55,#27AE60)','linear-gradient(135deg,#6B46C1,#805AD5)','linear-gradient(135deg,#2B6CB0,#3182CE)','linear-gradient(135deg,#B5700F,#D97706)','linear-gradient(135deg,#C0392B,#E53E3E)','linear-gradient(135deg,#2D3748,#4A5568)'];

function renderGallery(){
  loadAllData();
  const q=(document.getElementById('realSearch')?.value||'').toLowerCase();
  let filtered=realisations.filter(r=>{
    if(realSectorFilter!=='Tous'&&!r.sector.includes(realSectorFilter))return false;
    if(q&&!(r.client+r.sector+r.type+(r.tags||[]).join('')).toLowerCase().includes(q))return false;
    return true;
  });
  const grid=document.getElementById('galleryGrid');
  const empty=document.getElementById('realEmptyState');
  if(!filtered.length){grid.innerHTML='';if(empty)empty.style.display='block';return;}
  if(empty)empty.style.display='none';
  grid.innerHTML=filtered.map((_r,i)=>{const r=escObj(_r);return `
    <div class="gcard" onclick="openRealDetail('${r.id}')">
      <div class="gcard-thumb" style="background:${r.img?'':''}">
        ${r.img?`<img src="${r.img}" style="width:100%;height:100%;object-fit:cover">`:`<div style="width:100%;height:100%;background:${gradients[i%gradients.length]};display:flex;align-items:center;justify-content:center;font-family:var(--font-d);font-size:28px;font-weight:700;color:rgba(255,255,255,.3)">${r.client.charAt(0)}</div>`}
        <div class="gcard-thumb-overlay"></div>
        <div class="gcard-tag"><span class="tag ${sectorColors[r.sector]||'tag-neutral'}">${r.sector}</span></div>
        <div style="position:absolute;bottom:8px;left:12px;right:12px;display:flex;gap:5px">
          <div style="width:16px;height:16px;border-radius:50%;background:${r.color1||'#fff'};border:2px solid rgba(255,255,255,.6)"></div>
          <div style="width:16px;height:16px;border-radius:50%;background:${r.color2||'#eee'};border:2px solid rgba(255,255,255,.6)"></div>
        </div>
      </div>
      <div class="gcard-body">
        <div class="gcard-title">${r.client}</div>
        <div class="gcard-meta">${r.type} · ${r.qty||1} véh. · ${r.year}</div>
        <div class="gcard-tags">${(r.tags||[]).map(t=>`<span class="tag tag-neutral" style="font-size:10.5px">${t}</span>`).join('')}</div>
      </div>
      <div class="gcard-actions">
        <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();openRealisationModal(realisations.find(x=>x.id==='${r.id}'))">✏️</button>
        <button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="event.stopPropagation();deleteItem('realisations','${r.id}')">🗑️</button>
      </div>
    </div>
  `;}).join('');
}

function openRealDetail(id){
  const _r=realisations.find(x=>x.id===id);
  if(!_r)return;
  const r=escObj(_r);
  document.getElementById('realDetailTitle').textContent=_r.client;
  document.getElementById('realDetailBody').innerHTML=`
    ${r.img?`<img src="${r.img}" style="width:100%;height:160px;object-fit:cover;border-radius:var(--r-m);margin-bottom:12px">`:''}
    <div class="dl">
      <div class="dl-row"><span class="dl-key">Client</span><span class="dl-val">${r.client}</span></div>
      <div class="dl-row"><span class="dl-key">Secteur</span><span class="dl-val">${r.sector}</span></div>
      <div class="dl-row"><span class="dl-key">Type véhicule</span><span class="dl-val">${r.type}</span></div>
      <div class="dl-row"><span class="dl-key">Véhicules</span><span class="dl-val">${r.qty||1}</span></div>
      <div class="dl-row"><span class="dl-key">Année</span><span class="dl-val">${r.year}</span></div>
      <div class="dl-row"><span class="dl-key">Statut</span><span class="dl-val"><span class="tag ${r.status==='Terminé'?'tag-success':r.status==='En cours'?'tag-info':'tag-neutral'}">${r.status}</span></span></div>
    </div>
    ${r.desc?`<div style="margin-top:12px;padding:10px;background:var(--surface-2);border-radius:var(--r-s);font-size:12.5px;line-height:1.5">${r.desc}</div>`:''}
    ${(r.tags||[]).length?`<div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap">${r.tags.map(t=>`<span class="tag tag-neutral">${t}</span>`).join('')}</div>`:''}
  `;
  document.getElementById('realDetailFoot').innerHTML=`
    <button class="btn btn-ghost" onclick="closeModal('realDetail')">Fermer</button>
    <button class="btn btn-primary" onclick="openRealisationModal(realisations.find(x=>x.id==='${r.id}'));closeModal('realDetail')">Modifier</button>
  `;
  openModal('realDetail');
}

function openRealisationModal(r){
  document.getElementById('realModalTitle').textContent=r?'Modifier la réalisation':'Ajouter une réalisation';
  document.getElementById('realId').value=r?r.id:'';
  ['client','year','sector','type','qty','status','color1','color2','desc','tags','img'].forEach(f=>{
    const el=document.getElementById(`real_${f}`);
    if(!el)return;
    if(f==='tags')el.value=r?(r.tags||[]).join(', '):'';
    else el.value=r?r[f]||'':'';
  });
  if(!r){
    document.getElementById('real_year').value=new Date().getFullYear();
    document.getElementById('real_color1').value='#0B3660';
    document.getElementById('real_color2').value='#E8501A';
    document.getElementById('real_status').value='Terminé';
  }
  openModal('realisation');
}

function saveRealisation(){
  const client=document.getElementById('real_client').value.trim();
  if(!client){showToast('Nom du client obligatoire','error');return;}
  const id=document.getElementById('realId').value||uid();
  const obj={id,client,
    year:document.getElementById('real_year').value||new Date().getFullYear(),
    sector:document.getElementById('real_sector').value,
    type:document.getElementById('real_type').value,
    qty:document.getElementById('real_qty').value||1,
    status:document.getElementById('real_status').value,
    color1:document.getElementById('real_color1').value,
    color2:document.getElementById('real_color2').value,
    desc:document.getElementById('real_desc').value,
    tags:document.getElementById('real_tags').value.split(',').map(t=>t.trim()).filter(Boolean),
    img:document.getElementById('real_img').value,
    createdAt:new Date().toLocaleDateString('fr-FR')
  };
  loadAllData();
  const idx=realisations.findIndex(r=>r.id===id);
  if(idx>=0)realisations[idx]=obj;else realisations.push(obj);
  save('realisations',realisations);
  closeModal('realisation');
  renderGallery();renderDashboard();
  document.getElementById('realBadge').textContent=realisations.length;
  showToast('Réalisation enregistrée','success');
}

// Import via drag-drop / file name parsing
function openDropzone(){
  const input=document.createElement('input');
  input.type='file';input.multiple=true;input.accept='image/*,.pdf';
  input.onchange=function(){
    const files=Array.from(this.files);
    let detected=[];
    files.forEach(f=>{
      const name=f.name.toUpperCase().replace(/\.(PDF|JPG|JPEG|PNG|AI|PSD)$/,'');
      const parts=name.split(/[_\-\s]+/);
      const yearMatch=parts.find(p=>/^20\d{2}$/.test(p));
      const knownClients=['DONATRANS','STEF','MERIEUX','JACKY','PERRENOT','SEB'];
      const clientGuess=parts.find(p=>knownClients.some(c=>p.includes(c)))||parts[0];
      const typeMap={PORTEUR:'Porteur',SEMI:'Semi-remorque',VUL:'VUL',FOURGON:'Fourgon frigorifique'};
      const typeGuess=Object.entries(typeMap).find(([k])=>parts.some(p=>p.includes(k)))?.[1]||'Semi-remorque';
      const colorMap={BLANC:'Blanc',BLEU:'Bleu',ROUGE:'Rouge',VERT:'Vert',NOIR:'Noir',ORANGE:'Orange'};
      const colorGuess=Object.entries(colorMap).find(([k])=>parts.some(p=>p.includes(k)))?.[0]||'';
      detected.push({file:f.name,client:clientGuess,year:yearMatch||new Date().getFullYear(),type:typeGuess,tags:colorGuess?[colorGuess]:[]});
    });
    if(detected.length===0)return;
    // Auto-create realisations
    loadAllData();
    detected.forEach(d=>{
      realisations.push({id:uid(),client:d.client,year:d.year,type:d.type,sector:'Transport alimentaire',qty:1,status:'Terminé',color1:'#0B3660',color2:'#E8501A',desc:`Importé depuis fichier : ${d.file}`,tags:d.tags,createdAt:new Date().toLocaleDateString('fr-FR')});
    });
    save('realisations',realisations);
    renderGallery();renderDashboard();
    showToast(`${detected.length} réalisation(s) importée(s) depuis les noms de fichiers`,'success');
  };
  input.click();
}

