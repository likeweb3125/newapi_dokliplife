const express = require('express');
const router = express.Router();

const mailGunController = require('../controllers/mailGun');

router.post('/user', mailGunController.postMailGunSingUp); // 이메일 전송 계정 생성

router.post('/token', mailGunController.postMailGunToken); // 이메일 전송 토큰 생성

router.post('/send', mailGunController.postMailGunSend); // 이메일 전송 MailGun

module.exports = router;
