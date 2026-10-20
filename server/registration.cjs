const {fail}=require('./core.cjs');const policy=require('../assets/signup-policy.js');
const DOCUMENT_MESSAGE='Nao foi possivel utilizar este documento. Confira os dados ou entre em contato com o suporte.';
async function registerProfile(db,caller,input,now=Date.now()){
 const type=input.userType,doc=policy.digits(type==='PF'?input.cpf:input.cnpj);
 if(!policy.validDocument(type,doc))fail(DOCUMENT_MESSAGE,409);
 const name=String(input.name||'').trim(),phone=policy.digits(input.telefone);
 if(!name||name.length>200||phone.length<10||phone.length>13||!caller.email)fail('Confira os dados obrigatorios do cadastro.',400);
 let attribution={};const referral=String(input.employeeRef||'').trim().toLowerCase();if(referral){const employees=(await db.ref('employees').get()).val()||{};const found=Object.entries(employees).find(([,e])=>e.enabled===true&&e.slug===referral);if(found)attribution={employeeId:found[0],employeeSlug:found[1].slug,employeeName:found[1].name,employeeReferredAt:now};}
 const profile={userType:type,name,email:caller.email,telefone:phone,cpf:type==='PF'?doc:'',cnpj:type==='PJ'?doc:'',createdAt:now,lastAccess:now,isAdmin:false,mustChangePassword:input.mustChangePassword===true,authProvider:caller.firebase?.sign_in_provider||'password',...attribution};
 for(const field of ['cep','logradouro','numero','complemento','bairro','cidade','uf','nome_fantasia','situacao_cadastral','photoURL']){
  const value=input[field];if(value!==undefined){if(typeof value!=='string'||value.length>(field==='photoURL'?500:200))fail('Confira os dados do cadastro.',400);profile[field]=value;}
 }
 const ref=db.ref('users'),retain=()=>{};ref.on('value',retain);
 try{
  await ref.once('value');
  const result=await ref.transaction(current=>{
   current=current||{};
   for(const [uid,user]of Object.entries(current)){
    if(uid!==caller.uid&&[policy.digits(user.cpf),policy.digits(user.cnpj)].includes(doc))return;
   }
   const previous=current[caller.uid];
   if(previous&&(policy.digits(previous.cpf)||policy.digits(previous.cnpj))){
    if(previous.userType!==type||policy.digits(type==='PF'?previous.cpf:previous.cnpj)!==doc)return;
    return current;
   }
   return {...current,[caller.uid]:{...previous,...profile,isAdmin:previous?.isAdmin===true}};
  });
  if(!result.committed)fail(DOCUMENT_MESSAGE,409);
  return {registered:true};
 }finally{ref.off('value',retain);}
}

async function claimReferral(db,caller,input,now=Date.now()){
 const referral=String(input.employeeRef||'').trim().toLowerCase();if(!referral)return{claimed:false};
 const employees=(await db.ref('employees').get()).val()||{},found=Object.entries(employees).find(([,e])=>e.enabled===true&&e.slug===referral);if(!found)return{claimed:false};
 const ref=db.ref('users/'+caller.uid);let claimed=false;await ref.transaction(user=>{if(!user||user.employeeId)return user;claimed=true;return{...user,employeeId:found[0],employeeSlug:found[1].slug,employeeName:found[1].name,employeeReferredAt:now}});return{claimed};
}
module.exports={registerProfile,claimReferral,DOCUMENT_MESSAGE};
