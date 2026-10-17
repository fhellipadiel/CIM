const crypto=require('node:crypto');
const {fail}=require('./core.cjs');
const {adminEntry,recoveryEntry,adminDirectory,validUid}=require('./access-registry.cjs');
const digest=s=>crypto.createHash('sha256').update(s).digest('hex');
function recentGoogle(caller,now){const age=now-Number(caller.auth_time)*1000;if(caller.firebase?.sign_in_provider!=='google.com'||caller.email_verified!==true||!Number.isFinite(age)||age< -60000||age>300000)fail('Entre novamente com a conta Google autorizada.',401);}
async function resetAccount({auth,db,targetUid,actorUid,now=Date.now(),id=crypto.randomUUID()}){
 if(!validUid(targetUid)||!validUid(actorUid))fail('Conta inválida.',400);
 const entry=await adminEntry(db,targetUid);if(entry.enabled!==true||entry.canRead!==true)fail('Administrador indisponível.',404);
 const user=await auth.getUser(targetUid);if(!(user.multiFactor?.enrolledFactors||[]).length)fail('Essa conta não tem um autenticador para redefinir.',409);
 const lock=db.ref('mfaRecoveryLocks/'+targetUid),lease=await lock.transaction(value=>value?.expiresAt>now?undefined:{id,expiresAt:now+600000});if(!lease.committed)fail('Já existe uma recuperação em andamento.',409);
 try{
  await db.ref('securityAudit/'+id).set({type:'mfa_recovery',actorUid,targetUid,startedAt:now,status:'started'});
  const ref=db.ref('adminMfaPolicy/'+targetUid),old=(await ref.get()).val()||{};
  await ref.set({...old,required:true,recoveryPending:true,recoveredAt:now,recoveredBy:actorUid});
  await auth.revokeRefreshTokens(targetUid);
  await auth.updateUser(targetUid,{multiFactor:{enrolledFactors:[]}});
  await auth.revokeRefreshTokens(targetUid);
  await db.ref('securityAudit/'+id).update({status:'completed',completedAt:Date.now()});
  return {recovered:true,requiresEnrollment:true};
 }catch(error){await db.ref('securityAudit/'+id).update({status:'failed',failedAt:Date.now()}).catch(()=>{});throw error;}
 finally{await lock.transaction(value=>value?.id===id?null:undefined);}
}
async function handleRecovery({auth,db,caller,body,now=Date.now()}){
 if(!body||!['status','accounts','prepare','reset'].includes(body.op))fail('Operação inválida.',400);
 recentGoogle(caller,now);
 if((await recoveryEntry(db,caller.uid)).enabled!==true)fail('Esta conta não tem autorização para recuperação.',403);
 if(body.op==='status')return {authorized:true};
 if(body.op==='accounts'){
  const admins=await adminDirectory(db);if(admins.length>100)fail('Revise a lista administrativa no Firebase.',409);
  const accounts=await Promise.all(admins.map(async e=>{try{const u=await auth.getUser(e.uid);return {uid:e.uid,name:u.displayName||'',email:u.email||'',enrolled:!!u.multiFactor?.enrolledFactors?.length};}catch(error){if(error.code==='auth/user-not-found')return null;throw error;}}));
  return {accounts:accounts.filter(Boolean)};
 }
 if(!validUid(body.uid))fail('Selecione um administrador.',400);
 const target=await adminEntry(db,body.uid);if(target.enabled!==true||target.canRead!==true)fail('Administrador indisponível.',404);
 const user=await auth.getUser(body.uid);
 if(body.op==='prepare'){
  if(!user.email||!user.multiFactor?.enrolledFactors?.length)fail('Essa conta não tem um autenticador para redefinir.',409);
  const nonce=crypto.randomBytes(32).toString('base64url');
  await db.ref('mfaRecoveryChallenges/'+caller.uid).set({hash:digest(nonce),uid:body.uid,email:user.email,expiresAt:now+300000});
  return {nonce,email:user.email};
 }
 if(typeof body.nonce!=='string'||body.nonce.length>100||typeof body.confirmation!=='string')fail('Confirme novamente a conta.',400);
 const challengeRef=db.ref('mfaRecoveryChallenges/'+caller.uid);
 const used=await challengeRef.transaction(v=>v&&v.expiresAt>now&&v.uid===body.uid&&v.hash===digest(body.nonce)&&v.email===user.email&&body.confirmation===user.email?null:undefined);
 if(!used.committed)fail('Confirmação inválida ou expirada. Selecione a conta novamente.',409);
 const rate=await db.ref('mfaRecoveryRateLimits/'+caller.uid).transaction(v=>{const next=v?.window===Math.floor(now/3600000)?v:{window:Math.floor(now/3600000),count:0};return next.count>=5?undefined:{...next,count:next.count+1};});
 if(!rate.committed)fail('Limite de recuperações atingido. Tente mais tarde.',429);
 if((await recoveryEntry(db,caller.uid)).enabled!==true)fail('Recuperação não autorizada.',403);
 return resetAccount({auth,db,targetUid:body.uid,actorUid:caller.uid,now});
}
module.exports={handleRecovery,resetAccount,recentGoogle};
