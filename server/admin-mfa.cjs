const {fail}=require('./core.cjs');const {configureStorageMfa}=require('./storage-mfa.cjs');
function hasTotp(user){return (user.multiFactor?.enrolledFactors||[]).some(f=>f.factorId==='totp');}
function available(config){return (config.multiFactorConfig?.providerConfigs||[]).some(p=>p.state==='ENABLED'&&p.totpProviderConfig);}
async function handleAdminMfa({auth,db,caller,body,requireSetup,requireAdmin,storageGuard=configureStorageMfa,now=Date.now()}){
 await requireSetup();
 if(!body||!['status','prepare','activate'].includes(body.op))fail('Operacao invalida.',400);
 const user=await auth.getUser(caller.uid),policy=(await db.ref('adminMfaPolicy/'+caller.uid).get()).val()||{};
 const project=await auth.projectConfigManager().getProjectConfig();
 const status={available:available(project),emailVerified:user.emailVerified===true,enrolled:hasTotp(user),enabled:policy.required===true};
 if(body.op==='status')return status;
 if(!status.available)fail('O autenticador ainda precisa ser habilitado no projeto Firebase.',409);
 if(!status.emailVerified)fail('Confirme seu e-mail antes de configurar o autenticador.',403);
 const age=now-Number(caller.auth_time)*1000;
 if(!Number.isFinite(age)||age< -60000||age>300000)fail('Entre novamente para confirmar sua identidade.',401);
 if(['anonymous','custom'].includes(caller.firebase?.sign_in_provider))fail('Confirme sua identidade com e-mail e senha ou Google.',403);
 if(policy.required===true)await requireAdmin();
 if(body.op==='prepare')return {ready:true};
 if(!status.enrolled)fail('Confirme primeiro o codigo do aplicativo autenticador.',409);
 await storageGuard(auth,caller.uid,true);
 await db.ref('adminMfaPolicy/'+caller.uid).set({required:true,activatedAt:policy.activatedAt||now,updatedAt:now});
 return {enabled:true,signInAgain:true};
}
module.exports={handleAdminMfa,hasTotp,available};
