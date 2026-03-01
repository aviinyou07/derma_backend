const service = require('../services/newsletter.service');

exports.subscribe = async (req, res) => {
  try {
    const result = await service.subscribe(req.body);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.unsubscribe = async (req, res) => {
  try {
    const result = await service.unsubscribe(req.body);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
