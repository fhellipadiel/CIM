const MEMBER="root.child('accessControl').child('admins').child(auth.uid)";
const READ=MEMBER+".child('enabled').val() === true && "+MEMBER+".child('canRead').val() === true";
const WRITE=READ+" && "+MEMBER+".child('canWrite').val() === true";
const MFA="root.child('adminMfaPolicy').child(auth.uid).child('recoveryPending').val() !== true && (root.child('adminMfaPolicy').child(auth.uid).child('required').val() !== true || auth.token.firebase.sign_in_second_factor === 'totp')";
function withAccessRegistry(input){
 const result=structuredClone(input),rules=result.rules;if(!rules||typeof rules.adminSetupAccess?.['.read']!=='string')throw Error('Administrator rules unavailable.');
 function walk(node){for(const [key,value]of Object.entries(node)){if(typeof value==='string'&&key.startsWith('.'))node[key]=value.replace(/auth\.uid\s*===?\s*(['"])[^'"]+\1/g,'('+ (key==='.read'?READ:WRITE)+' && '+MFA+')');else if(value&&typeof value==='object')walk(value);}}
 walk(rules);
 rules.adminAccess={'.read':'auth != null && ('+READ+') && ('+MFA+')','.write':false};
 rules.adminWriteAccess={'.read':'auth != null && ('+WRITE+') && ('+MFA+')','.write':false};
 rules.adminSetupAccess={'.read':'auth != null && ('+READ+')','.write':false};
 for(const path of ['accessControl','adminMfaPolicy','mfaRecoveryChallenges','mfaRecoveryLocks','mfaRecoveryRateLimits','securityAudit'])rules[path]={'.read':false,'.write':false};
 if(JSON.stringify(rules).match(/auth\.uid\s*===?\s*['"][^'"]+['"]/))throw Error('Literal account authorization remains.');
 return result;
}
const storageRules=`rules_version = '2';
service firebase.storage {
 // Administrative media is authorized by the server.
 match /b/{bucket}/o {
  function image(){return request.resource.size > 0 && request.resource.size <= 5 * 1024 * 1024 && request.resource.contentType.matches('image/(jpeg|png|webp|gif)');}
  match /{folder}/{allPaths=**} {
   allow get: if folder in ['products','sessions','brands','contacts','profile','links','about','leadCampaigns'];
   allow write, list: if false;
  }
  match /avatars/{userId}/{allPaths=**} {
   allow get: if true;
   allow create, update: if request.auth != null && request.auth.uid == userId && image();
   allow delete: if request.auth != null && request.auth.uid == userId;
  }
 }
}
`;
module.exports={withAccessRegistry,storageRules,READ,WRITE,MFA};
