const express = require('express');
const router = express.Router();

const maintenanceController = require('../controllers/maintenance');
const multerMiddleware = require('../middleware/multer');
const isAuthMiddleware = require('../middleware/is-auth');

router.get(
   '/list/:category',
   isAuthMiddleware.isAuthAdmin,
   maintenanceController.getMaintenanceBoardList
); // 유지보수 게시판 리스트
router.get(
   '/view/:category/:list_no',
   isAuthMiddleware.isAuthAdmin,
   maintenanceController.getMaintenanceBoardView
); // 게시판 조회

router.post(
   '/create',
   isAuthMiddleware.isAuthAdmin,
   multerMiddleware.fileMulter,
   maintenanceController.getMaintenanceBoardCreate
); // 게시판 등록

router.post(
   '/comment',
   isAuthMiddleware.isAuthAdmin,
   maintenanceController.postMaintenanceCommentCreate
); // 게시판 댓글 등록
router.get(
   '/comment/:list_no',
   isAuthMiddleware.isAuthAdmin,
   maintenanceController.getMaintenanceCommentList
); // 게시판 댓글 리스트

router.get(
   '/download/:list_no',
   isAuthMiddleware.isAuthAdmin,
   maintenanceController.getFileDownload
); //게시판 첨부파일 다운로드

module.exports = router;
