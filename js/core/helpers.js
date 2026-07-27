// ============================================================
// GENERIC HELPERS
// ============================================================
function deleteItem(key,id){
  showConfirm('Confirmer la suppression','Cette action est irréversible.',()=>{
    loadAllData();
    const map={adhesifs,realisations,kpi:kpiData,maquettes,social:socialData,movements,zones,slots};
    const arr=map[key];
    if(!arr)return;
    const saveKey=key==='kpi'?'kpi':key==='social'?'social':key;
    const idx=arr.findIndex(x=>x.id===id);
    if(idx>=0){
      if(key==='adhesifs'){ logMovement(arr[idx],'suppression',arr[idx].qty,0,'Référence supprimée'); }
      arr.splice(idx,1);save(saveKey,arr);
    }
    // re-render
    if(key==='adhesifs'){renderAdhesifs();renderWarehouse();renderDashboard();renderMovements();}
    else if(key==='realisations'){renderGallery();renderDashboard();}
    else if(key==='kpi'){renderKPI();renderDashboard();}
    else if(key==='maquettes')renderMaquettes();
    else if(key==='social')renderSocial();
    else if(key==='zones'||key==='slots')renderWarehouse();
    showToast('Supprimé','success');
  });
}

function openModal(id){document.getElementById('modal-'+id).classList.add('open');}
function closeModal(id){document.getElementById('modal-'+id).classList.remove('open');}

function showToast(msg,type=''){
  const area=document.getElementById('toastArea');
  const el=document.createElement('div');
  el.className='toast'+(type?' '+type:'');
  el.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>${esc(msg)}`;
  area.appendChild(el);setTimeout(()=>el.remove(),3500);
}

function showConfirm(title,msg,onConfirm){
  const existing=document.querySelector('.confirm-overlay');
  if(existing)existing.remove();
  const div=document.createElement('div');
  div.className='confirm-overlay';
  div.innerHTML=`<div class="confirm-box"><div class="confirm-title">${esc(title)}</div><div class="confirm-msg">${esc(msg)}</div><div class="confirm-actions"><button class="btn btn-ghost" onclick="this.closest('.confirm-overlay').remove()">Annuler</button><button class="btn btn-danger" id="confirmOk">Confirmer</button></div></div>`;
  document.body.appendChild(div);
  document.getElementById('confirmOk').onclick=()=>{div.remove();onConfirm();};
}

function showFutureFeature(name){
  showToast(`${name} — Fonctionnalité prévue en version future`,'warn');
}

function fmtNum(n){
  n=+n;
  if(n>=1000000)return(n/1000000).toFixed(1)+'M';
  if(n>=1000)return(n/1000).toFixed(1)+'k';
  return String(n);
}

function globalSearchFn(q){
  if(!q){return;}
  q=q.toLowerCase();
  // Search across all data
  loadAllData();
  const results=[];
  adhesifs.forEach(a=>{if((a.name+a.ref+a.supplier).toLowerCase().includes(q))results.push({type:'Adhésif',name:a.name,action:()=>goTo('adhesifs')});});
  realisations.forEach(r=>{if((r.client+r.sector).toLowerCase().includes(q))results.push({type:'Réalisation',name:r.client,action:()=>goTo('realisations')});});
  if(results.length>0){goTo(results[0].type==='Adhésif'?'adhesifs':'realisations');showToast(`${results.length} résultat(s) pour "${q}"`);}
  else showToast('Aucun résultat trouvé');
}

function filterMvt(type, el){
  mvtFilter=type;
  document.querySelectorAll('#tab-adh-mvt .chip').forEach(c=>c.classList.remove('is-on'));
  el.classList.add('is-on');
  renderMovements();
}

