const crypto = require('crypto');
const razorpay = require('../config/razorpay');
const db = require('../config/db');
const query = require('../queries/order.query');

const generateOrderNumber = () => `ORD-${Date.now()}`;

const parseJsonField = (value, fallback = null) => {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;

  try {
    return JSON.parse(value);
  } catch (_error) {
    return fallback;
  }
};

const normalizeCouponCode = (value) => String(value || '').trim().toUpperCase();

const round2 = (value) => Number(Number(value || 0).toFixed(2));

const getDefaultUserAddress = async (userId) => {
  const rows = await db.query(
    `SELECT
      full_name,
      phone,
      address_line1,
      address_line2,
      city,
      state,
      postal_code,
      country
     FROM user_addresses
     WHERE user_id = ?
     ORDER BY is_default DESC, id ASC
     LIMIT 1`,
    [userId]
  );

  const address = rows[0] || null;
  if (!address) return null;

  return {
    full_name: address.full_name,
    phone: address.phone,
    address_line1: address.address_line1,
    address_line2: address.address_line2,
    city: address.city,
    state: address.state,
    postal_code: address.postal_code,
    country: address.country
  };
};

const resolveShippingAddress = async (userId, shippingAddress) => {
  if (shippingAddress && typeof shippingAddress === 'object') {
    return shippingAddress;
  }

  const fallback = await getDefaultUserAddress(userId);
  if (!fallback) {
    throw new Error('Shipping address required');
  }

  return fallback;
};

const loadCoupon = async ({ connection, couponCode }) => {
  if (!couponCode) return null;

  const sql = connection
    ? `SELECT *
       FROM coupons
       WHERE code = ?
         AND is_active = 1
         AND (starts_at IS NULL OR starts_at <= NOW())
         AND (expires_at IS NULL OR expires_at >= NOW())
       LIMIT 1
       FOR UPDATE`
    : `SELECT *
       FROM coupons
       WHERE code = ?
         AND is_active = 1
         AND (starts_at IS NULL OR starts_at <= NOW())
         AND (expires_at IS NULL OR expires_at >= NOW())
       LIMIT 1`;

  const rows = connection
    ? (await connection.query(sql, [couponCode]))[0]
    : await db.query(sql, [couponCode]);

  return rows[0] || null;
};

const getCouponUserUsageCount = async ({ connection, couponId, userId }) => {
  if (!userId) return 0;

  const sql = `SELECT COUNT(*) AS total
               FROM coupon_usages
               WHERE coupon_id = ? AND user_id = ?`;

  const rows = connection
    ? (await connection.query(sql, [couponId, userId]))[0]
    : await db.query(sql, [couponId, userId]);

  return Number(rows[0]?.total || 0);
};

const evaluateCoupon = async ({
  connection,
  couponCode,
  userId,
  subtotal,
  totalGST,
  shippingCharge,
  strict = true
}) => {
  const normalizedCode = normalizeCouponCode(couponCode);
  if (!normalizedCode) {
    return {
      coupon: null,
      discount: 0
    };
  }

  const coupon = await loadCoupon({ connection, couponCode: normalizedCode });
  if (!coupon) {
    throw new Error('Invalid or expired coupon');
  }

  const usageLimit = coupon.usage_limit == null ? null : Number(coupon.usage_limit);
  const usedCount = Number(coupon.used_count || 0);

  if (usageLimit != null && usedCount >= usageLimit) {
    throw new Error('Coupon usage limit reached');
  }

  const perUserLimit = coupon.per_user_limit == null ? null : Number(coupon.per_user_limit);
  if (perUserLimit != null && userId) {
    const userUsageCount = await getCouponUserUsageCount({
      connection,
      couponId: coupon.id,
      userId
    });

    if (userUsageCount >= perUserLimit) {
      throw new Error('Coupon usage limit reached for this account');
    }
  }

  const orderBase = round2(Number(subtotal || 0) + Number(totalGST || 0) + Number(shippingCharge || 0));
  const minimumOrderAmount =
    coupon.minimum_order_amount == null ? null : Number(coupon.minimum_order_amount);

  if (minimumOrderAmount != null && orderBase < minimumOrderAmount) {
    throw new Error(`Coupon requires minimum order amount of ₹${minimumOrderAmount}`);
  }

  let discount = 0;

  if (coupon.discount_type === 'percentage') {
    discount = (orderBase * Number(coupon.discount_value || 0)) / 100;
  } else {
    discount = Number(coupon.discount_value || 0);
  }

  if (coupon.max_discount_amount != null) {
    discount = Math.min(discount, Number(coupon.max_discount_amount));
  }

  discount = round2(Math.max(0, Math.min(discount, orderBase)));

  if (strict && discount <= 0) {
    throw new Error('Coupon is not applicable');
  }

  return {
    coupon: {
      id: coupon.id,
      code: coupon.code,
      discount_type: coupon.discount_type
    },
    discount
  };
};

exports.previewOrder = async (payload) => {
  const {
    items,
    payment_method = 'razorpay',
    coupon_code = null,
    user_id = null
  } = payload || {};

  if (!Array.isArray(items) || !items.length) {
    throw new Error('Order items required');
  }

  if (!['razorpay', 'cod'].includes(payment_method)) {
    throw new Error('Invalid payment method');
  }

  let subtotal = 0;
  let totalGST = 0;
  let totalQty = 0;

  const normalizedItems = [];

  for (const item of items) {
    const quantity = Number(item.quantity || 0);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error('Invalid item quantity');
    }

    const variation = await query.getVariationForCheckout(item.variation_id);
    if (!variation) throw new Error('Invalid product variation');
    if (Number(variation.stock) < quantity) throw new Error('Insufficient stock');

    const unitPrice = Number(variation.price);
    const gstPercentage = Number(variation.gst_percentage);
    const lineSubtotal = unitPrice * quantity;
    const lineGst = (lineSubtotal * gstPercentage) / 100;
    const lineTotal = lineSubtotal + lineGst;

    subtotal += lineSubtotal;
    totalGST += lineGst;
    totalQty += quantity;

    const images = parseJsonField(variation.images, []);

    normalizedItems.push({
      variation_id: variation.id,
      product_id: variation.product_id,
      product_name: variation.product_name,
      product_slug: variation.product_slug,
      size: variation.size,
      quantity,
      unit_price: unitPrice,
      gst_percentage: gstPercentage,
      gst_amount: Number(lineGst.toFixed(2)),
      line_total: Number(lineTotal.toFixed(2)),
      image: Array.isArray(images) ? images[0] || null : null
    });
  }

  const shipping = payment_method === 'cod' ? 49 : 0;
  const couponResult = await evaluateCoupon({
    connection: null,
    couponCode: coupon_code,
    userId: Number(user_id) || null,
    subtotal,
    totalGST,
    shippingCharge: shipping,
    strict: false
  });
  const discount = Number(couponResult.discount || 0);
  const grandTotal = subtotal + totalGST + shipping - discount;

  return {
    items: normalizedItems,
    summary: {
      total_quantity: totalQty,
      subtotal: Number(subtotal.toFixed(2)),
      total_gst: Number(totalGST.toFixed(2)),
      shipping_charge: Number(shipping.toFixed(2)),
      discount_amount: Number(discount.toFixed(2)),
      grand_total: Number(grandTotal.toFixed(2)),
      currency: 'INR',
      payment_method,
      coupon_code: couponResult.coupon?.code || null
    }
  };
};

/* =========================================================
   CREATE ORDER (COD + RAZORPAY)
========================================================= */
exports.createOrder = async (userId, payload) => {

  const {
    items,
    shipping_address,
    payment_method,
    coupon_code = null
  } = payload;

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
    const couponResult = await evaluateCoupon({
      connection,
      couponCode: coupon_code,
      userId,
      subtotal,
      totalGST,
      shippingCharge: shipping,
      strict: true
    });
    const discount = Number(couponResult.discount || 0);
    const grandTotal = subtotal + totalGST + shipping - discount;
    const shippingAddressResolved = await resolveShippingAddress(userId, shipping_address);

    const orderStatus =
      payment_method === 'cod' ? 'confirmed' : 'pending';

    const paymentStatus =
      payment_method === 'cod' ? 'pending' : 'pending';

    const [orderInsert] = await connection.query(
      `INSERT INTO orders
      (user_id, order_number, status, payment_method, payment_status,
       total_quantity, subtotal, total_gst,
       shipping_charge, discount_amount, grand_total,
       coupon_code,
       shipping_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        orderNumber,
        orderStatus,
        payment_method,
        paymentStatus,
        totalQty,
        subtotal,
        totalGST,
        shipping,
        discount,
        grandTotal,
        couponResult.coupon?.code || null,
        JSON.stringify(shippingAddressResolved)
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

    if (couponResult.coupon && discount > 0) {
      await connection.query(
        `INSERT INTO coupon_usages (coupon_id, user_id, order_id)
         VALUES (?, ?, ?)`,
        [couponResult.coupon.id, userId, orderId]
      );

      await connection.query(
        `UPDATE coupons
         SET used_count = used_count + 1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [couponResult.coupon.id]
      );
    }

    return {
      order_id: orderId,
      order_number: orderNumber,
      grand_total: grandTotal,
      payment_method,
      coupon_code: couponResult.coupon?.code || null
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
    razorpay_key_id: process.env.RAZORPAY_KEY_ID,
    amount: orderResult.grand_total,
    amount_paise: Math.round(orderResult.grand_total * 100),
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

exports.createOrderFromCart = async (userId, payload) => {
  const paymentMethod = payload?.payment_method;
  const shippingAddress = payload?.shipping_address;
  const couponCode = payload?.coupon_code || null;

  const cartItems = await query.getCartItemsForUser(userId);
  if (!cartItems.length) {
    throw new Error('Cart is empty');
  }

  const items = cartItems.map((item) => ({
    variation_id: item.variation_id,
    quantity: item.quantity
  }));

  const result = await exports.createOrder(userId, {
    items,
    payment_method: paymentMethod,
    shipping_address: shippingAddress,
    coupon_code: couponCode
  });

  await db.query(
    `DELETE FROM cart_items WHERE user_id = ?`,
    [userId]
  );

  return result;
};

exports.getMyOrders = async (userId, params = {}) => {
  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(params.limit) || 10));
  const offset = (page - 1) * limit;
  const status = params.status || null;

  const [orders, total] = await Promise.all([
    query.getMyOrders(userId, { limit, offset, status }),
    query.countMyOrders(userId, status)
  ]);

  return {
    data: orders.map((order) => {
      const shippingAddress = parseJsonField(order.shipping_address, {});
      return {
        ...order,
        shipping_address: shippingAddress,
        ship_to: shippingAddress?.full_name || null
      };
    }),
    pagination: {
      page,
      limit,
      total,
      total_pages: Math.max(1, Math.ceil(total / limit))
    }
  };
};

exports.getOrderDetails = async (userId, orderId) => {
  const id = Number(orderId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('Invalid order id');
  }

  const order = await query.getOrderByIdForUser(userId, id);
  if (!order) throw new Error('Order not found');

  const items = await query.getOrderItems(id);

  return {
    ...order,
    shipping_address: parseJsonField(order.shipping_address, null),
    billing_address: parseJsonField(order.billing_address, null),
    items: items.map((item) => ({
      ...item,
      images: parseJsonField(item.images, [])
    }))
  };
};

exports.getOrderStatusHistory = async (userId, orderId) => {
  const id = Number(orderId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('Invalid order id');
  }

  const order = await query.getOrderByIdForUser(userId, id);
  if (!order) throw new Error('Order not found');

  const rows = await query.getOrderStatusHistory(id);

  return {
    order_id: id,
    data: rows.map((row) => ({
      ...row,
      metadata: parseJsonField(row.metadata, null)
    }))
  };
};

exports.getOrderInvoice = async (userId, orderId) => {
  const details = await exports.getOrderDetails(userId, orderId);

  const currency = (value) => `₹${Number(value || 0).toFixed(2)}`;
  const shipping = details.shipping_address || {};

  const itemsRows = (details.items || []).map((item, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${item.product_name || '-'}</td>
        <td>${item.size || '-'}</td>
        <td>${Number(item.quantity || 0)}</td>
        <td>${currency(item.unit_price)}</td>
        <td>${currency(item.total_price)}</td>
      </tr>
    `).join('');

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Invoice ${details.order_number || details.id}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
    h1 { margin: 0 0 4px; }
    p { margin: 2px 0; }
    .meta { margin: 20px 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { border: 1px solid #e5e7eb; padding: 8px; font-size: 14px; text-align: left; }
    th { background: #f9fafb; }
    .totals { margin-top: 16px; max-width: 380px; margin-left: auto; }
    .totals p { display: flex; justify-content: space-between; }
    .grand { font-weight: bold; font-size: 18px; }
  </style>
</head>
<body>
  <h1>Invoice</h1>
  <p>Order #${details.order_number || details.id}</p>
  <p>Placed: ${details.placed_at ? new Date(details.placed_at).toLocaleString('en-IN') : '-'}</p>

  <div class="meta">
    <p><strong>Ship To:</strong> ${shipping.full_name || '-'}</p>
    <p>${shipping.address_line1 || ''} ${shipping.address_line2 || ''}</p>
    <p>${shipping.city || ''}, ${shipping.state || ''} ${shipping.postal_code || ''}</p>
    <p>${shipping.country || ''}</p>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Item</th>
        <th>Variant</th>
        <th>Qty</th>
        <th>Unit Price</th>
        <th>Line Total</th>
      </tr>
    </thead>
    <tbody>
      ${itemsRows}
    </tbody>
  </table>

  <div class="totals">
    <p><span>Subtotal</span><span>${currency(details.subtotal)}</span></p>
    <p><span>Shipping</span><span>${currency(details.shipping_charge)}</span></p>
    <p><span>Tax</span><span>${currency(details.total_gst)}</span></p>
    <p><span>Discount</span><span>${currency(details.discount_amount)}</span></p>
    <p class="grand"><span>Grand Total</span><span>${currency(details.grand_total)}</span></p>
  </div>
</body>
</html>`;

  return {
    order_id: details.id,
    order_number: details.order_number,
    html
  };
};