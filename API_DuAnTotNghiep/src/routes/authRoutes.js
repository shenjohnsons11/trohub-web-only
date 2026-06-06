const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Đường dẫn đăng ký và đăng nhập tổng hợp mới
router.post('/register', authController.register);
router.post('/login', authController.login);

module.exports = router;