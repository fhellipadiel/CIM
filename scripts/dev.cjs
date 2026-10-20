const http=require('node:http');
const fs=require('node:fs/promises');
const path=require('node:path');
const {handle}=require('../server/checkout.cjs');
const root=path.resolve(__dirname,'..');
const routes=new Set(['admin-recovery','admin-access','admin-media','admin-mfa','employee','analytics','support','register-profile','claim-referral','company-lookup','checkout','customer-orders','resume-payment','cart-save','cart-load','payment-status','admin-session','admin-notifications','admin-tests','admin-order-status','admin-archive-legacy-order','webhook']);
http.createServer(async(req,res)=>{
  res.status=code=>{res.statusCode=code;return res;};
  res.json=value=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));};
  try {
    const pathname=new URL(req.url,'http://localhost').pathname;
    if(pathname.startsWith('/api/')) {
      const action=pathname.slice(5);
      if(!routes.has(action))return res.status(404).json({error:'Rota não encontrada'});
      let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>(action==='admin-media'?4250000:65536))return res.status(413).json({error:'Solicitação muito grande'});}
      req.body=raw ? JSON.parse(raw) : {};
      return await handle(action,req,res);
    }
    const local=pathname==='/' ? '/index.html' : pathname==='/admin' ? '/adm.html' : pathname==='/login' ? '/login.html' : pathname==='/funcionario' ? '/funcionario.html' : pathname;
    if(!['/index.html','/cim.html','/adm.html','/login.html','/funcionario.html','/leads.html','/recuperar-acesso.html'].includes(local) && !/^\/assets\/[a-zA-Z0-9_./ -]+$/.test(local))return res.status(404).end('Não encontrado');
    const target=path.resolve(root,'.'+local);
    if(!target.startsWith(root+path.sep))return res.status(403).end();
    const content=await fs.readFile(target);
    const mime={'.html':'text/html; charset=utf-8','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.css':'text/css','.js':'text/javascript'};
    res.setHeader('Content-Type',mime[path.extname(target)]||'application/octet-stream');
    res.end(content);
  }catch{res.status(400).end('Não foi possível atender à solicitação');}
}).listen(Number(process.env.PORT||3000),'127.0.0.1',()=>console.log('Teste local: http://localhost:'+ (process.env.PORT||3000) +'/cim.html'));