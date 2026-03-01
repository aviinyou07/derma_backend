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
const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const ALLOWED_ADDRESS_TYPES = new Set(['home', 'work', 'other']);

const normalizeAddressPayload = (payload = {}) => {
  const addressType = String(payload.address_type || 'home').trim().toLowerCase();

  if (!ALLOWED_ADDRESS_TYPES.has(addressType)) {
    throw new Error('Invalid address type');
  }

  const normalized = {
    address_type: addressType,
    full_name: payload.full_name ? String(payload.full_name).trim() : null,
    phone: payload.phone ? String(payload.phone).trim() : null,
    address_line1: payload.address_line1 ? String(payload.address_line1).trim() : '',
    address_line2: payload.address_line2 ? String(payload.address_line2).trim() : null,
    city: payload.city ? String(payload.city).trim() : '',
    state: payload.state ? String(payload.state).trim() : '',
    postal_code: payload.postal_code ? String(payload.postal_code).trim() : '',
    country: payload.country ? String(payload.country).trim() : '',
    is_default: payload.is_default === true
  };

  if (!normalized.address_line1 || !normalized.city || !normalized.state || !normalized.postal_code || !normalized.country) {
    throw new Error('address_line1, city, state, postal_code and country are required');
  }

  return normalized;
};

const sendEmailSafe = async (payload) => {
  try {
    await sendEmail(payload);
    return true;
  } catch (error) {
    console.error('[EMAIL] send failed:', {
      to: payload?.to,
      subject: payload?.subject,
      error: error?.message || String(error)
    });
    return false;
  }
};

/* =======================
   SIGNUP
======================= */
exports.signup = async ({ name, email, password }) => {
  const normalizedEmail = normalizeEmail(email);
  const existing = await query.findByEmail(normalizedEmail);
  if (existing) throw new Error('Email already registered');

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
  const otp = generateOTP();

  await db.transaction(async (connection) => {
    const userId = await query.createUser(connection, {
      name,
      email: normalizedEmail,
      password: hashedPassword
    });

    await connection.query(
      `INSERT INTO user_otps
       (user_id, purpose, otp_hash, expires_at)
       VALUES (?, 'email_verification', ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))`,
      [userId, hashOTP(otp)]
    );
  });

  const mailSent = await sendEmailSafe({
    to: normalizedEmail,
    subject: 'Verify your email',
    html: `<p>Your OTP is <b>${otp}</b></p>`
  });

  const response = {
    message: mailSent
      ? 'Signup successful. Verify your email.'
      : 'Signup successful. Verification email could not be sent right now. Please contact support or retry later.'
  };

  return response;
};

/* =======================
   VERIFY EMAIL
======================= */
exports.verifyEmail = async ({ email, otp }) => {
  const user = await query.findByEmail(normalizeEmail(email));
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

  await sendEmailSafe({
    to: user.email,
    subject: 'Welcome to Derma Co',
    html: `<p>Welcome ${user.name} 🎉</p>`
  });

  return { message: 'Email verified successfully' };
};

exports.resendVerificationOtp = async ({ email }) => {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) throw new Error('Email is required');

  const user = await query.findByEmail(normalizedEmail);
  if (!user) throw new Error('User not found');
  if (user.email_verified) throw new Error('Email already verified');

  const recentOtpRows = await db.query(
    `SELECT id, created_at
     FROM user_otps
     WHERE user_id = ?
       AND purpose = 'email_verification'
       AND is_used = 0
     ORDER BY id DESC
     LIMIT 1`,
    [user.id]
  );

  const recentOtp = recentOtpRows[0] || null;
  if (recentOtp?.created_at) {
    const elapsedMs = Date.now() - new Date(recentOtp.created_at).getTime();
    const cooldownMs = 60 * 1000;
    if (elapsedMs < cooldownMs) {
      const waitSeconds = Math.max(1, Math.ceil((cooldownMs - elapsedMs) / 1000));
      throw new Error(`Please wait ${waitSeconds}s before requesting a new OTP`);
    }
  }

  const otp = generateOTP();

  await db.query(
    `INSERT INTO user_otps
     (user_id, purpose, otp_hash, expires_at)
     VALUES (?, 'email_verification', ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))`,
    [user.id, hashOTP(otp)]
  );

  const mailSent = await sendEmailSafe({
    to: normalizedEmail,
    subject: 'Your verification OTP (resend)',
    html: `<p>Your verification OTP is <b>${otp}</b></p>`
  });

  const response = {
    message: mailSent
      ? 'Verification OTP sent successfully'
      : 'Verification OTP generated but email could not be sent right now. Please retry in a moment.'
  };

  return response;
};

/* =======================
   LOGIN
======================= */
exports.login = async ({ identifier, password }) => {
  const user = await query.findByIdentifier(identifier);
  if (!user) throw new Error('Invalid credentials');

  if (!user.is_active)
    throw new Error('Account is inactive');

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
  const normalizedEmail = normalizeEmail(email);
  const user = await query.findByEmail(normalizedEmail);
  if (!user) throw new Error('User not found');

  const otp = generateOTP();

  await db.query(
    `INSERT INTO user_otps
     (user_id, purpose, otp_hash, expires_at)
     VALUES (?, 'password_reset', ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))`,
    [user.id, hashOTP(otp)]
  );

  const mailSent = await sendEmailSafe({
    to: normalizedEmail,
    subject: 'Password Reset OTP',
    html: `<p>Your reset OTP is <b>${otp}</b></p>`
  });

  const response = {
    message: mailSent
      ? 'Reset OTP sent'
      : 'Reset OTP generated but email could not be sent right now. Please retry in a moment.'
  };

  return response;
};

/* =======================
   RESET PASSWORD
======================= */
exports.resetPassword = async ({ email, otp, newPassword }) => {
  const user = await query.findByEmail(normalizeEmail(email));
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

  await sendEmailSafe({
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

exports.listAddresses = async (userId) => {
  const rows = await query.listAddresses(userId);
  return { data: rows };
};

exports.addAddress = async (userId, payload) => {
  const data = normalizeAddressPayload(payload);

  const addressId = await db.transaction(async (connection) => {
    const totalAddresses = await query.countAddresses(userId);
    const shouldBeDefault = data.is_default || totalAddresses === 0;

    if (shouldBeDefault) {
      await query.clearDefaultAddress(connection, userId);
    }

    return query.insertAddress(connection, userId, {
      ...data,
      is_default: shouldBeDefault
    });
  });

  const address = await query.findAddressById(userId, addressId);
  return {
    message: 'Address added successfully',
    data: address
  };
};

exports.updateAddress = async (userId, addressId, payload) => {
  const id = Number(addressId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('Invalid address id');
  }

  const existing = await query.findAddressById(userId, id);
  if (!existing) {
    throw new Error('Address not found');
  }

  const updates = [];
  const params = [];

  if (payload.address_type !== undefined) {
    const nextType = String(payload.address_type || '').trim().toLowerCase();
    if (!ALLOWED_ADDRESS_TYPES.has(nextType)) {
      throw new Error('Invalid address type');
    }
    updates.push('address_type = ?');
    params.push(nextType);
  }

  const optionalFields = [
    'full_name',
    'phone',
    'address_line1',
    'address_line2',
    'city',
    'state',
    'postal_code',
    'country'
  ];

  for (const key of optionalFields) {
    if (payload[key] !== undefined) {
      updates.push(`${key} = ?`);

      const value = payload[key] == null ? null : String(payload[key]).trim();
      if (['address_line1', 'city', 'state', 'postal_code', 'country'].includes(key) && !value) {
        throw new Error(`${key} cannot be empty`);
      }

      params.push(value || null);
    }
  }

  const setDefault = payload.is_default === true;

  if (!updates.length && !setDefault) {
    return {
      message: 'No changes applied',
      data: existing
    };
  }

  await db.transaction(async (connection) => {
    if (setDefault) {
      await query.clearDefaultAddress(connection, userId);
      updates.push('is_default = 1');
    }

    const bindParams = params.length ? [...params, userId, id] : [userId, id];
    await connection.query(
      `UPDATE user_addresses
       SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = ? AND id = ?`,
      bindParams
    );
  });

  const updated = await query.findAddressById(userId, id);
  return {
    message: 'Address updated successfully',
    data: updated
  };
};

exports.deleteAddress = async (userId, addressId) => {
  const id = Number(addressId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('Invalid address id');
  }

  const existing = await query.findAddressById(userId, id);
  if (!existing) {
    throw new Error('Address not found');
  }

  await db.transaction(async (connection) => {
    await query.deleteAddress(connection, userId, id);

    if (Number(existing.is_default) === 1) {
      const latest = await query.findLatestAddress(connection, userId);
      if (latest?.id) {
        await connection.query(
          `UPDATE user_addresses
           SET is_default = 1,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [latest.id]
        );
      }
    }
  });

  return { message: 'Address deleted successfully' };
};

exports.setDefaultAddress = async (userId, addressId) => {
  const id = Number(addressId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('Invalid address id');
  }

  const existing = await query.findAddressById(userId, id);
  if (!existing) {
    throw new Error('Address not found');
  }

  await db.transaction(async (connection) => {
    await query.clearDefaultAddress(connection, userId);

    await connection.query(
      `UPDATE user_addresses
       SET is_default = 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = ? AND id = ?`,
      [userId, id]
    );
  });

  const updated = await query.findAddressById(userId, id);
  return {
    message: 'Default address updated',
    data: updated
  };
};