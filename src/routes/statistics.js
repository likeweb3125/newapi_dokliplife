const express = require('express');
const router = express.Router();

const statController = require('../controllers/statistics');
const isAuthMiddleware = require('../middleware/is-auth');

router.get('/', isAuthMiddleware.isAuthAdmin, statController.getStatCnt); //관리자 메인 전체통계

router.get(
   '/pre',
   isAuthMiddleware.isAuthAdmin,
   statController.getPeriodStatCnt
); //관리자 메인 기간별 현황 통계

router.get(
   '/history',
   isAuthMiddleware.isAuthAdmin,
   statController.getStatHistory
); //관리자 메인 기간별 현황 통계

router.get('/url', isAuthMiddleware.isAuthAdmin, statController.getStatUrl); //관리자 메인 접속 경로

router.get('/agent', isAuthMiddleware.isAuthAdmin, statController.getStatAgent); //관리자 메인 접속 브라우저

module.exports = router;
