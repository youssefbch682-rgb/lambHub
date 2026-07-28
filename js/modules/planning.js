// ============================================================
// MODULE — PLANNING (import Excel, édition, export, impression)
// ============================================================
let planningStore=null; // {sheets:[{name,rows:[[..]],colors:{"r_c":"#hex"}}], active:0}
let planLastCell=null; // {r,c}

// Le planning vit désormais dans IndexedDB (feuilles Excel volumineuses).
// planningStore est chargé une fois au démarrage puis maintenu en mémoire.
async function initPlanning(){
  try{
    const v=await IDB.kvGet('planning');
    planningStore=v!=null?v:null;
  }catch(e){ console.warn('[Planning] lecture serveur impossible',e); planningStore=null; }
}
function loadPlanning(){ /* no-op : planningStore est déjà en mémoire (chargé par initPlanning au démarrage) */ }
function savePlanning(){ IDB.kvSet('planning',planningStore).then(()=>broadcastSync('planning')).catch(e=>storageError(e,'planning:save')); }

function handlePlanningFile(file){
  if(!file)return;
  if(typeof XLSX==='undefined'){showToast('Bibliothèque Excel non chargée — vérifiez la connexion internet','error');return;}
  const reader=new FileReader();
  reader.onload=e=>{
    try{
      const wb=XLSX.read(new Uint8Array(e.target.result),{type:'array'});
      const sheets=wb.SheetNames.map(name=>{
        const ws=wb.Sheets[name];
        let rows=XLSX.utils.sheet_to_json(ws,{header:1,raw:false,defval:''});
        // normalize row lengths
        const maxCols=rows.reduce((m,r)=>Math.max(m,r.length),1);
        rows=rows.map(r=>{ const row=r.slice(0,maxCols); while(row.length<maxCols)row.push(''); return row; });
        if(rows.length===0)rows=[['','','']];
        // capture cell fill colors when available
        const colors={};
        Object.keys(ws).forEach(addr=>{
          if(addr[0]==='!')return;
          const cell=ws[addr];
          const fill=cell&&cell.s&&cell.s.fgColor&&cell.s.fgColor.rgb;
          if(fill){
            const ref=XLSX.utils.decode_cell(addr);
            colors[`${ref.r}_${ref.c}`]='#'+fill.slice(-6);
          }
        });
        return {name,rows,colors};
      });
      planningStore={sheets,active:0};
      savePlanning();
      renderPlanning();
      showToast(`Planning importé — ${sheets.length} feuille(s)`,'success');
    }catch(err){
      showToast('Erreur de lecture du fichier Excel : '+err.message,'error');
    }
  };
  reader.onerror=()=>showToast('Impossible de lire le fichier','error');
  reader.readAsArrayBuffer(file);
  document.getElementById('fileImportPlanning').value='';
}

function renderPlanning(){
  loadPlanning();
  const empty=document.getElementById('planningEmpty');
  const content=document.getElementById('planningContent');
  if(!planningStore||!planningStore.sheets||!planningStore.sheets.length){
    empty.style.display='block'; content.style.display='none'; return;
  }
  empty.style.display='none'; content.style.display='block';
  // sheet tabs
  const tabsEl=document.getElementById('planSheetTabs');
  tabsEl.innerHTML=planningStore.sheets.map((s,i)=>`<div class="plan-sheet-tab${i===planningStore.active?' active':''}" onclick="planSwitchSheet(${i})">${s.name}</div>`).join('');
  renderPlanningTable();
}

function planSwitchSheet(i){
  planningStore.active=i;
  savePlanning();
  renderPlanning();
}

function renderPlanningTable(){
  if(!planningStore)return;
  const sheet=planningStore.sheets[planningStore.active];
  if(!sheet)return;
  const search=(document.getElementById('planSearch')?.value||'').toLowerCase();
  const wrap=document.getElementById('planTableWrap');
  const rows=sheet.rows;
  const nCols=rows[0]?rows[0].length:1;
  // populate category filter from header row (first row) options, distinct values from col 0 below header
  const catSel=document.getElementById('planCatFilter');
  if(catSel){
    const distinct=[...new Set(rows.slice(1).map(r=>r[0]).filter(Boolean))];
    const prev=catSel.value;
    catSel.innerHTML='<option value="">Toutes catégories</option>'+distinct.map(c=>`<option value="${esc(c)}"${c===prev?' selected':''}>${esc(c)}</option>`).join('');
  }
  const cat=catSel?catSel.value:'';
  let html='<table class="plan-table"><thead><tr><th class="rowhead">#</th>';
  for(let c=0;c<nCols;c++){
    html+=`<th>${esc((rows[0]&&rows[0][c])||('Col '+(c+1)))}<span class="plan-coldel" onclick="planDeleteCol(${c})" title="Supprimer colonne"> ✕</span></th>`;
  }
  html+='</tr></thead><tbody>';
  for(let r=1;r<rows.length;r++){
    const row=rows[r];
    if(search&&!row.some(v=>(v+'').toLowerCase().includes(search)))continue;
    if(cat&&row[0]!==cat)continue;
    html+=`<tr><td class="rowhead">${r}<span class="plan-rowdel" onclick="planDeleteRow(${r})" title="Supprimer ligne"> ✕</span></td>`;
    for(let c=0;c<nCols;c++){
      const val=row[c]!==undefined?row[c]:'';
      const bg=sheet.colors&&sheet.colors[`${r}_${c}`]?` style="background:${sheet.colors[`${r}_${c}`]}"`:'';
      html+=`<td${bg} onclick="planSetLastCell(${r},${c})"><input class="plan-cell" value="${esc(val)}" oninput="planEditCell(${r},${c},this.value)"></td>`;
    }
    html+='</tr>';
  }
  html+='</tbody></table>';
  wrap.innerHTML=html;
}

function planSetLastCell(r,c){ planLastCell={r,c}; }

function planEditCell(r,c,val){
  const sheet=planningStore.sheets[planningStore.active];
  if(!sheet.rows[r])sheet.rows[r]=[];
  sheet.rows[r][c]=val;
  savePlanning();
}

function planAddRow(){
  const sheet=planningStore.sheets[planningStore.active];
  const nCols=sheet.rows[0]?sheet.rows[0].length:3;
  sheet.rows.push(new Array(nCols).fill(''));
  savePlanning(); renderPlanningTable();
  showToast('Ligne ajoutée','success');
}
function planDeleteRow(r){
  showConfirm('Supprimer cette ligne ?','Cette action est irréversible.',()=>{
    const sheet=planningStore.sheets[planningStore.active];
    sheet.rows.splice(r,1);
    savePlanning(); renderPlanningTable();
    showToast('Ligne supprimée','success');
  });
}
function planAddCol(){
  const sheet=planningStore.sheets[planningStore.active];
  sheet.rows.forEach(row=>row.push(''));
  savePlanning(); renderPlanningTable();
  showToast('Colonne ajoutée','success');
}
function planDeleteCol(c){
  showConfirm('Supprimer cette colonne ?','Cette action est irréversible.',()=>{
    const sheet=planningStore.sheets[planningStore.active];
    sheet.rows.forEach(row=>row.splice(c,1));
    // shift colors
    const newColors={};
    Object.entries(sheet.colors||{}).forEach(([k,v])=>{
      const [r,cc]=k.split('_').map(Number);
      if(cc===c)return;
      newColors[`${r}_${cc>c?cc-1:cc}`]=v;
    });
    sheet.colors=newColors;
    savePlanning(); renderPlanningTable();
    showToast('Colonne supprimée','success');
  });
}
function planApplyColor(hex){
  if(!planLastCell){showToast('Cliquez d\'abord sur une cellule','warn');return;}
  const sheet=planningStore.sheets[planningStore.active];
  if(!sheet.colors)sheet.colors={};
  sheet.colors[`${planLastCell.r}_${planLastCell.c}`]=hex;
  savePlanning(); renderPlanningTable();
}

function printPlanning(){
  window.print();
}

function exportPlanningExcel(){
  if(typeof XLSX==='undefined'){showToast('Bibliothèque Excel non chargée','error');return;}
  const wb=XLSX.utils.book_new();
  planningStore.sheets.forEach(s=>{
    const ws=XLSX.utils.aoa_to_sheet(s.rows);
    XLSX.utils.book_append_sheet(wb,ws,s.name.slice(0,31));
  });
  XLSX.writeFile(wb,'planning-lamberet-'+new Date().toISOString().slice(0,10)+'.xlsx');
  showToast('Planning exporté en Excel','success');
}

function exportPlanningPDF(){
  showToast('Choisissez "Enregistrer au format PDF" dans la fenêtre d\'impression','warn');
  setTimeout(()=>window.print(),400);
}

