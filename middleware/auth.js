const jwt = require('jsonwebtoken');
const config = require('config');

function auth(req, res, next) {
  const token = req.header('x-auth-token');
  if (!token) return res.status(401).send('Access denied. No token provided.');
  try {
  const tokenPayload = jwt.verify(token, config.get('jwtSecret'));
  req.user = tokenPayload;
  return next();
  } catch (ex) {
  return res.status(400).send('Invalid token.');
  }
}

module.exports = auth;
