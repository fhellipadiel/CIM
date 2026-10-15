const http=require('node:http');
const port=Number(process.env.WEBHOOK_PORT||3001);
http.createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname!=='/api/webhook'){res.writeHead(404);return res.end('Não encontrado');}
  if(req.method!=='POST'){res.writeHead(405,{'Allow':'POST'});return res.end('Use POST');}
  try{
    const chunks=[];let size=0;
    for await(const chunk of req){size+=chunk.length;if(size>65536){res.writeHead(413);return res.end('Solicitação muito grande');}chunks.push(chunk);}
    const payload=Buffer.concat(chunks);
    let event={};try{event=JSON.parse(payload.toString('utf8'));}catch{}
    const query=new URL(req.url,'http://localhost').searchParams;
    console.log('Diagnóstico webhook: '+JSON.stringify({queryKeys:[...query.keys()],type:event.type||query.get('type')||query.get('topic'),signaturePresent:!!req.headers['x-signature'],requestIdPresent:!!req.headers['x-request-id'],queryId:query.get('data.id')||query.get('id'),bodyId:event.data?.id,applicationId:event.application_id,userId:event.user_id}));
    if(query.has('data.id') && ['payment','order'].includes(event.type)) {
      const fs=require('node:fs');const path=require('node:path');
      fs.writeFileSync(path.join(__dirname,'../.tools/webhook-diagnostic.json'),JSON.stringify({url:req.url,headers:{'x-signature':req.headers['x-signature'],'x-request-id':req.headers['x-request-id']},body:{type:event.type,action:event.action,data:event.data}}));
    }
    const headers={'Content-Type':'application/json'};
    for(const key of ['x-signature','x-request-id'])if(req.headers[key])headers[key]=req.headers[key];
    const upstream=await fetch('http://127.0.0.1:3000'+req.url,{method:'POST',headers,body:Buffer.concat(chunks),signal:AbortSignal.timeout(20000)});
    res.writeHead(upstream.status,{'Content-Type':'application/json'});
    res.end(await upstream.text());
    console.log('Webhook recebido: HTTP '+upstream.status);
  }catch{res.writeHead(502);res.end('Servidor local indisponível');}
}).listen(port,'127.0.0.1',()=>console.log('Proxy exclusivo do webhook: http://127.0.0.1:'+port+'/api/webhook'));