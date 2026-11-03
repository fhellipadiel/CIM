module.exports=(req,res)=>{
 const action=req.query?.signupAction||new URL(req.url,'http://localhost').searchParams.get('signupAction');
 if(['product-page','product-sitemap','product-category','product-brand','product-catalog','product-vehicle'].includes(action))return require('../servidor/public-products.cjs').route(action,req,res);
 return require('../servidor/checkout.cjs').handle(['company-lookup','register-profile','claim-referral','support','analytics','admin-mfa','admin-recovery','admin-access','admin-media','admin-import-history','admin-navigation-analytics','employee','site-content','product-page','product-sitemap','product-category','product-brand','product-catalog'].includes(action)?action:'checkout',req,res);
};
