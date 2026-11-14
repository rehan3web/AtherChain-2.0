const fs = require('node:fs');
const path = require('node:path');

module.exports = ({ config }) => {
  // EAS file environment variable, or a local file kept out of Git.
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON ||
    (fs.existsSync(path.join(__dirname, 'google-services.json')) ? './google-services.json' : undefined);
  if (process.env.EAS_BUILD_PLATFORM === 'android' && !googleServicesFile) {
    throw new Error('Android push requires GOOGLE_SERVICES_JSON in EAS or a local google-services.json before building.');
  }
  return {
    ...config,
    android: { ...config.android, ...(googleServicesFile ? { googleServicesFile } : {}) },
  };
};
