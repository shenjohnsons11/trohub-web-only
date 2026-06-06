const Contract = require('../models/Contract');
const Room = require('../models/Room');

// 1. Lấy danh sách toàn bộ hợp đồng (Chủ trọ xem trên Web)
exports.getAllContracts = async (req, res) => {
    try {
        const contracts = await Contract.find()
            .populate('roomId', 'roomCode area')
            .populate('tenantId', 'fullName phone')
            .sort({ createdAt: -1 });
            
        res.status(200).json({ success: true, data: contracts });
    } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi Server: " + error.message });
    }
};

// 2. Chủ trọ tạo dự thảo hợp đồng (Giao diện Tạo hợp đồng trên Figma)
exports.createContract = async (req, res) => {
    try {
        // Dữ liệu truyền lên bao gồm thông tin cơ bản và mảng các dịch vụ đã chốt giá
        // Mảng services có dạng: [{ serviceId: "...", fixedPrice: 4000 }]
        const { roomId, tenantId, startDate, endDate, fixedRentPrice, fixedDeposit, services } = req.body;

        const newContract = new Contract({
            roomId,
            tenantId,
            startDate,
            endDate,
            fixedRentPrice,
            fixedDeposit,
            services: services || [], // Nhúng thẳng mảng dịch vụ vào đây
            status: 0 // Trạng thái mặc định: 0 - Chờ khách xác nhận
        });

        await newContract.save();
        res.status(201).json({ 
            success: true, 
            message: "Tạo dự thảo hợp đồng thành công! Chờ khách thuê ký xác nhận.", 
            data: newContract 
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi khi tạo hợp đồng: " + error.message });
    }
};

// 3. Xem chi tiết hợp đồng (Cả Web và Mobile App đều dùng)
exports.getContractById = async (req, res) => {
    try {
        const contract = await Contract.findById(req.params.id)
            .populate('roomId')
            .populate('tenantId', 'fullName phone idCard email')
            .populate('services.serviceId', 'name unit type defaultPrice'); // Kéo chi tiết dịch vụ ra

        if (!contract) {
            return res.status(404).json({ success: false, message: "Không tìm thấy hợp đồng!" });
        }
        res.status(200).json({ success: true, data: contract });
    } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi Server: " + error.message });
    }
};

// 4. Khách thuê thực hiện Ký hợp đồng (Trên Mobile App)
exports.signContract = async (req, res) => {
    try {
        const contract = await Contract.findById(req.params.id);
        
        if (!contract) return res.status(404).json({ success: false, message: "Không tìm thấy hợp đồng!" });
        if (contract.status !== 0) {
            return res.status(400).json({ success: false, message: "Hợp đồng này không ở trạng thái chờ ký!" });
        }

        // 1. Chuyển trạng thái hợp đồng thành Đang hiệu lực (1) và lưu vết thời gian ký
        contract.status = 1;
        contract.tenantConfirmedAt = new Date();
        await contract.save();

        // 2. Chuyển trạng thái Phòng thành Đang thuê (1)
        await Room.findByIdAndUpdate(contract.roomId, { status: 1 });

        res.status(200).json({ 
            success: true, 
            message: "Ký tên điện tử thành công! Hợp đồng chính thức có hiệu lực." 
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi khi ký hợp đồng: " + error.message });
    }
};

// 5. Cập nhật thông tin hợp đồng (Chủ trọ sửa trên Web)
exports.updateContract = async (req, res) => {
    try {
        const { roomId, tenantId, startDate, endDate, fixedRentPrice, fixedDeposit, status } = req.body;
        const updateData = {};
        if (roomId !== undefined) updateData.roomId = roomId;
        if (tenantId !== undefined) updateData.tenantId = tenantId;
        if (startDate !== undefined) updateData.startDate = startDate;
        if (endDate !== undefined) updateData.endDate = endDate;
        if (fixedRentPrice !== undefined) updateData.fixedRentPrice = fixedRentPrice;
        if (fixedDeposit !== undefined) updateData.fixedDeposit = fixedDeposit;
        if (status !== undefined) updateData.status = status;

        const updated = await Contract.findByIdAndUpdate(req.params.id, updateData, { new: true })
            .populate('roomId', 'roomCode area')
            .populate('tenantId', 'fullName phone');

        if (!updated) return res.status(404).json({ success: false, message: "Không tìm thấy hợp đồng!" });

        // Nếu admin đổi trạng thái thành hiệu lực (1) → đổi phòng thành Đang thuê
        if (status === 1 && updated.roomId) {
            await Room.findByIdAndUpdate(updated.roomId._id || updated.roomId, { status: 1 });
        }

        res.status(200).json({ success: true, message: "Cập nhật hợp đồng thành công!", data: updated });
    } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi khi cập nhật hợp đồng: " + error.message });
    }
};