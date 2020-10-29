const { BlacklistedToken } = require('../models/blacklistedToken');

async function checkTokenBlacklist(req, res, next) {
  const token = req.header('x-auth-token');
  if (!token) return res.status(401).send('Access denied. No token provided.');
  try {
    const blacklistedToken = await BlacklistedToken.findOne({ string: token });
    if (blacklistedToken) return res.status(400).send(`Invalid token. Please log out and log back in.`);
    return next();
  } catch (ex) {
  return res.status(400).send('Invalid token.');
  }
}

module.exports = checkTokenBlacklist;
