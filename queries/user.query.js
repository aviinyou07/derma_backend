const db = require('../config/db');

exports.findByEmail = async (email) => {
  const rows = await db.query(
    `SELECT id, name, email, phone, password, email_verified, is_active
     FROM users
     WHERE email = ?
     LIMIT 1`,
    [email]
  );

  return rows[0] || null;
};

exports.findByIdentifier = async (identifier) => {
  const rows = await db.query(
    `SELECT id, name, email, phone, password, email_verified, is_active
     FROM users
     WHERE email = ? OR phone = ?
     LIMIT 1`,
    [identifier, identifier]
  );

  return rows[0] || null;
};

exports.createUser = async (connection, { name, email, password }) => {
  const [result] = await connection.query(
    `INSERT INTO users (name, email, password)
     VALUES (?, ?, ?)`,
    [name, email, password]
  );

  return result.insertId;
};

exports.updatePassword = async (connection, userId, password) => {
  await connection.query(
    `UPDATE users
     SET password = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [password, userId]
  );
};

exports.getProfile = async (userId) => {
  const rows = await db.query(
    `SELECT id, name, email, phone, email_verified, is_active, created_at, updated_at
     FROM users
     WHERE id = ?
     LIMIT 1`,
    [userId]
  );

  return rows[0] || null;
};

exports.updateProfile = async (userId, data) => {
  const updates = [];
  const params = [];

  if (typeof data.name === 'string' && data.name.trim()) {
    updates.push('name = ?');
    params.push(data.name.trim());
  }

  if (typeof data.phone === 'string') {
    updates.push('phone = ?');
    params.push(data.phone.trim() || null);
  }

  if (!updates.length) {
    return;
  }

  params.push(userId);

  await db.query(
    `UPDATE users
     SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    params
  );
};

exports.listAddresses = async (userId) => {
  return db.query(
    `SELECT
      id,
      user_id,
      address_type,
      full_name,
      phone,
      address_line1,
      address_line2,
      city,
      state,
      postal_code,
      country,
      is_default,
      created_at,
      updated_at
     FROM user_addresses
     WHERE user_id = ?
     ORDER BY is_default DESC, id ASC`,
    [userId]
  );
};

exports.findAddressById = async (userId, addressId) => {
  const rows = await db.query(
    `SELECT
      id,
      user_id,
      address_type,
      full_name,
      phone,
      address_line1,
      address_line2,
      city,
      state,
      postal_code,
      country,
      is_default,
      created_at,
      updated_at
     FROM user_addresses
     WHERE user_id = ? AND id = ?
     LIMIT 1`,
    [userId, addressId]
  );

  return rows[0] || null;
};

exports.countAddresses = async (userId) => {
  const rows = await db.query(
    `SELECT COUNT(*) AS total
     FROM user_addresses
     WHERE user_id = ?`,
    [userId]
  );

  return Number(rows[0]?.total || 0);
};

exports.clearDefaultAddress = async (connection, userId) => {
  await connection.query(
    `UPDATE user_addresses
     SET is_default = 0,
         updated_at = CURRENT_TIMESTAMP
     WHERE user_id = ? AND is_default = 1`,
    [userId]
  );
};

exports.insertAddress = async (connection, userId, data) => {
  const [result] = await connection.query(
    `INSERT INTO user_addresses
    (user_id, address_type, full_name, phone,
     address_line1, address_line2, city, state,
     postal_code, country, is_default)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      data.address_type,
      data.full_name,
      data.phone,
      data.address_line1,
      data.address_line2,
      data.city,
      data.state,
      data.postal_code,
      data.country,
      data.is_default ? 1 : 0
    ]
  );

  return result.insertId;
};

exports.updateAddress = async (connection, userId, addressId, updates, params = []) => {
  await connection.query(
    `UPDATE user_addresses
     SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
     WHERE user_id = ? AND id = ?`,
    [...params, userId, addressId]
  );
};

exports.deleteAddress = async (connection, userId, addressId) => {
  await connection.query(
    `DELETE FROM user_addresses
     WHERE user_id = ? AND id = ?`,
    [userId, addressId]
  );
};

exports.findLatestAddress = async (connection, userId) => {
  const [rows] = await connection.query(
    `SELECT id
     FROM user_addresses
     WHERE user_id = ?
     ORDER BY id DESC
     LIMIT 1`,
    [userId]
  );

  return rows[0] || null;
};
