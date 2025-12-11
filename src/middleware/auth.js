const { verifyToken } = require('../utils/jwt');

const auth = (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (!token || scheme.toLowerCase() !== 'bearer') {
    return res.status(401).json({ error: 'Authorization required' });
  }

  try {
    const decoded = verifyToken(token);
    req.user = { id: decoded.id };
    return next();
  } catch (err) {
    console.error('Auth error', err.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Optional auth - sets user if token exists, but doesn't require it
const optionalAuth = (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (token && scheme.toLowerCase() === 'bearer') {
    try {
      const decoded = verifyToken(token);
      req.user = { id: decoded.id };
    } catch (err) {
      // Ignore invalid tokens for optional auth
      req.user = null;
    }
  } else {
    req.user = null;
  }
  
  return next();
};

module.exports = auth;
module.exports.optionalAuth = optionalAuth;
