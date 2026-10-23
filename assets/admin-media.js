(function(){'use strict';
function adminAuth(){try{return firebase.app('cim-admin').auth();}catch{return firebase.auth();}}
async function request(body){const user=adminAuth().currentUser;if(!user)throw Error('Entre no ADM para continuar.');const r=await fetch('/api/admin-media',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+await user.getIdToken()},body:JSON.stringify(body),signal:AbortSignal.timeout(60000)}),data=await r.json();if(!r.ok)throw Error(data.error||'Não foi possível processar a imagem.');return data;}
async function upload(path,blob){if(!blob||blob.size>3*1024*1024)throw Error('A imagem processada precisa ter até 3 MB.');const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=reject;reader.readAsDataURL(blob);});return (await request({op:'upload',path,contentType:blob.type,base64})).url;}
const remove=path=>request({op:'delete',path});
async function list(folder){const files=[];let pageToken;do{const page=await request({op:'list',folder,pageToken});files.push(...page.files);pageToken=page.pageToken;}while(pageToken);return files;}
window.CimAdminMedia={upload,remove,list};
})();
