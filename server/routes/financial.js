const express = require('express');
const router = express.Router();
const HoSo = require('../models/HoSo');
const ExcelJS = require('exceljs');

// Middleware kiểm tra quyền quan-tri-tin-dung
const checkCreditManagerRole = (req, res, next) => {
  const userRole = req.headers['user-role'];
  if (userRole !== 'quan-tri-tin-dung') {
    return res.status(403).json({ message: 'Không có quyền truy cập dữ liệu tài chính' });
  }
  next();
};

// GET /financial/dashboard - Lấy dữ liệu dashboard tài chính
router.get('/dashboard', checkCreditManagerRole, async (req, res) => {
  try {
    // Lấy dữ liệu theo tháng (6 tháng gần nhất)
    const monthlyData = await HoSo.aggregate([
      {
        $match: {
          ngayGiaiNgan: { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$ngayGiaiNgan' },
            month: { $month: '$ngayGiaiNgan' }
          },
          totalAmount: { $sum: '$soTienGiaiNgan' },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': -1, '_id.month': -1 }
      },
      {
        $limit: 6
      },
      {
        $project: {
          _id: 0,
          month: {
            $concat: [
              'T', { $toString: '$_id.month' }, '/', { $toString: '$_id.year' }
            ]
          },
          amount: '$totalAmount',
          count: '$count'
        }
      }
    ]);

    // Lấy dữ liệu phân bố theo loại tiền
    const currencyData = await HoSo.aggregate([
      {
        $match: {
          loaiTien: { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: '$loaiTien',
          totalAmount: { $sum: '$soTienGiaiNgan' },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          currency: '$_id',
          amount: '$totalAmount',
          count: '$count'
        }
      }
    ]);

    // Tính tỷ lệ phần trăm cho từng loại tiền
    const totalAmount = currencyData.reduce((sum, item) => sum + item.amount, 0);
    const currencyDataWithPercentage = currencyData.map(item => ({
      ...item,
      percentage: totalAmount > 0 ? Math.round((item.amount / totalAmount) * 100) : 0
    }));

    // Lấy top 5 tài khoản có số tiền lớn nhất
    const topAccounts = await HoSo.aggregate([
      {
        $match: {
          soTienGiaiNgan: { $exists: true, $ne: null }
        }
      },
      {
        $sort: { soTienGiaiNgan: -1 }
      },
      {
        $limit: 5
      },
      {
        $project: {
          _id: 0,
          account: '$soTaiKhoan',
          customer: '$tenKhachHang',
          amount: '$soTienGiaiNgan'
        }
      }
    ]);

    // Tính tỷ lệ hoàn thành hồ sơ
    const completionStats = await HoSo.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          completed: {
            $sum: {
              $cond: [
                { $eq: ['$trangThai', 'hoan-thanh'] },
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    const completionRate = completionStats.length > 0 && completionStats[0].total > 0
      ? Math.round((completionStats[0].completed / completionStats[0].total) * 100)
      : 0;

    res.json({
      success: true,
      data: {
        monthlyData: monthlyData.reverse(), // Đảo ngược để hiển thị theo thứ tự thời gian
        currencyData: currencyDataWithPercentage,
        topAccounts,
        completionRate
      }
    });

  } catch (error) {
    console.error('Error fetching financial data:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi khi lấy dữ liệu tài chính' 
    });
  }
});

// GET /financial/export - Xuất báo cáo tài chính
router.get('/export', checkCreditManagerRole, async (req, res) => {
  try {
    const { format = 'excel' } = req.query;
    
    // Lấy dữ liệu tổng hợp
    const monthlyData = await HoSo.aggregate([
      {
        $match: {
          ngayGiaiNgan: { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$ngayGiaiNgan' },
            month: { $month: '$ngayGiaiNgan' }
          },
          totalAmount: { $sum: '$soTienGiaiNgan' },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': -1, '_id.month': -1 }
      }
    ]);

    // Lấy dữ liệu chi tiết hồ sơ
    const detailedData = await HoSo.find({
      ngayGiaiNgan: { $exists: true, $ne: null }
    }).sort({ ngayGiaiNgan: -1 }).limit(100);

    // Lấy thống kê theo loại tiền
    const currencyData = await HoSo.aggregate([
      {
        $match: {
          loaiTien: { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: '$loaiTien',
          totalAmount: { $sum: '$soTienGiaiNgan' },
          count: { $sum: 1 }
        }
      }
    ]);

    if (format === 'excel') {
      // Tạo file Excel
      const workbook = new ExcelJS.Workbook();
      
      // Sheet 1: Tổng quan
      const overviewSheet = workbook.addWorksheet('Tổng quan');
      overviewSheet.columns = [
        { header: 'Tháng', key: 'month', width: 15 },
        { header: 'Tổng tiền giải ngân (VND)', key: 'amount', width: 25 },
        { header: 'Số lượng hồ sơ', key: 'count', width: 20 }
      ];

      monthlyData.forEach(item => {
        overviewSheet.addRow({
          month: `T${item._id.month}/${item._id.year}`,
          amount: item.totalAmount.toLocaleString('vi-VN'),
          count: item.count
        });
      });

      // Sheet 2: Chi tiết hồ sơ
      const detailSheet = workbook.addWorksheet('Chi tiết hồ sơ');
      detailSheet.columns = [
        { header: 'Số tài khoản', key: 'soTaiKhoan', width: 20 },
        { header: 'CIF', key: 'cif', width: 15 },
        { header: 'Tên khách hàng', key: 'tenKhachHang', width: 30 },
        { header: 'Số tiền giải ngân (VND)', key: 'soTienGiaiNgan', width: 25 },
        { header: 'Loại tiền', key: 'loaiTien', width: 15 },
        { header: 'Ngày giải ngân', key: 'ngayGiaiNgan', width: 20 },
        { header: 'Trạng thái', key: 'trangThai', width: 15 },
        { header: 'Phòng', key: 'phong', width: 20 },
        { header: 'QLKH', key: 'qlkh', width: 15 },
        { header: 'Hợp đồng', key: 'hopDong', width: 20 },
        { header: 'Ghi chú', key: 'ghiChu', width: 30 }
      ];

      detailedData.forEach(hoso => {
        detailSheet.addRow({
          soTaiKhoan: hoso.soTaiKhoan || '',
          cif: hoso.cif || '',
          tenKhachHang: hoso.tenKhachHang || '',
          soTienGiaiNgan: hoso.soTienGiaiNgan ? hoso.soTienGiaiNgan.toLocaleString('vi-VN') : '',
          loaiTien: hoso.loaiTien || '',
          ngayGiaiNgan: hoso.ngayGiaiNgan ? new Date(hoso.ngayGiaiNgan).toLocaleDateString('vi-VN') : '',
          trangThai: hoso.trangThai || '',
          phong: hoso.phong || '',
          qlkh: hoso.qlkh || '',
          hopDong: hoso.hopDong || '',
          ghiChu: hoso.ghiChu || ''
        });
      });

      // Sheet 3: Thống kê theo loại tiền
      const currencySheet = workbook.addWorksheet('Thống kê theo loại tiền');
      currencySheet.columns = [
        { header: 'Loại tiền', key: 'currency', width: 20 },
        { header: 'Tổng tiền (VND)', key: 'totalAmount', width: 25 },
        { header: 'Số lượng hồ sơ', key: 'count', width: 20 },
        { header: 'Tỷ lệ (%)', key: 'percentage', width: 15 }
      ];

      const totalAmount = currencyData.reduce((sum, item) => sum + item.totalAmount, 0);
      currencyData.forEach(item => {
        const percentage = totalAmount > 0 ? ((item.totalAmount / totalAmount) * 100).toFixed(2) : 0;
        currencySheet.addRow({
          currency: item._id,
          totalAmount: item.totalAmount.toLocaleString('vi-VN'),
          count: item.count,
          percentage: `${percentage}%`
        });
      });

      // Định dạng header
      [overviewSheet, detailSheet, currencySheet].forEach(sheet => {
        sheet.getRow(1).font = { bold: true };
        sheet.getRow(1).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF4F81BD' }
        };
        sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      });

      // Tạo tên file với timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filename = `Bao-cao-tai-chinh-${timestamp}.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      await workbook.xlsx.write(res);
      res.end();

    } else if (format === 'json') {
      res.json({
        success: true,
        data: {
          monthlyData,
          detailedData,
          currencyData
        }
      });
    } else {
      res.status(400).json({ 
        success: false, 
        message: 'Định dạng xuất báo cáo không được hỗ trợ' 
      });
    }

  } catch (error) {
    console.error('Error exporting financial data:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi khi xuất báo cáo tài chính' 
    });
  }
});

module.exports = router; 