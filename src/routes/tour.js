const express = require('express');
const router = express.Router();

const tourController = require('../controllers/tour');

/**
 * @swagger
 * tags:
 *   name: Tour
 *   description: 방문 예약 API
 */

/**
 * @swagger
 * /v1/tour/accept:
 *   post:
 *     summary: 방문 예약 수락
 *     description: "il_tour_reservation 기준으로 방문 예약을 수락합니다. rtr_status를 CONFIRMED로, rtr_confirm_dtm을 NOW()로, rtr_user_bizcall에 비즈콜 가상번호(또는 원번호)를 저장합니다. 고객(customer.phone)과 관리자(gosiwonAdmin.hp)에게 수락 안내 문자를 발송합니다 (알림톡 대체)."
 *     tags: [Tour]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - rtr_eid
 *             properties:
 *               rtr_eid:
 *                 type: string
 *                 description: "방문예약일련번호 (il_tour_reservation.rtr_eid)"
 *                 example: RTR00000000001
 *     responses:
 *       200:
 *         description: 수락 완료
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
 *                   example: "방문 예약 수락 완료"
 *                 data:
 *                   type: object
 *                   properties:
 *                     rtr_eid:
 *                       type: string
 *                       description: 방문예약일련번호
 *                     status:
 *                       type: string
 *                       example: CONFIRMED
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/accept', tourController.acceptTourReservation);

/**
 * @swagger
 * /v1/tour/cancel:
 *   post:
 *     summary: 방문 예약 취소
 *     description: "il_tour_reservation 기준으로 방문 예약을 취소합니다. rtr_status를 CANCEL_GOSIWON으로, rtr_message에 취소 사유를, rtr_confirm_dtm을 NOW()로 저장합니다. 고객과 관리자에게 취소 안내 문자를 발송합니다 (알림톡 대체)."
 *     tags: [Tour]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - rtr_eid
 *             properties:
 *               rtr_eid:
 *                 type: string
 *                 description: "방문예약일련번호 (il_tour_reservation.rtr_eid)"
 *                 example: RTR00000000001
 *               message:
 *                 type: string
 *                 description: "취소 사유 (rtr_message에 저장)"
 *                 example: "일정 조정으로 인한 취소"
 *     responses:
 *       200:
 *         description: 취소 완료
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
 *                   example: "방문 예약 취소 완료"
 *                 data:
 *                   type: object
 *                   properties:
 *                     rtr_eid:
 *                       type: string
 *                       description: 방문예약일련번호
 *                     status:
 *                       type: string
 *                       example: CANCEL_GOSIWON
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/cancel', tourController.cancelTourReservation);

module.exports = router;
