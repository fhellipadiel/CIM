const crypto=require('node:crypto');
const {fail}=require('./core.cjs');
async function recordAdminSession(db,caller,browser='',now=Date.now()){
 const authenticatedAt=Number(caller.auth_time)*1000;
 if(!Number.isFinite(authenticatedAt)||authenticatedAt<=0)fail('Sessao de administrador invalida.',401);
 const id=crypto.createHash('sha256').update(caller.uid+':'+authenticatedAt).digest('hex');
 const ref=db.ref('adminLoginHistory/'+caller.uid);
 const result=await ref.transaction(current=>{
  const entries={...(current||{})};
  if(!entries[id])entries[id]={enteredAt:now,authenticatedAt,browser:String(browser||'').slice(0,256)};
  const latest=Object.entries(entries).sort((a,b)=>b[1].enteredAt-a[1].enteredAt).slice(0,30);
  return Object.fromEntries(latest);
 });
 const entries=result.snapshot.val()||{};
 const latest=Math.max(...Object.values(entries).map(entry=>entry.enteredAt));
 if(Number.isFinite(latest))await db.ref('users/'+caller.uid+'/lastAdminLoginAt').set(latest);
 return {recorded:true};
}
module.exports={recordAdminSession};
