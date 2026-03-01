const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../config/db');
const query = require('../queries/user.query');
const { generateOTP } = require('../utils/otp');
const { sendEmail } = require('../utils/email');

const SALT_ROUNDS = 10;
const hashOTP = (otp) =>
  crypto.createHash('sha256').update(otp).digest('hex');

/* =======================
   SIGNUP
======================= */
exports.signup = async ({ name, email, password }) => {
  const existing = await query.findByEmail(email);
  if (existing) throw new Error('Email already registered');

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
  const otp = generateOTP();

  await db.transaction(async (connection) => {
    const userId = await query.createUser(connection, {
      name,
      email,
      password: hashedPassword
    });

    await connection.query(
      `INSERT INTO user_otps
       (user_id, purpose, otp_hash, expires_at)
       VALUES (?, 'email_verification', ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))`,
      [userId, hashOTP(otp)]
    );
  });

  await sendEmail({
    to: email,
    subject: 'Verify your email',
    html: `<p>Your OTP is <b>${otp}</b></p>`
  });

  return { message: 'Signup successful. Verify your email.' };
};

/* =======================
   VERIFY EMAIL
======================= */
exports.verifyEmail = async ({ email, otp }) => {
  const user = await query.findByEmail(email);
  if (!user) throw new Error('User not found');

  const rows = await db.query(
    `SELECT * FROM user_otps
     WHERE user_id = ?
     AND purpose = 'email_verification'
     AND is_used = 0
     AND expires_at > NOW()
     ORDER BY id DESC LIMIT 1`,
    [user.id]
  );

  const record = rows[0];
  if (!record) throw new Error('Invalid or expired OTP');

  if (hashOTP(otp) !== record.otp_hash)
    throw new Error('Invalid OTP');

  await db.transaction(async (connection) => {
    await connection.query(
      `UPDATE user_otps SET is_used = 1 WHERE id = ?`,
      [record.id]
    );

    await connection.query(
      `UPDATE users SET email_verified = 1 WHERE id = ?`,
      [user.id]
    );
  });

  await sendEmail({
    to: user.email,
    subject: 'Welcome to Derma Co',
    html: `<p>Welcome ${user.name} 🎉</p>`
  });

  return { message: 'Email verified successfully' };
};

/* =======================
   LOGIN
======================= */
exports.login = async ({ identifier, password }) => {
  const user = await query.findByIdentifier(identifier);
  if (!user) throw new Error('Invalid credentials');

  if (!user.email_verified)
    throw new Error('Email not verified');

  const match = await bcrypt.compare(password, user.password);
  if (!match) throw new Error('Invalid credentials');

  const token = jwt.sign(
    { id: user.id },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN }
  );

  return { token };
};

/* =======================
   FORGOT PASSWORD
======================= */
exports.forgotPassword = async ({ email }) => {
  const user = await query.findByEmail(email);
  if (!user) throw new Error('User not found');

  const otp = generateOTP();

  await db.query(
    `INSERT INTO user_otps
     (user_id, purpose, otp_hash, expires_at)
     VALUES (?, 'password_reset', ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))`,
    [user.id, hashOTP(otp)]
  );

  await sendEmail({
    to: email,
    subject: 'Password Reset OTP',
    html: `<p>Your reset OTP is <b>${otp}</b></p>`
  });

  return { message: 'Reset OTP sent' };
};

/* =======================
   RESET PASSWORD
======================= */
exports.resetPassword = async ({ email, otp, newPassword }) => {
  const user = await query.findByEmail(email);
  if (!user) throw new Error('User not found');

  const rows = await db.query(
    `SELECT * FROM user_otps
     WHERE user_id = ?
     AND purpose = 'password_reset'
     AND is_used = 0
     AND expires_at > NOW()
     ORDER BY id DESC LIMIT 1`,
    [user.id]
  );

  const record = rows[0];
  if (!record) throw new Error('Invalid or expired OTP');

  if (hashOTP(otp) !== record.otp_hash)
    throw new Error('Invalid OTP');

  const hashed = await bcrypt.hash(newPassword, SALT_ROUNDS);

  await db.transaction(async (connection) => {
    await query.updatePassword(connection, user.id, hashed);
    await connection.query(
      `UPDATE user_otps SET is_used = 1 WHERE id = ?`,
      [record.id]
    );
  });

  await sendEmail({
    to: user.email,
    subject: 'Password Changed',
    html: `<p>Your password has been changed successfully.</p>`
  });

  return { message: 'Password reset successful' };
};

/* =======================
   PROFILE
======================= */
exports.getProfile = async (userId) => {
  return await query.getProfile(userId);
};

exports.updateProfile = async (userId, data) => {
  await query.updateProfile(userId, data);
  return { message: 'Profile updated successfully' };
};