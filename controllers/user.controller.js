const service = require('../services/user.services');

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
exports.resendVerificationOtp = handle(service.resendVerificationOtp);
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

exports.listAddresses = async (req, res) => {
  try {
    const result = await service.listAddresses(req.user.id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.addAddress = async (req, res) => {
  try {
    const result = await service.addAddress(req.user.id, req.body);
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.updateAddress = async (req, res) => {
  try {
    const result = await service.updateAddress(req.user.id, req.params.addressId, req.body);
    res.json(result);
  } catch (err) {
    const status = err.message === 'Address not found' ? 404 : 400;
    res.status(status).json({ message: err.message });
  }
};

exports.deleteAddress = async (req, res) => {
  try {
    const result = await service.deleteAddress(req.user.id, req.params.addressId);
    res.json(result);
  } catch (err) {
    const status = err.message === 'Address not found' ? 404 : 400;
    res.status(status).json({ message: err.message });
  }
};

exports.setDefaultAddress = async (req, res) => {
  try {
    const result = await service.setDefaultAddress(req.user.id, req.params.addressId);
    res.json(result);
  } catch (err) {
    const status = err.message === 'Address not found' ? 404 : 400;
    res.status(status).json({ message: err.message });
  }
};