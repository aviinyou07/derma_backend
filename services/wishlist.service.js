const query = require('../queries/wishlist.query');

exports.getMyWishlist = async (userId) => {
  const data = await query.getWishlistByUser(userId);
  return { data };
};

exports.addToWishlist = async (userId, payload) => {
  const productId = Number(payload?.product_id);
  if (!Number.isInteger(productId) || productId <= 0) {
    throw new Error('Invalid product id');
  }

  const product = await query.findProductById(productId);
  if (!product || !Number(product.is_active)) {
    throw new Error('Product not found');
  }

  const existing = await query.findWishlistItem(userId, productId);
  if (!existing) {
    await query.insertWishlistItem(userId, productId);
  }

  return {
    message: existing ? 'Already in wishlist' : 'Added to wishlist'
  };
};

exports.removeFromWishlist = async (userId, productIdParam) => {
  const productId = Number(productIdParam);
  if (!Number.isInteger(productId) || productId <= 0) {
    throw new Error('Invalid product id');
  }

  await query.deleteWishlistItem(userId, productId);
  return { message: 'Removed from wishlist' };
};
