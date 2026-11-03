const {fail}=require('./core.cjs');

const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UID=/^[A-Za-z0-9_-]{1,128}$/;
const clean=(value,max=200)=>String(value||'').trim().slice(0,max);
const strong=password=>password.length>=12&&/[a-z]/.test(password)&&/[A-Z]/.test(password)&&/\d/.test(password)&&/[^A-Za-z0-9]/.test(password);
const PANELS=['dashboard','pedidos','analises','analises-links','produtos','destaques','categorias','marcas','sessoes','precos','promocoes','cupons','leads','links','importacao','cliques','suporte','funcionarios','usuarios','quem-somos','perfil','contatos','config'];
const panels=value=>Array.isArray(value)?[...new Set(value.map(String).filter(panel=>PANELS.includes(panel)))]:[...PANELS];

async function handleAdminManagement({auth,db,caller,body,primaryUid}){
  const op=clean(body.op,30);
  if(op==='presence'){
    const entry=(await db.ref('accessControl/admins/'+caller.uid).get()).val()||{};
    if(caller.uid!==primaryUid&&(entry.enabled!==true||entry.canRead!==true))fail('Acesso restrito ao administrador.',403);
    await db.ref('adminPresence/'+caller.uid).set({lastActiveAt:Date.now()});return{updated:true};
  }
  if(!primaryUid||caller?.uid!==primaryUid)fail('Somente o administrador principal pode gerenciar administradores.',403);

  if(op==='create'){
    const name=clean(body.name),email=clean(body.email,254).toLowerCase(),password=String(body.password||'');
    if(name.length<2||!EMAIL.test(email)||!strong(password))fail('Informe nome, e-mail e uma senha com 12 caracteres, maiúscula, minúscula, número e símbolo.',400);
    let account;
    try{account=await auth.createUser({email,password,displayName:name,emailVerified:false});}
    catch(error){fail(error.code==='auth/email-already-exists'?'Este e-mail já possui uma conta.':'Não foi possível criar o administrador.',409);}
    const now=Date.now(),profile={name,email,photoURL:'',isAdmin:true,authProvider:'manual',mustChangePassword:true,createdAt:now,lastAccess:now,createdBy:caller.uid};
    try{
      await db.ref().update({['users/'+account.uid]:profile,['accessControl/admins/'+account.uid]:{enabled:true,canRead:true,canWrite:body.accessMode!=='view',allowedPanels:panels(body.allowedPanels),createdAt:now,createdBy:caller.uid}});
    }catch(error){await auth.deleteUser(account.uid).catch(()=>{});throw error;}
    return {created:true,uid:account.uid,admin:{...profile,uid:account.uid}};
  }

  if(op==='permissions'){
    const uid=clean(body.uid,128);if(!UID.test(uid)||uid===primaryUid)fail('Administrador inválido.',400);
    const entry=(await db.ref('accessControl/admins/'+uid).get()).val();if(!entry)fail('Administrador não encontrado.',404);
    const allowedPanels=panels(body.allowedPanels),canWrite=body.accessMode!=='view';
    await db.ref('accessControl/admins/'+uid).update({canRead:true,canWrite,allowedPanels,updatedAt:Date.now(),updatedBy:caller.uid});
    await auth.revokeRefreshTokens(uid);
    return{updated:true,uid,canWrite,allowedPanels};
  }

  if(op==='delete'){
    const uid=clean(body.uid,128);
    if(!UID.test(uid))fail('Administrador inválido.',400);
    if(uid===primaryUid)fail('O administrador principal não pode ser excluído.',409);
    const entry=(await db.ref('accessControl/admins/'+uid).get()).val();
    if(!entry)fail('Administrador não encontrado.',404);
    try{await auth.deleteUser(uid);}catch(error){if(error.code!=='auth/user-not-found')fail('Não foi possível excluir a conta administrativa.',409);}
    await db.ref().update({['users/'+uid]:null,['accessControl/admins/'+uid]:null,['adminMfaPolicy/'+uid]:null,['adminPresence/'+uid]:null});
    return {deleted:true,uid};
  }

  fail('Ação administrativa inválida.',400);
}

module.exports={handleAdminManagement,PANELS};
