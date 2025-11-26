const express = require('express');
const router = express.Router();

const roomController = require('../controllers/room');
const roomCategoryController = require('../controllers/roomCategory');

/**
 * @swagger
 * tags:
 *   name: Room
 *   description: 방 관련 API
 */

/**
 * @swagger
 * /v1/room/list:
 *   post:
 *     summary: 방 목록 조회
 *     description: 고시원 ID로 방 목록을 조회합니다. roomName이 제공되면 추가 필터링되고, sortBy로 정렬 기준을 지정할 수 있습니다. 정렬 기준은 roomName, roomStatus, roomType, winType, rentFee입니다. 기본값은 orderNo 오름차순입니다.
 *     tags: [Room]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - goID
 *             properties:
 *               goID:
 *                 type: string
 *                 description: 고시원 고유 아이디
 *                 example: GOSI0000002130
 *               roomName:
 *                 type: string
 *                 description: 방이름 (선택사항, 부분 일치 검색)
 *                 example: 101
 *               sortBy:
 *                 type: string
 *                 description: 정렬 기준 (선택사항, 기본값은 orderNo 오름차순)
 *                 enum: [roomName, roomStatus, roomType, winType, rentFee]
 *                 example: rentFee
 *     responses:
 *       200:
 *         description: 방 목록 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 statusCode:
 *                   type: integer
 *                   example: 200
 *                 message:
 *                   type: string
 *                   example: 방 목록 조회 성공
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     description: 방 정보 전체
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/list', roomController.getRoomList);

/**
 * @swagger
 * /v1/room/info:
 *   post:
 *     summary: 방 상세 정보 조회
 *     description: 방 아이디(esntlID)로 방 정보 전체를 조회합니다.
 *     tags: [Room]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - esntlID
 *             properties:
 *               esntlID:
 *                 type: string
 *                 description: 방 고유 아이디
 *                 example: ROOM0000022725
 *     responses:
 *       200:
 *         description: 방 정보 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 statusCode:
 *                   type: integer
 *                   example: 200
 *                 message:
 *                   type: string
 *                   example: 방 정보 조회 성공
 *                 data:
 *                   type: object
 *                   description: 방 정보 전체
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/info', roomController.getRoomInfo);

/**
 * @swagger
 * /v1/room/category/list:
 *   post:
 *     summary: 방 카테고리 목록 조회
 *     description: 고시원 ID(goID)로 방 카테고리 목록과 옵션을 조회합니다.
 *     tags: [Room]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - goID
 *             properties:
 *               goID:
 *                 type: string
 *                 description: 고시원 고유 아이디
 *                 example: GOSI0000002130
 *     responses:
 *       200:
 *         description: 카테고리 목록 조회 성공
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/category/list', roomCategoryController.getCategoryList);

/**
 * @swagger
 * /v1/room/category/create:
 *   post:
 *     summary: 방 카테고리 등록
 *     description: 고시원 카테고리를 등록하고 옵션을 함께 저장합니다.
 *     tags: [Room]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - goID
 *               - categoryName
 *               - basePrice
 *             properties:
 *               goID:
 *                 type: string
 *                 example: GOSI0000002130
 *               categoryName:
 *                 type: string
 *                 example: 트리니티룸
 *               basePrice:
 *                 type: integer
 *                 description: 정가 (원 단위)
 *                 example: 85000
 *               memo:
 *                 type: string
 *               options:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     optionName:
 *                       type: string
 *                       example: 정가(2인)
 *                     optionAmount:
 *                       type: number
 *                       format: float
 *                       example: 100
 *                     sortOrder:
 *                       type: integer
 *                       example: 1
 *     responses:
 *       200:
 *         description: 카테고리 등록 성공
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/category/create', roomCategoryController.createCategory);

/**
 * @swagger
 * /v1/room/category/update:
 *   post:
 *     summary: 방 카테고리 수정
 *     description: 카테고리 정보를 수정하고 옵션을 추가/수정합니다. 옵션의 esntlId가 제공되면 수정, 제공되지 않으면 추가됩니다. isDeleted true일 경우 삭제됩니다.
 *     tags: [Room]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - categoryID
 *             properties:
 *               categoryID:
 *                 type: string
 *                 description: 수정할 카테고리 ID
 *                 example: CATE0000000001
 *               categoryName:
 *                 type: string
 *                 description: 카테고리명
 *                 example: 라이크웹룸
 *               basePrice:
 *                 type: integer
 *                 example: 90000
 *               memo:
 *                 type: string
 *               options:
 *                 type: array
 *                 description: 옵션 배열 (isDeleted=true일 경우 삭제)
 *                 items:
 *                   type: object
 *                   properties:
 *                     esntlID:
 *                       type: string
 *                       description: 기존 옵션 ID (신규는 생략)
 *                       example: COPT0000000001
 *                     optionName:
 *                       type: string
 *                       example: 정가(1인)
 *                     optionAmount:
 *                       type: number
 *                       format: float
 *                       example: 50
 *                     sortOrder:
 *                       type: integer
 *                       example: 1
 *                     isDeleted:
 *                       type: boolean
 *                       description: true일 경우 삭제
 *                       example: false
 *     responses:
 *       200:
 *         description: 카테고리 수정 성공
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/category/update', roomCategoryController.updateCategory);

/**
 * @swagger
 * /v1/room/category/delete:
 *   post:
 *     summary: 방 카테고리 삭제
 *     description: 카테고리를 삭제하면 연결된 옵션도 함께 삭제됩니다.
 *     tags: [Room]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - categoryID
 *             properties:
 *               categoryID:
 *                 type: string
 *                 example: RCAT1700000000000
 *     responses:
 *       200:
 *         description: 카테고리 삭제 성공
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/category/delete', roomCategoryController.deleteCategory);

module.exports = router;

