const query = require('../queries/product.query');

/* =========================
   PRODUCT LIST
========================= */
exports.listProducts = async (filters) => {
  const page = Number(filters.page) || 1;
  const limit = Number(filters.limit) || 12;
  const offset = (page - 1) * limit;

  return await query.getProducts({
    limit,
    offset,
    category: filters.category,
    brand: filters.brand
  });
};


/* =========================
   PRODUCT DETAILS
========================= */
exports.getProductDetails = async (slug) => {
  const product = await query.getProductBySlug(slug);
  if (!product) throw new Error('Product not found');

  const variations = await query.getProductVariations(product.id);
  const similar = await query.getSimilarProducts(
    product.id,
    product.category_id
  );

  return {
    ...product,
    variations,
    similar_products: similar
  };
};

exports.getTrending = async (limit) => {
  return await query.getTrendingProducts(Number(limit) || 10);
};

exports.getFeatured = async (limit) => {
  return await query.getFeaturedProducts(Number(limit) || 10);
};

exports.search = async (keyword, limit) => {
  if (!keyword) throw new Error('Search keyword required');

  return await query.searchProducts(keyword, Number(limit) || 10);
};