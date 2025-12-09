const express = require('express');
const router = express.Router();

const roomStatusController = require('../controllers/roomStatus');

/**
 * @swagger
 * tags:
 *   name: RoomStatus
 *   description: 방 상태 및 히스토리 관리 API
 */

/**
 * @swagger
 * /v1/room/status:
 *   get:
 *     summary: 방 현재 상태 조회
 *     description: 방의 현재 상태 정보를 조회합니다.
 *     tags: [RoomStatus]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: roomEsntlId
 *         required: true
 *         schema:
 *           type: string
 *         description: 방 고유 아이디
 *         example: ROOM0000022725
 *     responses:
 *       200:
 *         description: 방 상태 조회 성공
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
 *                   example: 방 상태 조회 성공
 *                 data:
 *                   type: object
 *                   properties:
 *                     esntlId:
 *                       type: string
 *                       example: RSTA0000000001
 *                     roomEsntlId:
 *                       type: string
 *                       example: ROOM0000022725
 *                     status:
 *                       type: string
 *                       enum: [BEFORE_SALES, ON_SALE, DEPOSIT_PENDING, RESERVED, IN_USE, OVERDUE, CHECKOUT_REQUESTED, CHECKOUT_CONFIRMED, ROOM_MOVE]
 *                       example: IN_USE
 *                     statusName:
 *                       type: string
 *                       example: 이용중
 *                     customerEsntlId:
 *                       type: string
 *                       example: CUST0000000001
 *                     customerName:
 *                       type: string
 *                       example: 홍길동
 *                     contractStartDate:
 *                       type: string
 *                       format: date-time
 *                     contractEndDate:
 *                       type: string
 *                       format: date-time
 *                     memo:
 *                       type: string
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/status', roomStatusController.getRoomStatus);

/**
 * @swagger
 * /v1/room/status:
 *   put:
 *     summary: 방 상태 변경
 *     description: 방의 현재 상태를 변경하고 히스토리에 기록합니다.
 *     tags: [RoomStatus]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - roomEsntlId
 *               - status
 *             properties:
 *               roomEsntlId:
 *                 type: string
 *                 description: 방 고유 아이디
 *                 example: ROOM0000022725
 *               status:
 *                 type: string
 *                 enum: [BEFORE_SALES, ON_SALE, DEPOSIT_PENDING, RESERVED, IN_USE, OVERDUE, CHECKOUT_REQUESTED, CHECKOUT_CONFIRMED, ROOM_MOVE]
 *                 description: 방 상태
 *                 example: IN_USE
 *               customerEsntlId:
 *                 type: string
 *                 description: 입실자 고유 아이디
 *                 example: CUST0000000001
 *               customerName:
 *                 type: string
 *                 description: 입실자 이름
 *                 example: 홍길동
 *               contractStartDate:
 *                 type: string
 *                 format: date-time
 *                 description: 계약 시작일
 *                 example: 2024-01-01T00:00:00Z
 *               contractEndDate:
 *                 type: string
 *                 format: date-time
 *                 description: 계약 종료일
 *                 example: 2024-12-31T23:59:59Z
 *               memo:
 *                 type: string
 *                 description: 메모
 *               historyStartDate:
 *                 type: string
 *                 format: date-time
 *                 description: "히스토리 시작일 (기본값: 현재 시간)"
 *               historyEndDate:
 *                 type: string
 *                 format: date-time
 *                 description: 히스토리 종료일
 *     responses:
 *       200:
 *         description: 방 상태 변경 성공
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put('/status', roomStatusController.updateRoomStatus);

/**
 * @swagger
 * /v1/room/status/history:
 *   get:
 *     summary: 방 상태 히스토리 조회
 *     description: 특정 방의 상태 변경 이력을 조회합니다. 간트 차트 표시용입니다.
 *     tags: [RoomStatus]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: roomEsntlId
 *         required: true
 *         schema:
 *           type: string
 *         description: 방 고유 아이디
 *         example: ROOM0000022725
 *       - in: query
 *         name: startDate
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *         description: 조회 시작일 (YYYY-MM-DD)
 *         example: 2024-01-01
 *       - in: query
 *         name: endDate
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *         description: 조회 종료일 (YYYY-MM-DD)
 *         example: 2024-12-31
 *     responses:
 *       200:
 *         description: 방 상태 히스토리 조회 성공
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
 *                   example: 방 상태 히스토리 조회 성공
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       esntlId:
 *                         type: string
 *                       roomEsntlId:
 *                         type: string
 *                       status:
 *                         type: string
 *                       statusName:
 *                         type: string
 *                       customerEsntlId:
 *                         type: string
 *                       customerName:
 *                         type: string
 *                       startDate:
 *                         type: string
 *                         format: date-time
 *                       endDate:
 *                         type: string
 *                         format: date-time
 *                       memo:
 *                         type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/status/history', roomStatusController.getRoomStatusHistory);

/**
 * @swagger
 * /v1/room/status/history/multiple:
 *   get:
 *     summary: 여러 방의 상태 히스토리 일괄 조회
 *     description: 고시원의 모든 방에 대한 상태 히스토리를 조회합니다. 간트 차트 표시용입니다.
 *     tags: [RoomStatus]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: gosiwonEsntlId
 *         required: true
 *         schema:
 *           type: string
 *         description: 고시원 고유 아이디
 *         example: GOSI0000002130
 *       - in: query
 *         name: startDate
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *         description: 조회 시작일 (YYYY-MM-DD)
 *         example: 2024-01-01
 *       - in: query
 *         name: endDate
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *         description: 조회 종료일 (YYYY-MM-DD)
 *         example: 2024-12-31
 *     responses:
 *       200:
 *         description: 방 상태 히스토리 조회 성공
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
 *                   example: 방 상태 히스토리 조회 성공
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       roomEsntlId:
 *                         type: string
 *                       roomNumber:
 *                         type: string
 *                       history:
 *                         type: array
 *                         items:
 *                           type: object
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/status/history/multiple', roomStatusController.getMultipleRoomStatusHistory);

/**
 * @swagger
 * /v1/room/status/history:
 *   post:
 *     summary: 방 상태 히스토리 등록
 *     description: 방 상태 변경 이력을 직접 등록합니다.
 *     tags: [RoomStatus]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - roomEsntlId
 *               - status
 *               - startDate
 *             properties:
 *               roomEsntlId:
 *                 type: string
 *                 description: 방 고유 아이디
 *                 example: ROOM0000022725
 *               status:
 *                 type: string
 *                 enum: [BEFORE_SALES, ON_SALE, DEPOSIT_PENDING, RESERVED, IN_USE, OVERDUE, CHECKOUT_REQUESTED, CHECKOUT_CONFIRMED, ROOM_MOVE]
 *                 description: 방 상태
 *                 example: IN_USE
 *               customerEsntlId:
 *                 type: string
 *                 description: 입실자 고유 아이디
 *                 example: CUST0000000001
 *               customerName:
 *                 type: string
 *                 description: 입실자 이름
 *                 example: 홍길동
 *               startDate:
 *                 type: string
 *                 format: date-time
 *                 description: 상태 시작일
 *                 example: 2024-01-01T00:00:00Z
 *               endDate:
 *                 type: string
 *                 format: date-time
 *                 description: 상태 종료일
 *                 example: 2024-12-31T23:59:59Z
 *               memo:
 *                 type: string
 *                 description: 메모
 *     responses:
 *       200:
 *         description: 방 상태 히스토리 등록 성공
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/status/history', roomStatusController.createRoomStatusHistory);

/**
 * @swagger
 * /v1/room/status/history:
 *   put:
 *     summary: 방 상태 히스토리 수정
 *     description: 방 상태 변경 이력을 수정합니다.
 *     tags: [RoomStatus]
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
 *                 description: 히스토리 고유 아이디
 *                 example: RSTH0000000001
 *               status:
 *                 type: string
 *                 enum: [BEFORE_SALES, ON_SALE, DEPOSIT_PENDING, RESERVED, IN_USE, OVERDUE, CHECKOUT_REQUESTED, CHECKOUT_CONFIRMED, ROOM_MOVE]
 *                 description: 방 상태
 *               customerEsntlId:
 *                 type: string
 *                 description: 입실자 고유 아이디
 *               customerName:
 *                 type: string
 *                 description: 입실자 이름
 *               startDate:
 *                 type: string
 *                 format: date-time
 *                 description: 상태 시작일
 *               endDate:
 *                 type: string
 *                 format: date-time
 *                 description: 상태 종료일
 *               memo:
 *                 type: string
 *                 description: 메모
 *     responses:
 *       200:
 *         description: 방 상태 히스토리 수정 성공
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put('/status/history', roomStatusController.updateRoomStatusHistory);

/**
 * @swagger
 * /v1/room/status/history:
 *   delete:
 *     summary: 방 상태 히스토리 삭제
 *     description: 방 상태 변경 이력을 삭제합니다.
 *     tags: [RoomStatus]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: esntlId
 *         required: true
 *         schema:
 *           type: string
 *         description: 히스토리 고유 아이디
 *         example: RSTH0000000001
 *     responses:
 *       200:
 *         description: 방 상태 히스토리 삭제 성공
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete('/status/history', roomStatusController.deleteRoomStatusHistory);

module.exports = router;

