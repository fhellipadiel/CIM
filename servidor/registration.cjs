const {fail}=require('./core.cjs');const policy=require('../assets/signup-policy.js');
const DOCUMENT_MESSAGE='Nao foi possivel utilizar este documento. Confira os dados ou entre em contato com o suporte.';
async function employeeFromAssignedLink(db,value){
 const slug=String(value||'').trim().toLowerCase();
 if(!/^[a-z0-9_-]{2,80}$/.test(slug))return null;
 const [employees,links]=await Promise.all([db.ref('employees').get().then(snapshot=>snapshot.val()||{}),db.ref('trackingLinks').get().then(snapshot=>snapshot.val()||{})]);
 const matches=Object.entries(links).filter(([,link])=>String(link?.slug||'').trim().toLowerCase()===slug);
 if(matches.length!==1)return null;
 const [linkId]=matches[0],owners=Object.entries(employees).filter(([,employee])=>employee?.enabled===true&&Array.isArray(employee.linkIds)&&employee.linkIds.includes(linkId));
 return owners.length===1?{uid:owners[0][0],employee:owners[0][1],linkId}:null;
}
async function registerProfile(db,caller,input,now=Date.now()){
 const type=input.userType,doc=policy.digits(type==='PF'?input.cpf:input.cnpj);
 if(!policy.validDocument(type,doc))fail(DOCUMENT_MESSAGE,409);
 const name=String(input.name||'').trim(),phone=policy.digits(input.telefone);
 if(!name||name.length>200||phone.length<10||phone.length>13||!caller.email)fail('Confira os dados obrigatorios do cadastro.',400);
 let attribution={};const match=await employeeFromAssignedLink(db,input.employeeRef);if(match)attribution={employeeId:match.uid,employeeSlug:match.employee.slug,employeeName:match.employee.name,employeeReferredAt:now};
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
 const match=await employeeFromAssignedLink(db,input.employeeRef);if(!match)return{claimed:false};
 const ref=db.ref('users/'+caller.uid);let claimed=false;await ref.transaction(user=>{if(!user||user.employeeId)return user;claimed=true;return{...user,employeeId:match.uid,employeeSlug:match.employee.slug,employeeName:match.employee.name,employeeReferredAt:now}});return{claimed};
}
module.exports={registerProfile,claimReferral,employeeFromAssignedLink,DOCUMENT_MESSAGE};
