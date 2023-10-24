const express = require('express');
const router = express.Router();

const memberController = require('../controllers/member');
const isAuthMiddleware = require('../middleware/is-auth');

router.get(
   '/list/:m_level',
   isAuthMiddleware.isAuthAdmin,
   memberController.getMemberList
); //관리자 페이지 회원 리스트

router.get(
   '/level',
   isAuthMiddleware.isAuthAdmin,
   memberController.getMemberLevel
); //관리자 페이지 회원 레벨

router.get(
   '/view/:idx',
   isAuthMiddleware.isAuthAdmin,
   memberController.getMemberView
); //관리자 페이지 회원

router.put('/', isAuthMiddleware.isAuthAdmin, memberController.putMemberUpdate); //관리자 페이지 회원 수정

router.delete(
   '/',
   isAuthMiddleware.isAuthAdmin,
   memberController.deleteMemberDestroy
); //관리자 페이지 회원 탈퇴

router.get('/sms', isAuthMiddleware.isAuthAdmin, memberController.getSmsList); //관리자 페이지 SMS 전송 회원

router.get(
   '/sms-txt',
   isAuthMiddleware.isAuthAdmin,
   memberController.getSmsTextList
); //관리자 페이지 SMS 전송 문구

router.put(
   '/sms-txt',
   isAuthMiddleware.isAuthAdmin,
   memberController.putSmsTextUpdate
); //관리자 페이지 SMS 전송 문구 수정

router.get(
   '/sec',
   isAuthMiddleware.isAuthAdmin,
   memberController.getSecessionList
); //관리자 페이지 회원 탈퇴 리스트

router.post(
   '/sec',
   isAuthMiddleware.isAuthAdmin,
   memberController.postSecessionDestroy
); //관리자 페이지 회원 탈퇴 정보 영구 삭제

module.exports = router;
