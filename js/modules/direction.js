// ============================================================
// MODULE 7 — DIRECTION
// ============================================================
function renderDirection(){
  loadAllData();
  const totalAdh=adhesifs.length;
  const alertsAdh=adhesifs.filter(a=>+a.qty<=(+a.min||5)).length;
  const avgNote=kpiData.length?(kpiData.reduce((s,k)=>s+ +k.note,0)/kpiData.length).toFixed(1):0;
  const totalReach=socialData.reduce((s,p)=>s+ +p.reach,0);
  const doc=document.getElementById('dirOverview');
  doc.innerHTML=`
    <div class="dir-card"><div style="font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:var(--ink-3);font-weight:700;margin-bottom:8px">Adhésifs en stock</div><div class="dir-card-num" style="color:var(--brand)">${totalAdh}</div><div style="font-size:12px;color:var(--ink-3)">Références · ${alertsAdh} alertes</div><div class="dir-card-delta ${alertsAdh>0?'delta-down':'delta-up'}">${alertsAdh>0?'⚠️ '+alertsAdh+' à réapprovisionner':'✅ Stocks en ordre'}</div></div>
    <div class="dir-card"><div style="font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:var(--ink-3);font-weight:700;margin-bottom:8px">Réalisations totales</div><div class="dir-card-num" style="color:var(--success)">${realisations.length}</div><div style="font-size:12px;color:var(--ink-3)">Projets enregistrés</div><div class="dir-card-delta delta-up">${realisations.filter(r=>r.status==='Terminé').length} terminées</div></div>
    <div class="dir-card"><div style="font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:var(--ink-3);font-weight:700;margin-bottom:8px">Satisfaction client</div><div class="dir-card-num" style="color:var(--accent)">${avgNote||'—'}/5</div><div style="font-size:12px;color:var(--ink-3)">Sur ${kpiData.length} retours</div></div>
  `;
  // Sectors
  const sectors={};
  realisations.forEach(r=>{sectors[r.sector]=(sectors[r.sector]||0)+1;});
  const total=realisations.length||1;
  const secEl=document.getElementById('dirSectors');
  const secColors={'Transport alimentaire':'var(--success)','Logistique':'var(--brand)','Pharma':'var(--purple)','Distribution':'var(--info)','Autre':'var(--ink-3)'};
  secEl.innerHTML='<div style="display:flex;flex-direction:column;gap:10px">'+
    Object.entries(sectors).sort((a,b)=>b[1]-a[1]).map(([s,c])=>`
      <div><div style="display:flex;justify-content:space-between;font-size:12.5px;font-weight:600;margin-bottom:4px"><span>${esc(s)}</span><span>${c} (${Math.round(c/total*100)}%)</span></div><div class="progress"><div class="progress-fill" style="width:${c/total*100}%;background:${secColors[s]||'var(--ink-3)'}"></div></div></div>
    `).join('')+'</div>';
  if(!Object.keys(sectors).length)secEl.innerHTML='<div style="color:var(--ink-3);font-size:13px;text-align:center;padding:20px">Aucune réalisation enregistrée</div>';
  // Alerts
  const alertEl=document.getElementById('dirAlerts');
  const items=[];
  if(alertsAdh>0)items.push({type:'warn',title:`${alertsAdh} adhésif(s) en stock faible`,desc:'Réapprovisionnement requis'});
  if(+avgNote>0&&+avgNote<4)items.push({type:'warn',title:'Satisfaction en baisse',desc:`Note moy. ${avgNote}/5 — sous le seuil`});
  if(+avgNote>=4.5)items.push({type:'success',title:'Excellente satisfaction',desc:`Note moy. ${avgNote}/5`});
  if(realisations.length>0)items.push({type:'info',title:`${realisations.length} réalisations enregistrées`,desc:'Données à jour'});
  const colors={success:'var(--success)',warn:'var(--warn)',info:'var(--info)'};
  const bgs={success:'var(--success-soft)',warn:'var(--warn-soft)',info:'var(--info-soft)'};
  alertEl.innerHTML=items.map(i=>`<div style="padding:12px 14px;background:${bgs[i.type]};border-radius:var(--r-m);border:1px solid ${colors[i.type]};margin-bottom:8px"><div style="font-size:12px;font-weight:700;color:${colors[i.type]};margin-bottom:2px">${i.title}</div><div style="font-size:12px;color:var(--ink-2)">${i.desc}</div></div>`).join('')||'<div style="color:var(--ink-3);font-size:13px;padding:10px">Aucune alerte</div>';
  renderAccountsPanel();
}

