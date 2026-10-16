const {fail}=require('./core.cjs');
// The private Firebase rules decide who can read this path. No UID is stored here.
async function requireAdminAccess(req,db,request=fetch){
 const token=(req.headers.authorization||'').match(/^Bearer (.+)$/)?.[1];
 if(!token)fail('Entre na sua conta para continuar.',401);
 const url=new URL(db.ref('adminAccess').toString()+'.json');
 url.searchParams.set('auth',token);
 let response;
 try{response=await request(url,{signal:AbortSignal.timeout(10000),redirect:'error'});}catch{fail('Nao foi possivel verificar a permissao de administrador.',503);}
 if(response.status===401||response.status===403)fail('Acesso restrito ao administrador.',403);
 if(!response.ok)fail('Nao foi possivel verificar a permissao de administrador.',503);
 return true;
}
module.exports={requireAdminAccess};
