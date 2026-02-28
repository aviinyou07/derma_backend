const service = require('../services/auth.service');

const handle = (fn, status = 200) => async (req, res) => {
  try {
    const result = await fn(req.body);
    res.status(status).json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.signup = handle(service.signup, 201);
exports.verifyEmail = handle(service.verifyEmail);
exports.login = handle(service.login);
exports.resendOTP = handle(service.resendOTP);
exports.requestPasswordReset = handle(service.requestPasswordReset);
exports.resetPassword = handle(service.resetPassword);