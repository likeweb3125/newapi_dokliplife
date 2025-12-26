const express = require('express');
const router = express.Router();

const refundController = require('../controllers/refund');

/**
 * @swagger
 * tags:
 *   name: 계약현황
 *   description: 계약현황 관리 API
 */

/**
 * @swagger
 * /v1/refund/process:
 *   post:
 *     summary: 환불 및 퇴실처리
 *     description: '계약에 대한 환불 및 퇴실처리를 수행합니다. refund 테이블에 환불 정보를 저장하고, roomStatus를 CHECKOUT_CONFIRMED로 업데이트하며, history에 기록을 남깁니다. 취소사유 (EXPIRED_CHECKOUT: 만기퇴실, MIDDLE_CHECKOUT: 중도퇴실, CONTRACT_CANCEL: 계약취소), liabilityReason: 귀책사유 (OWNER: 사장님, OCCUPANT: 입실자). check_basic_sell이 true인 경우 기본 판매 설정을 사용하고, false인 경우 unableCheckInReason이 있으면 BEFORE_SALES 상태로 설정하며, 없으면 사용자 지정 날짜를 사용합니다.'
 *     tags: [계약현황]
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
 *               check_basic_sell:
 *                 type: boolean
 *                 description: '기본 판매 설정 사용 여부 (true: 기본 설정 사용, false: 사용자 지정 날짜 사용)'
 *                 example: true
 *               unableCheckInReason:
 *                 type: string
 *                 enum: [CHECKOUT, CHECK, CONTRACT, ROOM_MOVE, FREE_EXPERIENCE, OTHER, ETC]
 *                 description: '입실 불가 사유 (check_basic_sell이 false일 때만 사용, 값이 있으면 BEFORE_SALES 상태로 설정. 퇴실:CHECKOUT, 점검:CHECK, 계약중:CONTRACT, 방이동:ROOM_MOVE, 무료체험:FREE_EXPERIENCE, 타업체:OTHER, 기타:ETC)'
 *                 example: null
 *               check_room_only_config:
 *                 type: boolean
 *                 description: '방별 설정 사용 여부 (check_basic_sell이 false이고 unableCheckInReason이 없을 때 true이면 ON_SALE과 CAN_CHECKIN 상태 생성)'
 *                 example: true
 *               sell_able_start_date:
 *                 type: string
 *                 format: date-time
 *                 description: 판매 가능 시작일 (check_basic_sell이 false이고 check_room_only_config가 true일 때 필수)
 *                 example: '2025-11-10T00:00:00'
 *               sell_able_end_date:
 *                 type: string
 *                 format: date-time
 *                 description: 판매 가능 종료일 (check_basic_sell이 false이고 check_room_only_config가 true일 때 필수)
 *                 example: '2025-11-20T00:00:00'
 *               can_checkin_start_date:
 *                 type: string
 *                 format: date-time
 *                 description: 입실 가능 시작일 (check_basic_sell이 false이고 check_room_only_config가 true일 때 필수)
 *                 example: '2025-11-15T00:00:00'
 *               can_checkin_end_date:
 *                 type: string
 *                 format: date-time
 *                 description: 입실 가능 종료일 (check_basic_sell이 false이고 check_room_only_config가 true일 때 필수)
 *                 example: '2025-12-15T00:00:00'
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
 *                       example: CHECKOUT_CONFIRMED
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
