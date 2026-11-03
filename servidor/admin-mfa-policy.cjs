function withAdminMfaPolicy(input){
 const result=structuredClone(input),rules=result.rules;
 const bootstrap=rules.adminSetupAccess?.['.read']||rules.adminAccess?.['.read'];if(typeof bootstrap!=='string'||!bootstrap.includes('auth.uid'))throw Error('Private administrator rule unavailable.');
 const condition="(root.child('adminMfaPolicy').child(auth.uid).child('required').val() !== true || auth.token.firebase.sign_in_second_factor === 'totp')";
 function walk(node){for(const [key,value]of Object.entries(node)){if(typeof value==='string'&&key.startsWith('.')&&!value.includes('adminMfaPolicy'))node[key]=value.replace(/auth\.uid\s*===?\s*(['"])[^'"]+\1/g,match=>'('+match+' && '+condition+')');else if(value&&typeof value==='object')walk(value);}}
 for(const [path,value]of Object.entries(rules))if(path!=='adminSetupAccess'&&path!=='adminMfaPolicy'&&value&&typeof value==='object')walk(value);
 rules.adminSetupAccess={'.read':bootstrap,'.write':false};rules.adminMfaPolicy={'.read':false,'.write':false};
 return result;
}
module.exports={withAdminMfaPolicy};
