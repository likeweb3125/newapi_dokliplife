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
 * /v1/tour/items:
 *   get:
 *     summary: 룸투어 리스트 조회
 *     description: "il_tour_reservation 기준 룸투어 예약 목록을 조회합니다. 페이징(page, limit), 날짜 미지정 시 7일 전~6개월 후, 먼날짜 순(DESC) 정렬."
 *     tags: [Tour]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *           example: "2026-02-20"
 *         description: "방문일 시작 (YYYY-MM-DD). 미입력 시 7일 전부터"
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *           example: "2026-02-26"
 *         description: "방문일 종료 (YYYY-MM-DD). 미입력 시 6개월 후까지"
 *       - in: query
 *         name: gswEid
 *         schema:
 *           type: string
 *           example: "GOSI0000002130"
 *         description: "고시원 ID 필터"
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ACCEPT, CANCEL_GOSIWON, CANCEL_USER, INVALID]
 *         description: "예약 상태 필터"
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: "이름·전화번호·방번호·고시원명 검색 (부분 일치)"
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: "페이지 번호"
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: "페이지당 건수 (최대 100)"
 *     responses:
 *       200:
 *         description: 룸투어 리스트 조회 성공
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
 *                   example: "룸투어 리스트 조회 성공"
 *                 data:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                       description: "전체 건수"
 *                     page:
 *                       type: integer
 *                       description: "현재 페이지"
 *                     limit:
 *                       type: integer
 *                       description: "페이지당 건수"
 *                     tourReservationStats:
 *                       type: object
 *                       description: "룸투어 예약 통계 (startDate~endDate 구간, 리스트와 동일)"
 *                       properties:
 *                         date:
 *                           type: string
 *                           description: "요청 기준일 (YYYY-MM-DD)"
 *                         from:
 *                           type: string
 *                           description: "집계 구간 시작일"
 *                         to:
 *                           type: string
 *                           description: "집계 구간 종료일"
 *                         weekTotal:
 *                           type: integer
 *                           description: "한 주간 총 예약 건수"
 *                         notConfirm:
 *                           type: integer
 *                           description: "미확인 건수 (rtr_confirm_dtm 없음)"
 *                         confirmed:
 *                           type: integer
 *                           description: "확인됨 건수"
 *                         cancelGosiwon:
 *                           type: integer
 *                           description: "고시원 취소 건수"
 *                         cancelUser:
 *                           type: integer
 *                           description: "사용자 취소 건수"
 *                         invalid:
 *                           type: integer
 *                           description: "무효 건수"
 *                     data:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           rtr_eid:
 *                             type: string
 *                             description: "방문예약일련번호"
 *                           rtr_status:
 *                             type: string
 *                           rtr_tour_dtm:
 *                             type: string
 *                             description: "방문일시 (YYYY-MM-DD HH:mm:ss)"
 *                           rtr_message:
 *                             type: string
 *                           rtr_join_date:
 *                             type: string
 *                           rtr_stay_period:
 *                             type: string
 *                           rtr_user_bizcall:
 *                             type: string
 *                           rtr_regist_dtm:
 *                             type: string
 *                           rtr_confirm_dtm:
 *                             type: string
 *                           name:
 *                             type: string
 *                             description: "예약자명"
 *                           birth:
 *                             type: string
 *                           gender:
 *                             type: string
 *                           phone:
 *                             type: string
 *                           gsw_name:
 *                             type: string
 *                             description: "고시원명"
 *                           gsw_eid:
 *                             type: string
 *                           serviceNumber:
 *                             type: string
 *                           roomNumber:
 *                             type: string
 *                           roomStatus:
 *                             type: string
 *                           roomEndDate:
 *                             type: string
 *                           paymentAbleStartDate:
 *                             type: string
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/items', tourController.getTourItems);

/**
 * @swagger
 * /v1/tour/accept:
 *   post:
 *     summary: 방문 예약 수락
 *     description: "il_tour_reservation 기준으로 방문 예약을 수락합니다. rtr_status를 ACCEPT로, rtr_confirm_dtm을 NOW()로, rtr_user_bizcall에 비즈콜 가상번호(또는 원번호)를 저장합니다. 고객(customer.phone)과 관리자(gosiwonAdmin.hp)에게 수락 안내 문자를 발송합니다 (알림톡 대체)."
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
 *                       example: ACCEPT
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
