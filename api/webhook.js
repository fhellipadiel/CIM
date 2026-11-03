module.exports = (req, res) => require('../servidor/checkout.cjs').handle('webhook', req, res);
