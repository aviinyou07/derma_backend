const REQUIRED_SECRETS = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];
const DB_KEYS = ['DB_HOST', 'DB_USER', 'DB_DATABASE'];
const SMTP_KEYS = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'];

const validateEnv = () => {
  const missingSecrets = REQUIRED_SECRETS.filter((key) => !process.env[key]);
  const missingDb = DB_KEYS.filter((key) => !process.env[key]);
  const missingSmtp = SMTP_KEYS.filter((key) => !process.env[key]);

  if (missingSecrets.length) {
    throw new Error(`Missing required environment variables: ${missingSecrets.join(', ')}`);
  }

  if (missingDb.length) {
    console.warn(`[BOOT] Database env appears incomplete: ${missingDb.join(', ')}`);
  }

  if (missingSmtp.length) {
    console.warn(`[BOOT] Email env appears incomplete: ${missingSmtp.join(', ')}. OTP/password emails may fail.`);
  }
};

module.exports = {
  validateEnv
};
