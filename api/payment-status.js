module.exports = (req, res) => require('../servidor/checkout.cjs').handle('payment-status', req, res);
