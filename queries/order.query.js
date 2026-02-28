const db = require('../config/db');

/* =========================
   CREATE ORDER
========================= */
exports.insertOrder = async (connection, orderData) => {
  const [result] = await connection.query(
    `INSERT INTO orders
    (user_id, order_number, status, payment_status,
     total_quantity, subtotal, total_gst,
     shipping_charge, discount_amount, grand_total,
     shipping_address)
     VALUES (?, ?, 'pending', 'pending',
     ?, ?, ?, ?, ?, ?, ?)`,
    [
      orderData.user_id,
      orderData.order_number,
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