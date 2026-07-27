// ============================================================
// MODULE 1 — ADHÉSIFS
// ============================================================
let adhesifFilterStatus='all';
// ============================================================
// FAMILLES DE COULEURS — regroupe les teintes précises ("Bleu nuit",
// "Navy metallic", #1a3c8f…) en familles générales pour le filtre.
// Détection : 1) mots-clés FR/EN dans le nom  2) analyse teinte/saturation/
// luminosité de la pastille hex  3) sinon "Autre".
// ============================================================
const COLOR_FAMILY_ORDER=['Blanc','Noir','Gris','Argent','Or','Beige','Marron','Rouge','Rose','Orange','Jaune','Vert','Turquoise','Bleu','Violet','Autre'];
const COLOR_KEYWORDS={
  Blanc:['blanc','blanche','white','ivoire','ivory'],
  Noir:['noir','noire','black','carbone','carbon'],
  Gris:['gris','grise','grey','gray','anthracite','graphite','ardoise'],
  Argent:['argent','silver','alu','aluminium','chrome','chromé','inox'],
  Or:['or','gold','doré','dorée','dore','doree'],
  Beige:['beige','creme','crème','cream','sable','ecru','écru','champagne','ivoirin'],
  Marron:['marron','brun','brune','brown','chocolat','choco','camel','cuivre','copper','bronze','moka','taupe'],
  Rouge:['rouge','red','bordeaux','burgundy','carmin','cerise','grenat','vermillon'],
  Rose:['rose','pink','fuchsia','fushia','magenta'],
  Orange:['orange','corail','coral','abricot','mandarine','tangerine'],
  Jaune:['jaune','yellow','citron','moutarde','canari'],
  Vert:['vert','verte','green','kaki','olive','menthe','mint','anis','emeraude','émeraude','sapin','pomme'],
  Turquoise:['turquoise','cyan','teal','petrole','pétrole','lagon'],
  Bleu:['bleu','bleue','blue','marine','navy','azur','cobalt','indigo','roi','royal','ciel'],
  Violet:['violet','violette','purple','mauve','lilas','lavande','prune','aubergine','parme']
};
// Index inversé mot→famille (les mots-clés sont des tokens exacts : "or" ne matche pas "orange")
const COLOR_KEYWORD_INDEX=(()=>{const idx={};for(const fam in COLOR_KEYWORDS)COLOR_KEYWORDS[fam].forEach(k=>idx[k.normalize('NFD').replace(/[\u0300-\u036f]/g,'')]=fam);return idx;})();

function hexToHsl(hex){
  const m=String(hex||'').trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if(!m)return null;
  let h=m[1];if(h.length===3)h=h.split('').map(c=>c+c).join('');
  const r=parseInt(h.slice(0,2),16)/255,g=parseInt(h.slice(2,4),16)/255,b=parseInt(h.slice(4,6),16)/255;
  const max=Math.max(r,g,b),min=Math.min(r,g,b),l=(max+min)/2;
  if(max===min)return{h:0,s:0,l};
  const d=max-min;
  const s=l>0.5?d/(2-max-min):d/(max+min);
  let hue;
  if(max===r)hue=((g-b)/d+(g<b?6:0))*60;
  else if(max===g)hue=((b-r)/d+2)*60;
  else hue=((r-g)/d+4)*60;
  return{h:hue,s,l};
}

function familyFromHex(hex){
  const c=hexToHsl(hex);
  if(!c)return null;
  const{h,s,l}=c;
  if(l>=0.93&&s<=0.2)return'Blanc';
  if(l<=0.1)return'Noir';
  if(s<=0.12)return l>=0.75?'Blanc':l<=0.2?'Noir':'Gris';
  if(h>=20&&h<=55&&s<=0.4&&l>=0.68)return'Beige';
  if(h>=15&&h<50&&l<0.38)return'Marron';
  if(h<15||h>=340)return'Rouge';
  if(h<45)return'Orange';
  if(h<68)return'Jaune';
  if(h<160)return'Vert';
  if(h<200)return'Turquoise';
  if(h<255)return'Bleu';
  if(h<300)return'Violet';
  return'Rose';
}

function colorFamily(a){
  // 1) mots du nom de couleur, puis du nom de l'adhésif
  const words=((a.color||'')+' '+(a.name||'')).toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .split(/[^a-z]+/).filter(Boolean);
  for(const wd of words){ if(COLOR_KEYWORD_INDEX[wd])return COLOR_KEYWORD_INDEX[wd]; }
  // 2) pastille hexadécimale
  const fam=familyFromHex(a.colorHex);
  if(fam)return fam;
  return'Autre';
}

let adhesifSearchQ='';
let adhFiltSupplier='',adhFiltColor='',adhFiltZone='';
function resetAdhesifFilters(){
  adhFiltSupplier='';adhFiltColor='';adhFiltZone='';adhesifSearchQ='';
  adhesifFilterStatus='all';
  document.querySelectorAll('#chip-all,#chip-low,#chip-ok').forEach(c=>c.classList.remove('is-on'));
  document.getElementById('chip-all')?.classList.add('is-on');
  const si=document.getElementById('adhesifSearch');if(si)si.value='';
  ['adhFiltSupplier','adhFiltColor','adhFiltZone'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  renderAdhesifs();
}
// Remplit un select de filtre avec les valeurs distinctes des données, en préservant la sélection
function fillFilterSelect(id,values,currentVal,allLabel){
  const el=document.getElementById(id);
  if(!el)return;
  const distinct=[...new Set(values.filter(Boolean).map(v=>String(v).trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr'));
  el.innerHTML=`<option value="">${allLabel}</option>`+distinct.map(v=>`<option value="${esc(v)}"${v===currentVal?' selected':''}>${esc(v)}</option>`).join('');
}

function filterAdhesifs(){
  adhesifSearchQ=document.getElementById('adhesifSearch')?.value.toLowerCase()||'';
  adhFiltSupplier=document.getElementById('adhFiltSupplier')?.value||'';
  adhFiltColor=document.getElementById('adhFiltColor')?.value||'';
  adhFiltZone=document.getElementById('adhFiltZone')?.value||'';
  renderAdhesifs();
}

function filterAdhesifStatus(status,el){
  adhesifFilterStatus=status;
  document.querySelectorAll('#chip-all,#chip-low,#chip-ok').forEach(c=>c.classList.remove('is-on'));
  el.classList.add('is-on');
  renderAdhesifs();
}

function renderAdhesifs(){
  loadAllData();
  // KPI
  const total=adhesifs.length;
  const totalR=adhesifs.reduce((s,a)=>s+ +a.qty,0);
  const totalM=adhesifs.reduce((s,a)=>s+ +a.length,0);
  const low=adhesifs.filter(a=>+a.qty<=(+a.min||5)&&+a.qty>0).length;
  const empty=adhesifs.filter(a=>+a.qty===0).length;
  document.getElementById('adhesifKpiGrid').innerHTML=`
    <div class="kpi-card"><div class="kpi-header"><span class="kpi-label">Références</span></div><div class="kpi-val">${total}</div><div class="kpi-delta delta-neutral">références actives</div></div>
    <div class="kpi-card c-success"><div class="kpi-header"><span class="kpi-label">Rouleaux totaux</span></div><div class="kpi-val">${totalR}</div><div class="kpi-delta delta-neutral">en stock</div></div>
    <div class="kpi-card c-warn"><div class="kpi-header"><span class="kpi-label">Stock faible</span></div><div class="kpi-val" style="color:var(--warn)">${low}</div><div class="kpi-delta delta-neutral">à réapprovisionner</div></div>
    <div class="kpi-card c-accent"><div class="kpi-header"><span class="kpi-label">Ruptures</span></div><div class="kpi-val" style="color:var(--danger)">${empty}</div><div class="kpi-delta delta-neutral">en rupture totale</div></div>
  `;
  // Alimente les filtres déroulants à partir des données (sélection préservée)
  fillFilterSelect('adhFiltSupplier',adhesifs.map(a=>a.supplier),adhFiltSupplier,'Tous fournisseurs');
  (function(){
    const el=document.getElementById('adhFiltColor');
    if(!el)return;
    const present=new Set(adhesifs.map(colorFamily));
    const fams=COLOR_FAMILY_ORDER.filter(f=>present.has(f));
    el.innerHTML=`<option value="">Toutes couleurs</option>`+fams.map(f=>`<option value="${f}"${f===adhFiltColor?' selected':''}>${f}</option>`).join('');
  })();
  fillFilterSelect('adhFiltZone',adhesifs.map(a=>a.zone),adhFiltZone,'Toutes zones');

  let filtered=adhesifs.filter(a=>{
    if(adhesifFilterStatus==='low') return +a.qty<=(+a.min||5);
    if(adhesifFilterStatus==='ok') return +a.qty>(+a.min||5);
    return true;
  }).filter(a=>!adhesifSearchQ||(a.name+a.ref+a.supplier+a.color+a.loc).toLowerCase().includes(adhesifSearchQ))
    .filter(a=>!adhFiltSupplier||String(a.supplier||'').trim()===adhFiltSupplier)
    .filter(a=>!adhFiltColor||colorFamily(a)===adhFiltColor)
    .filter(a=>!adhFiltZone||String(a.zone||'').trim()===adhFiltZone);

  // Bouton réinitialiser visible dès qu'un filtre est actif
  const hasFilters=!!(adhFiltSupplier||adhFiltColor||adhFiltZone||adhesifSearchQ||adhesifFilterStatus!=='all');
  const resetBtn=document.getElementById('adhFiltReset');
  if(resetBtn)resetBtn.style.display=hasFilters?'':'none';

  const body=document.getElementById('adhesifBody');
  if(!filtered.length){body.innerHTML=`<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--ink-3)">Aucun adhésif ne correspond${hasFilters?' aux filtres actifs. <button class="btn btn-ghost btn-sm" onclick="resetAdhesifFilters()">✕ Réinitialiser les filtres</button>':'. <button class="btn btn-primary btn-sm" onclick="openAdhesifModal()">+ Ajouter</button>'}</td></tr>`;return;}
  body.innerHTML=filtered.map(_a=>{
    const a=escObj(_a);
    const isLow=+a.qty<=(+a.min||5);
    const isEmpty=+a.qty===0;
    const statusTag=isEmpty?'<span class="tag tag-danger">Rupture</span>':isLow?'<span class="tag tag-warn">Stock faible</span>':'<span class="tag tag-success">Normal</span>';
    return `<tr>
      <td class="mono">${a.ref||'—'}</td>
      <td><div style="display:flex;align-items:center;gap:7px"><div class="swatch" style="background:${a.colorHex||'#eee'}"></div><span>${a.color||'—'}</span></div></td>
      <td><span style="font-weight:600">${a.name}</span></td>
      <td>${a.supplier||'—'}</td>
      <td class="mono">${a.loc||'—'}</td>
      <td style="${isLow?'color:var(--warn);font-weight:700':''}"><strong>${a.qty}</strong></td>
      <td>${a.length||0} m</td>
      <td>${statusTag}</td>
      <td><div style="display:flex;gap:6px">
        <button class="btn btn-ghost btn-sm" onclick="openDrawer(adhesifs.find(x=>x.id==='${a.id}'))">Détail</button>
        <button class="btn btn-ghost btn-sm" onclick="openAdhesifModal(adhesifs.find(x=>x.id==='${a.id}'))">✏️</button>
        <button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="deleteItem('adhesifs','${a.id}')">🗑️</button>
      </div></td>
    </tr>`;
  }).join('');
}

function openAdhesifModal(a){
  document.getElementById('adhesifModalTitle').textContent=a?'Modifier l\'adhésif':'Ajouter un adhésif';
  document.getElementById('adhesifId').value=a?a.id:'';
  ['ref','supplier','name','color','colorHex','width','thickness','zone','rack','loc','qty','length','min','comment'].forEach(f=>{
    const el=document.getElementById(`adh_${f}`);
    if(el)el.value=a?a[f]||'':'';
  });
  const knownSuppliers=['Hesix','3M','Avery','Oracal','Hexis'];
  const supSel=document.getElementById('adh_supplier');
  const otherWrap=document.getElementById('adh_supplier_other_wrap');
  const otherInput=document.getElementById('adh_supplier_other');
  if(a&&a.supplier&&!knownSuppliers.includes(a.supplier)){
    supSel.value='Autres'; otherWrap.style.display='block'; otherInput.value=a.supplier;
  } else {
    otherWrap.style.display='none'; otherInput.value='';
    if(a)supSel.value=a.supplier||'Hesix';
  }
  if(!a)document.getElementById('adh_colorHex').value='#FFFFFF';
  openModal('adhesif');
}

function logMovement(adhesif,type,oldQty,newQty,note){
  loadAllData();
  const now=new Date();
  movements.push({
    id:uid(),
    adhesifId:adhesif.id, adhesifName:adhesif.name, ref:adhesif.ref,
    type, oldQty:+oldQty, newQty:+newQty, diff:(+newQty-(+oldQty)),
    qty:(+newQty-(+oldQty)),
    user:'Camille M.', note:note||'',
    date:now.toLocaleDateString('fr-FR'), time:now.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}),
    ts:now.getTime(), cancelled:false
  });
  save('movements',movements);
}

function saveAdhesif(){
  const fields=['ref','name','loc','qty'];
  for(const f of fields){
    const v=document.getElementById(`adh_${f}`).value.trim();
    if(!v){showToast(`Champ obligatoire manquant : ${f}`,'error');return;}
  }
  const id=document.getElementById('adhesifId').value||uid();
  const isNew=!document.getElementById('adhesifId').value;
  loadAllData();
  const previous=adhesifs.find(a=>a.id===id);
  const oldQty=previous?+previous.qty:0;
  const obj={id};
  ['ref','supplier','name','color','colorHex','width','thickness','zone','rack','loc','qty','length','min','comment'].forEach(f=>{
    obj[f]=document.getElementById(`adh_${f}`)?.value||'';
  });
  if(obj.supplier==='Autres'){
    const other=document.getElementById('adh_supplier_other').value.trim();
    if(other)obj.supplier=other;
  }
  obj.updatedAt=new Date().toLocaleDateString('fr-FR');
  const idx=adhesifs.findIndex(a=>a.id===id);
  const movedLocation=previous&&previous.loc!==obj.loc;
  if(idx>=0)adhesifs[idx]=obj;else adhesifs.push(obj);
  save('adhesifs',adhesifs);
  if(isNew){
    logMovement(obj,'creation',0,obj.qty,'Création de la référence');
  } else {
    if(+oldQty!==+obj.qty){
      logMovement(obj,+obj.qty>+oldQty?'in':'out',oldQty,obj.qty,'Modification manuelle de la quantité');
    } else if(movedLocation){
      logMovement(obj,'deplacement',oldQty,obj.qty,`Déplacé de ${previous.loc} vers ${obj.loc}`);
    } else {
      logMovement(obj,'modification',oldQty,obj.qty,'Modification des informations');
    }
  }
  closeModal('adhesif');
  renderAdhesifs();renderWarehouse();renderDashboard();renderMovements();
  showToast('Adhésif enregistré','success');
}

function openDrawer(_a){
  const a=escObj(_a);
  const isLow=+a.qty<=(+a.min||5);
  document.getElementById('drawerTitle').textContent=_a.name;
  document.getElementById('drawerBody').innerHTML=`
    <div class="drawer-swatch" style="background:${a.colorHex||'#eee'};border:1px solid rgba(0,0,0,.08)"></div>
    <div class="dl">
      <div class="dl-row"><span class="dl-key">Référence</span><span class="dl-val mono">${a.ref||'—'}</span></div>
      <div class="dl-row"><span class="dl-key">Fournisseur</span><span class="dl-val">${a.supplier||'—'}</span></div>
      <div class="dl-row"><span class="dl-key">Couleur</span><span class="dl-val">${a.color||'—'}</span></div>
      <div class="dl-row"><span class="dl-key">Largeur</span><span class="dl-val">${a.width||'—'}</span></div>
      <div class="dl-row"><span class="dl-key">Épaisseur</span><span class="dl-val">${a.thickness||'—'}</span></div>
      <div class="dl-row"><span class="dl-key">Zone</span><span class="dl-val">${a.zone||'—'}</span></div>
      <div class="dl-row"><span class="dl-key">Étagère</span><span class="dl-val">${a.rack||'—'}</span></div>
      <div class="dl-row"><span class="dl-key">Emplacement</span><span class="dl-val mono">${a.loc||'—'}</span></div>
      <div class="dl-row"><span class="dl-key">Quantité</span><span class="dl-val" style="${isLow?'color:var(--warn)':''}">${a.qty} rouleaux</span></div>
      <div class="dl-row"><span class="dl-key">Longueur</span><span class="dl-val">${a.length||0} m</span></div>
      <div class="dl-row"><span class="dl-key">Seuil alerte</span><span class="dl-val">${a.min||5} rouleaux</span></div>
      <div class="dl-row"><span class="dl-key">Mise à jour</span><span class="dl-val">${a.updatedAt||'—'}</span></div>
    </div>
    ${a.comment?`<div style="margin-top:12px;padding:10px;background:var(--surface-2);border-radius:var(--r-s);font-size:12.5px;color:var(--ink-2)">${a.comment}</div>`:''}
    ${isLow?'<div style="padding:9px 10px;background:var(--warn-soft);border-radius:6px;font-size:12px;color:var(--warn);font-weight:600;margin-top:12px">⚠️ Stock faible — Commander en urgence</div>':''}
    <div style="display:flex;flex-direction:column;gap:8px;margin-top:14px">
      <button class="btn btn-primary" onclick='openMvtModal("${a.id}")'>Enregistrer un mouvement</button>
      <button class="btn btn-ghost" onclick="openAdhesifModal(adhesifs.find(x=>x.id==='${a.id}'));closeDrawer()">Modifier</button>
      <button class="btn btn-ghost" style="color:var(--danger)" onclick="deleteItem('adhesifs','${a.id}');closeDrawer()">Supprimer</button>
    </div>
  `;
  document.getElementById('drawerOverlay').classList.add('open');
}
function closeDrawer(){document.getElementById('drawerOverlay').classList.remove('open');}

// ============================================================
// WAREHOUSE 2D PLAN
// ============================================================
function rackStatusClass(a){
  if(!a)return 'empty';
  const qty=+a.qty, min=+a.min||5;
  if(qty<=0||qty<=min)return 'danger';      // rouge — stock faible
  if(qty<=min*1.5)return 'near';             // orange — proche du seuil
  return 'ok';                                // vert — stock correct
}

function renderWarehouse(){
  loadAllData();
  const container=document.getElementById('warehouseZones');
  if(!container)return;
  if(zones.length===0){
    container.innerHTML=`<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg><div class="title">Aucune zone définie</div><div class="desc">Créez votre première zone de stockage.</div><button class="btn btn-primary" onclick="openZoneModal()">+ Ajouter une zone</button></div>`;
    return;
  }
  container.innerHTML=zones.map(_z=>{
    const z=escObj(_z);
    const zSlots=slots.filter(s=>s.zoneId===_z.id);
    return `<div class="zone-block">
      <div class="zone-header">
        <span class="zone-name">${z.name}</span>
        <span class="mono" style="font-size:10px;color:var(--ink-3)">${zSlots.length} emplacements</span>
        <button class="btn btn-ghost btn-sm" onclick="openSlotModal('${z.id}')">+ Emplacement</button>
        <button class="btn btn-ghost btn-sm" style="margin-left:6px" onclick="deleteItem('zones','${z.id}')">🗑️ Zone</button>
      </div>
      <div class="zone-rack-grid">
        ${zSlots.map(_s=>{
          const s=escObj(_s);
          const a=escObj(adhesifs.find(x=>x.loc===_s.code));
          const st=rackStatusClass(a);
          let cls='rack '+st;
          return `<div class="${cls}" onclick="selectRack('${s.id}')">
            <div class="rack-code">${s.code}</div>
            ${a?`<div class="rack-name">${a.name.split(' ').slice(0,3).join(' ')}</div><div class="rack-qty${st==='danger'?' danger':st==='near'?' near':''}">${a.qty} roul.</div>`:'<div class="rack-name" style="color:var(--ink-3)">— vide —</div>'}
          </div>`;
        }).join('')}
        ${zSlots.length===0?'<div style="color:var(--ink-3);font-size:12px;padding:8px">Aucun emplacement dans cette zone</div>':''}
      </div>
    </div>`;
  }).join('');
}

function selectRack(slotId){
  document.querySelectorAll('.rack').forEach(r=>r.classList.remove('selected'));
  event.currentTarget.classList.add('selected');
  const slot=slots.find(s=>s.id===slotId);
  if(!slot)return;
  const code=slot.code;
  const _a=adhesifs.find(x=>x.loc===code);
  const a=escObj(_a);
  const detail=document.getElementById('rackDetail');
  if(!a){
    detail.innerHTML=`<div style="font-size:13px;color:var(--ink-3);text-align:center;padding:16px 0">Emplacement <strong>${esc(code)}</strong> vide</div>
    <button class="btn btn-ghost btn-sm" style="width:100%;justify-content:center;margin-top:10px" onclick="deleteSlotById('${slot.id}')">🗑️ Supprimer cet emplacement</button>`;
    return;
  }
  const st=rackStatusClass(a);
  detail.innerHTML=`
    <div style="background:${a.colorHex||'#eee'};height:50px;border-radius:8px;margin-bottom:12px;border:1px solid rgba(0,0,0,.08)"></div>
    <div style="font-weight:700;font-size:13px;margin-bottom:8px">${a.name}</div>
    <div class="dl">
      <div class="dl-row"><span class="dl-key">Réf.</span><span class="dl-val mono">${a.ref}</span></div>
      <div class="dl-row"><span class="dl-key">Fournisseur</span><span class="dl-val">${a.supplier}</span></div>
      <div class="dl-row"><span class="dl-key">Zone / Étagère</span><span class="dl-val">${a.zone||'—'} / ${a.rack||'—'}</span></div>
      <div class="dl-row"><span class="dl-key">Quantité</span><span class="dl-val" style="${st!=='ok'?'color:var(--warn)':''}">${a.qty} roul.</span></div>
    </div>
    ${st==='danger'?'<div style="padding:8px;background:var(--danger-soft);border-radius:6px;font-size:12px;color:var(--danger);font-weight:600;margin-top:10px">🔴 Stock faible</div>':st==='near'?'<div style="padding:8px;background:var(--warn-soft);border-radius:6px;font-size:12px;color:var(--warn);font-weight:600;margin-top:10px">🟠 Proche du seuil</div>':'<div style="padding:8px;background:var(--success-soft);border-radius:6px;font-size:12px;color:var(--success);font-weight:600;margin-top:10px">🟢 Stock correct</div>'}
    <button class="btn btn-ghost btn-sm" style="width:100%;justify-content:center;margin-top:10px" onclick="openAdhesifModal(adhesifs.find(x=>x.id==='${a.id}'))">Modifier</button>
  `;
}

function deleteSlotById(slotId){
  showConfirm('Supprimer cet emplacement ?','Cette action est irréversible.',()=>{
    loadAllData();
    slots=slots.filter(s=>s.id!==slotId);
    save('slots',slots);
    renderWarehouse();
    showToast('Emplacement supprimé','success');
  });
}

function openZoneModal(){
  document.getElementById('zone_name').value='';
  document.getElementById('zone_code').value='';
  openModal('zone');
}

function saveZone(){
  const name=document.getElementById('zone_name').value.trim();
  if(!name){showToast('Nom de zone obligatoire','error');return;}
  loadAllData();
  zones.push({id:uid(),name,code:document.getElementById('zone_code').value.trim()});
  save('zones',zones);
  closeModal('zone');
  renderWarehouse();
  showToast('Zone créée','success');
}

function openSlotModal(preZoneId){
  loadAllData();
  const sel=document.getElementById('slot_zone');
  sel.innerHTML=zones.map(z=>`<option value="${z.id}">${z.name}</option>`).join('');
  if(preZoneId)sel.value=preZoneId;
  document.getElementById('slot_code').value='';
  openModal('slot');
}

function saveSlot(){
  const code=document.getElementById('slot_code').value.trim();
  const zoneId=document.getElementById('slot_zone').value;
  if(!code){showToast('Code emplacement obligatoire','error');return;}
  loadAllData();
  slots.push({id:uid(),code,zoneId});
  save('slots',slots);
  closeModal('slot');
  renderWarehouse();
  showToast('Emplacement créé','success');
}

// ============================================================
// MOVEMENTS
// ============================================================
let mvtFilter='all';

function filterMvt(type,el){
  mvtFilter=type;
  document.querySelectorAll('#tab-adh-mvt .chip').forEach(c=>c.classList.remove('is-on'));
  el.classList.add('is-on');
  renderMovements();
}

function openMvtModal(preselect){
  loadAllData();
  const sel=document.getElementById('mvt_adhesif');
  sel.innerHTML=adhesifs.map(a=>`<option value="${a.id}">${a.ref} — ${a.name}</option>`).join('');
  if(preselect){const idx=adhesifs.findIndex(a=>a.id===preselect);if(idx>=0)sel.selectedIndex=idx;}
  document.getElementById('mvt_qty').value='';
  document.getElementById('mvt_note').value='';
  openModal('mvt');
}

function saveMvt(){
  const adhesifId=document.getElementById('mvt_adhesif').value;
  const type=document.getElementById('mvt_type').value;
  const qty=+document.getElementById('mvt_qty').value;
  const note=document.getElementById('mvt_note').value;
  if(!qty||qty<1){showToast('Quantité invalide','error');return;}
  loadAllData();
  const a=adhesifs.find(x=>x.id===adhesifId);
  if(!a){showToast('Adhésif introuvable','error');return;}
  const oldQty=+a.qty;
  const newQty=type==='in'?+a.qty+qty:Math.max(0,+a.qty-qty);
  a.qty=newQty;
  a.updatedAt=new Date().toLocaleDateString('fr-FR');
  save('adhesifs',adhesifs);
  logMovement(a,type,oldQty,newQty,note);
  closeModal('mvt');
  renderMovements();renderAdhesifs();renderWarehouse();renderDashboard();
  showToast(`Mouvement enregistré — ${a.name}:`+(type==='in'?` +${qty}`:`-${qty}`)+' roul.','success');
}

function undoMovement(mvtId){
  loadAllData();
  const m=movements.find(x=>x.id===mvtId);
  if(!m){showToast('Mouvement introuvable','error');return;}
  if(m.cancelled){showToast('Ce mouvement a déjà été annulé','warn');return;}
  showConfirm('Annuler ce mouvement ?',`La quantité de "${m.adhesifName}" reviendra à ${m.oldQty} rouleaux.`,()=>{
    loadAllData();
    const mv=movements.find(x=>x.id===mvtId);
    const a=adhesifs.find(x=>x.id===mv.adhesifId);
    if(a){ a.qty=mv.oldQty; a.updatedAt=new Date().toLocaleDateString('fr-FR'); save('adhesifs',adhesifs); }
    mv.cancelled=true;
    save('movements',movements);
    renderMovements();renderAdhesifs();renderWarehouse();renderDashboard();
    showToast('Action annulée — quantité restaurée','success');
  });
}

function undoLastMovement(){
  loadAllData();
  const active=movements.filter(m=>!m.cancelled);
  if(!active.length){showToast('Aucun mouvement à annuler','warn');return;}
  const last=active[active.length-1];
  undoMovement(last.id);
}

function renderMovements(){
  loadAllData();
  const log=document.getElementById('mvtLog');
  if(!log)return;
  let filtered=movements;
  if(mvtFilter==='in')filtered=movements.filter(m=>m.type==='in');
  else if(mvtFilter==='out')filtered=movements.filter(m=>m.type==='out');
  else if(mvtFilter==='alert')filtered=movements.filter(m=>m.type==='alert');
  if(!filtered.length){log.innerHTML='<div style="text-align:center;padding:24px;color:var(--ink-3);font-size:13px">Aucun mouvement enregistré</div>';return;}
  const iconsMap={in:'⬆️',out:'⬇️',alert:'⚠️',creation:'✨',modification:'✏️',suppression:'🗑️',deplacement:'📦'};
  const colorsMap={in:'var(--success)',out:'var(--accent)',alert:'var(--warn)',creation:'var(--brand)',modification:'var(--info)',suppression:'var(--danger)',deplacement:'var(--purple)'};
  const bgMap={in:'var(--success-soft)',out:'var(--accent-soft)',alert:'var(--warn-soft)',creation:'var(--brand-soft)',modification:'var(--info-soft)',suppression:'var(--danger-soft)',deplacement:'var(--purple-soft)'};
  const labelMap={in:'Entrée',out:'Sortie',alert:'Alerte',creation:'Création',modification:'Modification',suppression:'Suppression',deplacement:'Déplacement'};
  log.innerHTML=filtered.slice().reverse().map(_m=>{
    const m=escObj(_m);
    const diff=(m.diff!==undefined?m.diff:m.qty)||0;
    const diffTxt=diff>0?`+${diff}`:diff;
    return `
    <div class="mvt-row${m.cancelled?' mvt-cancelled':''}" style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--line-2)">
      <div class="mvt-icon" style="background:${bgMap[m.type]||'var(--surface-3)'};width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;flex:none">${iconsMap[m.type]||'•'}</div>
      <div class="mvt-body" style="flex:1;min-width:0">
        <div class="mvt-title" style="font-weight:600;font-size:13px">${m.adhesifName||'—'} <span style="font-weight:500;color:var(--ink-3);font-size:11.5px">· ${labelMap[m.type]||m.type}</span></div>
        <div class="mvt-meta" style="font-size:11.5px;color:var(--ink-3)">${m.ref||''}${m.note?' · '+m.note:''} · ${m.date}${m.time?' à '+m.time:''} · par ${m.user||'—'}${m.cancelled?' · Action annulée':''}</div>
        <div class="mvt-meta" style="font-size:11px;color:var(--ink-3)">Qté : ${m.oldQty!==undefined?m.oldQty:'—'} → ${m.newQty!==undefined?m.newQty:'—'}</div>
      </div>
      <div class="mvt-qty" style="color:${colorsMap[m.type]||'var(--ink)'};font-weight:700;font-family:var(--font-m)">${diffTxt}</div>
      ${!m.cancelled?`<button class="mvt-undo" onclick="undoMovement('${m.id}')">↩ Annuler</button>`:''}
    </div>`;
  }).join('');
}

