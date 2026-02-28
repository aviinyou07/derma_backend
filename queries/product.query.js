const db = require('../config/db');

/* =========================
   PRODUCT LISTING
========================= */
exports.getProducts = async ({ limit, offset, category, brand }) => {
  let sql = `
    SELECT 
      p.id,
      p.name,
      p.slug,
      p.images,
      p.labels,
      p.is_featured,
      p.is_trending,
      b.name AS brand_name,
      b.slug AS brand_slug,
      c.name AS category_name,
      c.slug AS category_slug,
      MIN(v.price) AS starting_price
    FROM products p
    LEFT JOIN brands b ON p.brand_id = b.id
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN product_variations v 
      ON p.id = v.product_id AND v.is_active = 1
    WHERE p.is_active = 1
  `;

  const params = [];

  if (category) {
    sql += ` AND c.slug = ?`;
    params.push(category);
  }

  if (brand) {
    sql += ` AND b.slug = ?`;
    params.push(brand);
  }

  sql += `
    GROUP BY p.id
    ORDER BY p.created_at DESC
    LIMIT ? OFFSET ?
  `;

  params.push(limit, offset);

  return await db.query(sql, params);
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
    FROM products p
    LEFT JOIN brands b ON p.brand_id = b.id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.slug = ? AND p.is_active = 1
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