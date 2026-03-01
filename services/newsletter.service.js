const query = require('../queries/newsletter.query');

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

exports.subscribe = async (payload = {}) => {
  const email = normalizeEmail(payload.email);
  const fullName = payload.full_name ? String(payload.full_name).trim() : null;
  const source = payload.source ? String(payload.source).trim().toLowerCase() : 'footer';

  if (!isValidEmail(email)) {
    throw new Error('Valid email is required');
  }

  const existing = await query.findByEmail(email);

  if (!existing) {
    await query.insertSubscriber({ email, fullName, source });
    return { message: 'Subscribed successfully' };
  }

  if (Number(existing.is_active) === 1) {
    return { message: 'Email is already subscribed' };
  }

  await query.activateSubscriber(existing.id, { fullName, source });
  return { message: 'Subscribed successfully' };
};

exports.unsubscribe = async (payload = {}) => {
  const email = normalizeEmail(payload.email);

  if (!isValidEmail(email)) {
    throw new Error('Valid email is required');
  }

  const existing = await query.findByEmail(email);
  if (!existing || Number(existing.is_active) === 0) {
    return { message: 'Email is already unsubscribed' };
  }

  await query.deactivateSubscriber(existing.id);
  return { message: 'Unsubscribed successfully' };
};
