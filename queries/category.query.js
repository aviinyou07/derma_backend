const db = require('../config/db');

exports.listCategories = async (limit = 20) => {
  return db.query(
    `SELECT id, name, slug, image, description
     FROM categories
     WHERE is_active = 1
     ORDER BY created_at DESC
     LIMIT ?`,
    [limit]
  );
};
