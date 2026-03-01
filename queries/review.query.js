const db = require('../config/db');

exports.findProductBySlug = async (slug) => {
  const rows = await db.query(
    `SELECT id, name, slug
     FROM products
     WHERE slug = ? AND is_active = 1
     LIMIT 1`,
    [slug]
  );

  return rows[0] || null;
};

exports.listProductReviews = async (productId, { limit, offset }) => {
  return db.query(
    `SELECT
      r.id,
      r.product_id,
      r.rating,
      r.review_title,
      r.review_text,
      r.is_verified_purchase,
      r.created_at,
      u.id AS user_id,
      u.name AS user_name
     FROM product_reviews r
     JOIN users u ON u.id = r.user_id
     WHERE r.product_id = ?
       AND r.is_published = 1
     ORDER BY r.created_at DESC
     LIMIT ? OFFSET ?`,
    [productId, limit, offset]
  );
};

exports.countProductReviews = async (productId) => {
  const rows = await db.query(
    `SELECT COUNT(*) AS total
     FROM product_reviews
     WHERE product_id = ?
       AND is_published = 1`,
    [productId]
  );

  return Number(rows[0]?.total || 0);
};

exports.findOrderItemForUser = async (userId, orderItemId) => {
  const rows = await db.query(
    `SELECT
      oi.id,
      oi.order_id,
      oi.product_id
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     WHERE oi.id = ? AND o.user_id = ?
     LIMIT 1`,
    [orderItemId, userId]
  );

  return rows[0] || null;
};

exports.findReviewByOrderItem = async (orderItemId) => {
  const rows = await db.query(
    `SELECT id, user_id, product_id
     FROM product_reviews
     WHERE order_item_id = ?
     LIMIT 1`,
    [orderItemId]
  );

  return rows[0] || null;
};

exports.insertReview = async (connection, payload) => {
  const [result] = await connection.query(
    `INSERT INTO product_reviews
    (user_id, product_id, order_item_id, rating, review_title, review_text, is_verified_purchase)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.user_id,
      payload.product_id,
      payload.order_item_id,
      payload.rating,
      payload.review_title,
      payload.review_text,
      payload.is_verified_purchase ? 1 : 0
    ]
  );

  return result.insertId;
};

exports.findReviewByIdForUser = async (userId, reviewId) => {
  const rows = await db.query(
    `SELECT
      id,
      user_id,
      product_id,
      order_item_id,
      rating,
      review_title,
      review_text,
      is_verified_purchase,
      is_published,
      created_at,
      updated_at
     FROM product_reviews
     WHERE user_id = ? AND id = ?
     LIMIT 1`,
    [userId, reviewId]
  );

  return rows[0] || null;
};

exports.updateReview = async (connection, reviewId, updates, params = []) => {
  await connection.query(
    `UPDATE product_reviews
     SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [...params, reviewId]
  );
};

exports.refreshProductReviewStats = async (connection, productId) => {
  await connection.query(
    `UPDATE products p
     SET
      p.average_rating = (
        SELECT COALESCE(ROUND(AVG(r.rating), 2), 0)
        FROM product_reviews r
        WHERE r.product_id = p.id
          AND r.is_published = 1
      ),
      p.review_count = (
        SELECT COUNT(*)
        FROM product_reviews r
        WHERE r.product_id = p.id
          AND r.is_published = 1
      ),
      p.updated_at = CURRENT_TIMESTAMP
     WHERE p.id = ?`,
    [productId]
  );
};

exports.listReviewsByUser = async (userId, { limit, offset }) => {
  return db.query(
    `SELECT
      r.id,
      r.product_id,
      r.order_item_id,
      r.rating,
      r.review_title,
      r.review_text,
      r.is_verified_purchase,
      r.is_published,
      r.created_at,
      r.updated_at,
      p.name AS product_name,
      p.slug AS product_slug
     FROM product_reviews r
     JOIN products p ON p.id = r.product_id
     WHERE r.user_id = ?
     ORDER BY r.created_at DESC
     LIMIT ? OFFSET ?`,
    [userId, limit, offset]
  );
};

exports.countReviewsByUser = async (userId) => {
  const rows = await db.query(
    `SELECT COUNT(*) AS total
     FROM product_reviews
     WHERE user_id = ?`,
    [userId]
  );

  return Number(rows[0]?.total || 0);
};
