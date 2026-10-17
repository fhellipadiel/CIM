(function(){'use strict';
const config={
  apiKey: "AIzaSyBVtlnA85ugvll5hLAvOF8FuM4BGnKEovM",
  authDomain: "redx-6b53f.firebaseapp.com",
  databaseURL: "https://redx-6b53f-default-rtdb.firebaseio.com",
  projectId: "redx-6b53f",
  storageBucket: "redx-6b53f.firebasestorage.app",
  messagingSenderId: "194933965008",
  appId: "1:194933965008:web:ae1dae6df66ea44259ded5"
};
if(!firebase.apps.length)firebase.initializeApp(config);
const auth=firebase.auth(),$=id=>document.getElementById(id),setup=location.hash==='#configurar';let nonce=null,target=null,busy=false,generation=0;
$('setupPanel').hidden=!setup;$('recoveryPanel').hidden=setup;
auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);
async function api(body){const user=auth.currentUser;if(!user)throw Error('Entre com a conta Google autorizada.');const r=await fetch('/api/admin-recovery',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+await user.getIdToken()},body:JSON.stringify(body),signal:AbortSignal.timeout(60000)}),data=await r.json();if(!r.ok)throw Error(data.error||'Não foi possível concluir a recuperação.');return data;}
function clear(){nonce=target=null;$('confirmRecovery').hidden=true;$('confirmEmail').value='';}
async function google(){if(busy)return;busy=true;try{const provider=new firebase.auth.GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});await CimMfaAuth.withChallenge(auth,()=>auth.signInWithPopup(provider));}catch(error){$(setup?'setupFeedback':'recoveryFeedback').textContent=error.code==='auth/mfa-cancelled'?'Essa conta também exige o autenticador. Utilize a conta independente autorizada para recuperação.':'Não foi possível entrar. Tente novamente.';}finally{busy=false;}}
$('googleLogin').onclick=$('setupGoogle').onclick=google;
$('operatorLogout').onclick=$('setupLogout').onclick=()=>auth.signOut();
$('cancelRecovery').onclick=()=>{clear();$('accountsSection').hidden=false;};
$('recoveryAccount').onchange=()=>{$('prepareRecovery').disabled=!$('recoveryAccount').value;clear();};
$('prepareRecovery').onclick=async()=>{if(busy)return;busy=true;$('prepareRecovery').disabled=true;try{target=$('recoveryAccount').value;const data=await api({op:'prepare',uid:target});nonce=data.nonce;$('targetEmail').textContent=data.email;$('confirmRecovery').hidden=false;$('accountsSection').hidden=true;$('recoveryFeedback').textContent='';$('confirmEmail').focus();}catch(e){$('recoveryFeedback').textContent=e.message;}finally{busy=false;$('prepareRecovery').disabled=false;}};
$('confirmRecovery').onsubmit=async e=>{e.preventDefault();if(busy||!nonce||!target)return;busy=true;const button=e.submitter;button.disabled=true;try{await api({op:'reset',uid:target,nonce,confirmation:$('confirmEmail').value.trim()});clear();$('accountsSection').hidden=true;$('recoveryFeedback').className='success';$('recoveryFeedback').textContent='Autenticador antigo removido somente dessa conta. O administrador deve entrar no ADM e configurar o novo celular para recuperar o acesso aos dados.';}catch(e){clear();$('accountsSection').hidden=false;$('recoveryFeedback').textContent=e.message;}finally{busy=false;button.disabled=false;}};
$('setupLogin').onsubmit=async e=>{e.preventDefault();if(busy)return;busy=true;try{await CimMfaAuth.signIn(auth,$('setupEmail').value.trim(),$('setupPassword').value);$('setupPassword').value='';}catch{$('setupFeedback').textContent='Não foi possível entrar. Confira seus dados.';}finally{busy=false;}};
auth.onAuthStateChanged(async user=>{const gen=++generation;clear();if(setup){$('setupLogin').hidden=!!user;$('adminMfaCard').hidden=!user;$('setupLogout').hidden=!user;return;}
$('accountsSection').hidden=true;$('operatorSession').hidden=!user;$('googleLogin').hidden=!!user;$('operatorEmail').textContent=user?.email||'';$('recoveryFeedback').className='';$('recoveryFeedback').textContent='';
if(!user)return;
try{const {accounts}=await api({op:'accounts'});if(gen!==generation)return;$('recoveryAccount').replaceChildren(new Option('Selecione uma conta',''));for(const u of accounts){const option=new Option((u.name?u.name+' · ':'')+u.email+(u.enrolled?'':' · sem autenticador'),u.uid);option.disabled=!u.enrolled;$('recoveryAccount').append(option);}$('accountsSection').hidden=false;$('prepareRecovery').disabled=true;if(!accounts.length)$('recoveryFeedback').textContent='Nenhum administrador disponível.';}catch(e){if(gen===generation)$('recoveryFeedback').textContent=e.message;}
});
})();
