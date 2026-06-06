const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoiceController');

// Lấy danh sách hóa đơn (Web)
router.get('/', invoiceController.getAllInvoices);

// Chủ trọ xuất hóa đơn mới
router.post('/', invoiceController.createInvoice);

// Xem chi tiết một hóa đơn (Web & Mobile)
router.get('/:id', invoiceController.getInvoiceById);

// Đánh dấu thanh toán (Tự động sinh Transaction)
router.put('/:id/pay', invoiceController.payInvoice);

module.exports = router;