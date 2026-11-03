const {fail}=require('./core.cjs');
async function checkAccess(req,db,path,request){
 const token=(req.headers.authorization||'').match(/^Bearer (.+)$/)?.[1];if(!token)fail('Entre na sua conta para continuar.',401);
 const url=new URL(db.ref(path).toString()+'.json');url.searchParams.set('auth',token);let response;
 try{response=await request(url,{signal:AbortSignal.timeout(10000),redirect:'error'});}catch{fail('Nao foi possivel verificar a permissao de administrador.',503);}
 if(response.status===401||response.status===403)fail('Acesso restrito ao administrador.',403);
 if(!response.ok)fail('Nao foi possivel verificar a permissao de administrador.',503);return true;
}
// Private rules authorize the account; setup access never grants business-data access.
function requireAdminAccess(req,db,request=fetch){return checkAccess(req,db,'adminAccess',request);}
function requireAdminSetupAccess(req,db,request=fetch){return checkAccess(req,db,'adminSetupAccess',request);}
function requireAdminWriteAccess(req,db,request=fetch){return checkAccess(req,db,'adminWriteAccess',request);}
module.exports={requireAdminAccess,requireAdminSetupAccess,requireAdminWriteAccess};
