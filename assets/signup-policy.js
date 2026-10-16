(function(root,factory){const policy=factory();if(typeof module==='object'&&module.exports)module.exports=policy;else root.SignupPolicy=policy;})(typeof globalThis==='undefined'?this:globalThis,function(){
 function passwordChecks(value){const p=String(value||'');return {length:p.length>=8,uppercase:/[A-Z]/.test(p),lowercase:/[a-z]/.test(p),number:/[0-9]/.test(p),symbol:"^$*.[]{}()?\"!@#%&/\\,><':;|_~".split('').some(char=>p.includes(char))};}
 function strongPassword(value){return Object.values(passwordChecks(value)).every(Boolean);}
 function digits(value){return String(value||'').replace(/\D/g,'');}
 function validDocument(type,value){
  const d=digits(value);if(!['PF','PJ'].includes(type)||d.length!==(type==='PF'?11:14)||/^(\d)\1+$/.test(d))return false;
  if(type==='PF'){for(let size=9;size<=10;size++){let sum=0;for(let i=0;i<size;i++)sum+=Number(d[i])*(size+1-i);const digit=(sum*10)%11%10;if(digit!==Number(d[size]))return false;}return true;}
  for(let size=12;size<=13;size++){let sum=0,weight=size-7;for(let i=0;i<size;i++){sum+=Number(d[i])*weight;if(--weight<2)weight=9;}const rest=sum%11;if((rest<2?0:11-rest)!==Number(d[size]))return false;}return true;
 }
 return Object.freeze({passwordChecks,strongPassword,digits,validDocument});
});
