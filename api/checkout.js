module.exports=(req,res)=>{
 const action=req.query?.signupAction||new URL(req.url,'http://localhost').searchParams.get('signupAction');
 return require('../server/checkout.cjs').handle(['company-lookup','register-profile','support'].includes(action)?action:'checkout',req,res);
};
