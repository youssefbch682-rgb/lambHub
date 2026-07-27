// ============================================================
// MODULE 3 — KPI
// ============================================================
function renderKPI(){
  loadAllData();
  const total=kpiData.length;
  const avgNote=total?(kpiData.reduce((s,k)=>s+ +k.note,0)/total).toFixed(2):0;
  const avgRetouches=total?(kpiData.reduce((s,k)=>s+ +k.retouches,0)/total).toFixed(1):0;
  const avgDelay=total?(kpiData.reduce((s,k)=>s+ +k.delay,0)/total).toFixed(1):0;
  const tauxSat=total?((kpiData.filter(k=>+k.note>=4).length/total)*100).toFixed(0):0;
  document.getElementById('kpiGrid').innerHTML=`
    <div class="kpi-card c-success"><div class="kpi-header"><span class="kpi-label">Note moyenne</span></div><div class="kpi-val">${avgNote||'—'}</div><div class="kpi-delta delta-neutral">sur 5 · ${total} retours</div></div>
    <div class="kpi-card"><div class="kpi-header"><span class="kpi-label">Taux satisfaction</span></div><div class="kpi-val">${tauxSat||'—'}${total?'%':''}</div><div class="kpi-delta ${+tauxSat>=80?'delta-up':'delta-down'}">Note ≥ 4/5</div></div>
    <div class="kpi-card c-warn"><div class="kpi-header"><span class="kpi-label">Retouches moy.</span></div><div class="kpi-val">${avgRetouches||'—'}</div><div class="kpi-delta delta-neutral">Objectif : 1.0</div></div>
    <div class="kpi-card"><div class="kpi-header"><span class="kpi-label">Délai validation</span></div><div class="kpi-val">${avgDelay||'—'}</div><div class="kpi-delta delta-neutral">${total?'jours en moyenne':''}</div></div>
  `;
  // Critères
  const critEl=document.getElementById('kpiCriteres');
  if(total===0){critEl.innerHTML='<div style="text-align:center;padding:20px;color:var(--ink-3)">Aucune donnée</div>';}
  else{
    const noteSat=+avgNote/5*100;
    const noteRet=Math.max(0,100-(+avgRetouches/3*100));
    const noteDel=Math.max(0,100-(+avgDelay/10*100));
    critEl.innerHTML=`
      <div style="display:flex;flex-direction:column;gap:12px">
        ${[['Note globale',noteSat.toFixed(0),'%','var(--success)'],['Zéro retouche',noteRet.toFixed(0),'%','var(--info)'],['Délai maîtrisé',noteDel.toFixed(0),'%','var(--brand)']].map(([l,v,u,c])=>`
          <div>
            <div style="display:flex;justify-content:space-between;font-size:12.5px;font-weight:600;margin-bottom:5px"><span>${l}</span><span>${v}${u}</span></div>
            <div class="progress"><div class="progress-fill" style="width:${Math.min(100,+v)}%;background:${c}"></div></div>
          </div>`).join('')}
      </div>`;
  }
  // Bar viz mensuel
  const months=['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
  const byMonth=Array(12).fill(null).map((_,i)=>{
    const month=kpiData.filter(k=>{const d=new Date(k.date);return d.getMonth()===i;});
    return month.length?month.reduce((s,k)=>s+ +k.note,0)/month.length:null;
  });
  const maxVal=Math.max(...byMonth.filter(Boolean),5);
  document.getElementById('kpiBarViz').innerHTML=byMonth.map((v,i)=>`
    <div class="bar-viz-col">
      <div class="bar-viz-bar" style="height:${v?Math.max(10,(v/maxVal*90))+'%':'4px'};background:${v?'var(--brand)':'var(--surface-3)'}"></div>
      <div class="bar-viz-lbl">${months[i]}</div>
    </div>
  `).join('');
  // Feedback list
  const fl=document.getElementById('kpiFeedbackList');
  const emp=document.getElementById('kpiEmptyState');
  if(total===0){fl.innerHTML='';if(emp)emp.style.display='block';return;}
  if(emp)emp.style.display='none';
  fl.innerHTML=`<div style="display:flex;flex-direction:column;gap:10px">
    <div style="margin-bottom:8px"><button class="btn btn-ghost btn-sm" onclick="openKPIModal()">+ Ajouter un retour client</button></div>
    ${kpiData.slice().reverse().map(_k=>{const k=escObj(_k);return `
      <div class="feedback-card">
        <div class="feedback-header">
          <span class="feedback-client">${k.client}${k.project?' — '+k.project:''}</span>
          <span class="stars">${'★'.repeat(Math.round(+k.note))}${'☆'.repeat(5-Math.round(+k.note))}</span>
        </div>
        ${k.comment?`<div class="feedback-text">${k.comment}</div>`:''}
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div class="feedback-date">${k.date||'—'} · ${k.vehicles||'—'} véh. · ${k.retouches} retouche(s) · Délai : ${k.delay}j</div>
          <div style="display:flex;gap:6px">
            <button class="btn btn-ghost btn-sm" onclick="openKPIModal(kpiData.find(x=>x.id==='${k.id}'))">✏️</button>
            <button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="deleteItem('kpi','${k.id}')">🗑️</button>
          </div>
        </div>
      </div>`;}).join('')}
  </div>`;
}

function openKPIModal(k){
  document.getElementById('kpiModalTitle').textContent=k?'Modifier le retour':'Ajouter un retour client';
  document.getElementById('kpiId').value=k?k.id:'';
  ['client','project','note','retouches','delay','date','comment','vehicles'].forEach(f=>{
    const el=document.getElementById(`kpi_${f}`);
    if(el)el.value=k?k[f]||'':'';
  });
  if(!k)document.getElementById('kpi_date').value=new Date().toISOString().slice(0,10);
  openModal('kpi');
}

function saveKpi(){
  const client=document.getElementById('kpi_client').value.trim();
  const note=+document.getElementById('kpi_note').value;
  if(!client){showToast('Nom du client obligatoire','error');return;}
  if(!note||note<1||note>5){showToast('Note invalide (1-5)','error');return;}
  const id=document.getElementById('kpiId').value||uid();
  const obj={id,client,
    project:document.getElementById('kpi_project').value,
    note,retouches:+document.getElementById('kpi_retouches').value||0,
    delay:+document.getElementById('kpi_delay').value||0,
    date:document.getElementById('kpi_date').value,
    comment:document.getElementById('kpi_comment').value,
    vehicles:document.getElementById('kpi_vehicles').value||1
  };
  loadAllData();
  const idx=kpiData.findIndex(k=>k.id===id);
  if(idx>=0)kpiData[idx]=obj;else kpiData.push(obj);
  save('kpi',kpiData);
  closeModal('kpi');
  renderKPI();renderDashboard();
  showToast('Retour client enregistré','success');
}

// Questionnaire
let qStarVal=0;
function setStarRating(v){
  qStarVal=v;
  document.getElementById('q_note').value=v;
  document.querySelectorAll('#q_note_stars .star-btn').forEach((b,i)=>b.classList.toggle('active',i<v));
}

function selectRadio(field,val,el){
  document.getElementById(field).value=val;
  document.querySelectorAll(`#${field}_group .radio-opt`).forEach(o=>o.classList.remove('selected'));
  el.classList.add('selected');
}

function openQuestionnaireModal(){
  qStarVal=0;
  document.querySelectorAll('#q_note_stars .star-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('q_note').value=0;
  ['client','project','comment','vehicles'].forEach(f=>{const el=document.getElementById('q_'+f);if(el)el.value='';});
  ['q_visuel','q_identite','q_delai','q_modifs'].forEach(f=>{
    document.getElementById(f).value='';
    document.querySelectorAll(`#${f}_group .radio-opt`).forEach(o=>o.classList.remove('selected'));
  });
  openModal('questionnaire');
}

function saveQuestionnaire(){
  const client=document.getElementById('q_client').value.trim();
  const note=+document.getElementById('q_note').value;
  if(!client){showToast('Nom du client obligatoire','error');return;}
  if(!note){showToast('Veuillez sélectionner une note','error');return;}
  const modifs=document.getElementById('q_modifs').value;
  const retouchesMap={'Non, aucune':0,'1 à 2':1,'3 à 5':3,'Plus de 5':6};
  const retouches=retouchesMap[modifs]||0;
  loadAllData();
  kpiData.push({id:uid(),client,
    project:document.getElementById('q_project').value,
    note,retouches,delay:0,
    comment:document.getElementById('q_comment').value,
    vehicles:document.getElementById('q_vehicles').value||1,
    date:new Date().toISOString().slice(0,10)
  });
  save('kpi',kpiData);
  closeModal('questionnaire');
  renderKPI();renderDashboard();
  showToast('Questionnaire enregistré 🎉','success');
}

