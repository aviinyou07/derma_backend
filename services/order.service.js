const crypto = require('crypto');
const razorpay = require('../config/razorpay');
const db = require('../config/db');
const query = require('../queries/order.query');

const generateOrderNumber = () => `ORD-${Date.now()}`;

/* =========================================================
   CREATE ORDER (COD + RAZORPAY)
========================================================= */
exports.createOrder = async (userId, payload) => {

  const { items, shipping_address, payment_method } = payload;

  if (!['razorpay', 'cod'].includes(payment_method)) {
    throw new Error('Invalid payment method');
  }

  if (!items || !items.length) {
    throw new Error('Order items required');
  }

  /* =========================
     STEP 1: CREATE ORDER IN DB
  ========================= */

  const orderResult = await db.transaction(async (connection) => {

    let subtotal = 0;
    let totalGST = 0;
    let totalQty = 0;

    const orderNumber = generateOrderNumber();

    /* --- First validate all items and calculate totals --- */

    const validatedItems = [];

    for (const item of items) {

      const [rows] = await connection.query(
        `SELECT pv.*, p.name
         FROM product_variations pv
         JOIN products p ON pv.product_id = p.id
         WHERE pv.id = ? AND pv.is_active = 1`,
        [item.variation_id]
      );

      if (!rows.length)
        throw new Error('Invalid product variation');

      const v = rows[0];

      if (v.stock < item.quantity)
        throw new Error('Insufficient stock');

      const unitPrice = Number(v.price);
      const gstPercent = Number(v.gst_percentage);

      const gstAmount =
        (unitPrice * item.quantity * gstPercent) / 100;

      const totalPrice =
        (unitPrice * item.quantity) + gstAmount;

      subtotal += unitPrice * item.quantity;
      totalGST += gstAmount;
      totalQty += item.quantity;

      validatedItems.push({
        product_id: v.product_id,
        variation_id: v.id,
        product_name: v.name,
        quantity: item.quantity,
        unit_price: unitPrice,
        mrp: v.mrp,
        gst_percentage: gstPercent,
        gst_amount: gstAmount,
        total_price: totalPrice
      });
    }

    const shipping = payment_method === 'cod' ? 49 : 0;
    const discount = 0;
    const grandTotal = subtotal + totalGST + shipping - discount;

    const orderStatus =
      payment_method === 'cod' ? 'confirmed' : 'pending';

    const paymentStatus =
      payment_method === 'cod' ? 'pending' : 'pending';

    const [orderInsert] = await connection.query(
      `INSERT INTO orders
      (user_id, order_number, status, payment_status,
       total_quantity, subtotal, total_gst,
       shipping_charge, discount_amount, grand_total,
       shipping_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        orderNumber,
        orderStatus,
        paymentStatus,
        totalQty,
        subtotal,
        totalGST,
        shipping,
        discount,
        grandTotal,
        JSON.stringify(shipping_address)
      ]
    );

    const orderId = orderInsert.insertId;

    /* --- Reduce stock + insert order items --- */

    for (const item of validatedItems) {

      const [stockUpdate] = await connection.query(
        `UPDATE product_variations
         SET stock = stock - ?
         WHERE id = ?
         AND stock >= ?`,
        [item.quantity, item.variation_id, item.quantity]
      );

      if (stockUpdate.affectedRows === 0)
        throw new Error('Stock update failed');

      await connection.query(
        `INSERT INTO order_items
        (order_id, product_id, variation_id,
         product_name, quantity,
         unit_price, mrp,
         gst_percentage, gst_amount,
         total_price)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orderId,
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
    }

    return {
      order_id: orderId,
      order_number: orderNumber,
      grand_total: grandTotal,
      payment_method
    };
  });

  /* =========================
     STEP 2: HANDLE PAYMENT
  ========================= */

  if (payment_method === 'cod') {
    return {
      order_id: orderResult.order_id,
      payment_method: 'cod',
      message: 'Order placed successfully (COD)'
    };
  }

  /* --- Create Razorpay order AFTER transaction --- */

  const razorpayOrder = await razorpay.orders.create({
    amount: Math.round(orderResult.grand_total * 100),
    currency: "INR",
    receipt: orderResult.order_number
  });

  await db.query(
    `UPDATE orders SET invoice_number = ? WHERE id = ?`,
    [razorpayOrder.id, orderResult.order_id]
  );

  return {
    order_id: orderResult.order_id,
    razorpay_order_id: razorpayOrder.id,
    amount: orderResult.grand_total,
    currency: "INR"
  };
};


/* =========================================================
   VERIFY RAZORPAY PAYMENT
========================================================= */
exports.verifyPayment = async (data) => {

  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    order_id,
    amount
  } = data;

  const body = razorpay_order_id + "|" + razorpay_payment_id;

  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');

  if (expectedSignature !== razorpay_signature)
    throw new Error('Invalid payment signature');

  await db.transaction(async (connection) => {

    /* --- Check order exists --- */
    const [rows] = await connection.query(
      `SELECT grand_total, payment_status
       FROM orders WHERE id = ?`,
      [order_id]
    );

    if (!rows.length)
      throw new Error('Order not found');

    const order = rows[0];

    /* --- Prevent duplicate verification --- */
    if (order.payment_status === 'paid')
      return;

    /* --- Verify amount --- */
    if (Math.round(order.grand_total * 100) !== Number(amount))
      throw new Error('Amount mismatch');

    /* --- Prevent duplicate transaction --- */
    const [existing] = await connection.query(
      `SELECT id FROM transactions
       WHERE gateway_payment_id = ?`,
      [razorpay_payment_id]
    );

    if (existing.length)
      return;

    /* --- Update order --- */
    await connection.query(
      `UPDATE orders
       SET payment_status = 'paid',
           status = 'confirmed'
       WHERE id = ?`,
      [order_id]
    );

    /* --- Insert transaction --- */
    await connection.query(
      `INSERT INTO transactions
      (order_id, payment_gateway,
       gateway_order_id,
       gateway_payment_id,
       gateway_signature,
       amount, status, raw_response)
       VALUES (?, 'razorpay', ?, ?, ?, ?, 'success', ?)`,
      [
        order_id,
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        amount / 100,
        JSON.stringify(data)
      ]
    );
  });

  return { message: "Payment verified successfully" };
};