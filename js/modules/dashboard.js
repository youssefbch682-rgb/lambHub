// ============================================================
// DASHBOARD
// ============================================================
function renderDashboard(){
  loadAllData();
  const low=adhesifs.filter(a=>+a.qty<=(+a.min||5));
  const avgNote=kpiData.length?( kpiData.reduce((s,k)=>s+ +k.note,0)/kpiData.length ).toFixed(1):0;
  const totalReach=socialData.reduce((s,p)=>s+ +p.reach,0);
  const totalPost=socialData.length;
  const grid=document.getElementById('dashKpiGrid');
  grid.innerHTML=`
    <div class="kpi-card c-success"><div class="kpi-header"><span class="kpi-label">Total adhésifs</span></div><div class="kpi-val">${adhesifs.length}</div><div class="kpi-delta delta-neutral">${adhesifs.reduce((s,a)=>s+ +a.qty,0)} rouleaux au total</div></div>
    <div class="kpi-card c-warn"><div class="kpi-header"><span class="kpi-label">Alertes stock</span></div><div class="kpi-val" style="color:var(--warn)">${low.length}</div><div class="kpi-delta ${low.length>0?'delta-down':'delta-neutral'}">${low.length>0?'⚠️ Réapprovisionnement requis':'Tout est en ordre'}</div></div>
    <div class="kpi-card"><div class="kpi-header"><span class="kpi-label">Réalisations</span></div><div class="kpi-val">${realisations.length}</div><div class="kpi-delta delta-neutral">${realisations.filter(r=>r.status==='Terminé').length} terminées</div></div>
    <div class="kpi-card c-accent"><div class="kpi-header"><span class="kpi-label">Satisfaction</span></div><div class="kpi-val">${avgNote||'—'}</div><div class="kpi-delta delta-neutral">sur 5 · ${kpiData.length} retours</div></div>
  `;
  // Alerts
  const aEl=document.getElementById('dashAlerts');
  if(low.length===0){aEl.innerHTML='<div style="text-align:center;padding:20px;color:var(--ink-3);font-size:13px">✅ Aucune alerte stock</div>';}
  else{aEl.innerHTML=low.slice(0,4).map(_a=>{const a=escObj(_a);return `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--line-2);font-size:12.5px"><span style="font-weight:600">${a.name}</span><span class="tag tag-warn">${a.qty} roul.</span></div>`;}).join('');}
  // Recent
  const rEl=document.getElementById('dashRecent');
  const recent=realisations.slice(-4).reverse();
  if(recent.length===0){rEl.innerHTML='<div style="text-align:center;padding:20px;color:var(--ink-3);font-size:13px">Aucune réalisation enregistrée</div>';}
  else{rEl.innerHTML=recent.map(_r=>{const r=escObj(_r);return `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--line-2);font-size:12.5px"><span style="font-weight:600">${r.client}</span><span style="color:var(--ink-3)">${r.type} · ${r.year}</span></div>`;}).join('');}
  document.getElementById('dashNPS').textContent=avgNote||'—';
  // engagement
  const totalInter=socialData.reduce((s,p)=>s+ +p.interactions,0);
  const eng=totalReach>0?((totalInter/totalReach)*100).toFixed(1)+'%':'—';
  document.getElementById('dashEngagement').textContent=eng;
  document.getElementById('dashMaquettes').textContent=maquettes.length;
  // Notif dot
  document.getElementById('globalNotifDot').style.display=low.length>0?'block':'none';
  document.getElementById('alertBadge').textContent=low.length;
  document.getElementById('realBadge').textContent=realisations.length;
}

