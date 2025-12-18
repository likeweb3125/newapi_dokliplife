const express = require('express');
const router = express.Router();

const refundController = require('../controllers/refund');

/**
 * @swagger
 * tags:
 *   name: Refund
 *   description: 환불 및 퇴실처리 관리 API
 */

/**
 * @swagger
 * /v1/refund/process:
 *   post:
 *     summary: 환불 및 퇴실처리
 *     description: '계약에 대한 환불 및 퇴실처리를 수행합니다. refund 테이블에 환불 정보를 저장하고, roomStatus를 CHECKOUT_REQUESTED로 업데이트하며, history에 기록을 남깁니다. 취소사유 (EXPIRED_CHECKOUT: 만기퇴실, MIDDLE_CHECKOUT: 중도퇴실, CONTRACT_CANCEL: 계약취소)'
 *     tags: [Refund]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - contractEsntlId
 *               - cancelReason
 *               - cancelDate
 *             properties:
 *               contractEsntlId:
 *                 type: string
 *                 description: 계약 고유아이디
 *                 example: RCO0000000001
 *               cancelReason:
 *                 type: string
 *                 enum: [EXPIRED_CHECKOUT, MIDDLE_CHECKOUT, CONTRACT_CANCEL]
 *                 description: '취소사유 (EXPIRED_CHECKOUT: 만기퇴실, MIDDLE_CHECKOUT: 중도퇴실, CONTRACT_CANCEL: 계약취소)'
 *                 example: MIDDLE_CHECKOUT
 *               cancelDate:
 *                 type: string
 *                 format: date
 *                 description: 취소날짜 (YYYY-MM-DD)
 *                 example: '2025-11-06'
 *               cancelMemo:
 *                 type: string
 *                 description: 취소메모
 *                 example: '개인 사정으로 인한 중도퇴실'
 *               liabilityReason:
 *                 type: string
 *                 enum: [OWNER, OCCUPANT]
 *                 description: '귀책사유 (OWNER: 사장님, OCCUPANT: 입실자)'
 *                 example: OCCUPANT
 *               contactedOwner:
 *                 type: boolean
 *                 description: 사장님과 연락이 되었는지 유무
 *                 example: true
 *               refundMethod:
 *                 type: string
 *                 description: '환불수단 (예: 계좌이체, 현금, 카드취소 등)'
 *                 example: '계좌이체'
 *               paymentAmount:
 *                 type: integer
 *                 description: 결제금액
 *                 example: 300000
 *               proratedRent:
 *                 type: integer
 *                 description: 일할입실료
 *                 example: 200000
 *               penalty:
 *                 type: integer
 *                 description: 위약금
 *                 example: 30000
 *               totalRefundAmount:
 *                 type: integer
 *                 description: 총환불금액
 *                 example: 70000
 *               usePeriod:
 *                 type: integer
 *                 description: 사용기간 (일수)
 *                 example: 10
 *     responses:
 *       200:
 *         description: 환불 및 퇴실처리 성공
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
 *                   example: 환불 및 퇴실처리 성공
 *                 data:
 *                   type: object
 *                   properties:
 *                     rrr_sno:
 *                       type: integer
 *                       description: 환불요청 일련번호
 *                       example: 1
 *                     historyId:
 *                       type: string
 *                       description: 히스토리 고유아이디
 *                       example: HISTORY0000000001
 *                     roomStatus:
 *                       type: string
 *                       description: 업데이트된 방 상태
 *                       example: CHECKOUT_REQUESTED
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/process', refundController.processRefundAndCheckout);

module.exports = router;
