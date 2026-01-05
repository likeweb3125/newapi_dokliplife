const express = require('express');
const router = express.Router();

const statController = require('../controllers/statistics');
const isAuthMiddleware = require('../middleware/is-auth');

router.get('/', isAuthMiddleware.isAuthAdmin, statController.getStatCnt); //관리자 메인 전체통계

router.get(
	'/pre',
	isAuthMiddleware.isAuthAdmin,
	statController.getPeriodStatCnt
); //관리자 메인 기간별 현황 통계

router.get(
	'/chart',
	isAuthMiddleware.isAuthAdmin,
	statController.getPeriodStatChart
); //관리자 메인 기간별 현황 chart 통계

router.get(
	'/history',
	isAuthMiddleware.isAuthAdmin,
	statController.getStatHistory
); //관리자 메인 기간별 현황 통계

router.get('/url', isAuthMiddleware.isAuthAdmin, statController.getStatUrl); //관리자 메인 접속 경로

router.get('/agent', isAuthMiddleware.isAuthAdmin, statController.getStatAgent); //관리자 메인 접속 브라우저

/**
 * @swagger
 * tags:
 *   name: 실시간 결제
 *   description: 실시간 결제 통계 API
 */

/**
 * @swagger
 * /v1/stats/realTimeStats:
 *   post:
 *     summary: 실시간 매출 현황 조회
 *     description: 년, 월, 일을 입력받아 해당 기간의 결제 및 환불 통계를 조회합니다. YEAR, MONTH, DAY, TODAY 각각에 대해 Payment와 Refund 건수와 금액을 반환합니다.
 *     tags: [실시간 결제]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - year
 *               - month
 *               - day
 *             properties:
 *               year:
 *                 type: integer
 *                 description: 년도
 *                 example: 2025
 *               month:
 *                 type: integer
 *                 description: 월
 *                 example: 3
 *               day:
 *                 type: integer
 *                 description: 일
 *                 example: 5
 *     responses:
 *       200:
 *         description: 실시간 매출 현황 조회 성공
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
 *                   example: 실시간 매출 현황 조회 성공
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       type:
 *                         type: string
 *                         enum: [YEAR, MONTH, DAY, TODAY]
 *                         description: 기간 타입
 *                         example: YEAR
 *                       paymentType:
 *                         type: string
 *                         enum: [Payment, Refund]
 *                         description: '결제 타입 (Payment: 결제, Refund: 환불)'
 *                         example: Payment
 *                       paymentAmount:
 *                         type: integer
 *                         description: 결제/환불 금액 합계
 *                         example: 4335217721
 *                       paymentTypeCnt:
 *                         type: integer
 *                         description: 결제/환불 건수
 *                         example: 9850
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/realTimeStats', isAuthMiddleware.isAuthAdmin, statController.getRealTimeStats);

module.exports = router;
