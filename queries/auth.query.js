const db = require('../config/db');

exports.findByEmail = async (email) => {
  const rows = await db.query(
    `SELECT * FROM users WHERE email = ?`,
    [email]
  );
  return rows[0];
};

exports.findByIdentifier = async (identifier) => {
  const rows = await db.query(
    `SELECT * FROM users 
     WHERE email = ? OR phone = ?`,
    [identifier, identifier]
  );
  return rows[0];
};

exports.createUser = async (connection, { name, email, password }) => {
  const [result] = await connection.query(
    `INSERT INTO users (name, email, password)
     VALUES (?, ?, ?)`,
    [name, email, password]
  );
  return result.insertId;
};

exports.insertOTP = async (connection, { user_id, purpose, otp_hash }) => {
  await connection.query(
    `INSERT INTO user_otps
     (user_id, purpose, otp_hash, expires_at)
     VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))`,
    [user_id, purpose, otp_hash]
  );
};

exports.invalidateOldOTPs = async (connection, user_id, purpose) => {
  await connection.query(
    `UPDATE user_otps
     SET is_used = 1
     WHERE user_id = ?
     AND purpose = ?
     AND is_used = 0`,
    [user_id, purpose]
  );
};

exports.findActiveOTP = async (user_id, purpose) => {
  const rows = await db.query(
    `SELECT * FROM user_otps
     WHERE user_id = ?
     AND purpose = ?
     AND is_used = 0
     AND expires_at > NOW()
     ORDER BY id DESC LIMIT 1`,
    [user_id, purpose]
  );
  return rows[0];
};

exports.incrementOTPAttempts = async (otp_id) => {
  await db.query(
    `UPDATE user_otps 
     SET attempts = attempts + 1
     WHERE id = ?`,
    [otp_id]
  );
};

exports.markOTPUsed = async (connection, otp_id) => {
  await connection.query(
    `UPDATE user_otps SET is_used = 1 WHERE id = ?`,
    [otp_id]
  );
};

exports.markEmailVerified = async (connection, user_id) => {
  await connection.query(
    `UPDATE users SET email_verified = 1 WHERE id = ?`,
    [user_id]
  );
};

exports.updatePassword = async (connection, user_id, hashedPassword) => {
  await connection.query(
    `UPDATE users SET password = ? WHERE id = ?`,
    [hashedPassword, user_id]
  );
};