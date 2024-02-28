const express = require('express');
const router = express.Router();

const authController = require('../controllers/auth');
const isAuthMiddleware = require('../middleware/is-auth');

const validatorMiddleware = require('../middleware/validator');

router.post(
	'/signup',
	validatorMiddleware.singUpValidator,
	authController.postSignup
); // 회원가입

router.post('/login', authController.postLogin); //로그인

router.post('/email', authController.postEmailDoubleCheck); //이메일 중복확인
router.post('/email-password', authController.postPasswordEmailSendGun); // 비밀번호 재설정 이메일 전송 MailGun , Gmail - postPasswordEmailSendGmail
router.post(
	'/reset-password',
	isAuthMiddleware.isAuth,
	authController.postResetPassword
); // 비밀번호 재설정

router.get('/view', isAuthMiddleware.isAuth, authController.getUserView); // 회원정보 조회//
router.put('/user', isAuthMiddleware.isAuth, authController.putUserUpdate); // 회원정보 수정
router.delete(
	'/user',
	isAuthMiddleware.isAuth,
	authController.deleteUserDestroy
); // 회원탈퇴하기

router.get('/popup', authController.getPopupList); //팝업 리스트

module.exports = router;
