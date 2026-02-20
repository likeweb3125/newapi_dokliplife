const express = require('express');
const router = express.Router();

const dashboardController = require('../controllers/dashboard');
const isAuthMiddleware = require('../middleware/is-auth');

/**
 * @swagger
 * tags:
 *   name: dashboard
 *   description: "대시보드 통계 (회원 방문자 수, 계약 건수, 매출 일별 집계)"
 */

/**
 * @swagger
 * /v1/dashboard/stats:
 *   get:
 *     summary: 대시보드 통계 (일별)
 *     description: "오늘을 기준으로 최근 30일간 일별로 회원 방문자 수(yn_access_log), 계약 건수(roomContract), 매출(il_daily_selling_closing)을 조회합니다. 회원 방문자 수는 asl_user_id 기준 DISTINCT, 계약 건수는 취소 제외, 매출은 결제(PAYMENT)/환불(REFUND) 구분하여 집계합니다."
 *     tags: [dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 대시보드 통계 조회 성공
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
 *                   example: 대시보드 통계 조회 성공
 *                 data:
 *                   type: object
 *                   properties:
 *                     from:
 *                       type: string
 *                       description: "집계 시작일 (YYYY-MM-DD)"
 *                     to:
 *                       type: string
 *                       description: "집계 종료일 (YYYY-MM-DD, 오늘)"
 *                     daily:
 *                       type: array
 *                       description: "일별 통계 배열 (30일)"
 *                       items:
 *                         type: object
 *                         properties:
 *                           date:
 *                             type: string
 *                             description: "날짜 (YYYY-MM-DD)"
 *                           visitorCount:
 *                             type: integer
 *                             description: "해당일 회원 방문자 수 (yn_access_log 기준 DISTINCT asl_user_id)"
 *                           contractCount:
 *                             type: integer
 *                             description: "해당일 계약 건수 (roomContract, 취소 제외)"
 *                           sellingCnt:
 *                             type: integer
 *                             description: "해당일 결제 건수 (il_daily_selling_closing PAYMENT)"
 *                           sellingTotalAmt:
 *                             type: integer
 *                             description: "해당일 결제 총액"
 *                           refundCnt:
 *                             type: integer
 *                             description: "해당일 환불 건수"
 *                           refundTotalAmt:
 *                             type: integer
 *                             description: "해당일 환불 총액"
 *                     summary:
 *                       type: object
 *                       description: "30일 합계"
 *                       properties:
 *                         totalVisitorCount:
 *                           type: integer
 *                         totalContractCount:
 *                           type: integer
 *                         totalSellingCnt:
 *                           type: integer
 *                         totalSellingAmt:
 *                           type: integer
 *                         totalRefundCnt:
 *                           type: integer
 *                         totalRefundAmt:
 *                           type: integer
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/stats', isAuthMiddleware.isAuthAdmin, dashboardController.getStats);

/**
 * @swagger
 * /v1/dashboard/dailySchedule:
 *   get:
 *     summary: 일일 스케줄 조회
 *     description: "roomStatus·roomContract·환불요청·청소일·룸투어 등에서 오늘 기준으로 시작(또는 해당)되는 일정 목록을 반환합니다. 응답 항목은 상태값, 고시원이름, 방호수, 상태값에 따른 내용입니다."
 *     tags: [dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 일일 스케줄 조회 성공
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
 *                   example: 일일 스케줄 조회 성공
 *                 data:
 *                   type: object
 *                   properties:
 *                     date:
 *                       type: string
 *                       description: "기준일 (YYYY-MM-DD, 오늘)"
 *                       example: "2026-02-20"
 *                     list:
 *                       type: array
 *                       description: "일일 스케줄 목록 (상태값·고시원이름·방호수·내용)"
 *                       items:
 *                         type: object
 *                         properties:
 *                           statusValue:
 *                             type: string
 *                             description: "상태값 (예: 판매오픈, 판매종료, 계약일, 환불요청, 퇴실요청, 체납상태, 입실일, 퇴실일, 청소일, 룸투어 예약요청, 룸투어 예약방문)"
 *                           gosiwonName:
 *                             type: string
 *                             description: "고시원 이름"
 *                           roomNumber:
 *                             type: string
 *                             description: "방 호수 (해당 없으면 빈 문자열)"
 *                           content:
 *                             type: string
 *                             description: "상태값에 따른 상세 내용 문구"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/dailySchedule', isAuthMiddleware.isAuthAdmin, dashboardController.getDailySchedule);

module.exports = router;
