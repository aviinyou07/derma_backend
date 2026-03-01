const db = require('../config/db');

exports.findByEmail = async (email) => {
  const rows = await db.query(
    `SELECT id, email, full_name, source, is_active, subscribed_at, unsubscribed_at
     FROM newsletter_subscribers
     WHERE email = ?
     LIMIT 1`,
    [email]
  );

  return rows[0] || null;
};

exports.insertSubscriber = async ({ email, fullName, source }) => {
  const result = await db.query(
    `INSERT INTO newsletter_subscribers (email, full_name, source, is_active, subscribed_at, unsubscribed_at)
     VALUES (?, ?, ?, 1, NOW(), NULL)`,
    [email, fullName, source]
  );

  return result.insertId;
};

exports.activateSubscriber = async (id, { fullName, source }) => {
  await db.query(
    `UPDATE newsletter_subscribers
     SET full_name = COALESCE(?, full_name),
         source = COALESCE(?, source),
         is_active = 1,
         subscribed_at = NOW(),
         unsubscribed_at = NULL,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [fullName, source, id]
  );
};

exports.deactivateSubscriber = async (id) => {
  await db.query(
    `UPDATE newsletter_subscribers
     SET is_active = 0,
         unsubscribed_at = NOW(),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [id]
  );
};
