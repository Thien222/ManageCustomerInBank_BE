const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'khach-hang', 'quan-ly-khach-hang', 'quan-tri-tin-dung', 'ban-giam-doc', 'quan-ly-giao-dich'], default: null },
  isActive: { type: Boolean, default: false }, // Được admin duyệt/cấp role mới active
  createdAt: { type: Date, default: Date.now },
  email: { type: String, required: true, unique: true },
  emailVerified: { type: Boolean, default: false },
  otp: { type: String },
  otpExpires: { type: Date }
});

module.exports = mongoose.model('User', UserSchema); 