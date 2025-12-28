const express = require('express');
const router = express.Router();

const roomMoveController = require('../controllers/roomMove');

/**
 * @swagger
 * tags:
 *   name: 방이동
 *   description: 방이동 관리 API
 */

/**
 * @swagger
 * /v1/roomMove/process:
 *   post:
 *     summary: 방이동 처리
 *     description: '계약된 방을 다른 방으로 이동 처리합니다. roomStatus를 업데이트하고, roomMoveStatus에 기록을 남기며, 원래 방에 대해 roomAfterUse 함수를 호출합니다.'
 *     tags: [방이동]
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
 *               - originalRoomEsntlId
 *               - targetRoomEsntlId
 *               - reason
 *               - moveDate
 *             properties:
 *               contractEsntlId:
 *                 type: string
 *                 description: 계약 고유아이디
 *                 example: RCO0000000001
 *               originalRoomEsntlId:
 *                 type: string
 *                 description: 원래 방 고유아이디
 *                 example: ROOM0000000001
 *               targetRoomEsntlId:
 *                 type: string
 *                 description: 이동할 방 고유아이디
 *                 example: ROOM0000000002
 *               reason:
 *                 type: string
 *                 enum: [OWNER, CUSTOMER]
 *                 description: '방이동 사유 (OWNER: 운영자, CUSTOMER: 고객단순변심)'
 *                 example: OWNER
 *               moveDate:
 *                 type: string
 *                 format: date-time
 *                 description: 방이동일자
 *                 example: '2025-11-06T00:00:00'
 *               adjustmentAmount:
 *                 type: integer
 *                 minimum: 0
 *                 description: '조정금액 (양수만 허용, 0: 조정없음)'
 *                 example: 50000
 *               adjustmentType:
 *                 type: string
 *                 enum: [ADDITION, REFUND]
 *                 description: '조정타입 (ADDITION: 추가, REFUND: 환불). adjustmentAmount가 0보다 크면 필수, 0이면 자동으로 NULL로 설정됩니다.'
 *                 example: ADDITION
 *               contactedOwner:
 *                 type: string
 *                 enum: [Y, N]
 *                 description: '원장님 연락여부 (Y: 연락됨, N: 연락안됨)'
 *                 example: Y
 *               memo:
 *                 type: string
 *                 description: 메모
 *                 example: '방이동 관련 메모'
 *               check_basic_sell:
 *                 type: boolean
 *                 description: '기본 판매 설정 사용 여부 (true: 기본 설정 사용, false: 사용자 지정 날짜 사용)'
 *                 example: true
 *               unableCheckInReason:
 *                 type: string
 *                 enum: [CHECKOUT, CHECK, CONTRACT, ROOM_MOVE, FREE_EXPERIENCE, OTHER, ETC]
 *                 description: '입실 불가 사유 (check_basic_sell이 false일 때만 사용, 값이 있으면 BEFORE_SALES 상태로 설정)'
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
 *         description: 방이동 처리 성공
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
 *                   example: 방이동 처리 성공
 *                 data:
 *                   type: object
 *                   properties:
 *                     roomMoveStatusId:
 *                       type: string
 *                       description: 방이동 상태 고유아이디
 *                       example: RMV0000000001
 *                     originalRoomStatusId:
 *                       type: string
 *                       description: 원래 방 상태 고유아이디
 *                       example: RSTA0000000001
 *                     newRoomStatusId:
 *                       type: string
 *                       description: 새로운 방 상태 고유아이디
 *                       example: RSTA0000000002
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/process', roomMoveController.processRoomMove);

/**
 * @swagger
 * /v1/roomMove/{roomMoveStatusId}:
 *   delete:
 *     summary: 방이동 삭제
 *     description: '방이동 상태를 삭제합니다. 단, adjustmentStatus가 COMPLETED인 경우 삭제할 수 없습니다.'
 *     tags: [방이동]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomMoveStatusId
 *         required: true
 *         schema:
 *           type: string
 *         description: 방이동 상태 고유아이디
 *         example: RMV0000000001
 *     responses:
 *       200:
 *         description: 방이동 삭제 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: 방이동 상태가 삭제되었습니다.
 *       400:
 *         description: 잘못된 요청 (adjustmentStatus가 COMPLETED인 경우 등)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 statusCode:
 *                   type: integer
 *                   example: 400
 *                 message:
 *                   type: string
 *                   example: 조정 처리가 완료된 방이동은 삭제할 수 없습니다.
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete('/:roomMoveStatusId', roomMoveController.deleteRoomMove);

module.exports = router;

