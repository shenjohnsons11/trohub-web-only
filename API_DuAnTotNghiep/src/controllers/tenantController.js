const Account = require('../models/Account');
const Room = require('../models/Room');
const Contract = require('../models/Contract');
const Invoice = require('../models/Invoice');
const RepairRequest = require('../models/RepairRequest');
const bcrypt = require('bcryptjs');

// =========================================================================
// PHẦN 1: DÀNH CHO GIAO DIỆN WEB (CHỦ TRỌ QUẢN LÝ)
// =========================================================================

// 1. Lấy danh sách toàn bộ khách thuê (role = 2)
exports.getAllTenants = async (req, res) => {
    try {
        const tenants = await Account.find({ role: 2 }).sort({ createdAt: -1 });
        res.status(200).json({
            success: true,
            message: "Lấy danh sách khách thuê thành công!",
            data: tenants
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi Server: " + error.message });
    }
};

// 2. Thêm khách thuê mới (Tạo tài khoản + Gán phòng qua Hợp đồng)
exports.createTenant = async (req, res) => {
    try {
        // Form UI Figma truyền lên: Họ tên, sđt, phòng, CCCD, ngày bắt đầu
        const { fullName, phone, password, roomCode, idCard, startDate } = req.body;

        // Kiểm tra SĐT đã tồn tại chưa
        const existingAccount = await Account.findOne({ phone, role: 2 });
        if (existingAccount) {
            return res.status(400).json({ success: false, message: "Số điện thoại này đã được đăng ký!" });
        }

        // Tìm phòng để lấy ID phòng và Giá mặc định
        const room = await Room.findOne({ roomCode });
        if (!room) {
            return res.status(404).json({ success: false, message: "Không tìm thấy mã phòng này!" });
        }
        if (room.status !== 0) {
            return res.status(400).json({ success: false, message: "Phòng này hiện không trống!" });
        }

        // 1. Tạo tài khoản khách thuê
        const rawPassword = password || phone;
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(rawPassword, salt);

        const newTenant = new Account({
            username: phone, // Dùng SĐT làm username đăng nhập
            password: hashedPassword,
            fullName,
            phone,
            idCard,
            role: 2,
            status: 1
        });
        const savedTenant = await newTenant.save();

        // 2. Tạo Hợp đồng kết nối Khách với Phòng
        // Mặc định cho hợp đồng kéo dài 1 năm kể từ startDate
        const start = new Date(startDate);
        const end = new Date(start);
        end.setFullYear(end.getFullYear() + 1);

        const newContract = new Contract({
            roomId: room._id,
            tenantId: savedTenant._id,
            startDate: start,
            endDate: end,
            fixedRentPrice: room.defaultRentPrice, // Lấy giá mặc định của phòng
            fixedDeposit: room.defaultDeposit,
            status: 1 // Hiệu lực luôn
        });
        await newContract.save();

        // 3. Đổi trạng thái phòng thành "Đang thuê" (1)
        room.status = 1;
        await room.save();

        res.status(201).json({
            success: true,
            message: "Thêm khách thuê và gán phòng thành công!",
            data: savedTenant
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi khi thêm khách thuê: " + error.message });
    }
};

// 3. Lấy chi tiết thông tin 1 khách thuê
exports.getTenantById = async (req, res) => {
    try {
        const tenant = await Account.findOne({ _id: req.params.id, role: 2 });
        if (!tenant) return res.status(404).json({ success: false, message: "Không tìm thấy khách thuê!" });
        res.status(200).json({ success: true, data: tenant });
    } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi Server: " + error.message });
    }
};

// 4. Cập nhật thông tin khách thuê
exports.updateTenant = async (req, res) => {
    try {
        const { password } = req.body;
        let updateData = { ...req.body };

        if (password) {
            const salt = await bcrypt.genSalt(10);
            updateData.password = await bcrypt.hash(password, salt);
        }

        const updatedTenant = await Account.findOneAndUpdate(
            { _id: req.params.id, role: 2 }, 
            updateData, 
            { new: true }
        );
        
        if (!updatedTenant) return res.status(404).json({ success: false, message: "Không tìm thấy khách thuê!" });

        res.status(200).json({ success: true, message: "Cập nhật thành công!", data: updatedTenant });
    } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi Server: " + error.message });
    }
};

// 5. Ngừng thuê phòng (Chấm dứt hợp đồng)
exports.terminateTenant = async (req, res) => {
    try {
        const tenantId = req.params.id;

        // Tìm hợp đồng đang hiệu lực của khách này
        const activeContract = await Contract.findOne({ tenantId: tenantId, status: 1 });
        if (!activeContract) {
            return res.status(404).json({ success: false, message: "Khách thuê không có hợp đồng nào đang hiệu lực!" });
        }

        // 1. Chuyển hợp đồng sang trạng thái Hết hạn (2)
        activeContract.status = 2;
        await activeContract.save();

        // 2. Chuyển phòng về trạng thái Trống (0)
        await Room.findByIdAndUpdate(activeContract.roomId, { status: 0 });

        // 3. (Tùy chọn) Chuyển tài khoản khách thành Inactive (0)
        await Account.findByIdAndUpdate(tenantId, { status: 0 });

        res.status(200).json({ success: true, message: "Đã xử lý trả phòng thành công!" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi khi trả phòng: " + error.message });
    }
};

// =========================================================================
// PHẦN 2: DÀNH CHO GIAO DIỆN MOBILE APP (NGƯỜI THUÊ)
// =========================================================================

// 6. Lấy dữ liệu tổng hợp hiển thị lên màn hình chính Mobile App
exports.getHomeSummary = async (req, res) => {
    try {
        const { tenantId } = req.params;

        const tenant = await Account.findById(tenantId);
        if (!tenant || tenant.role !== 2) {
            return res.status(404).json({ success: false, message: "Không tìm thấy khách thuê!" });
        }

        // Tìm hợp đồng đang hiệu lực, populate để lấy thông tin mã phòng
        const contract = await Contract.findOne({ tenantId: tenantId, status: 1 }).populate('roomId', 'roomCode');
        
        let latestInvoice = null;
        let latestRepair = null;

        // Nếu có hợp đồng, mới tìm hóa đơn và sửa chữa dựa trên ID hợp đồng đó
        if (contract) {
            latestInvoice = await Invoice.findOne({ contractId: contract._id, status: 0 }).sort({ createdAt: -1 });
            latestRepair = await RepairRequest.findOne({ contractId: contract._id }).sort({ createdAt: -1 });
        }

        res.status(200).json({
            success: true,
            data: {
                tenantName: tenant.fullName,
                roomCode: contract && contract.roomId ? contract.roomId.roomCode : "Chưa có phòng",
                invoiceSummary: latestInvoice ? {
                    totalAmount: latestInvoice.totalAmount,
                    status: latestInvoice.status,
                    period: latestInvoice.period,
                    dueDate: latestInvoice.dueDate ? latestInvoice.dueDate.toLocaleDateString('vi-VN') : "N/A"
                } : null,
                contractSummary: contract ? {
                    endDate: contract.endDate.toLocaleDateString('vi-VN')
                } : null,
                repairSummary: latestRepair ? {
                    title: latestRepair.title,
                    status: latestRepair.status
                } : null
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi Mobile Dashboard: " + error.message });
    }
};