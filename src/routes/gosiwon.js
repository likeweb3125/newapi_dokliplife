const express = require('express');
const router = express.Router();

const gosiwonController = require('../controllers/gosiwon');
const parkingController = require('../controllers/parking');

/**
 * @swagger
 * /v1/gosiwon/info:
 *   get:
 *     summary: 고시원 상세 정보 조회
 *     description: esntlId로 고시원 정보를 조회합니다.
 *     tags: [Gosiwon]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: esntlId
 *         required: true
 *         schema:
 *           type: string
 *         description: 고시원 고유아이디
 *         example: GOSI0000002130
 *     responses:
 *       200:
 *         description: 고시원 정보 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 statusCode:
 *                   type: integer
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/GosiwonInfo'
 *       400:
 *         description: 잘못된 요청
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardError'
 *       404:
 *         description: 데이터를 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardError'
 *       401:
 *         description: 인증 실패
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardError'
 */
router.get('/info', gosiwonController.getGosiwonInfo);

/**
 * @swagger
 * /v1/gosiwon/names:
 *   get:
 *     summary: 고시원 이름 검색
 *     description: 검색어를 포함한 고시원 이름 목록을 반환합니다.
 *     tags: [Gosiwon]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: searchValue
 *         required: true
 *         schema:
 *           type: string
 *         description: 검색할 이름
 *         example: 성수
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *         description: 최대 반환 개수 (기본 10)
 *         example: 5
 *     responses:
 *       200:
 *         description: 고시원 이름 목록 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 statusCode:
 *                   type: integer
 *                 message:
 *                   type: string
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                       esntlId:
 *                         type: string
 *                       address:
 *                         type: string
 *                         description: 고시원 주소
 *                       isControlled:
 *                         type: string
 *                         description: 관제 여부 (관제 또는 빈 문자열)
 *                         example: 관제
 *                       deposit:
 *                         type: string
 *                         description: 보증급 관리 여부 (하드코딩)
 *                         example: 보증급 관리
 *                       settle:
 *                         type: string
 *                         description: 정산 지급 여부 (하드코딩)
 *                         example: 정산지급
 *       400:
 *         description: 잘못된 요청
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardError'
 *       401:
 *         description: 인증 실패
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardError'
 */
router.get('/names', gosiwonController.getGosiwonNames);

/**
 * @swagger
 * /v1/gosiwon/favorite:
 *   patch:
 *     summary: 고시원 즐겨찾기 토글
 *     description: 고시원의 즐겨찾기 상태를 토글합니다. 체크박스 방식으로 사용됩니다.
 *     tags: [Gosiwon]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - esntlId
 *             properties:
 *               esntlId:
 *                 type: string
 *                 description: 고시원 고유아이디
 *             example:
 *               esntlId: GOSI0000002130
 *     responses:
 *       200:
 *         description: 즐겨찾기 토글 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 statusCode:
 *                   type: integer
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     esntlId:
 *                       type: string
 *                     name:
 *                       type: string
 *                     isFavorite:
 *                       type: boolean
 *                       description: 즐겨찾기 여부 (true=즐겨찾기, false=일반)
 *       400:
 *         description: 잘못된 요청
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardError'
 *       404:
 *         description: 데이터를 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardError'
 *       401:
 *         description: 인증 실패
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardError'
 */
router.patch('/favorite', gosiwonController.toggleFavorite);

/**
 * @swagger
 * /v1/gosiwon/parking/info:
 *   get:
 *     summary: 주차장 정보 조회
 *     description: 고시원 ID로 주차장 정보를 조회합니다.
 *     tags: [Gosiwon]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: esntlId
 *         required: true
 *         schema:
 *           type: string
 *         description: 고시원 고유아이디
 *         example: GOSI0000002130
 *     responses:
 *       200:
 *         description: 주차장 정보 조회 성공
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
 *                   example: 주차장 정보 조회 성공
 *                 data:
 *                   type: object
 *                   properties:
 *                     parkingID:
 *                       type: string
 *                       example: PARK0000000001
 *                     gosiwonEsntlId:
 *                       type: string
 *                       example: GOSI0000002130
 *                     structure:
 *                       type: string
 *                       example: 필로티 구조
 *                     auto:
 *                       type: integer
 *                       example: 10
 *                     autoPrice:
 *                       type: integer
 *                       example: 50000
 *                     bike:
 *                       type: integer
 *                       example: 5
 *                     bikePrice:
 *                       type: integer
 *                       example: 30000
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/parking/info', parkingController.getParkingInfo);

/**
 * @swagger
 * /v1/gosiwon/parking/create:
 *   post:
 *     summary: 주차장 정보 등록
 *     description: 고시원에 주차장 정보를 등록합니다.
 *     tags: [Gosiwon]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - esntlId
 *             properties:
 *               esntlId:
 *                 type: string
 *                 description: 고시원 고유아이디
 *                 example: GOSI0000002130
 *               structure:
 *                 type: string
 *                 description: 주차장 구조
 *                 example: 필로티 구조
 *               auto:
 *                 type: integer
 *                 description: 자동차 주차 가능 대수
 *                 example: 10
 *               autoPrice:
 *                 type: integer
 *                 description: 자동차 한달 주차비 (원)
 *                 example: 50000
 *               bike:
 *                 type: integer
 *                 description: 오토바이 주차 가능 대수
 *                 example: 5
 *               bikePrice:
 *                 type: integer
 *                 description: 오토바이 한달 주차비 (원)
 *                 example: 30000
 *     responses:
 *       200:
 *         description: 주차장 정보 등록 성공
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
 *                   example: 주차장 정보 등록 성공
 *                 data:
 *                   type: object
 *                   properties:
 *                     parkingID:
 *                       type: string
 *                       example: PARK0000000001
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/parking/create', parkingController.createParking);

/**
 * @swagger
 * /v1/gosiwon/parking/update:
 *   patch:
 *     summary: 주차장 정보 수정
 *     description: 주차장 정보를 수정합니다.
 *     tags: [Gosiwon]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - parkingID
 *             properties:
 *               parkingID:
 *                 type: string
 *                 description: 주차장 고유아이디
 *                 example: PARK0000000001
 *               structure:
 *                 type: string
 *                 description: 주차장 구조
 *                 example: 필로티 구조
 *               auto:
 *                 type: integer
 *                 description: 자동차 주차 가능 대수
 *                 example: 10
 *               autoPrice:
 *                 type: integer
 *                 description: 자동차 한달 주차비 (원)
 *                 example: 50000
 *               bike:
 *                 type: integer
 *                 description: 오토바이 주차 가능 대수
 *                 example: 5
 *               bikePrice:
 *                 type: integer
 *                 description: 오토바이 한달 주차비 (원)
 *                 example: 30000
 *     responses:
 *       200:
 *         description: 주차장 정보 수정 성공
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.patch('/parking/update', parkingController.updateParking);

/**
 * @swagger
 * /v1/gosiwon/parking/delete:
 *   delete:
 *     summary: 주차장 정보 삭제
 *     description: 주차장 정보를 삭제합니다.
 *     tags: [Gosiwon]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: parkingID
 *         required: true
 *         schema:
 *           type: string
 *         description: 주차장 고유아이디
 *         example: PARK0000000001
 *     responses:
 *       200:
 *         description: 주차장 정보 삭제 성공
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete('/parking/delete', parkingController.deleteParking);

module.exports = router;

