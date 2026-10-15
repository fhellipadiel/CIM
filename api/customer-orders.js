module.exports = (req, res) => require('../server/checkout.cjs').handle('customer-orders', req, res);
