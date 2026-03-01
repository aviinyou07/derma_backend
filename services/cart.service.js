const query = require('../queries/cart.query');

const parseJson = (value, fallback = null) => {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;

  try {
    return JSON.parse(value);
  } catch (_error) {
    return fallback;
  }
};

const buildCartSummary = (items) => {
  let subtotal = 0;
  let totalGst = 0;
  let totalQuantity = 0;

  const normalized = items.map((item) => {
    const unitPrice = Number(item.price || 0);
    const gstPercentage = Number(item.gst_percentage || 0);
    const quantity = Number(item.quantity || 0);

    const lineSubtotal = unitPrice * quantity;
    const lineGst = (lineSubtotal * gstPercentage) / 100;
    const lineTotal = lineSubtotal + lineGst;

    subtotal += lineSubtotal;
    totalGst += lineGst;
    totalQuantity += quantity;

    const images = parseJson(item.images, []);

    return {
      id: item.id,
      variation_id: item.variation_id,
      product_id: item.product_id,
      product_name: item.product_name,
      product_slug: item.product_slug,
      size: item.size,
      quantity,
      unit_price: Number(unitPrice.toFixed(2)),
      gst_percentage: Number(gstPercentage.toFixed(2)),
      gst_amount: Number(lineGst.toFixed(2)),
      line_total: Number(lineTotal.toFixed(2)),
      stock: Number(item.stock || 0),
      image: Array.isArray(images) ? images[0] || null : null
    };
  });

  return {
    items: normalized,
    summary: {
      total_quantity: totalQuantity,
      subtotal: Number(subtotal.toFixed(2)),
      total_gst: Number(totalGst.toFixed(2)),
      shipping_charge: 0,
      discount_amount: 0,
      grand_total: Number((subtotal + totalGst).toFixed(2)),
      currency: 'INR'
    }
  };
};

exports.getCart = async (userId) => {
  const items = await query.getCartItemsByUser(userId);
  return buildCartSummary(items);
};

exports.addToCart = async (userId, payload) => {
  const variationId = Number(payload.variation_id);
  const quantity = Number(payload.quantity || 1);

  if (!Number.isInteger(variationId) || variationId <= 0) {
    throw new Error('Invalid variation id');
  }

  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error('Invalid quantity');
  }

  const variation = await query.getVariationForCart(variationId);
  if (!variation) throw new Error('Product variation not found');

  const existing = await query.getCartItemByVariation(userId, variationId);
  const nextQuantity = (existing ? Number(existing.quantity) : 0) + quantity;

  if (nextQuantity > Number(variation.stock || 0)) {
    throw new Error('Quantity exceeds available stock');
  }

  if (existing) {
    await query.updateCartItemByVariation(userId, variationId, nextQuantity);
  } else {
    await query.insertCartItem(userId, variationId, quantity);
  }

  return this.getCart(userId);
};

exports.updateCartItem = async (userId, itemId, payload) => {
  const id = Number(itemId);
  const quantity = Number(payload.quantity);

  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('Invalid cart item id');
  }

  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new Error('Invalid quantity');
  }

  const item = await query.getCartItemById(userId, id);
  if (!item) throw new Error('Cart item not found');

  if (quantity === 0) {
    await query.deleteCartItem(userId, id);
    return this.getCart(userId);
  }

  const variation = await query.getVariationForCart(item.variation_id);
  if (!variation) throw new Error('Product variation not found');
  if (quantity > Number(variation.stock || 0)) {
    throw new Error('Quantity exceeds available stock');
  }

  await query.updateCartItemQuantity(userId, id, quantity);
  return this.getCart(userId);
};

exports.removeCartItem = async (userId, itemId) => {
  const id = Number(itemId);

  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('Invalid cart item id');
  }

  await query.deleteCartItem(userId, id);
  return this.getCart(userId);
};

exports.clearCart = async (userId) => {
  await query.clearCart(userId);
  return { message: 'Cart cleared successfully' };
};
