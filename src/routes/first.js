const express = require('express');
const router = express.Router();

const mainController = require('../controllers/first');
const isAuthMiddleware = require('../middleware/is-auth');

router.get(
   '/alarm-cnt/:follow',
   //isAuthMiddleware.isAuthAdmin,
   mainController.getFirstBoardAlarm
); //관리자 메인 게시글 알림

router.get(
   '/alarm-read-delete/:follow',
   //isAuthMiddleware.isAuthAdmin,
   mainController.getFirstBoardAlarmReadDelete
); //관리자 메인 게시글 알림 읽은 알림 삭제

router.get(
   '/board-cnt',
   //isAuthMiddleware.isAuthAdmin,
   mainController.getFirstBoardCnt
); //관리자 메인 게시글 카운트

router.get(
   '/board-list/:limit',
   //isAuthMiddleware.isAuthAdmin,
   mainController.getFirstBoardList
); //관리자 메인 게시글

router.get(
   '/board-name',
   //isAuthMiddleware.isAuthAdmin,
   mainController.getFirstBoardName
); // 관리자 게시판 메뉴

router.get(
   '/connector-cnt',
   //isAuthMiddleware.isAuthAdmin,
   mainController.getFirstConnectorCnt
); // 관리자 메인 접속자 카운트

router.get(
   '/connector-list/:limit',
   //isAuthMiddleware.isAuthAdmin,
   mainController.getFirstConnectorList
); // 관리자 메인 접속자 리스트

module.exports = router;
