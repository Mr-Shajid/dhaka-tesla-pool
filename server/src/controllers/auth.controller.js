const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const httpError = require('../utils/httpError');
const { validateRegister, validateLogin } = require('../validators/auth.validators');

function signToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function publicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    walletPaisa: user.walletPaisa,
  };
}


async function register(req, res) {
  const errors = validateRegister(req.body);
  if (errors.length > 0) throw httpError(400, 'Validation failed', errors);

  const { name, password, role } = req.body;
  const email = req.body.email.trim().toLowerCase();

  const existing = await User.findOne({ email });
  if (existing) throw httpError(409, 'An account with this email already exists');

  const passwordHash = await bcrypt.hash(password, 10);

  let user;
  try {
    user = await User.create({ name: name.trim(), email, passwordHash, role });
  } catch (error) {
    // Two sign-ups with the same email at the same instant: the unique index catches it.
    if (error.code === 11000) throw httpError(409, 'An account with this email already exists');
    throw error;
  }

  res.status(201).json({ token: signToken(user), user: publicUser(user) });
}

async function login(req, res) {
  const errors = validateLogin(req.body);
  if (errors.length > 0) throw httpError(400, 'Validation failed', errors);

  const email = req.body.email.trim().toLowerCase();
  const user = await User.findOne({ email }).select('+passwordHash');

  const passwordOk = user && (await bcrypt.compare(req.body.password, user.passwordHash));
  if (!passwordOk) throw httpError(401, 'Invalid email or password');

  res.json({ token: signToken(user), user: publicUser(user) });
}

async function me(req, res) {
  res.json({ user: publicUser(req.user) });
}

module.exports = { register, login, me, publicUser };