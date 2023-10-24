const express = require('express');
const router = express.Router();

const popupController = require('../controllers/popup');

const isAuthMiddleware = require('../middleware/is-auth');

router.post('/', isAuthMiddleware.isAuthAdmin, popupController.postPopupCreate); //팝업 등록

router.get('/', isAuthMiddleware.isAuthAdmin, popupController.getPopupList); //팝업 리스트

router.get('/:idx', isAuthMiddleware.isAuthAdmin, popupController.getPopupView); //팝업 조회

router.put('/', isAuthMiddleware.isAuthAdmin, popupController.putBannerUpdate); //팝업 수정

router.delete(
   '/',
   isAuthMiddleware.isAuthAdmin,
   popupController.deletePopupDestroy
); //팝업 삭제

router.post(
   '/open',
   isAuthMiddleware.isAuthAdmin,
   popupController.postPopupOpen
); //팝업 노출, 중단

module.exports = router;
