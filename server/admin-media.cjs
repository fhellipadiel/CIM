const crypto=require('node:crypto');const {fail}=require('./core.cjs');
const FOLDERS=['products','sessions','brands','contacts','profile','links','about','leadCampaigns','avatars'];
function validPath(path){return typeof path==='string'&&path.length<=500&&/^[A-Za-z0-9_./-]+$/.test(path)&&!path.split('/').some(p=>!p||p==='.'||p==='..')&&FOLDERS.includes(path.split('/')[0])&&path.includes('/');}
function imageType(b){if(b.length>=8&&b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png';if(b.length>=3&&b[0]===255&&b[1]===216&&b[2]===255)return 'image/jpeg';if(b.length>=12&&b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP')return 'image/webp';if(b.toString('ascii',0,6)==='GIF89a'||b.toString('ascii',0,6)==='GIF87a')return 'image/gif';return null;}
function bucketFor(auth){return require('firebase-admin/storage').getStorage(auth.app).bucket(process.env.FIREBASE_STORAGE_BUCKET||(auth.app.options.projectId||auth.app.options.credential.projectId||'redx-6b53f')+'.firebasestorage.app');}
async function handleMedia({auth,caller,body,requireRead,requireWrite,bucket}){
 if(!body||!['upload','delete','list'].includes(body.op))fail('Operação inválida.',400);
 if(body.op==='list')await requireRead();else await requireWrite();
 bucket=bucket||bucketFor(auth);
 if(body.op==='list'){
  if(!FOLDERS.includes(body.folder)||body.pageToken&&(!/^[A-Za-z0-9_+=/-]{1,2000}$/.test(body.pageToken)))fail('Pasta inválida.',400);
  const [files,next]=await bucket.getFiles({prefix:body.folder+'/',maxResults:200,autoPaginate:false,...(body.pageToken?{pageToken:body.pageToken}:{})});
  return {files:files.map(f=>{const token=String(f.metadata.metadata?.firebaseStorageDownloadTokens||'').split(',')[0];return {path:f.name,url:'https://firebasestorage.googleapis.com/v0/b/'+bucket.name+'/o/'+encodeURIComponent(f.name)+'?alt=media'+(token?'&token='+encodeURIComponent(token):'')};}),pageToken:next?.pageToken||null};
 }
 if(!validPath(body.path))fail('Caminho de imagem inválido.',400);
 const file=bucket.file(body.path);
 if(body.op==='delete'){await file.delete({ignoreNotFound:true});return {deleted:true};}
 if(typeof body.base64!=='string'||body.base64.length>4194304||(body.base64.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(body.base64)))fail('Imagem inválida ou muito grande.',400);
 const bytes=Buffer.from(body.base64,'base64'),type=imageType(bytes);if(!bytes.length||bytes.length>3*1024*1024||type!==body.contentType)fail('Envie uma imagem JPG, PNG, WebP ou GIF de até 3 MB após processamento.',400);
 const token=crypto.randomUUID();await file.save(bytes,{resumable:false,preconditionOpts:{ifGenerationMatch:0},metadata:{contentType:type,cacheControl:'public,max-age=31536000',metadata:{firebaseStorageDownloadTokens:token,uploadedBy:caller.uid}}});
 return {url:'https://firebasestorage.googleapis.com/v0/b/'+bucket.name+'/o/'+encodeURIComponent(body.path)+'?alt=media&token='+token};
}
module.exports={handleMedia,validPath,imageType};
