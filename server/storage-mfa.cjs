async function configureStorageMfa(auth,uid,enabled){
 if(!/^[A-Za-z0-9_-]{1,128}$/.test(uid))throw Error('Identificador administrativo invalido.');
 const credential=auth.app.options.credential,project=auth.app.options.projectId||credential.projectId||process.env.GCLOUD_PROJECT||'redx-6b53f',bucket=auth.app.options.storageBucket||process.env.FIREBASE_STORAGE_BUCKET||project+'.firebasestorage.app';
 const token=(await credential.getAccessToken()).access_token,base='https://firebaserules.googleapis.com/v1/';
 async function request(path,method='GET',body){const r=await fetch(base+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Nao foi possivel atualizar a protecao das fotos ('+r.status+').');return r.json();}
 const name='projects/'+project+'/releases/firebase.storage/'+bucket,release=await request(name),ruleset=await request(release.rulesetName),files=ruleset.source?.files;
 if(files?.some(f=>f.content.includes('// Administrative media is authorized by the server.')))return;
 if(!files?.length)throw Error('Regras de armazenamento indisponiveis.');
 const guard=' && (request.auth.uid != '+JSON.stringify(uid)+" || request.auth.token.firebase.sign_in_second_factor == 'totp')";
 let found=false,changed=false;
 for(const file of files){file.content=file.content.replace(/function admin\(\)\s*\{\s*return ([^;]+);\s*\}/,(all,expression)=>{found=true;const next=enabled?(expression.includes(guard)?expression:expression+guard):expression.split(guard).join('');changed=changed||next!==expression;return 'function admin(){return '+next+';}';});}
 if(!found)throw Error('As regras das fotos precisam de revisao antes de ativar o autenticador.');
 if(!changed)return;
 const created=await request('projects/'+project+'/rulesets','POST',{source:{files:files.map(({name,content})=>({name,content}))}});
 await request(name,'PATCH',{release:{name,rulesetName:created.name},updateMask:'ruleset_name'});
 if((await request(name)).rulesetName!==created.name)throw Error('Nao foi possivel confirmar a protecao das fotos.');
}
module.exports={configureStorageMfa};
