const service = require('../services/user.service');

const handle = (fn, status = 200) => async (req, res) => {
  try {
    const result = await fn(req.body, req.user?.id);
    res.status(status).json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.signup = handle(service.signup, 201);
exports.verifyEmail = handle(service.verifyEmail);
exports.login = handle(service.login);
exports.forgotPassword = handle(service.forgotPassword);
exports.resetPassword = handle(service.resetPassword);

exports.getProfile = async (req, res) => {
  try {
    const result = await service.getProfile(req.user.id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const result = await service.updateProfile(req.user.id, req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};