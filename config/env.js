const REQUIRED_SECRETS = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];
const DB_KEYS = ['DB_HOST', 'DB_USER', 'DB_DATABASE'];
const SMTP_KEYS = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'];
const RAZORPAY_KEYS = ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET'];

const isPlaceholder = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return true;
  if (normalized.includes('xxxxxxxx')) return true;
  return normalized.startsWith('your_') || normalized.startsWith('replace_with_');
};

const validateEnv = () => {
  const missingSecrets = REQUIRED_SECRETS.filter((key) => !process.env[key]);
  const missingDb = DB_KEYS.filter((key) => !process.env[key]);
  const missingSmtp = SMTP_KEYS.filter((key) => !process.env[key]);
  const missingRazorpay = RAZORPAY_KEYS.filter((key) => !process.env[key]);

  if (missingSecrets.length) {
    throw new Error(`Missing required environment variables: ${missingSecrets.join(', ')}`);
  }

  if (missingDb.length) {
    console.warn(`[BOOT] Database env appears incomplete: ${missingDb.join(', ')}`);
  }

  if (missingSmtp.length) {
    console.warn(`[BOOT] Email env appears incomplete: ${missingSmtp.join(', ')}. OTP/password emails may fail.`);
  }

  if (missingRazorpay.length) {
    console.warn(`[BOOT] Razorpay env appears incomplete: ${missingRazorpay.join(', ')}. Online checkout will fail until configured.`);
  } else if (isPlaceholder(process.env.RAZORPAY_KEY_ID) || isPlaceholder(process.env.RAZORPAY_KEY_SECRET)) {
    console.warn('[BOOT] Razorpay credentials look like placeholders. Online checkout will fail until real credentials are configured.');
  }
};

module.exports = {
  validateEnv
};
