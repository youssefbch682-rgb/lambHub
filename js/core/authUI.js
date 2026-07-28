// ============================================================
// ÉCRAN DE CONNEXION — bloque l'accès à l'app tant que l'utilisateur
// n'est pas authentifié. Le rôle (admin/editeur/lecteur) renvoyé par
// le backend pilote ensuite l'affichage des actions (voir applyRolePermissions).
// ============================================================
function showLoginScreen(message){
  document.querySelector('.shell').style.display='none';
  let el=document.getElementById('loginScreen');
  if(!el){
    el=document.createElement('div');
    el.id='loginScreen';
    el.innerHTML=`
      <div class="login-card">
        <div class="brand-logo" style="margin:0 auto 16px"></div>
        <h1>Lamberet Decoration Hub</h1>
        <p class="login-sub">Connecte-toi avec ton compte Lamberet</p>
        <form id="loginForm">
          <input type="email" id="loginEmail" placeholder="email@lamberet.fr" required autocomplete="username">
          <input type="password" id="loginPassword" placeholder="Mot de passe" required autocomplete="current-password">
          <button type="submit">Se connecter</button>
          <div id="loginError" class="login-error"></div>
        </form>
      </div>`;
    document.body.appendChild(el);
    el.querySelector('#loginForm').addEventListener('submit', onLoginSubmit);
  }
  el.style.display='flex';
  el.querySelector('#loginError').textContent=message||'';
}

async function onLoginSubmit(e){
  e.preventDefault();
  const email=document.getElementById('loginEmail').value.trim();
  const password=document.getElementById('loginPassword').value;
  const errEl=document.getElementById('loginError');
  errEl.textContent='';
  try{
    const {token,user}=await Api.login(email,password);
    setToken(token);
    setCurrentUser(user);
    document.getElementById('loginScreen').style.display='none';
    document.querySelector('.shell').style.display='';
    await startApp();
  }catch(err){
    errEl.textContent=err.message||'Connexion impossible';
  }
}

function logout(){
  setToken(null); setCurrentUser(null);
  location.reload();
}

// Masque les actions d'écriture pour les comptes "lecteur" (rôle le plus bas).
// À appeler après chaque rendu de page si tu veux un contrôle fin ; pour
// l'instant applique une règle globale simple sur les boutons d'action.
function applyRolePermissions(){
  const user=getCurrentUser();
  if(!user) return;
  document.body.classList.toggle('role-lecteur', user.role==='lecteur');
  document.body.classList.toggle('role-editeur', user.role==='editeur');
  document.body.classList.toggle('role-admin', user.role==='admin');
}
