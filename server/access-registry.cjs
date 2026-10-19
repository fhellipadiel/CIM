const {fail}=require('./core.cjs');
const ROOT='accessControl',UID=/^[A-Za-z0-9_-]{1,128}$/;
function validUid(uid){return typeof uid==='string'&&UID.test(uid);}
async function adminEntry(db,uid){if(!validUid(uid))fail('Conta invÃ¡lida.',400);return (await db.ref(ROOT+'/admins/'+uid).get()).val()||{};}
async function recoveryEntry(db,uid){if(!validUid(uid))fail('Acesso nÃ£o autorizado.',403);return (await db.ref(ROOT+'/recoveryOperators/'+uid).get()).val()||{};}
async function adminDirectory(db){const all=(await db.ref(ROOT+'/admins').get()).val()||{};return Object.entries(all).filter(([uid,e])=>validUid(uid)&&e?.enabled===true&&e.canRead===true).map(([uid,e])=>({uid,canRead:true,canWrite:e.canWrite===true}));}
async function requireRegistryAdmin(db,caller,{write=false,setup=false}={}){
 const entry=await adminEntry(db,caller?.uid);
 if(entry.enabled!==true||entry.canRead!==true||(write&&entry.canWrite!==true))fail('Acesso restrito ao administrador.',403);
 const policy=(await db.ref('adminMfaPolicy/'+caller.uid).get()).val()||{};
 if(!setup&&(policy.recoveryPending===true||(policy.required===true&&caller?.firebase?.sign_in_second_factor!=='totp')))fail('Confirmação de duas etapas obrigatória.',403);
 return true;
}
module.exports={ROOT,validUid,adminEntry,recoveryEntry,adminDirectory,requireRegistryAdmin};
