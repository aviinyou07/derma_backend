const query = require('../queries/product.query');

/* =========================
   PRODUCT LIST
========================= */
exports.listProducts = async (filters) => {
  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(filters.limit) || 12));
  const offset = (page - 1) * limit;

  const minPrice = filters.minPrice !== undefined && filters.minPrice !== ''
    ? Number(filters.minPrice)
    : null;
  const maxPrice = filters.maxPrice !== undefined && filters.maxPrice !== ''
    ? Number(filters.maxPrice)
    : null;
  const minRating = filters.rating !== undefined && filters.rating !== ''
    ? Number(filters.rating)
    : null;

  const payload = {
    limit,
    offset,
    category: filters.category,
    brand: filters.brand,
    search: filters.search || filters.q || null,
    minPrice: Number.isFinite(minPrice) ? minPrice : null,
    maxPrice: Number.isFinite(maxPrice) ? maxPrice : null,
    minRating: Number.isFinite(minRating) ? minRating : null,
    sort: filters.sort || 'newest'
  };

  const [data, total] = await Promise.all([
    query.getProducts(payload),
    query.countProducts(payload)
  ]);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      total_pages: Math.max(1, Math.ceil(total / limit))
    }
  };
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

exports.getVariationById = async (variationId) => {
  const id = Number(variationId);
  if (!Number.isInteger(id) || id <= 0) throw new Error('Invalid variation id');

  const variation = await query.getVariationById(id);
  if (!variation) throw new Error('Variation not found');

  return variation;
};

exports.getFacets = async () => {
  return query.getProductFacets();
};