const db = require('../config/db');

exports.getWishlistByUser = async (userId) => {
  return db.query(
    `SELECT
      wi.id,
      wi.product_id,
      wi.created_at,
      p.name AS product_name,
      p.slug AS product_slug,
      p.images,
      p.average_rating,
      p.review_count,
      MIN(pv.price) AS starting_price
     FROM wishlist_items wi
     JOIN products p ON p.id = wi.product_id
     LEFT JOIN product_variations pv
       ON pv.product_id = p.id AND pv.is_active = 1
     WHERE wi.user_id = ?
       AND p.is_active = 1
     GROUP BY wi.id
     ORDER BY wi.created_at DESC`,
    [userId]
  );
};

exports.findWishlistItem = async (userId, productId) => {
  const rows = await db.query(
    `SELECT id, user_id, product_id
     FROM wishlist_items
     WHERE user_id = ? AND product_id = ?
     LIMIT 1`,
    [userId, productId]
  );

  return rows[0] || null;
};

exports.findProductById = async (productId) => {
  const rows = await db.query(
    `SELECT id, is_active
     FROM products
     WHERE id = ?
     LIMIT 1`,
    [productId]
  );

  return rows[0] || null;
};

exports.insertWishlistItem = async (userId, productId) => {
  const result = await db.query(
    `INSERT INTO wishlist_items (user_id, product_id)
     VALUES (?, ?)`,
    [userId, productId]
  );

  return result.insertId;
};

exports.deleteWishlistItem = async (userId, productId) => {
  await db.query(
    `DELETE FROM wishlist_items
     WHERE user_id = ? AND product_id = ?`,
    [userId, productId]
  );
};
