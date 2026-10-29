const {test}=require('node:test'),assert=require('node:assert/strict');
const notifications=require('../server/notifications.cjs');
const {sendNotificationEmail}=require('../server/brevo-email.cjs');

function memory(){
 const data={users:{admin:{isAdmin:true},alice:{name:'Alice',email:'alice@example.com'}}};
 const read=path=>path.split('/').filter(Boolean).reduce((value,key)=>value?.[key],data)||null;
 const write=(path,value)=>{const keys=path.split('/');let node=data;for(const key of keys.slice(0,-1))node=node[key]??={};if(value===null)delete node[keys.at(-1)];else node[keys.at(-1)]=structuredClone(value)};
 return {data,ref:(path='')=>({get:async()=>({val:()=>structuredClone(read(path))}),update:async updates=>{for(const [key,value]of Object.entries(updates))write([path,key].filter(Boolean).join('/'),value)}})};
}

test('nova notificação envia e-mail uma vez e edição não dispara novamente',async()=>{
 const db=memory();let calls=0;
 const sendEmail=async payload=>{calls++;assert.equal(payload.recipients[0].email,'alice@example.com');return{status:'sent',sent:1,skipped:0}};
 const created=await notifications(db,{uid:'admin',isAdmin:true},{action:'save',target:'alice',title:'Aviso',message:'Mensagem'},{sendEmail});
 assert.equal(created.email.sent,1);assert.equal(db.data.adminNotificationCampaigns[created.id].email.status,'sent');
 await notifications(db,{uid:'admin',isAdmin:true},{action:'save',id:created.id,title:'Aviso editado',message:'Mensagem nova'},{sendEmail});
 assert.equal(calls,1);
});

test('Brevo fica inativa sem chave e não tenta acessar a rede',async()=>{
 const previous=process.env.BREVO_API_KEY;delete process.env.BREVO_API_KEY;let called=false;
 try{
  const result=await sendNotificationEmail({campaignId:'campaign',title:'Aviso',message:'Texto',recipients:[{email:'cliente@example.com'}],request:async()=>{called=true}});
  assert.equal(result.status,'not_configured');assert.equal(called,false);
 }finally{if(previous===undefined)delete process.env.BREVO_API_KEY;else process.env.BREVO_API_KEY=previous}
});

test('Brevo envia texto simples sem HTML e sem expor destinatários entre si',async()=>{
 const previous=process.env.BREVO_API_KEY;process.env.BREVO_API_KEY='test-key';let requestBody;
 try{
  const result=await sendNotificationEmail({campaignId:'campaign',title:'<Aviso>',message:'Linha 1\nLinha 2',recipients:[{email:'a@example.com',name:'A'},{email:'b@example.com',name:'B'},{email:'invalido'}],request:async(url,options)=>{assert.equal(url,'https://api.brevo.com/v3/smtp/email');assert.equal(options.headers['api-key'],'test-key');requestBody=JSON.parse(options.body);return{ok:true,json:async()=>({messageIds:['1','2']})}}});
  assert.equal(result.status,'sent');assert.equal(result.sent,2);assert.equal(result.skipped,1);
  assert.equal(requestBody.messageVersions.length,2);assert.equal(requestBody.messageVersions[0].to.length,1);assert.equal(requestBody.htmlContent,undefined);assert.match(requestBody.textContent,/<Aviso>/);assert.match(requestBody.textContent,/Linha 1\nLinha 2/);
 }finally{if(previous===undefined)delete process.env.BREVO_API_KEY;else process.env.BREVO_API_KEY=previous}
});
