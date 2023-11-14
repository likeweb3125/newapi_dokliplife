const express = require('express');
const router = express.Router();

const commentController = require('../controllers/comment');

const isAuthMiddleware = require('../middleware/is-auth');

router.get(
   '/admin',
   isAuthMiddleware.isAuthAdmin,
   commentController.getCommentListAdmin
); //관리자 댓글 리스트

router.get(
   '/user/:category/:board_idx',
   isAuthMiddleware.isAuthBoard,
   commentController.postCommentList
); //댓글 리스트

router.post(
   '/user',
   isAuthMiddleware.isAuthBoard,
   commentController.postCommentCreate
); //댓글 등록

router.put(
   '/user',
   isAuthMiddleware.isAuthBoard,
   commentController.postCommentUpdate
); //댓글 수정

router.delete(
   '/user',
   isAuthMiddleware.isAuthBoard,
   commentController.deleteCommentDestroy
); //댓글 삭제

module.exports = router;
