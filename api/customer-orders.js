module.exports = (req, res) => require('../servidor/checkout.cjs').handle('customer-orders', req, res);
