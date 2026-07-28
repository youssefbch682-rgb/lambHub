// ============================================================
// MODULE — COMPTES ÉQUIPE (admin uniquement)
// Panneau visible sur la page Direction, permet de créer des comptes,
// changer leur rôle, et surtout d'activer/désactiver l'accès à tout
// moment (révocation immédiate, cf. server/src/middleware/auth.js).
// ============================================================
const ROLE_LABELS={admin:'Admin',editeur:'Éditeur',lecteur:'Lecteur'};

async function renderAccountsPanel(){
  const panel=document.getElementById('accountsPanel');
  const user=getCurrentUser();
  if(!user||user.role!=='admin'){ panel.style.display='none'; return; }
  panel.style.display='';

  const listEl=document.getElementById('accountsList');
  listEl.innerHTML='<div style="padding:16px;color:var(--ink-3);font-size:13px">Chargement…</div>';
  try{
    const users=await Api.listUsers();
    listEl.innerHTML=users.map(u=>`
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid var(--line-2)">
        <div>
          <div style="font-weight:600;font-size:13.5px">${esc(u.email)}</div>
          <div style="font-size:11.5px;color:var(--ink-3)">Créé le ${esc((u.created_at||'').slice(0,10))}</div>
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          <select onchange="changeAccountRole(${u.id},this.value)" style="padding:4px 8px;border:1px solid var(--line);border-radius:var(--r-s);font-size:12.5px" ${u.id===user.id?'disabled title="Tu ne peux pas changer ton propre rôle"':''}>
            ${['lecteur','editeur','admin'].map(r=>`<option value="${r}" ${r===u.role?'selected':''}>${ROLE_LABELS[r]}</option>`).join('')}
          </select>
          <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--ink-2);cursor:pointer">
            <input type="checkbox" ${u.active?'checked':''} onchange="toggleAccountActive(${u.id},this.checked)" ${u.id===user.id?'disabled title="Tu ne peux pas te désactiver toi-même"':''}>
            Accès actif
          </label>
          <button class="btn btn-ghost btn-sm" onclick="deleteAccount(${u.id},'${esc(u.email)}')" ${u.id===user.id?'disabled':''} title="Supprimer le compte">🗑</button>
        </div>
      </div>
    `).join('') || '<div style="padding:16px;color:var(--ink-3);font-size:13px">Aucun compte pour l\'instant.</div>';
  }catch(e){
    listEl.innerHTML='<div style="padding:16px;color:var(--danger);font-size:13px">Erreur de chargement des comptes.</div>';
  }
}

function openCreateAccountModal(){
  document.getElementById('accountForm').reset();
  document.getElementById('accountFormError').textContent='';
  openModal('account');
}

async function submitCreateAccount(e){
  e.preventDefault();
  const email=document.getElementById('accEmail').value.trim();
  const password=document.getElementById('accPassword').value;
  const role=document.getElementById('accRole').value;
  const errEl=document.getElementById('accountFormError');
  errEl.textContent='';
  try{
    await Api.createUser({email,password,role});
    closeModal('account');
    showToast(`Compte créé : ${email}`,'success');
    renderAccountsPanel();
  }catch(err){
    errEl.textContent=err.message||'Création impossible';
  }
}

async function changeAccountRole(id,role){
  try{
    await Api.updateUser(id,{role});
    showToast('Rôle mis à jour','success');
  }catch(e){
    showToast('Erreur : '+e.message,'error');
    renderAccountsPanel();
  }
}

async function toggleAccountActive(id,active){
  try{
    await Api.updateUser(id,{active});
    showToast(active?'Accès réactivé':'Accès coupé immédiatement','success');
  }catch(e){
    showToast('Erreur : '+e.message,'error');
    renderAccountsPanel();
  }
}

function deleteAccount(id,email){
  showConfirm('Supprimer ce compte ?',`Le compte ${email} sera supprimé définitivement.`,async()=>{
    try{
      await Api.deleteUser(id);
      showToast('Compte supprimé','success');
      renderAccountsPanel();
    }catch(e){
      showToast('Erreur : '+e.message,'error');
    }
  });
}
