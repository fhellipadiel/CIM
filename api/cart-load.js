module.exports = (req, res) => require('../server/checkout.cjs').handle('cart-load', req, res);
