const REQUIRED_SECRETS = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];
const DB_KEYS = ['DB_HOST', 'DB_USER', 'DB_DATABASE'];

const validateEnv = () => {
  const missingSecrets = REQUIRED_SECRETS.filter((key) => !process.env[key]);
  const missingDb = DB_KEYS.filter((key) => !process.env[key]);

  if (missingSecrets.length) {
    throw new Error(`Missing required environment variables: ${missingSecrets.join(', ')}`);
  }

  if (missingDb.length) {
    console.warn(`[BOOT] Database env appears incomplete: ${missingDb.join(', ')}`);
  }
};

module.exports = {
  validateEnv
};
