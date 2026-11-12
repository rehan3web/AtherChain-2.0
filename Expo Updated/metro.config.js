const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const { proxyApi } = require('./server/api-proxy');
const original = config.server.enhanceMiddleware;
config.server.enhanceMiddleware = (middleware, server) => {
  const next = original ? original(middleware, server) : middleware;
  return (req, res, connectNext) => proxyApi(req, res, () => next(req, res, connectNext));
};
module.exports = config;
