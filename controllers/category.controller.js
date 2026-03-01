const service = require('../services/category.service');

exports.listCategories = async (req, res) => {
  try {
    const data = await service.listCategories(req.query || {});
    res.json(data);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
