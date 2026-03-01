const db = require('../config/db');

exports.getCartItemsByUser = async (userId) => {
  return db.query(
    `SELECT
      ci.id,
      ci.user_id,
      ci.variation_id,
      ci.quantity,
      ci.created_at,
      ci.updated_at,
      pv.product_id,
      pv.size,
      pv.price,
      pv.mrp,
      pv.gst_percentage,
      pv.stock,
      p.name AS product_name,
      p.slug AS product_slug,
      p.images
     FROM cart_items ci
     JOIN product_variations pv ON pv.id = ci.variation_id
     JOIN products p ON p.id = pv.product_id
     WHERE ci.user_id = ?
       AND pv.is_active = 1
       AND p.is_active = 1
     ORDER BY ci.id DESC`,
    [userId]
  );
};

exports.getCartItemById = async (userId, itemId) => {
  const rows = await db.query(
    `SELECT id, user_id, variation_id, quantity
     FROM cart_items
     WHERE user_id = ? AND id = ?
     LIMIT 1`,
    [userId, itemId]
  );

  return rows[0] || null;
};

exports.getCartItemByVariation = async (userId, variationId) => {
  const rows = await db.query(
    `SELECT id, user_id, variation_id, quantity
     FROM cart_items
     WHERE user_id = ? AND variation_id = ?
     LIMIT 1`,
    [userId, variationId]
  );

  return rows[0] || null;
};

exports.getVariationForCart = async (variationId) => {
  const rows = await db.query(
    `SELECT
      pv.id,
      pv.product_id,
      pv.size,
      pv.price,
      pv.gst_percentage,
      pv.stock,
      p.name AS product_name,
      p.slug AS product_slug,
      p.images
     FROM product_variations pv
     JOIN products p ON p.id = pv.product_id
     WHERE pv.id = ?
       AND pv.is_active = 1
       AND p.is_active = 1
     LIMIT 1`,
    [variationId]
  );

  return rows[0] || null;
};

exports.insertCartItem = async (userId, variationId, quantity) => {
  const result = await db.query(
    `INSERT INTO cart_items (user_id, variation_id, quantity)
     VALUES (?, ?, ?)`,
    [userId, variationId, quantity]
  );

  return result.insertId;
};

exports.updateCartItemQuantity = async (userId, itemId, quantity) => {
  await db.query(
    `UPDATE cart_items
     SET quantity = ?, updated_at = CURRENT_TIMESTAMP
     WHERE user_id = ? AND id = ?`,
    [quantity, userId, itemId]
  );
};

exports.updateCartItemByVariation = async (userId, variationId, quantity) => {
  await db.query(
    `UPDATE cart_items
     SET quantity = ?, updated_at = CURRENT_TIMESTAMP
     WHERE user_id = ? AND variation_id = ?`,
    [quantity, userId, variationId]
  );
};

exports.deleteCartItem = async (userId, itemId) => {
  await db.query(
    `DELETE FROM cart_items
     WHERE user_id = ? AND id = ?`,
    [userId, itemId]
  );
};

exports.clearCart = async (userId) => {
  await db.query(
    `DELETE FROM cart_items
     WHERE user_id = ?`,
    [userId]
  );
};
