const nodemailer = require('nodemailer');

const parseBoolean = (value, fallback = false) => {
  if (value == null) return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
  return fallback;
};

const smtpHost = process.env.SMTP_HOST;
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const smtpFrom = process.env.SMTP_FROM || smtpUser;
const smtpSecure = parseBoolean(process.env.SMTP_SECURE, smtpPort === 465);

let transporter;
let transporterVerified = false;

const getTransporter = () => {
  if (transporter) return transporter;

  if (!smtpHost || !smtpUser || !smtpPass) {
    throw new Error('SMTP is not configured. Required vars: SMTP_HOST, SMTP_USER, SMTP_PASS');
  }

  transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: {
      user: smtpUser,
      pass: smtpPass
    }
  });

  return transporter;
};

exports.sendEmail = async ({ to, subject, html }) => {
  const smtpTransporter = getTransporter();

  if (!transporterVerified) {
    await smtpTransporter.verify();
    transporterVerified = true;
  }

  if (!smtpFrom) {
    throw new Error('SMTP_FROM or SMTP_USER must be set for the sender address');
  }

  await smtpTransporter.sendMail({
    from: `"Derma Co" <${smtpFrom}>`,
    to,
    subject,
    html
  });
};