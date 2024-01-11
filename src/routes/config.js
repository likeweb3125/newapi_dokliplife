const express = require('express');
const router = express.Router();

const configController = require('../controllers/config');
const isAuthMiddleware = require('../middleware/is-auth');

router.get(
   '/site/:site_id',
   isAuthMiddleware.isAuthAdmin,
   configController.getConfigSite
); // 사이트 정보

router.put(
   '/site',
   isAuthMiddleware.isAuthAdmin,
   configController.putConfigSiteUpdate
); // 사이트 정보 수정

router.get(
   '/policy',
   isAuthMiddleware.isAuthAdmin,
   configController.getConfigPolicy
); //운영정책 설정

router.post(
   '/policy',
   isAuthMiddleware.isAuthAdmin,
   configController.postConfigPolicyCreate
); //운영정책 생성

router.get(
   '/policy/:idx',
   //isAuthMiddleware.isAuthAdmin,
   configController.postConfigPolicyView
); //운영정책 내용

router.put(
   '/policy',
   isAuthMiddleware.isAuthAdmin,
   configController.putConfigPolicyUpdate
); //운영정책 수정

router.delete(
   '/policy',
   isAuthMiddleware.isAuthAdmin,
   configController.deleteConfigPolicyDestroy
); //운영정책 삭제

router.post(
   '/policy/use',
   isAuthMiddleware.isAuthAdmin,
   configController.postConfigPolicyUseYn
); //운영정책 사용 여부

router.get(
   '/level',
   isAuthMiddleware.isAuthAdmin,
   configController.getConfigLevel
); //회원 등급 관리

router.put(
   '/level',
   isAuthMiddleware.isAuthAdmin,
   configController.putConfigLevelUpdate
); //회원 등급 수정

module.exports = router;
