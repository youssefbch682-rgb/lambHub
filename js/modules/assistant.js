// ============================================================
// MODULE 6 — ASSISTANT IA
// ============================================================
function renderAIStatus(){
  loadAllData();
  const el=document.getElementById('aiDataStatus');
  if(!el)return;
  const docsCount=DocStorage.getAll().filter(d=>!d.archived).length;
  el.innerHTML=[
    ['Adhésifs',adhesifs.length,'références'],['Réalisations',realisations.length,'projets'],
    ['Retours KPI',kpiData.length,'entrées'],['Publications',socialData.length,'posts'],
    ['Maquettes',maquettes.length,'fonds'],['Documents',docsCount,'fichiers']
  ].map(([l,v,u])=>`<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 8px;background:var(--surface-2);border-radius:var(--r-xs)"><span>${l}</span><span style="font-weight:700;color:var(--brand)">${v} ${u}</span></div>`).join('');
  // Restaure la config IA dans les champs
  const cfg=getAIConfig();
  const epI=document.getElementById('aiEndpointInput');
  const tkI=document.getElementById('aiTokenInput');
  if(epI)epI.value=cfg.endpoint;
  if(tkI)tkI.value=cfg.token;
  updateAIConnStatus();
}

const PROMPT_MAX_ITEMS=80; // borne chaque liste injectée dans le prompt pour maîtriser coût et latence
function capList(arr){ return arr.length>PROMPT_MAX_ITEMS?arr.slice(-PROMPT_MAX_ITEMS):arr; }

function buildSystemPrompt(){
  const adhesifsSummary=capList(adhesifs).map(a=>`- ${a.ref||'?'} ${a.name} : fournisseur ${a.supplier||'?'}, emplacement ${a.loc||'?'}, ${a.qty} rouleaux, longueur ${a.length||0}m, seuil alerte ${a.min||5}, statut ${+a.qty<=(+a.min||5)?'STOCK FAIBLE':'OK'}`).join('\n');
  const realSummary=capList(realisations).map(r=>`- ${r.client} : ${r.type}, ${r.qty} véhicules, secteur ${r.sector}, année ${r.year}, statut ${r.status}, couleurs ${r.color1} / ${r.color2}, tags: ${(r.tags||[]).join(', ')}`).join('\n');
  const kpiSummary=kpiData.length?`Note moy: ${(kpiData.reduce((s,k)=>s+ +k.note,0)/kpiData.length).toFixed(1)}/5, Retouches moy: ${(kpiData.reduce((s,k)=>s+ +k.retouches,0)/kpiData.length).toFixed(1)}, Délai moy: ${(kpiData.reduce((s,k)=>s+ +k.delay,0)/kpiData.length).toFixed(1)}j, ${kpiData.length} retours`:'Aucune donnée KPI';
  const socialSummary=capList(socialData).map(p=>`- ${p.network} | ${p.date} | "${p.theme}" | portée ${p.reach}, ${p.interactions} interactions`).join('\n');
  const maqSummary=capList(maquettes).map(m=>`- ${m.name} : ${m.type}, ${m.version||'?'}, statut ${m.status}, MAJ ${m.date||'?'}`).join('\n');
  const docsMeta=capList(DocStorage.getAll().filter(d=>!d.archived)).map(d=>`- ${d.originalName} : client ${d.client||'?'}, catégorie ${d.category||'?'}, véhicule ${d.vehicle||'?'}, tags: ${(d.tags||[]).join(', ')||'—'}`).join('\n');
  return `Tu es l'assistant intelligent du Lamberet Decoration Hub, application interne du secteur décoration de Lamberet (leader européen des carrosseries frigorifiques).

ADHÉSIFS EN STOCK (${adhesifs.length} références) :
${adhesifsSummary||'Aucun adhésif enregistré.'}

RÉALISATIONS CLIENTS (${realisations.length} projets) :
${realSummary||'Aucune réalisation enregistrée.'}

KPI SATISFACTION :
${kpiSummary}

RÉSEAUX SOCIAUX (${socialData.length} publications) :
${socialSummary||'Aucune publication enregistrée.'}

FONDS DE MAQUETTE (${maquettes.length} fonds) :
${maqSummary||'Aucun fond enregistré.'}

BIBLIOTHÈQUE DOCUMENTAIRE (${DocStorage.getAll().filter(d=>!d.archived).length} fichiers) :
${docsMeta||'Aucun document importé.'}

Réponds en français, de manière concise et structurée. Utilise des emojis pour la lisibilité. Si tu trouves des résultats, liste-les clairement avec les détails pertinents. Ne réponds qu'à partir des données ci-dessus.`;
}

// ============================================================
// CONNEXION IA — via un backend proxy (la clé API reste côté serveur, jamais ici)
// Déploiement : voir lamberet-ai-worker.js (Cloudflare Workers)
// ============================================================
const AI_CFG_KEYS={endpoint:'ldh_ai_endpoint',token:'ldh_ai_token'};
function getAIConfig(){
  return {endpoint:(localStorage.getItem(AI_CFG_KEYS.endpoint)||'').trim(),token:(localStorage.getItem(AI_CFG_KEYS.token)||'').trim()};
}
function saveAIConfig(){
  const ep=document.getElementById('aiEndpointInput').value.trim();
  const tk=document.getElementById('aiTokenInput').value.trim();
  if(ep&&!/^https:\/\//.test(ep)){showToast('L\'URL du proxy doit commencer par https://','error');return;}
  localStorage.setItem(AI_CFG_KEYS.endpoint,ep);
  localStorage.setItem(AI_CFG_KEYS.token,tk);
  updateAIConnStatus();
  showToast(ep?'Connexion IA enregistrée':'Connexion IA désactivée — moteur local','success');
}
async function testAIConnection(){
  const cfg=getAIConfig();
  const st=document.getElementById('aiConfigStatus');
  if(!cfg.endpoint){st.textContent='Aucune URL configurée.';return;}
  st.textContent='Test en cours…';
  try{
    const text=await askClaudeAPI(cfg,'Tu es un assistant de test.',[{role:'user',content:'Réponds uniquement : OK'}],10000);
    st.textContent=text?'✅ Connexion réussie — l\'assistant utilisera Claude.':'⚠️ Réponse vide du proxy.';
  }catch(e){
    st.textContent='❌ Échec : '+e.message;
  }
  updateAIConnStatus();
}
function updateAIConnStatus(){
  const el=document.getElementById('aiConnStatus');
  if(!el)return;
  const cfg=getAIConfig();
  el.textContent=cfg.endpoint?'Connecté à Claude via proxy · Données de l\'application':'Moteur local · Données de l\'application';
}

// Appel au proxy avec timeout. Le proxy transmet à l'API Anthropic (modèle claude-sonnet-4-6).
async function askClaudeAPI(cfg,system,messages,timeoutMs=45000){
  const ctrl=new AbortController();
  const t=setTimeout(()=>ctrl.abort(),timeoutMs);
  try{
    const headers={'Content-Type':'application/json'};
    if(cfg.token)headers['Authorization']='Bearer '+cfg.token;
    const resp=await fetch(cfg.endpoint,{method:'POST',headers,body:JSON.stringify({system,messages}),signal:ctrl.signal});
    if(!resp.ok){
      let detail='';
      try{detail=(await resp.json()).error||'';}catch(e){}
      throw new Error('HTTP '+resp.status+(detail?' — '+detail:''));
    }
    const data=await resp.json();
    if(typeof data.text!=='string')throw new Error('Réponse du proxy invalide');
    return data.text;
  }catch(e){
    if(e.name==='AbortError')throw new Error('Délai dépassé ('+Math.round(timeoutMs/1000)+'s)');
    throw e;
  }finally{clearTimeout(t);}
}

// Historique de conversation (multi-tours) — borné pour maîtriser le coût
let chatHistory=[];
const CHAT_HISTORY_MAX=12;

async function sendMessage(text){
  if(!text.trim())return;
  addMsg(text,true);
  chatHistory.push({role:'user',content:text});
  if(chatHistory.length>CHAT_HISTORY_MAX)chatHistory=chatHistory.slice(-CHAT_HISTORY_MAX);
  const typing=addTyping();
  loadAllData();
  const cfg=getAIConfig();
  if(cfg.endpoint){
    try{
      const reply=await askClaudeAPI(cfg,buildSystemPrompt(),chatHistory);
      typing.remove();
      addMsg(reply);
      chatHistory.push({role:'assistant',content:reply});
      return;
    }catch(e){
      typing.remove();
      const fallback=localAIFallback(text);
      addMsg('⚠️ IA distante injoignable ('+e.message+') — réponse du moteur local :\n\n'+fallback);
      chatHistory.push({role:'assistant',content:fallback});
      return;
    }
  }
  // Pas de proxy configuré : moteur local par mots-clés
  setTimeout(()=>{
    typing.remove();
    const reply=localAIFallback(text);
    addMsg(reply);
    chatHistory.push({role:'assistant',content:reply});
  },350);
}

function localAIFallback(text){
  const q=text.toLowerCase();
  loadAllData();
  const docs=(typeof DocStorage!=='undefined')?DocStorage.getAll():[];

  // "Où se trouve l'adhésif [couleur] ?"
  const colorMatch=['blanc','bleu','rouge','vert','noir','orange','jaune','gris','violet','rose'].find(c=>q.includes(c));
  if(q.includes('où') && (q.includes('adhésif')||q.includes('adhesif')||colorMatch)){
    let found=adhesifs;
    if(colorMatch)found=adhesifs.filter(a=>(a.color||'').toLowerCase().includes(colorMatch)||(a.name||'').toLowerCase().includes(colorMatch));
    if(!found.length)return `❓ Je ne trouve aucun adhésif${colorMatch?' '+colorMatch:''} correspondant dans le stock.`;
    return `📍 Emplacement(s) trouvé(s) :\n`+found.map(a=>`• ${a.name} (${a.ref}) — Zone ${a.zone||'?'} / Étagère ${a.rack||'?'} / Emplacement ${a.loc} — ${a.qty} rouleaux`).join('\n');
  }

  // "Quels fichiers contiennent PO ?" (ou SR / VUL / un mot-clé de nom de fichier)
  if(q.includes('fichier')&&(q.includes('contiennent')||q.includes('contenant')||q.includes('nommé'))){
    const kwMatch=q.match(/\b(po|sr|vul|frigo|hayon|easy|fast)\b/);
    const kw=kwMatch?kwMatch[1].toUpperCase():null;
    const found=kw?docs.filter(d=>(d.originalName||'').toUpperCase().includes(kw)||(d.tags||[]).some(t=>t.toUpperCase().includes(kw))):docs;
    if(!found.length)return `❓ Aucun fichier${kw?' contenant "'+kw+'"':''} trouvé dans la bibliothèque de documents.`;
    return `📁 ${found.length} fichier(s) trouvé(s)${kw?' contenant "'+kw+'"':''} :\n`+found.slice(0,10).map(d=>`• ${d.originalName} — ${d.client||'client inconnu'} · ${d.category}`).join('\n');
  }

  // "Quels projets sont des porteurs ?"
  if(q.includes('porteur')||q.includes('semi-remorque')||q.includes('semi remorque')||(q.includes('vul'))){
    const vehicle=q.includes('porteur')?'Porteur':(q.includes('vul')?'Véhicule utilitaire léger':'Semi-remorque');
    const found=docs.filter(d=>d.vehicle===vehicle||(d.tags||[]).includes(vehicle));
    if(!found.length)return `❓ Aucun fichier/projet classé "${vehicle}" pour le moment.`;
    return `🚛 ${found.length} fichier(s) classé(s) "${vehicle}" :\n`+found.slice(0,10).map(d=>`• ${d.originalName} — ${d.client||'?'}`).join('\n');
  }

  // "Quels fonds de maquette sont obsolètes ?"
  if(q.includes('maquette')&&(q.includes('obsolète')||q.includes('obsolete')||q.includes('périmé'))){
    const found=maquettes.filter(m=>(m.status||'').toLowerCase().includes('obsolète')||(m.status||'').toLowerCase().includes('archivé'));
    if(!found.length)return '✅ Aucun fond de maquette marqué comme obsolète actuellement.';
    return `🖼️ ${found.length} fond(s) obsolète(s) :\n`+found.map(m=>`• ${m.name} (${m.type}) — statut : ${m.status}`).join('\n');
  }

  // "Quels clients ont donné une note inférieure à 3 ?"
  if(q.includes('note')&&(q.includes('inférieur')||q.includes('inferieur')||q.includes('moins de')||/note.*[123]/.test(q))){
    const threshold=3;
    const found=kpiData.filter(k=>+k.note<threshold);
    if(!found.length)return `✅ Aucun client n'a donné de note inférieure à ${threshold}/5.`;
    return `⚠️ ${found.length} retour(s) avec une note < ${threshold}/5 :\n`+found.map(k=>`• ${k.client||'Client'} — note ${k.note}/5${k.comment?' · "'+k.comment+'"':''}`).join('\n');
  }

  // "Quels projets ont le plus de retouches ?"
  if(q.includes('retouche')){
    if(!kpiData.length)return '📊 Aucune donnée de retouches enregistrée.';
    const sorted=[...kpiData].sort((a,b)=>(+b.retouches||0)-(+a.retouches||0)).slice(0,5);
    return `🔁 Projets avec le plus de retouches :\n`+sorted.map(k=>`• ${k.client||'Client'} — ${k.retouches||0} retouche(s)`).join('\n');
  }

  // "Quels fichiers ont été importés cette semaine ?"
  if(q.includes('importé')&&(q.includes('semaine')||q.includes('récemment')||q.includes('recent'))){
    const weekAgo=Date.now()-7*24*3600*1000;
    const found=docs.filter(d=>d.importedAt&&new Date(d.importedAt).getTime()>=weekAgo);
    if(!found.length)return '📁 Aucun fichier importé au cours des 7 derniers jours.';
    return `📁 ${found.length} fichier(s) importé(s) cette semaine :\n`+found.map(d=>`• ${d.originalName} — ${new Date(d.importedAt).toLocaleDateString('fr-FR')}`).join('\n');
  }

  // "Quels fournisseurs sont les plus utilisés ?"
  if(q.includes('fournisseur')){
    if(!adhesifs.length)return '📦 Aucun adhésif enregistré pour analyser les fournisseurs.';
    const counts={};
    adhesifs.forEach(a=>{ const s=a.supplier||'Non renseigné'; counts[s]=(counts[s]||0)+1; });
    const sorted=Object.entries(counts).sort((a,b)=>b[1]-a[1]);
    return `🏭 Fournisseurs par nombre de références :\n`+sorted.map(([s,n])=>`• ${s} — ${n} référence(s)`).join('\n');
  }

  // "Donne-moi un résumé complet du secteur décoration."
  if(q.includes('résumé')||q.includes('resume')){
    const low=adhesifs.filter(a=>+a.qty<=(+a.min||5));
    const avg=kpiData.length?(kpiData.reduce((s,k)=>s+ +k.note,0)/kpiData.length).toFixed(1):'—';
    return `📊 Résumé Lamberet Decoration Hub :\n• ${adhesifs.length} référence(s) d'adhésifs (${low.length} en alerte)\n• ${realisations.length} réalisation(s) client\n• ${docs.length} fichier(s) en bibliothèque documentaire\n• ${maquettes.length} fond(s) de maquette\n• Note de satisfaction moyenne : ${avg}/5\n• ${socialData.length} publication(s) réseaux sociaux`;
  }

  // Stock faible / alerte générique
  if(q.includes('stock faible')||q.includes('alerte')){
    const low=adhesifs.filter(a=>+a.qty<=(+a.min||5));
    if(!low.length)return'✅ Aucun adhésif en stock faible actuellement.';
    return'⚠️ Adhésifs en stock faible :\n'+low.map(a=>`• ${a.name} (${a.ref}) : ${a.qty} rouleaux - Emplacement ${a.loc}`).join('\n');
  }
  if(q.includes('réalisation')||q.includes('projet')){
    if(!realisations.length)return'📋 Aucune réalisation enregistrée pour l\'instant.';
    return`📋 ${realisations.length} réalisation(s) enregistrée(s) :\n`+realisations.slice(-5).map(r=>`• ${r.client} — ${r.type}, ${r.year}`).join('\n');
  }
  if(q.includes('satisfaction')||q.includes('note')||q.includes('kpi')){
    if(!kpiData.length)return'⭐ Aucun retour KPI enregistré.';
    const avg=(kpiData.reduce((s,k)=>s+ +k.note,0)/kpiData.length).toFixed(1);
    return`⭐ Note de satisfaction moyenne : ${avg}/5 sur ${kpiData.length} retour(s).`;
  }
  if(q.includes('maquette')||q.includes('fond')){
    if(!maquettes.length)return'🖼️ Aucun fond de maquette enregistré.';
    return`🖼️ ${maquettes.length} fond(s) de maquette :\n`+maquettes.map(m=>`• ${m.name} (${m.type}) — ${m.status}`).join('\n');
  }
  return`Je n'ai pas assez de données pour répondre précisément à cette question. Je dispose de : ${adhesifs.length} adhésifs, ${realisations.length} réalisations, ${docs.length} fichiers, ${kpiData.length} retours KPI, ${maquettes.length} maquettes, ${socialData.length} publications. Essayez une question plus précise, ou utilisez les suggestions ci-contre.`;
}

function addMsg(text,isUser=false){
  const msgs=document.getElementById('chatMsgs');
  const div=document.createElement('div');
  div.className='msg'+(isUser?' msg-user':'');
  div.innerHTML=`<div class="msg-avatar ${isUser?'msg-user-av':'msg-bot-av'}">${isUser?'CM':'IA'}</div><div class="msg-bubble">${esc(text).replace(/\n/g,'<br>')}</div>`;
  msgs.appendChild(div);
  msgs.scrollTop=msgs.scrollHeight;
}
function addTyping(){
  const msgs=document.getElementById('chatMsgs');
  const div=document.createElement('div');div.className='msg';div.id='typing';
  div.innerHTML=`<div class="msg-avatar msg-bot-av">IA</div><div class="msg-bubble"><div class="typing-dot"><span></span><span></span><span></span></div></div>`;
  msgs.appendChild(div);msgs.scrollTop=msgs.scrollHeight;return div;
}
function clearChat(){
  chatHistory=[];
  document.getElementById('chatMsgs').innerHTML=`<div class="msg"><div class="msg-avatar msg-bot-av">IA</div><div class="msg-bubble">Nouvelle conversation 👋 Comment puis-je vous aider ?</div></div>`;
}
function askAI(text){
  goTo('assistant');
  setTimeout(()=>{sendMessage(text);},100);
}

document.getElementById('chatSend').addEventListener('click',()=>{
  const inp=document.getElementById('chatInput');
  sendMessage(inp.value);inp.value='';inp.style.height='auto';
});
document.getElementById('chatInput').addEventListener('keydown',e=>{
  if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();const inp=e.target;sendMessage(inp.value);inp.value='';inp.style.height='auto';}
});
document.getElementById('chatInput').addEventListener('input',function(){this.style.height='auto';this.style.height=Math.min(this.scrollHeight,120)+'px';});

