const express = require('express');
const router = express.Router();
const HoSo = require('../models/HoSo');

// Lấy danh sách hồ sơ (có filter, phân trang)
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', trangThai, soTaiKhoan, tenKhachHang, qlkh, phong, fromDate, toDate } = req.query;
    const filter = {};
    if (trangThai) filter.trangThai = trangThai;
    if (soTaiKhoan) filter.soTaiKhoan = { $regex: soTaiKhoan, $options: 'i' };
    if (tenKhachHang) filter.tenKhachHang = { $regex: tenKhachHang, $options: 'i' };
    if (qlkh) filter.qlkh = { $regex: qlkh, $options: 'i' };
    if (phong) filter.phong = { $regex: phong, $options: 'i' };
    if (fromDate || toDate) {
      filter.ngayGiaiNgan = {};
      if (fromDate) filter.ngayGiaiNgan.$gte = new Date(fromDate);
      if (toDate) filter.ngayGiaiNgan.$lte = new Date(toDate);
    }
    if (search) {
      filter.$or = [
        { soTaiKhoan: { $regex: search, $options: 'i' } },
        { tenKhachHang: { $regex: search, $options: 'i' } },
        { qlkh: { $regex: search, $options: 'i' } },
        { phong: { $regex: search, $options: 'i' } }
      ];
    }
    const total = await HoSo.countDocuments(filter);
    const data = await HoSo.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));
    res.json({ data, total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Thêm mới hồ sơ
router.post('/', async (req, res) => {
  try {
    const hoso = new HoSo(req.body);
    const saved = await hoso.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Sửa hồ sơ
router.put('/:id', async (req, res) => {
  try {
    const updated = await HoSo.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ error: 'Không tìm thấy hồ sơ' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Xóa hồ sơ
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await HoSo.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Không tìm thấy hồ sơ' });
    res.json({ message: 'Đã xóa hồ sơ' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Bàn giao hồ sơ (BGD -> QTTD)
router.put('/:id/ban-giao', async (req, res) => {
  try {
    const updated = await HoSo.findByIdAndUpdate(
      req.params.id,
      {
        trangThai: 'dang-xu-ly',
        'banGiao.daBanGiao': true,
        'banGiao.user': req.body.user,
        'banGiao.ghiChu': req.body.ghiChu || ''
      },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: 'Không tìm thấy hồ sơ' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Lấy danh sách hồ sơ chờ QTTD nhận
router.get('/cho-qttd-nhan', async (req, res) => {
  try {
    // Có thể dùng trạng thái 'cho-qttd-nhan' hoặc 'dang-xu-ly' tùy quy ước
    const data = await HoSo.find({ trangThai: 'dang-xu-ly', 'banGiao.daBanGiao': true, 'nhanGiao.daNhan': { $ne: true } }).sort({ createdAt: -1 });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// QTTD xác nhận nhận hồ sơ
router.post('/:id/nhan', async (req, res) => {
  try {
    const updated = await HoSo.findByIdAndUpdate(
      req.params.id,
      {
        trangThai: 'qttd-da-nhan',
        'nhanGiao.daNhan': true,
        'nhanGiao.user': req.body.user || '',
        'nhanGiao.ghiChu': req.body.ghiChu || ''
      },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: 'Không tìm thấy hồ sơ' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// QTTD từ chối nhận hồ sơ
router.post('/:id/tu-choi', async (req, res) => {
  try {
    const updated = await HoSo.findByIdAndUpdate(
      req.params.id,
      {
        trangThai: 'qttd-tu-choi',
        'nhanGiao.daNhan': false,
        'nhanGiao.user': req.body.user || '',
        'nhanGiao.ghiChu': req.body.note || ''
      },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: 'Không tìm thấy hồ sơ' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// QTTD hoàn trả hồ sơ về QLKH
router.post('/:id/hoan-tra', async (req, res) => {
  try {
    const updated = await HoSo.findByIdAndUpdate(
      req.params.id,
      {
        trangThai: 'qttd-hoan-tra',
        'hoanTra.daHoanTra': true,
        'hoanTra.user': req.body.user || '',
        'hoanTra.ghiChu': req.body.note || ''
      },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: 'Không tìm thấy hồ sơ' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// QLKH xác nhận đã nhận đủ chứng từ
router.post('/:id/xac-nhan-nhan-chung-tu', async (req, res) => {
  try {
    const updated = await HoSo.findByIdAndUpdate(
      req.params.id,
      {
        trangThai: 'hoan-tat', // hoặc 'qlkh-da-nhan'
        'nhanChungTu.daNhan': true,
        'nhanChungTu.user': req.body.user || '',
        'nhanChungTu.ghiChu': req.body.note || ''
      },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: 'Không tìm thấy hồ sơ' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// QLKH từ chối nhận chứng từ
router.post('/:id/tu-choi-nhan-chung-tu', async (req, res) => {
  try {
    const updated = await HoSo.findByIdAndUpdate(
      req.params.id,
      {
        trangThai: 'qlkh-tu-choi-nhan',
        'nhanChungTu.daNhan': false,
        'nhanChungTu.user': req.body.user || '',
        'nhanChungTu.ghiChu': req.body.note || ''
      },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: 'Không tìm thấy hồ sơ' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
module.exports = router; 

