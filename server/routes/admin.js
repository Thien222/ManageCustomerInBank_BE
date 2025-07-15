const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'secret_key';

// Middleware xác thực admin
function authAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token' });
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin') return res.status(403).json({ error: 'Not admin' });
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Lấy danh sách user (trừ admin)
router.get('/users', authAdmin, async (req, res) => {
  try {
    const users = await User.find({ username: { $ne: 'admin' } }).select('-password');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Duyệt/cấp role cho user
router.post('/users/:id/approve', authAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    if (!role) return res.status(400).json({ error: 'Thiếu role' });
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role, isActive: true },
      { new: true }
    ).select('-password');
    if (!user) return res.status(404).json({ error: 'Không tìm thấy user' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Tạo user mới
router.post('/users', authAdmin, async (req, res) => {
  try {
    const { username, password, email, role, isActive } = req.body;
    if (!username || !password || !email) return res.status(400).json({ error: 'Thiếu thông tin' });
    const exist = await User.findOne({ $or: [{ username }, { email }] });
    if (exist) return res.status(400).json({ error: 'Username hoặc email đã tồn tại' });
    const hash = await require('bcryptjs').hash(password, 10);
    const user = await User.create({ username, password: hash, email, role, isActive, emailVerified: true });
    res.status(201).json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Xem chi tiết user
router.get('/users/:id', authAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ error: 'Không tìm thấy user' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cập nhật user
router.put('/users/:id', authAdmin, async (req, res) => {
  try {
    const { email, role, isActive } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { email, role, isActive },
      { new: true }
    ).select('-password');
    if (!user) return res.status(404).json({ error: 'Không tìm thấy user' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Xóa user
router.delete('/users/:id', authAdmin, async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: 'Không tìm thấy user' });
    res.json({ message: 'Đã xóa user' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router; 