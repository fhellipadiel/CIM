(function(){'use strict';
let modulePromise;function sdk(){return modulePromise||(modulePromise=import('https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js').catch(error=>{modulePromise=null;throw error;}));}
const native=value=>value?._delegate||value;
function factor(user,module){return user.multiFactor?native(user.multiFactor):module.multiFactor(native(user));}
function el(tag,cls,text){const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;}
function dialog(title){const box=el('dialog','mfa-dialog'),head=el('header','mfa-head'),name=el('h2','',title),close=el('button','mfa-close','×'),content=el('div','mfa-body');name.id='mfa-title-'+Math.random().toString(36).slice(2);box.setAttribute('aria-labelledby',name.id);close.type='button';close.setAttribute('aria-label','Fechar');head.append(name,close);box.append(head,content);document.body.append(box);const previous=document.activeElement;function remove(){box.close();box.remove();previous?.focus();}close.onclick=()=>box.dispatchEvent(new Event('cancel',{cancelable:true}));return {box,content,close,show:()=>box.showModal(),remove};}
function recoveryText(){return 'Se você guardou a chave de configuração, adicione essa chave no autenticador do novo celular. Os códigos voltarão a funcionar. Sem a chave, procure o responsável pelo Firebase para recuperar o acesso com segurança. Trocar apenas a senha não desativa o autenticador.';}
async function challenge(auth,error){
 if(error.code!=='auth/multi-factor-auth-required')throw error;
 const m=await sdk(),resolver=error.resolver?native(error.resolver):m.getMultiFactorResolver(native(auth),error),hint=resolver.hints.find(f=>f.factorId===m.TotpMultiFactorGenerator.FACTOR_ID);
 if(!hint)throw Error('Este acesso precisa de um segundo fator que não é suportado nesta tela.');
 return new Promise((resolve,reject)=>{
  const d=dialog('Código do autenticador'),note=el('p','','Abra o aplicativo autenticador no seu celular e digite o código temporário.'),form=el('form','mfa-form'),label=el('label','','Código de 6 dígitos'),input=el('input','mfa-code'),feedback=el('p','mfa-error'),submit=el('button','mfa-primary','Confirmar código'),help=el('button','mfa-secondary','Perdi ou troquei o celular'),recovery=el('p','mfa-help');
  input.type='text';input.inputMode='numeric';input.autocomplete='one-time-code';input.maxLength=6;input.required=true;input.pattern='[0-9]{6}';input.setAttribute('aria-label','Código do autenticador');input.oninput=()=>{input.value=input.value.replace(/\D/g,'');};label.append(input);feedback.setAttribute('role','alert');submit.type='submit';help.type='button';recovery.hidden=true;help.onclick=()=>{recovery.hidden=!recovery.hidden;recovery.textContent=recoveryText();};form.append(label,feedback,submit);d.content.append(note,form,help,recovery);let busy=false;
  d.box.addEventListener('cancel',e=>{e.preventDefault();if(busy)return;d.remove();const cancel=Error('Confirmação do autenticador cancelada.');cancel.code='auth/mfa-cancelled';reject(cancel);});
  form.onsubmit=async e=>{e.preventDefault();if(busy||!/^\d{6}$/.test(input.value))return;busy=true;submit.disabled=true;d.close.disabled=true;feedback.textContent='';try{const assertion=m.TotpMultiFactorGenerator.assertionForSignIn(hint.uid,input.value);const result=await resolver.resolveSignIn(assertion);d.remove();resolve({...result,user:auth.currentUser||result.user});}catch(error){feedback.textContent=error.code==='auth/too-many-requests'?'Muitas tentativas. Aguarde alguns minutos e entre novamente.':'Código inválido ou expirado. Confira o horário do celular e tente novamente.';input.value='';input.focus();}finally{busy=false;submit.disabled=false;d.close.disabled=false;}};
  d.show();input.focus();
 });
}
async function signIn(auth,email,password){const m=await sdk();try{const result=await m.signInWithEmailAndPassword(native(auth),email,password);return {...result,user:auth.currentUser||result.user};}catch(error){return challenge(auth,error);}}
async function withChallenge(auth,operation){try{return await operation();}catch(error){return challenge(auth,error);}}
window.CimMfaAuth={sdk,native,factor,el,dialog,recoveryText,challenge,signIn,withChallenge};
})();
