const db = require('../config/db');
const query = require('../queries/review.query');

const normalizeRating = (value) => {
  const rating = Number(value);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error('Rating must be between 1 and 5');
  }

  return rating;
};

exports.getProductReviewsBySlug = async (slug, params = {}) => {
  const product = await query.findProductBySlug(slug);
  if (!product) throw new Error('Product not found');

  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(params.limit) || 10));
  const offset = (page - 1) * limit;

  const [reviews, total] = await Promise.all([
    query.listProductReviews(product.id, { limit, offset }),
    query.countProductReviews(product.id)
  ]);

  return {
    product: {
      id: product.id,
      name: product.name,
      slug: product.slug
    },
    data: reviews,
    pagination: {
      page,
      limit,
      total,
      total_pages: Math.max(1, Math.ceil(total / limit))
    }
  };
};

exports.createReview = async (userId, payload = {}) => {
  const rating = normalizeRating(payload.rating);
  const reviewTitle = payload.review_title ? String(payload.review_title).trim() : null;
  const reviewText = payload.review_text ? String(payload.review_text).trim() : null;

  const productIdFromBody = payload.product_id ? Number(payload.product_id) : null;
  const orderItemId = payload.order_item_id ? Number(payload.order_item_id) : null;

  if ((!productIdFromBody || !Number.isInteger(productIdFromBody)) && (!orderItemId || !Number.isInteger(orderItemId))) {
    throw new Error('Either product_id or order_item_id is required');
  }

  let productId = productIdFromBody;
  let isVerifiedPurchase = false;

  if (orderItemId) {
    const orderItem = await query.findOrderItemForUser(userId, orderItemId);
    if (!orderItem) {
      throw new Error('Order item not found for this user');
    }

    const existing = await query.findReviewByOrderItem(orderItemId);
    if (existing) {
      throw new Error('Review already submitted for this order item');
    }

    productId = orderItem.product_id;
    isVerifiedPurchase = true;
  }

  if (!productId || !Number.isInteger(productId) || productId <= 0) {
    throw new Error('Invalid product id');
  }

  let reviewId;

  await db.transaction(async (connection) => {
    reviewId = await query.insertReview(connection, {
      user_id: userId,
      product_id: productId,
      order_item_id: orderItemId || null,
      rating,
      review_title: reviewTitle,
      review_text: reviewText,
      is_verified_purchase: isVerifiedPurchase
    });

    await query.refreshProductReviewStats(connection, productId);
  });

  return {
    message: 'Review submitted successfully',
    review_id: reviewId
  };
};

exports.updateReview = async (userId, reviewIdParam, payload = {}) => {
  const reviewId = Number(reviewIdParam);
  if (!Number.isInteger(reviewId) || reviewId <= 0) {
    throw new Error('Invalid review id');
  }

  const existing = await query.findReviewByIdForUser(userId, reviewId);
  if (!existing) {
    throw new Error('Review not found');
  }

  const updates = [];
  const params = [];

  if (payload.rating !== undefined) {
    updates.push('rating = ?');
    params.push(normalizeRating(payload.rating));
  }

  if (payload.review_title !== undefined) {
    updates.push('review_title = ?');
    const value = payload.review_title == null ? null : String(payload.review_title).trim();
    params.push(value || null);
  }

  if (payload.review_text !== undefined) {
    updates.push('review_text = ?');
    const value = payload.review_text == null ? null : String(payload.review_text).trim();
    params.push(value || null);
  }

  if (!updates.length) {
    return { message: 'No changes applied' };
  }

  await db.transaction(async (connection) => {
    await query.updateReview(connection, reviewId, updates, params);
    await query.refreshProductReviewStats(connection, existing.product_id);
  });

  return { message: 'Review updated successfully' };
};

exports.getMyReviews = async (userId, params = {}) => {
  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(params.limit) || 10));
  const offset = (page - 1) * limit;

  const [reviews, total] = await Promise.all([
    query.listReviewsByUser(userId, { limit, offset }),
    query.countReviewsByUser(userId)
  ]);

  return {
    data: reviews,
    pagination: {
      page,
      limit,
      total,
      total_pages: Math.max(1, Math.ceil(total / limit))
    }
  };
};
