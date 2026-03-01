const db = require('../config/db');

/* =========================
   PRODUCT LISTING
========================= */
const buildProductWhere = ({ category, brand, search, minPrice, maxPrice, minRating }) => {
  const where = ['p.is_active = 1'];
  const params = [];

  if (category) {
    where.push('c.slug = ?');
    params.push(category);
  }

  if (brand) {
    where.push('b.slug = ?');
    params.push(brand);
  }

  if (search) {
    where.push('(p.name LIKE ? OR p.keywords LIKE ? OR c.name LIKE ? OR b.name LIKE ?)');
    const value = `%${search}%`;
    params.push(value, value, value, value);
  }

  if (minPrice != null) {
    where.push('v.price >= ?');
    params.push(minPrice);
  }

  if (maxPrice != null) {
    where.push('v.price <= ?');
    params.push(maxPrice);
  }

  if (minRating != null) {
    where.push('COALESCE(p.average_rating, 0) >= ?');
    params.push(minRating);
  }

  return {
    sql: where.length ? `WHERE ${where.join(' AND ')}` : '',
    params
  };
};

const resolveSortClause = (sort) => {
  switch (String(sort || 'newest').toLowerCase()) {
    case 'price-low':
      return 'ORDER BY starting_price ASC, p.created_at DESC';
    case 'price-high':
      return 'ORDER BY starting_price DESC, p.created_at DESC';
    case 'name':
      return 'ORDER BY p.name ASC';
    case 'trending':
      return 'ORDER BY p.is_trending DESC, p.updated_at DESC';
    default:
      return 'ORDER BY p.created_at DESC';
  }
};

exports.getProducts = async ({
  limit,
  offset,
  category,
  brand,
  search,
  minPrice,
  maxPrice,
  minRating,
  sort
}) => {
  const where = buildProductWhere({ category, brand, search, minPrice, maxPrice, minRating });
  const order = resolveSortClause(sort);

  let sql = `
    SELECT 
      p.id,
      p.name,
      p.slug,
      p.images,
      p.labels,
      p.is_featured,
      p.is_trending,
      p.average_rating,
      p.review_count,
      b.name AS brand_name,
      b.slug AS brand_slug,
      c.name AS category_name,
      c.slug AS category_slug,
      MIN(v.price) AS starting_price
    FROM products p
    LEFT JOIN brands b ON p.brand_id = b.id
    LEFT JOIN categories c ON p.category_id = c.id
    JOIN product_variations v 
      ON p.id = v.product_id AND v.is_active = 1
    ${where.sql}
  `;

  sql += `
    GROUP BY p.id
    ${order}
    LIMIT ? OFFSET ?
  `;

  const params = [...where.params, limit, offset];

  return await db.query(sql, params);
};

exports.countProducts = async ({ category, brand, search, minPrice, maxPrice, minRating }) => {
  const where = buildProductWhere({ category, brand, search, minPrice, maxPrice, minRating });

  const rows = await db.query(
    `SELECT COUNT(DISTINCT p.id) AS total
     FROM products p
     LEFT JOIN brands b ON p.brand_id = b.id
     LEFT JOIN categories c ON p.category_id = c.id
     JOIN product_variations v ON p.id = v.product_id AND v.is_active = 1
     ${where.sql}`,
    where.params
  );

  return Number(rows[0]?.total || 0);
};

exports.getProductFacets = async () => {
  const [categories, brands, priceRows] = await Promise.all([
    db.query(
      `SELECT c.id, c.name, c.slug
       FROM categories c
       WHERE c.is_active = 1
       ORDER BY c.name ASC`
    ),
    db.query(
      `SELECT b.id, b.name, b.slug
       FROM brands b
       WHERE b.is_active = 1
       ORDER BY b.name ASC`
    ),
    db.query(
      `SELECT
        COALESCE(MIN(v.price), 0) AS min_price,
        COALESCE(MAX(v.price), 0) AS max_price
       FROM product_variations v
       JOIN products p ON p.id = v.product_id
       WHERE v.is_active = 1 AND p.is_active = 1`
    )
  ]);

  return {
    categories,
    brands,
    price_range: {
      min: Number(priceRows[0]?.min_price || 0),
      max: Number(priceRows[0]?.max_price || 0)
    }
  };
};


/* =========================
   PRODUCT DETAILS
========================= */
exports.getProductBySlug = async (slug) => {
  const rows = await db.query(
    `
    SELECT 
      p.*,
      b.id AS brand_id,
      b.name AS brand_name,
      b.slug AS brand_slug,
      b.logo AS brand_logo,
      b.description AS brand_description,
      c.id AS category_id,
      c.name AS category_name,
      c.slug AS category_slug,
      c.image AS category_image
    FROM (
      SELECT *
      FROM products FORCE INDEX (slug)
      WHERE slug = ? AND is_active = 1
      LIMIT 1
    ) p
    LEFT JOIN brands b ON p.brand_id = b.id
    LEFT JOIN categories c ON p.category_id = c.id
    LIMIT 1
    `,
    [slug]
  );

  return rows[0];
};

exports.getProductVariations = async (productId) => {
  return await db.query(
    `
    SELECT *
    FROM product_variations
    WHERE product_id = ?
    AND is_active = 1
    ORDER BY is_default DESC, price ASC
    `,
    [productId]
  );
};


/* =========================
   SIMILAR PRODUCTS
========================= */
exports.getSimilarProducts = async (productId, categoryId) => {
  return await db.query(
    `
    SELECT 
      p.id,
      p.name,
      p.slug,
      p.images,
      MIN(v.price) AS starting_price
    FROM products p
    LEFT JOIN product_variations v 
      ON p.id = v.product_id AND v.is_active = 1
    WHERE p.category_id = ?
    AND p.id != ?
    AND p.is_active = 1
    GROUP BY p.id
    ORDER BY RAND()
    LIMIT 6
    `,
    [categoryId, productId]
  );
};

exports.getTrendingProducts = async (limit = 10) => {
  return await db.query(
    `
    SELECT 
      p.id,
      p.name,
      p.slug,
      p.images,
      c.name AS category_name,
      MIN(v.price) AS starting_price
    FROM products p
    LEFT JOIN product_variations v 
      ON p.id = v.product_id AND v.is_active = 1
    LEFT JOIN categories c 
      ON p.category_id = c.id
    WHERE p.is_active = 1
    AND p.is_trending = 1
    GROUP BY p.id
    ORDER BY p.updated_at DESC
    LIMIT ?
    `,
    [limit]
  );
};

exports.getFeaturedProducts = async (limit = 10) => {
  return await db.query(
    `
    SELECT 
      p.id,
      p.name,
      p.slug,
      p.images,
      c.name AS category_name,
      MIN(v.price) AS starting_price
    FROM products p
    LEFT JOIN product_variations v 
      ON p.id = v.product_id AND v.is_active = 1
    LEFT JOIN categories c 
      ON p.category_id = c.id
    WHERE p.is_active = 1
    AND p.is_featured = 1
    GROUP BY p.id
    ORDER BY p.updated_at DESC
    LIMIT ?
    `,
    [limit]
  );
};

exports.searchProducts = async (keyword, limit = 10) => {
  return await db.query(
    `
    SELECT 
      p.id,
      p.name AS product_name,
      p.slug,
      c.name AS category_name,
      v.id AS variation_id,
      v.size,
      v.price
    FROM products p
    LEFT JOIN categories c 
      ON p.category_id = c.id
    LEFT JOIN product_variations v 
      ON p.id = v.product_id AND v.is_active = 1
    WHERE p.is_active = 1
    AND (
      p.name LIKE ?
      OR p.keywords LIKE ?
      OR c.name LIKE ?
      OR v.size LIKE ?
    )
    ORDER BY p.name ASC
    LIMIT ?
    `,
    [
      `%${keyword}%`,
      `%${keyword}%`,
      `%${keyword}%`,
      `%${keyword}%`,
      limit
    ]
  );
};

exports.getVariationById = async (variationId) => {
  const rows = await db.query(
    `
    SELECT
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
    LIMIT 1
    `,
    [variationId]
  );

  return rows[0] || null;
};