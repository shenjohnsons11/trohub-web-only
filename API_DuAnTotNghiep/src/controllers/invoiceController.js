const Invoice = require('../models/Invoice');
const Contract = require('../models/Contract');
const Service = require('../models/Service');
const Transaction = require('../models/Transaction'); // Gọi thêm bảng Giao dịch

// 1. Lấy danh sách toàn bộ hóa đơn (Hiển thị lên bảng Web)
exports.getAllInvoices = async (req, res) => {
    try {
        // Dùng populate 2 tầng để lấy tên phòng và tên người thuê từ Hợp đồng
        const invoices = await Invoice.find()
            .populate({
                path: 'contractId',
                populate: [
                    { path: 'roomId', select: 'roomCode' },
                    { path: 'tenantId', select: 'fullName' }
                ]
            })
            .sort({ createdAt: -1 });

        res.status(200).json({ success: true, data: invoices });
    } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi Server: " + error.message });
    }
};

// 2. Tạo hóa đơn mới (Chủ trọ chốt số điện nước hàng tháng)
exports.createInvoice = async (req, res) => {
    try {
        const { contractId, period, dueDate, serviceIndices, room, tenant } = req.body;

        // Hỗ trợ lưu trực tiếp các trường tính toán từ Frontend
        if (room || tenant) {
            let resolvedContractId = contractId;
            if (!resolvedContractId && room) {
                const Room = require('../models/Room');
                const targetRoom = await Room.findOne({ roomCode: room });
                if (targetRoom) {
                    resolvedContractId = targetRoom._id; // Lưu tạm roomId làm contractId nếu không có hợp đồng
                    const contract = await Contract.findOne({ roomId: targetRoom._id }).sort({ createdAt: -1 });
                    if (contract) {
                        resolvedContractId = contract._id;
                    }
                }
            }

            // Parse period từ fromDate (MM/YYYY)
            let resolvedPeriod = period;
            if (!resolvedPeriod && req.body.fromDate) {
                const parts = req.body.fromDate.split('/');
                if (parts.length === 3) {
                    resolvedPeriod = `${parts[1]}/${parts[2]}`;
                }
            }
            if (!resolvedPeriod) {
                const d = new Date();
                resolvedPeriod = `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
            }

            // Trạng thái: "Chưa thanh toán" -> 0, "Đã thanh toán" -> 1
            let resolvedStatus = 0;
            if (req.body.status === "Đã thanh toán" || req.body.status === 1) {
                resolvedStatus = 1;
            }

            // Định dạng ngày
            let parsedDueDate = new Date();
            if (dueDate) {
                if (typeof dueDate === 'string') {
                    if (dueDate.includes('/')) {
                        const parts = dueDate.split('/');
                        parsedDueDate = new Date(parts[2], parts[1] - 1, parts[0]);
                    } else {
                        parsedDueDate = new Date(dueDate);
                    }
                } else {
                    parsedDueDate = new Date(dueDate);
                }
            }

            const electricityOld = Number(req.body.electricityOld) || 0;
            const electricityNew = Number(req.body.electricityNew) || 0;
            const electricityPrice = Number(req.body.electricityPrice) || 0;
            const electricityUsage = Math.max(0, electricityNew - electricityOld);
            const electricityAmount = electricityUsage * electricityPrice;

            const waterOld = Number(req.body.waterOld) || 0;
            const waterNew = Number(req.body.waterNew) || 0;
            const waterPrice = Number(req.body.waterPrice) || 0;
            const waterUsage = Math.max(0, waterNew - waterOld);
            const waterAmount = waterUsage * waterPrice;

            const total = Number(req.body.total) || Number(req.body.totalAmount) || 0;

            const newInvoice = new Invoice({
                contractId: resolvedContractId || null,
                period: resolvedPeriod,
                dueDate: parsedDueDate,
                totalAmount: total,
                status: resolvedStatus,
                room: room || "",
                tenant: tenant || "",
                fromDate: req.body.fromDate || "",
                toDate: req.body.toDate || "",
                roomAmount: Number(req.body.roomAmount) || 0,
                electricityOld,
                electricityNew,
                electricity: electricityAmount,
                waterOld,
                waterNew,
                water: waterAmount,
                services: Number(req.body.services) || 0,
                discount: Number(req.body.discount) || 0,
                penaltyDays: Number(req.body.penaltyDays) || 0,
                penaltyRate: Number(req.body.penaltyRate) || 0.1,
                penalty: Number(req.body.penalty) || 0,
                paymentMethod: req.body.paymentMethod || "",
                transactionCode: req.body.transactionCode || "",
                details: []
            });

            await newInvoice.save();
            return res.status(201).json({ success: true, message: "Xuất hóa đơn thành công!", data: newInvoice });
        }

        // --- Logic cũ khi gọi bằng API thô ---
        const contract = await Contract.findById(contractId).populate('services.serviceId');
        if (!contract || contract.status !== 1) {
            return res.status(400).json({ success: false, message: "Hợp đồng không tồn tại hoặc đã hết hiệu lực!" });
        }

        // Tìm hóa đơn của tháng trước để lấy Chỉ số cũ (oldIndex)
        const previousInvoice = await Invoice.findOne({ contractId }).sort({ createdAt: -1 });

        let totalAmount = contract.fixedRentPrice; // Bắt đầu cộng từ Tiền phòng gốc
        let details = [];

        // Duyệt qua từng dịch vụ đã chốt trong hợp đồng để tính tiền
        for (const item of contract.services) {
            const service = item.serviceId;
            let appliedPrice = item.fixedPrice;
            
            let detailRow = {
                serviceId: service._id,
                appliedPrice: appliedPrice
            };

            if (service.type === 1) { 
                // Loại 1: Tính theo chỉ số (Điện, Nước)
                // Tìm chỉ số mới chủ trọ vừa nhập cho dịch vụ này
                const inputData = serviceIndices.find(s => s.serviceId.toString() === service._id.toString());
                const newIndex = inputData ? inputData.newIndex : 0;
                
                // Lấy chỉ số cũ từ hóa đơn tháng trước (nếu không có thì = 0)
                let oldIndex = 0;
                if (previousInvoice) {
                    const prevDetail = previousInvoice.details.find(d => d.serviceId.toString() === service._id.toString());
                    if (prevDetail) oldIndex = prevDetail.newIndex;
                }

                const quantity = newIndex > oldIndex ? newIndex - oldIndex : 0;
                const amount = quantity * appliedPrice;

                detailRow.oldIndex = oldIndex;
                detailRow.newIndex = newIndex;
                detailRow.quantity = quantity;
                detailRow.amount = amount;
            } else {
                // Loại 2: Tính khoán (Wifi, Rác...)
                detailRow.quantity = 1;
                detailRow.amount = appliedPrice;
            }

            totalAmount += detailRow.amount;
            details.push(detailRow);
        }

        const newInvoice = new Invoice({
            contractId,
            period,
            dueDate,
            totalAmount,
            status: 0, // 0: Chưa thanh toán
            details
        });

        await newInvoice.save();
        res.status(201).json({ success: true, message: "Xuất hóa đơn thành công!", data: newInvoice });
    } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi khi tạo hóa đơn: " + error.message });
    }
};

// 3. Xem chi tiết 1 hóa đơn
exports.getInvoiceById = async (req, res) => {
    try {
        const invoice = await Invoice.findById(req.params.id)
            .populate({
                path: 'contractId',
                populate: [
                    { path: 'roomId', select: 'roomCode area' },
                    { path: 'tenantId', select: 'fullName phone idCard' }
                ]
            })
            .populate('details.serviceId', 'name unit'); // Lấy thêm tên dịch vụ (Điện, Nước) và đơn vị

        if (!invoice) return res.status(404).json({ success: false, message: "Không tìm thấy hóa đơn!" });
        res.status(200).json({ success: true, data: invoice });
    } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi Server: " + error.message });
    }
};

// 4. Thanh toán hóa đơn (Ghi nhận Giao dịch)
exports.payInvoice = async (req, res) => {
    try {
        const { method, gatewayReference } = req.body; // VD: method = "VNPay" hoặc "Chuyển khoản"
        
        const invoice = await Invoice.findById(req.params.id);
        if (!invoice) return res.status(404).json({ success: false, message: "Không tìm thấy hóa đơn!" });
        if (invoice.status === 1) return res.status(400).json({ success: false, message: "Hóa đơn này đã được thanh toán rồi!" });

        // 1. Cập nhật trạng thái hóa đơn thành Đã thanh toán (1)
        invoice.status = 1;
        await invoice.save();

        // 2. Tạo một bản ghi Giao dịch (Transaction) theo chuẩn ERD
        const newTransaction = new Transaction({
            invoiceId: invoice._id,
            amount: invoice.totalAmount,
            method: method || 'Tiền mặt',
            status: 1, // 1: Thành công
            gatewayReference: gatewayReference || ''
        });
        await newTransaction.save();

        res.status(200).json({ 
            success: true, 
            message: "Thanh toán thành công và đã ghi nhận giao dịch!",
            transaction: newTransaction
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi khi xử lý thanh toán: " + error.message });
    }
};