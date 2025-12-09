const express = require('express');
const router = express.Router();

const roomActionHistoryController = require('../controllers/roomActionHistory');

/**
 * @swagger
 * tags:
 *   name: RoomAction
 *   description: 방 액션/이벤트 이력 관리 API
 */

/**
 * @swagger
 * /v1/room/action/history:
 *   get:
 *     summary: 방 액션 이력 조회
 *     description: 특정 방의 결제/예약/상태변경 등 액션 이력을 조회합니다.
 *     tags: [RoomAction]
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
 *         name: actionType
 *         required: false
 *         schema:
 *           type: string
 *           enum:
 *             - PAYMENT
 *             - RESERVATION
 *             - STATUS_CHANGE
 *             - DEPOSIT
 *             - REFUND
 *             - ROOM_MOVE
 *             - CHECKOUT
 *             - OVERDUE
 *             - ETC
 *         description: "액션 타입 필터 (PAYMENT: 결제, RESERVATION: 예약, STATUS_CHANGE: 상태변경, DEPOSIT: 보증금/예약금 처리, REFUND: 환불/반환, ROOM_MOVE: 방이동, CHECKOUT: 퇴실, OVERDUE: 체납, ETC: 기타)"
 *         example: PAYMENT
 *       - in: query
 *         name: startDate
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *         description: 조회 시작일 (YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *         description: 조회 종료일 (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: 방 액션 이력 조회 성공
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/action/history', roomActionHistoryController.getRoomActionHistory);

/**
 * @swagger
 * /v1/room/action/history:
 *   post:
 *     summary: 방 액션 이력 등록
 *     description: 결제/예약/보증금/상태변경 등 액션을 기록합니다.
 *     tags: [RoomAction]
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
 *               - actionType
 *             properties:
 *               roomEsntlId:
 *                 type: string
 *                 example: ROOM0000022725
 *               actionType:
 *                 type: string
 *                 enum:
 *                   - PAYMENT
 *                   - RESERVATION
 *                   - STATUS_CHANGE
 *                   - DEPOSIT
 *                   - REFUND
 *                   - ROOM_MOVE
 *                   - CHECKOUT
 *                   - OVERDUE
 *                   - ETC
 *                 description: "액션 타입 (PAYMENT: 결제, RESERVATION: 예약, STATUS_CHANGE: 상태변경, DEPOSIT: 보증금/예약금 처리, REFUND: 환불/반환, ROOM_MOVE: 방이동, CHECKOUT: 퇴실, OVERDUE: 체납, ETC: 기타)"
 *                 example: PAYMENT
 *               statusFrom:
 *                 type: string
 *                 example: RESERVED
 *               statusTo:
 *                 type: string
 *                 example: IN_USE
 *               actorAdminId:
 *                 type: string
 *                 example: admin001
 *               actorCustomerId:
 *                 type: string
 *                 example: CUST0000000001
 *               amount:
 *                 type: number
 *                 format: float
 *                 example: 500000
 *               currency:
 *                 type: string
 *                 example: KRW
 *               paymentMethod:
 *                 type: string
 *                 example: CARD
 *               reservationId:
 *                 type: string
 *                 example: RSV00000001
 *               memo:
 *                 type: string
 *               metadata:
 *                 type: object
 *                 description: 추가 정보(JSON)
 *     responses:
 *       200:
 *         description: 방 액션 이력 등록 성공
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/action/history', roomActionHistoryController.createRoomActionHistory);

/**
 * @swagger
 * /v1/room/action/history/multiple:
 *   get:
 *     summary: 고시원 전체 방 액션 이력 조회
 *     description: 고시원에 속한 모든 방의 액션 이력을 조회합니다.
 *     tags: [RoomAction]
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
 *         name: actionType
 *         required: false
 *         schema:
 *           type: string
 *           enum:
 *             - PAYMENT
 *             - RESERVATION
 *             - STATUS_CHANGE
 *             - DEPOSIT
 *             - REFUND
 *             - ROOM_MOVE
 *             - CHECKOUT
 *             - OVERDUE
 *             - ETC
 *         description: "액션 타입 필터 (PAYMENT: 결제, RESERVATION: 예약, STATUS_CHANGE: 상태변경, DEPOSIT: 보증금/예약금 처리, REFUND: 환불/반환, ROOM_MOVE: 방이동, CHECKOUT: 퇴실, OVERDUE: 체납, ETC: 기타)"
 *       - in: query
 *         name: startDate
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: 방 액션 이력 조회 성공
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get(
	'/action/history/multiple',
	roomActionHistoryController.getMultipleRoomActionHistory
);

module.exports = router;

