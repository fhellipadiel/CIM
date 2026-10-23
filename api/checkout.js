module.exports=(req,res)=>{
 const action=req.query?.signupAction||new URL(req.url,'http://localhost').searchParams.get('signupAction');
 if(['product-page','product-sitemap','product-category','product-brand','product-catalog','product-vehicle'].includes(action))return require('../server/public-products.cjs').route(action,req,res);
 return require('../server/checkout.cjs').handle(['company-lookup','register-profile','claim-referral','support','analytics','admin-mfa','admin-recovery','admin-access','admin-media','admin-import-history','admin-navigation-analytics','employee','product-page','product-sitemap','product-category','product-brand','product-catalog'].includes(action)?action:'checkout',req,res);
};
