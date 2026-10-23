const crypto=require('node:crypto');
const {fail}=require('./core.cjs');
const clean=value=>String(value||'').trim();
function clientIp(req){return clean(req.headers?.['x-forwarded-for']).split(',')[0]||clean(req.headers?.['x-real-ip'])||'unknown';}
function originAllowed(req,action,env=process.env){
 if(action==='webhook')return true;
 const origin=clean(req.headers?.origin);if(!origin)return true;
 const allowed=new Set(['http://localhost:3000','http://127.0.0.1:3000','https://www.cimautoparts.com.br','https://cimautoparts.com.br']);
 for(const raw of [env.CHECKOUT_BASE_URL,env.CHECKOUT_PRODUCTION_BASE_URL,...clean(env.ALLOWED_ORIGINS).split(',')]){try{if(raw)allowed.add(new URL(raw).origin);}catch{}}
 try{const local=new URL(origin);if(env.NODE_ENV!=='production'&&local.protocol==='http:'&&['localhost','127.0.0.1'].includes(local.hostname))return true;}catch{}
 if(!allowed.has(origin))fail('Origem não autorizada.',403);
 return true;
}
async function rateLimit(db,req,scope,subject='',options={}){
 const now=options.now||Date.now(),windowMs=options.windowMs||60000,limit=options.limit||60;
 const actor=crypto.createHash('sha256').update(clientIp(req)+'|'+clean(subject).slice(0,128)).digest('hex').slice(0,40);
 const window=Math.floor(now/windowMs),path='apiRateLimits/'+clean(scope).replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,40)+'/'+actor;
 const result=await db.ref(path).transaction(value=>{const next=value?.window===window?value:{window,count:0};if(Number(next.count)>=limit)return;return{window,count:Number(next.count)+1,updatedAt:now};});
 if(!result.committed)fail('Muitas tentativas. Aguarde um momento e tente novamente.',429);
}
module.exports={clientIp,originAllowed,rateLimit};
