const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../config/db');
const query = require('../queries/auth.query');
const { generateOTP } = require('../utils/otp');

const SALT_ROUNDS = 10;

const hashOTP = (otp) =>
  crypto.createHash('sha256').update(otp).digest('hex');

/* ======================
   SIGNUP
====================== */
exports.signup = async ({ name, email, password }) => {
  const existing = await query.findByEmail(email);
  if (existing) throw new Error('Email already registered');

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
  const otp = generateOTP();
  const otpHash = hashOTP(otp);

  await db.transaction(async (connection) => {
    const userId = await query.createUser(connection, {
      name,
      email,
      password: hashedPassword
    });

    await query.insertOTP(connection, {
      user_id: userId,
      purpose: 'email_verification',
      otp_hash: otpHash
    });
  });

  console.log("Email OTP:", otp);

  return { message: "Account created. Verify your email." };
};

/* ======================
   VERIFY EMAIL
====================== */
exports.verifyEmail = async ({ email, otp }) => {
  const user = await query.findByEmail(email);
  if (!user) throw new Error('User not found');

  const record = await query.findActiveOTP(user.id, 'email_verification');
  if (!record) throw new Error('OTP expired or invalid');

  if (record.attempts >= 5)
    throw new Error('Too many failed attempts');

  if (hashOTP(otp) !== record.otp_hash) {
    await query.incrementOTPAttempts(record.id);
    throw new Error('Invalid OTP');
  }

  await db.transaction(async (connection) => {
    await query.markOTPUsed(connection, record.id);
    await query.markEmailVerified(connection, user.id);
  });

  return { message: "Email verified successfully" };
};

/* ======================
   LOGIN
====================== */
exports.login = async ({ identifier, password }) => {
  const user = await query.findByIdentifier(identifier);
  if (!user) throw new Error('Invalid credentials');

  if (!user.email_verified)
    throw new Error('Email not verified');

  if (!user.is_active)
    throw new Error('Account disabled');

  const match = await bcrypt.compare(password, user.password);
  if (!match) throw new Error('Invalid credentials');

  const token = jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );

  return { message: "Login successful", token };
};

/* ======================
   RESEND OTP
====================== */
exports.resendOTP = async ({ email, purpose }) => {
  const user = await query.findByEmail(email);
  if (!user) throw new Error('User not found');

  const otp = generateOTP();
  const otpHash = hashOTP(otp);

  await db.transaction(async (connection) => {
    await query.invalidateOldOTPs(connection, user.id, purpose);

    await query.insertOTP(connection, {
      user_id: user.id,
      purpose,
      otp_hash: otpHash
    });
  });

  console.log("Resent OTP:", otp);

  return { message: "OTP resent successfully" };
};

/* ======================
   REQUEST PASSWORD RESET
====================== */
exports.requestPasswordReset = async ({ email }) => {
  const user = await query.findByEmail(email);
  if (!user) throw new Error('User not found');

  const otp = generateOTP();
  const otpHash = hashOTP(otp);

  await db.transaction(async (connection) => {
    await query.invalidateOldOTPs(connection, user.id, 'password_reset');

    await query.insertOTP(connection, {
      user_id: user.id,
      purpose: 'password_reset',
      otp_hash: otpHash
    });
  });

  console.log("Reset OTP:", otp);

  return { message: "Password reset OTP sent" };
};

/* ======================
   RESET PASSWORD
====================== */
exports.resetPassword = async ({ email, otp, newPassword }) => {
  const user = await query.findByEmail(email);
  if (!user) throw new Error('User not found');

  const record = await query.findActiveOTP(user.id, 'password_reset');
  if (!record) throw new Error('OTP expired or invalid');

  if (hashOTP(otp) !== record.otp_hash)
    throw new Error('Invalid OTP');

  const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

  await db.transaction(async (connection) => {
    await query.markOTPUsed(connection, record.id);
    await query.updatePassword(connection, user.id, hashedPassword);
  });

  return { message: "Password reset successful" };
};