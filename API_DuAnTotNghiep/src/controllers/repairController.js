const RepairRequest = require('../models/RepairRequest');
const Contract = require('../models/Contract');

// 1. Lấy danh sách yêu cầu sửa chữa (Dành cho Chủ trọ - Web)
exports.getAllRequests = async (req, res) => {
    try {
        // Dùng populate để kéo thông tin phòng (roomCode) và người gửi (fullName, phone) qua Hợp đồng
        const requests = await RepairRequest.find()
            .populate({
                path: 'contractId',
                populate: [
                    { path: 'roomId', select: 'roomCode' },
                    { path: 'tenantId', select: 'fullName phone' }
                ]
            })
            .sort({ createdAt: -1 }); // Mới nhất lên đầu

        // Map để frontend dễ hiển thị
        const data = requests.map(r => ({
            _id: r._id,
            repairCode: r._id.toString().slice(-6).toUpperCase(),
            room: r.contractId?.roomId?.roomCode || '-',
            sender: r.contractId?.tenantId?.fullName || '-',
            title: r.title,
            content: r.content,
            priority: r.priority || 1,
            status: r.status || 0,
            landlordNote: r.landlordNote || '',
            images: r.images || [],
            createdAt: r.createdAt
        }));

        res.status(200).json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi Server: " + error.message });
    }
};

// 2. Gửi yêu cầu sửa chữa mới (Dành cho Khách thuê - Mobile App)
exports.createRequest = async (req, res) => {
    try {
        const { tenantId, title, content, priority } = req.body;

        // 1. Tự động dò tìm Hợp đồng đang hiệu lực (status = 1) của khách này
        const activeContract = await Contract.findOne({ tenantId: tenantId, status: 1 });
        if (!activeContract) {
            return res.status(400).json({ 
                success: false, 
                message: "Bạn hiện không có hợp đồng thuê phòng nào đang hiệu lực để báo cáo sự cố!" 
            });
        }

        // 2. Lưu yêu cầu gắn liền với hợp đồng đó
        const newRequest = new RepairRequest({
            contractId: activeContract._id,
            title,
            content,
            priority: priority || 2, // Mặc định là 2 (Mức độ Vừa) nếu App không gửi
            status: 0 // 0: Chờ xác nhận
        });

        await newRequest.save();
        res.status(201).json({ 
            success: true, 
            message: "Gửi báo cáo sự cố thành công!", 
            data: newRequest 
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi khi gửi yêu cầu: " + error.message });
    }
};

// 3. Cập nhật trạng thái và ghi chú (Dành cho Chủ trọ - Web)
exports.updateRequestStatus = async (req, res) => {
    try {
        // Chủ trọ truyền lên trạng thái mới và lời ghi chú nội bộ
        let { status, priority, note } = req.body;

        // Map string → number nếu frontend gửi string
        const statusMap = { 'Mới': 0, 'Đang xử lý': 1, 'Đã hoàn thành': 2, 'Hoàn thành': 2, 'Đã hủy': 3 };
        const priorityMap = { 'Thấp': 1, 'Trung bình': 2, 'Cao': 3 };

        const statusNum = typeof status === 'string' ? (statusMap[status] !== undefined ? statusMap[status] : parseInt(status)) : status;
        const priorityNum = typeof priority === 'string' ? (priorityMap[priority] !== undefined ? priorityMap[priority] : parseInt(priority)) : priority;

        const updateData = {};
        if (statusNum !== undefined && !isNaN(statusNum)) updateData.status = statusNum;
        if (priorityNum !== undefined && !isNaN(priorityNum)) updateData.priority = priorityNum;
        if (note !== undefined) updateData.landlordNote = note;

        const updatedRequest = await RepairRequest.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true }
        );

        if (!updatedRequest) {
            return res.status(404).json({ success: false, message: "Không tìm thấy yêu cầu sửa chữa này!" });
        }

        res.status(200).json({ 
            success: true, 
            message: "Cập nhật tiến độ xử lý thành công!", 
            data: {
                _id: updatedRequest._id,
                repairCode: updatedRequest._id.toString().slice(-6).toUpperCase(),
                status: updatedRequest.status,
                priority: updatedRequest.priority,
                landlordNote: updatedRequest.landlordNote || ''
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi khi cập nhật: " + error.message });
    }
};