const jwt = require('jsonwebtoken');
const config = require('config');

function auth(req, res, next) {
  const token = req.header('x-auth-token');
  if (!token) return res.status(401).send('Access denied. No token provided.');
  try {
    jwt.verify(token, config.get('jwtSecret'), function(err, tokenPayload) {
      if (err) return res.status(400).send(`Invalid token.\nerror = ${err}`);
      req.user = tokenPayload;
      return next();
    });

  } catch (ex) {
  return res.status(400).send('Invalid token.');
  }
}

module.exports = auth;
