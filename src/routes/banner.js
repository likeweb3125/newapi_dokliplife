const express = require('express');
const router = express.Router();

const bannerController = require('../controllers/banner');

const multerMiddleware = require('../middleware/multer');
const isAuthMiddleware = require('../middleware/is-auth');

router.post(
   '/',
   isAuthMiddleware.isAuthAdmin,
   multerMiddleware.bannerMulter,
   bannerController.postBannerCreate
); //배너 등록

router.get(
   '/',
   isAuthMiddleware.isAuthAdmin,
   multerMiddleware.bannerMulter,
   bannerController.getBannerList
); //배너 리스트

router.get(
   '/:idx',
   isAuthMiddleware.isAuthAdmin,
   bannerController.getBannerView
); //배너 조회

router.put(
   '/',
   isAuthMiddleware.isAuthAdmin,
   multerMiddleware.bannerMulter,
   bannerController.postBannerUpdate
); //배너 수정

router.delete(
   '/',
   isAuthMiddleware.isAuthAdmin,
   multerMiddleware.bannerMulter,
   bannerController.deleteBannerDestroy
); //배너 삭제

router.post(
   '/open',
   isAuthMiddleware.isAuthAdmin,
   multerMiddleware.bannerMulter,
   bannerController.postBannerOpen
); //배너 노출, 중단

router.put(
   '/move',
   isAuthMiddleware.isAuthAdmin,
   multerMiddleware.bannerMulter,
   bannerController.putBannerMove
); //배너 이동

module.exports = router;
