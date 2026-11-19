const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES = ['PASSENGER', 'DRIVER'];

function validateRegister({ name, email, password, role } = {}) {
  const errors = [];
  if (typeof name !== 'string' || name.trim().length < 2) {
    errors.push('Name must be at least 2 characters');
  }
  if (typeof email !== 'string' || !EMAIL_PATTERN.test(email.trim())) {
    errors.push('A valid email is required');
  }
  if (typeof password !== 'string' || password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }
  if (!ROLES.includes(role)) {
    errors.push('Role must be PASSENGER or DRIVER');
  }
  return errors;
}

function validateLogin({ email, password } = {}) {
  const errors = [];
  if (typeof email !== 'string' || email.trim() === '') {
    errors.push('Email is required');
  }
  if (typeof password !== 'string' || password === '') {
    errors.push('Password is required');
  }
  return errors;
}

module.exports = { validateRegister, validateLogin };