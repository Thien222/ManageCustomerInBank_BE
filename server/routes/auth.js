const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const nodemailer = require('nodemailer');

const JWT_SECRET = process.env.JWT_SECRET || 'secret_key';
const EMAIL_USER = process.env.EMAIL_USER || 'your_email@gmail.com';
const EMAIL_PASS = process.env.EMAIL_PASS || 'your_app_password';

const transporter = nodemailer.createTransport({
  host: process.env.MAILTRAP_HOST,
  port: process.env.MAILTRAP_PORT,
  auth: {
    user: process.env.MAILTRAP_USER,
    pass: process.env.MAILTRAP_PASS
  }
});

// Hàm gửi mail OTP
async function sendOTP(email, otp) {
  await transporter.sendMail({
    from: 'no-reply@yourapp.com',
    to: email,
    subject: 'Mã xác thực đăng ký tài khoản',
    text: `Mã OTP của bạn là: ${otp}`,
  });
}

// Tạo sẵn admin nếu chưa có
User.findOne({ username: 'admin' }).then(async (admin) => {
  if (!admin) {
    const hash = await bcrypt.hash('admin123', 10);
    await User.create({ username: 'admin', password: hash, role: 'admin', isActive: true, email: 'admin@local', emailVerified: true });
    console.log('✅ Đã tạo user admin mặc định (username: admin, password: admin123)');
  }
});

// Đăng ký
router.post('/register', async (req, res) => {
  try {
    const { username, password, email } = req.body;
    if (!username || !password || !email) return res.status(400).json({ error: 'Thiếu thông tin' });
    const exist = await User.findOne({ $or: [{ username }, { email }] });
    if (exist) return res.status(400).json({ error: 'Username hoặc email đã tồn tại' });
    const hash = await bcrypt.hash(password, 10);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 phút
    await sendOTP(email, otp);
    await User.create({ username, password: hash, email, otp, otpExpires });
    res.status(201).json({ message: 'Đăng ký thành công! Vui lòng kiểm tra email để xác thực.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Xác thực OTP
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'Không tìm thấy user' });
    if (user.emailVerified) return res.status(400).json({ error: 'Email đã xác thực' });
    if (user.otp !== otp || !user.otpExpires || user.otpExpires < new Date()) {
      return res.status(400).json({ error: 'OTP không đúng hoặc đã hết hạn' });
    }
    user.emailVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();
    res.json({ message: 'Xác thực email thành công! Chờ admin duyệt tài khoản.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Đăng nhập
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ error: 'Sai tài khoản hoặc mật khẩu' });
    if (!user.emailVerified) return res.status(403).json({ error: 'Email chưa xác thực' });
    if (!user.isActive) return res.status(403).json({ error: 'Tài khoản chưa được admin duyệt/cấp role' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: 'Sai tài khoản hoặc mật khẩu' });
    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, user: { username: user.username, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router; 