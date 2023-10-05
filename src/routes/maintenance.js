const express = require('express');
const router = express.Router();

const maintenanceController = require('../controllers/maintenance');
const multerMiddleware = require('../middleware/multer');

router.get('/list/:category', maintenanceController.getMaintenanceBoardList); // 유지보수 게시판 리스트
router.get(
   '/view/:category/:list_no',
   maintenanceController.getMaintenanceBoardView
); // 게시판 조회

router.post(
   '/create',
   multerMiddleware.fileMulter,
   maintenanceController.getMaintenanceBoardCreate
); // 게시판 등록

router.post('/comment', maintenanceController.postMaintenanceCommentCreate); // 게시판 댓글 등록
router.get(
   '/comment/:list_no',
   maintenanceController.getMaintenanceCommentList
); // 게시판 댓글 리스트

module.exports = router;
