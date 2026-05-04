const express = require('express');
const { body } = require('express-validator');
const { register, login, getProfile, updateProfile, getAllUsers } = require('../controllers/authController');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();

router.post('/register', [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], register);

router.post('/login', [
  body('email').isEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password is required')
], login);

router.get('/profile', protect, getProfile);
router.put('/profile', protect, updateProfile);
router.get('/users', protect, adminOnly, getAllUsers);

module.exports = router;
