// ============================================================
// MODULE 4 — RÉSEAUX SOCIAUX
// ============================================================
let socialFilter='Tous';
function filterSocial(s,el){
  socialFilter=s;
  document.querySelectorAll('#page-social .chip').forEach(c=>c.classList.remove('is-on'));
  el.classList.add('is-on');
  renderSocial();
}

function renderSocial(){
  loadAllData();
  const filt=socialFilter==='Tous'?socialData:socialData.filter(p=>p.network===socialFilter);
  const totalReach=filt.reduce((s,p)=>s+ +p.reach,0);
  const totalImpr=filt.reduce((s,p)=>s+ +p.impressions,0);
  const totalInter=filt.reduce((s,p)=>s+ +p.interactions,0);
  const eng=totalReach>0?((totalInter/totalReach)*100).toFixed(1):0;
  const best=filt.reduce((b,p)=>(!b||+p.interactions>+b.interactions)?p:b,null);
  document.getElementById('socialKpiGrid').innerHTML=`
    <div class="kpi-card"><div class="kpi-header"><span class="kpi-label">Publications</span></div><div class="kpi-val">${filt.length}</div><div class="kpi-delta delta-neutral">${filt.filter(p=>p.status==='Programmé').length} programmées</div></div>
    <div class="kpi-card c-accent"><div class="kpi-header"><span class="kpi-label">Portée totale</span></div><div class="kpi-val">${fmtNum(totalReach)}</div><div class="kpi-delta delta-neutral">impressions : ${fmtNum(totalImpr)}</div></div>
    <div class="kpi-card c-success"><div class="kpi-header"><span class="kpi-label">Engagement</span></div><div class="kpi-val">${eng}%</div><div class="kpi-delta delta-neutral">${totalInter} interactions</div></div>
    <div class="kpi-card"><div class="kpi-header"><span class="kpi-label">Meilleur post</span></div><div class="kpi-val" style="font-size:16px">${best?esc(best.theme).slice(0,20):'—'}</div><div class="kpi-delta delta-neutral">${best?fmtNum(best.interactions)+' inter.':''}</div></div>
  `;
  const body=document.getElementById('socialBody');
  const netIcons={Facebook:'🟦',Instagram:'🟣',LinkedIn:'🟧'};
  if(!filt.length){body.innerHTML=`<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--ink-3)">Aucune publication. <button class="btn btn-primary btn-sm" onclick="openPostModal()">+ Ajouter</button></td></tr>`;return;}
  body.innerHTML=filt.slice().reverse().map(_p=>{
    const p=escObj(_p);
    const eng=+p.reach>0?(( +p.interactions / +p.reach)*100).toFixed(1)+'%':'—';
    return `<tr>
      <td><div style="display:flex;align-items:center;gap:7px">${netIcons[p.network]||'•'} <span style="font-weight:600">${p.network}</span></div></td>
      <td class="mono">${p.date||'—'}</td>
      <td>${p.theme}</td>
      <td><span class="tag ${p.status==='Publié'?'tag-success':p.status==='Programmé'?'tag-info':'tag-neutral'}">${p.status}</span></td>
      <td>${fmtNum(p.reach)}</td><td>${fmtNum(p.impressions)}</td><td>${fmtNum(p.interactions)}</td>
      <td>${eng}</td>
      <td><div style="display:flex;gap:6px">
        <button class="btn btn-ghost btn-sm" onclick='openPostModal(socialData.find(x=>x.id==="${p.id}"))'>✏️</button>
        <button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="deleteItem('social','${p.id}')">🗑️</button>
      </div></td>
    </tr>`;
  }).join('');
}

function openPostModal(p){
  document.getElementById('postModalTitle').textContent=p?'Modifier la publication':'Ajouter une publication';
  document.getElementById('postId').value=p?p.id:'';
  ['network','date','theme','status','reach','impressions','interactions','clicks','followers'].forEach(f=>{
    const el=document.getElementById(`post_${f}`);
    if(el)el.value=p?p[f]||'':'';
  });
  if(!p)document.getElementById('post_date').value=new Date().toISOString().slice(0,10);
  openModal('post');
}

function savePost(){
  const theme=document.getElementById('post_theme').value.trim();
  if(!theme){showToast('Thème obligatoire','error');return;}
  const id=document.getElementById('postId').value||uid();
  const obj={id,
    network:document.getElementById('post_network').value,
    date:document.getElementById('post_date').value,
    theme,status:document.getElementById('post_status').value,
    reach:+document.getElementById('post_reach').value||0,
    impressions:+document.getElementById('post_impressions').value||0,
    interactions:+document.getElementById('post_interactions').value||0,
    clicks:+document.getElementById('post_clicks').value||0,
    followers:+document.getElementById('post_followers').value||0
  };
  loadAllData();
  const idx=socialData.findIndex(p=>p.id===id);
  if(idx>=0)socialData[idx]=obj;else socialData.push(obj);
  save('social',socialData);
  closeModal('post');
  renderSocial();
  showToast('Publication enregistrée','success');
}

