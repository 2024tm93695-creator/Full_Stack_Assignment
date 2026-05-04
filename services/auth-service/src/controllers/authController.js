const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'smartpark_jwt_secret_2024';

const generateToken = (id, role) =>
  jwt.sign({ id, role }, JWT_SECRET, { expiresIn: '7d' });

const safeUser = (u) => ({
  id: u._id, name: u.name, email: u.email,
  role: u.role, vehicleType: u.vehicleType, vehicleNumber: u.vehicleNumber, phone: u.phone
});

const register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const { name, email, password, phone, vehicleNumber, vehicleType } = req.body;
    if (await User.findOne({ email })) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    const user = await User.create({ name, email, password, phone, vehicleNumber, vehicleType });
    res.status(201).json({ token: generateToken(user._id, user.role), user: safeUser(user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    res.json({ token: generateToken(user._id, user.role), user: safeUser(user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getProfile = (req, res) => res.json(safeUser(req.user));

const updateProfile = async (req, res) => {
  try {
    const { name, phone, vehicleNumber, vehicleType } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user._id, { name, phone, vehicleNumber, vehicleType }, { new: true }
    ).select('-password');
    res.json(safeUser(user));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { register, login, getProfile, updateProfile, getAllUsers };
