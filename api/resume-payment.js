module.exports = (req, res) => require('../server/checkout.cjs').handle('resume-payment', req, res);
