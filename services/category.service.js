const query = require('../queries/category.query');

exports.listCategories = async (params = {}) => {
  const limit = Math.min(50, Math.max(1, Number(params.limit) || 8));
  return query.listCategories(limit);
};
