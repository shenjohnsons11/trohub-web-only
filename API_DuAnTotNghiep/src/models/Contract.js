const mongoose = require('mongoose');

const contractSchema = new mongoose.Schema({
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    fixedRentPrice: { type: Number, required: true }, // gia_thue_chot
    fixedDeposit: { type: Number, required: true },   // tien_coc_chot
    tenantConfirmedAt: { type: Date },                // thoi_gian_khach_xac_nhan
    status: { type: Number, enum: [0, 1, 2, 3], default: 0 }, // 0: Chờ xác nhận, 1: Hiệu lực, 2: Hết hạn, 3: Hủy
    
    // Tuyệt chiêu Nhúng dữ liệu: Gộp bảng HOP_DONG_DICH_VU vào đây
    services: [{
        serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service' },
        fixedPrice: { type: Number } // don_gia_chot lúc ký
    }]
}, { timestamps: true });

module.exports = mongoose.model('Contract', contractSchema);