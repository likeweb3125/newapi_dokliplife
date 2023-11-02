const express = require('express');
const router = express.Router();

const boardController = require('../controllers/board');

const multerMiddleware = require('../middleware/multer');
const isAuthMiddleware = require('../middleware/is-auth');
//const category = require('../models/category');

router.get('/main/:category/:limit', boardController.getBoardMain); //게시글 메인 공지
router.get('/:category/:getLimit', boardController.getBoardList); //게시글 리스트
router.get(
   '/view/:category/:idx',
   isAuthMiddleware.isAuthBoard,
   boardController.getBoardView
); //게시글 뷰페이지

router.post(
   '/',
   multerMiddleware.fileMulter,
   isAuthMiddleware.isAuthBoard,
   boardController.postBoardCreate
); //게시글 등록

router.put(
   '/',
   multerMiddleware.fileMulter,
   isAuthMiddleware.isAuthBoard,
   boardController.putBoardUpdate
); //게시글 수정

router.delete('/', isAuthMiddleware.isAuth, boardController.deleteBoardDestroy); //게시글 삭제

router.delete(
   '/file',
   isAuthMiddleware.isAuth,
   boardController.deleteBoardFileDestroy
); //게시첨부파일 삭제

router.post('/password', boardController.postBoardPassword); //게시글 비밀번호 확인

router.put(
   '/move',
   isAuthMiddleware.isAuthAdmin,
   multerMiddleware.fileMulter,
   boardController.putBoardMove
); //관리자 게시글 이동

router.put(
   '/notice',
   isAuthMiddleware.isAuthAdmin,
   multerMiddleware.fileMulter,
   boardController.putBoardNotice
); //관리자 게시글 공지 설정

router.get(
   '/download/:category/:parent_idx/:idx',
   isAuthMiddleware.isAuthBoard,
   boardController.getFileDownload
); //게시판 첨부파일 다운로드

module.exports = router;
