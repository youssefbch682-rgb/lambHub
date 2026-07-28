// ============================================================
// CLIENT API — remplace les accès directs localStorage/IndexedDB
// par des appels au backend Node/SQLite.
// ============================================================
const API_BASE = window.LDH_API_BASE || '/api';

function getToken(){ return localStorage.getItem('ldh_token'); }
function setToken(t){ t ? localStorage.setItem('ldh_token',t) : localStorage.removeItem('ldh_token'); }
function getCurrentUser(){ try{ return JSON.parse(localStorage.getItem('ldh_user')); }catch(e){ return null; } }
function setCurrentUser(u){ u ? localStorage.setItem('ldh_user',JSON.stringify(u)) : localStorage.removeItem('ldh_user'); }

async function apiFetch(path, opts={}){
  const headers = Object.assign({'Content-Type':'application/json'}, opts.headers||{});
  const token = getToken();
  if(token) headers.Authorization = 'Bearer '+token;

  const res = await fetch(API_BASE+path, Object.assign({}, opts, {headers}));

  if(res.status===401){
    // Session expirée ou compte désactivé par un admin → retour à l'écran de connexion
    setToken(null); setCurrentUser(null);
    showLoginScreen('Session expirée — reconnecte-toi.');
    throw new Error('401 Non authentifié');
  }
  if(!res.ok){
    const body = await res.json().catch(()=>({error:res.statusText}));
    throw new Error(body.error || 'Erreur API ('+res.status+')');
  }
  return res.status===204 ? null : res.json();
}

const Api = {
  login(email,password){
    return apiFetch('/auth/login',{method:'POST',body:JSON.stringify({email,password})});
  },
  me(){ return apiFetch('/auth/me'); },

  // Comptes (admin uniquement côté serveur, mais on expose ici pour le panneau admin)
  listUsers(){ return apiFetch('/auth/users'); },
  createUser(u){ return apiFetch('/auth/users',{method:'POST',body:JSON.stringify(u)}); },
  updateUser(id,patch){ return apiFetch('/auth/users/'+id,{method:'PATCH',body:JSON.stringify(patch)}); },
  deleteUser(id){ return apiFetch('/auth/users/'+id,{method:'DELETE'}); },

  // Données métier
  getResource(name){ return apiFetch('/records/'+name); },
  putResourceAll(name,items){ return apiFetch('/records/'+name,{method:'PUT',body:JSON.stringify(items)}); },
};
