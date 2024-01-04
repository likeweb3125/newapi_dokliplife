const express = require('express');
const router = express.Router();

const menuController = require('../controllers/menu');
const menuSubController = require('../controllers/menuSub');
const menuBoardGroupController = require('../controllers/menuBoardGroup');

const multerMiddleware = require('../middleware/multer');
const isAuthMiddleware = require('../middleware/is-auth');

router.get('/', isAuthMiddleware.isAuthAdmin, menuController.getCategoryList); // 메뉴 리스트

router.post(
   '/',
   isAuthMiddleware.isAuthAdmin,
   multerMiddleware.menuFileMulter,
   menuController.postCategoryCreate
); // 메뉴 생성

router.get(
   '/:id',
   isAuthMiddleware.isAuthAdmin,
   menuController.getCategoryView
); //메뉴 내용

router.put(
   '/',
   isAuthMiddleware.isAuthAdmin,
   multerMiddleware.menuFileMulter,
   menuController.putCategoryUpdate
); //메뉴 수정

router.delete(
   '/',
   isAuthMiddleware.isAuthAdmin,
   menuController.deleteCategoryDestroy
); //메뉴 삭제

router.put(
   '/move',
   isAuthMiddleware.isAuthAdmin,
   menuController.putMoveCategory
); //메뉴 이동

router.put(
   '/moveLast',
   isAuthMiddleware.isAuthAdmin,
   menuController.putMoveLastCategory
); //메뉴 순서 마지막으로 이동

//
// Sub Menu
//
router.post(
   '/sub',
   isAuthMiddleware.isAuthAdmin,
   multerMiddleware.menuFileMulter,
   menuSubController.postSubCategoryCreate
); // 서브메뉴 생성

router.get(
   '/sub/:id',
   isAuthMiddleware.isAuthAdmin,
   menuSubController.getSubCategoryView
); // 서브메뉴 내용

router.put(
   '/sub',
   isAuthMiddleware.isAuthAdmin,
   multerMiddleware.menuFileMulter,
   menuSubController.putSubCategoryUpdate
); // 서브메뉴 수정

router.delete(
   '/sub',
   isAuthMiddleware.isAuthAdmin,
   menuSubController.deleteSubCategoryDestroy
); // 서브메뉴 삭제

//
// Board Group
//
router.get(
   '/boardGroup/:parent_id',
   isAuthMiddleware.isAuthAdmin,
   menuBoardGroupController.getBoardGroupList
); // 서브메뉴 게시판 구분 리스트

router.post(
   '/boardGroup',
   isAuthMiddleware.isAuthAdmin,
   multerMiddleware.groupFileMulter,
   menuBoardGroupController.postBoardGroupCreate
); // 서브메뉴 게시판 구분 생성

router.get(
   '/boardGroup/view/:id',
   isAuthMiddleware.isAuthAdmin,
   menuBoardGroupController.getBoardGroupView
); // 서브메뉴 게시판 구분 내용

router.put(
   '/boardGroup',
   isAuthMiddleware.isAuthAdmin,
   multerMiddleware.groupFileMulter,
   menuBoardGroupController.putBoardGroupUpdate
); // 서브메뉴 게시판 구분 수정

router.delete(
   '/boardGroup',
   isAuthMiddleware.isAuthAdmin,
   menuBoardGroupController.deleteBoardGroupDestroy
); // 서브메뉴 게시판 구분 삭제

router.put(
   '/boardGroupMove',
   isAuthMiddleware.isAuthAdmin,
   menuBoardGroupController.putBoardGroupMove
); // 서브메뉴 게시판 구분 이동

module.exports = router;
