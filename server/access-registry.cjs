const {fail}=require('./core.cjs');
const ROOT='accessControl',UID=/^[A-Za-z0-9_-]{1,128}$/;
function validUid(uid){return typeof uid==='string'&&UID.test(uid);}
async function adminEntry(db,uid){if(!validUid(uid))fail('Conta inválida.',400);return (await db.ref(ROOT+'/admins/'+uid).get()).val()||{};}
async function recoveryEntry(db,uid){if(!validUid(uid))fail('Acesso não autorizado.',403);return (await db.ref(ROOT+'/recoveryOperators/'+uid).get()).val()||{};}
async function adminDirectory(db){const all=(await db.ref(ROOT+'/admins').get()).val()||{};return Object.entries(all).filter(([uid,e])=>validUid(uid)&&e?.enabled===true&&e.canRead===true).map(([uid,e])=>({uid,canRead:true,canWrite:e.canWrite===true}));}
module.exports={ROOT,validUid,adminEntry,recoveryEntry,adminDirectory};
