const Account = require('../models/Account');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Chuỗi bí mật mã hóa phiên đăng nhập
const JWT_SECRET = process.env.JWT_SECRET || 'trohub_secret_key_2026';

// 1. Đăng ký tài khoản (Hỗ trợ khởi tạo cho cả Chủ trọ và Người thuê)
exports.register = async (req, res) => {
    try {
        const { username, password, fullName, phone, email, idCard, role } = req.body;

        // Kiểm tra xem tên đăng nhập đã được ai sử dụng chưa
        const existingAccount = await Account.findOne({ username });
        if (existingAccount) {
            return res.status(400).json({ success: false, message: "Tên đăng nhập này đã tồn tại trên hệ thống!" });
        }

        // Tiến hành mã hóa mật khẩu bảo mật theo tiêu chuẩn quy định trong ERD
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newAccount = new Account({
            username,
            password: hashedPassword,
            fullName,
            phone,
            email,
            idCard,
            role,   // 1 - Chủ trọ, 2 - Người thuê
            status: 1 // Mặc định khởi tạo là trạng thái Active (1)
        });

        await newAccount.save();
        res.status(201).json({ success: true, message: "Đăng ký tài khoản mới thành công!" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi Server khi đăng ký: " + error.message });
    }
};

// 2. Đăng nhập hệ thống tổng hợp (Dùng chung cho cả Web và Mobile App)
exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;

        // Tìm kiếm tài khoản dựa trên tên đăng nhập duy nhất
        const account = await Account.findOne({ username });
        if (!account || account.status === 0) {
            return res.status(400).json({ success: false, message: "Tài khoản không tồn tại hoặc đã bị khóa!" });
        }

        // So khớp mật khẩu đã mã hóa lưu trong cơ sở dữ liệu
        const isMatch = await bcrypt.compare(password, account.password);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: "Mật khẩu đăng nhập không chính xác!" });
        }

        // Tạo mã Token phiên làm việc thời hạn 30 ngày, đính kèm ID và Quyền hạn truy cập
        const token = jwt.sign(
            { id: account._id, role: account.role }, 
            JWT_SECRET, 
            { expiresIn: '30d' }
        );

        res.status(200).json({
            success: true,
            message: "Đăng nhập hệ thống thành công!",
            token,
            user: {
                id: account._id,
                username: account.username,
                fullName: account.fullName,
                role: account.role // 1: Giao diện Web chủ trọ, 2: Giao diện Mobile khách thuê
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi Server khi đăng nhập: " + error.message });
    }
};