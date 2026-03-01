const db = require('../config/db');

exports.getVariationForCheckout = async (variationId) => {
  const rows = await db.query(
    `SELECT
      pv.id,
      pv.product_id,
      pv.size,
      pv.price,
      pv.mrp,
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

exports.getMyOrders = async (userId, { limit, offset, status }) => {
  const params = [userId];
  let where = 'WHERE o.user_id = ?';

  if (status) {
    where += ' AND o.status = ?';
    params.push(status);
  }

  params.push(limit, offset);

  return db.query(
    `SELECT
      o.id,
      o.order_number,
      o.status,
      o.payment_method,
      o.payment_status,
      o.total_quantity,
      o.grand_total,
      o.placed_at,
      o.shipping_address,
      (
        SELECT oi.product_name
        FROM order_items oi
        WHERE oi.order_id = o.id
        ORDER BY oi.id ASC
        LIMIT 1
      ) AS first_product_name,
      (
        SELECT COUNT(*)
        FROM order_items oi
        WHERE oi.order_id = o.id
      ) AS item_count
     FROM orders o
     ${where}
     ORDER BY o.placed_at DESC
     LIMIT ? OFFSET ?`,
    params
  );
};

exports.countMyOrders = async (userId, status) => {
  const params = [userId];
  let where = 'WHERE user_id = ?';

  if (status) {
    where += ' AND status = ?';
    params.push(status);
  }

  const rows = await db.query(
    `SELECT COUNT(*) AS total
     FROM orders
     ${where}`,
    params
  );

  return Number(rows[0]?.total || 0);
};

exports.getOrderByIdForUser = async (userId, orderId) => {
  const rows = await db.query(
    `SELECT
      o.id,
      o.user_id,
      o.order_number,
      o.status,
      o.payment_method,
      o.payment_status,
      o.currency,
      o.total_quantity,
      o.subtotal,
      o.total_gst,
      o.shipping_charge,
      o.discount_amount,
      o.grand_total,
      o.coupon_code,
      o.shipping_address,
      o.billing_address,
      o.invoice_number,
      o.notes,
      o.placed_at,
      o.confirmed_at,
      o.shipped_at,
      o.delivered_at,
      o.cancelled_at,
      o.returned_at,
      o.tracking_number,
      o.courier_name
     FROM orders o
     WHERE o.user_id = ? AND o.id = ?
     LIMIT 1`,
    [userId, orderId]
  );

  return rows[0] || null;
};

exports.getOrderItems = async (orderId) => {
  return db.query(
    `SELECT
      oi.id,
      oi.order_id,
      oi.product_id,
      oi.variation_id,
      oi.product_name,
      oi.product_slug,
      oi.brand_name,
      oi.size,
      oi.quantity,
      oi.unit_price,
      oi.mrp,
      oi.gst_percentage,
      oi.gst_amount,
      oi.discount_amount,
      oi.total_price,
      p.images
     FROM order_items oi
     LEFT JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = ?
     ORDER BY oi.id ASC`,
    [orderId]
  );
};

exports.getOrderStatusHistory = async (orderId) => {
  return db.query(
    `SELECT
      osh.id,
      osh.order_id,
      osh.from_status,
      osh.to_status,
      osh.change_reason,
      osh.metadata,
      osh.created_at,
      u.id AS changed_by_user_id,
      u.name AS changed_by_name
     FROM order_status_history osh
     LEFT JOIN users u ON u.id = osh.changed_by
     WHERE osh.order_id = ?
     ORDER BY osh.created_at ASC, osh.id ASC`,
    [orderId]
  );
};

exports.getCartItemsForUser = async (userId) => {
  return db.query(
    `SELECT
      ci.id,
      ci.user_id,
      ci.variation_id,
      ci.quantity,
      pv.product_id,
      pv.stock
     FROM cart_items ci
     JOIN product_variations pv ON pv.id = ci.variation_id
     JOIN products p ON p.id = pv.product_id
     WHERE ci.user_id = ?
       AND pv.is_active = 1
       AND p.is_active = 1
     ORDER BY ci.id ASC`,
    [userId]
  );
};

/* =========================
   CREATE ORDER
========================= */
exports.insertOrder = async (connection, orderData) => {
  const [result] = await connection.query(
    `INSERT INTO orders
    (user_id, order_number, status, payment_method, payment_status,
     total_quantity, subtotal, total_gst,
     shipping_charge, discount_amount, grand_total,
     shipping_address)
     VALUES (?, ?, 'pending', ?, 'pending',
     ?, ?, ?, ?, ?, ?, ?)`,
    [
      orderData.user_id,
      orderData.order_number,
      orderData.payment_method,
      orderData.total_quantity,
      orderData.subtotal,
      orderData.total_gst,
      orderData.shipping_charge,
      orderData.discount_amount,
      orderData.grand_total,
      JSON.stringify(orderData.shipping_address)
    ]
  );

  return result.insertId;
};

/* =========================
   INSERT ORDER ITEMS
========================= */
exports.insertOrderItem = async (connection, item) => {
  await connection.query(
    `INSERT INTO order_items
    (order_id, product_id, variation_id,
     product_name, quantity,
     unit_price, mrp,
     gst_percentage, gst_amount,
     total_price)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      item.order_id,
      item.product_id,
      item.variation_id,
      item.product_name,
      item.quantity,
      item.unit_price,
      item.mrp,
      item.gst_percentage,
      item.gst_amount,
      item.total_price
    ]
  );
};

/* =========================
   UPDATE ORDER PAYMENT
========================= */
exports.markOrderPaid = async (connection, order_id) => {
  await connection.query(
    `UPDATE orders 
     SET payment_status = 'paid',
         status = 'confirmed'
     WHERE id = ?`,
    [order_id]
  );
};

/* =========================
   INSERT TRANSACTION
========================= */
exports.insertTransaction = async (connection, tx) => {
  await connection.query(
    `INSERT INTO transactions
    (order_id, payment_gateway,
     gateway_order_id,
     gateway_payment_id,
     gateway_signature,
     amount, status, raw_response)
     VALUES (?, 'razorpay', ?, ?, ?, ?, 'success', ?)`,
    [
      tx.order_id,
      tx.gateway_order_id,
      tx.gateway_payment_id,
      tx.gateway_signature,
      tx.amount,
      JSON.stringify(tx.raw_response)
    ]
  );
};

/* =========================
   REDUCE STOCK (SAFE)
========================= */
exports.reduceStock = async (connection, variation_id, qty) => {
  await connection.query(
    `UPDATE product_variations
     SET stock = stock - ?
     WHERE id = ?
     AND stock >= ?`,
    [qty, variation_id, qty]
  );
};