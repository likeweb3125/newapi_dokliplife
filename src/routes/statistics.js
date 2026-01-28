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
 *     summary: 실시간 매출 현황 상단 카운트
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

/**
 * @swagger
 * /v1/stats/realTimeList:
 *   post:
 *     summary: 실시간 매출 현황 상세 목록 조회
 *     description: 날짜를 입력받아 해당 기간의 결제 상세 목록을 조회합니다. DataTables 형식으로 반환됩니다.
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
 *               - date
 *             properties:
 *               date:
 *                 type: string
 *                 description: '날짜 (예: 2025, 2025-07, 2025-07-01)'
 *                 example: '2025-07'
 *               page:
 *                 type: integer
 *                 description: '페이지 번호 (기본값: 1)'
 *                 example: 1
 *               limit:
 *                 type: integer
 *                 description: '페이지당 항목 수 (기본값: 10)'
 *                 example: 10
 *               start:
 *                 type: integer
 *                 description: DataTables start 파라미터
 *                 example: 0
 *               length:
 *                 type: integer
 *                 description: DataTables length 파라미터
 *                 example: 10
 *               draw:
 *                 type: integer
 *                 description: DataTables draw 파라미터
 *                 example: 1
 *     responses:
 *       200:
 *         description: 실시간 매출 현황 상세 목록 조회 성공
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
 *                   example: 실시간 매출 현황 상세 목록 조회 성공
 *                 data:
 *                   type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           esntlId:
 *                             type: string
 *                             example: PAYL0000000001
 *                           uniqueId:
 *                             type: string
 *                             description: '고유값 (등록일 YYYYMMDD + esntlId의 숫자 부분, 앞의 0 제거)'
 *                             example: '2025073143357'
 *                           pDate:
 *                             type: string
 *                             example: '2025-07-31'
 *                           pTime:
 *                             type: string
 *                             example: '14:30:00'
 *                           payMethod:
 *                             type: string
 *                             description: '결제 수단 (KAKAO, CARD 등)'
 *                             example: KAKAO
 *                           payType:
 *                             type: string
 *                             description: '결제 유형 (checkInPay: 입실료, extraPay: 추가결제)'
 *                             example: checkInPay
 *                           contractEsntlId:
 *                             type: string
 *                             example: RCTT0000000001
 *                           gosiwonEsntlId:
 *                             type: string
 *                             example: GOSI0000000001
 *                           gosiwonName:
 *                             type: string
 *                             example: 고시원명
 *                           roomEsntlId:
 *                             type: string
 *                             example: ROOM0000000001
 *                           roomName:
 *                             type: string
 *                             example: '101'
 *                           customerEsntlId:
 *                             type: string
 *                             example: CUTR0000000001
 *                           customerName:
 *                             type: string
 *                             example: 홍길동
 *                           age:
 *                             type: integer
 *                             example: 25
 *                           gender:
 *                             type: string
 *                             example: M
 *                           roomDeposit:
 *                             type: integer
 *                             example: 500000
 *                           gosiwonDeposit:
 *                             type: integer
 *                             example: 50
 *                           paymentAmount:
 *                             type: integer
 *                             example: 500000
 *                           paymentPoint:
 *                             type: integer
 *                             example: 0
 *                           paymentCoupon:
 *                             type: integer
 *                             example: 0
 *                           collectPoint:
 *                             type: integer
 *                             example: 0
 *                           code:
 *                             type: string
 *                             example: SUCCESS
 *                           reason:
 *                             type: string
 *                             example: ''
 *                           calAmount:
 *                             type: integer
 *                             example: 475000
 *                           imp_uid:
 *                             type: string
 *                             example: imp_1234567890
 *                           cAmount:
 *                             type: integer
 *                             example: 25000
 *                           cPercent:
 *                             type: integer
 *                             example: 5
 *                           calculateStatus:
 *                             type: string
 *                             example: SUCCESS
 *                           tid:
 *                             type: string
 *                             example: tid_1234567890
 *                           contractType:
 *                             type: string
 *                             example: 입실료
 *                           deposit:
 *                             type: integer
 *                             description: '계산된 보증금 (roomDeposit이 있으면 roomDeposit, 없으면 gosiwonDeposit * 10000)'
 *                             example: 500000
 *                     recordsTotal:
 *                       type: integer
 *                       description: 전체 레코드 수
 *                       example: 100
 *                     recordsFiltered:
 *                       type: integer
 *                       description: 필터링된 레코드 수
 *                       example: 100
 *                     draw:
 *                       type: integer
 *                       description: DataTables draw 파라미터
 *                       example: 1
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/realTimeList', isAuthMiddleware.isAuthAdmin, statController.getRealTimeList);

/**
 * @swagger
 * /v1/stats/contractStats:
 *   post:
 *     summary: 계약현황 통계 조회
 *     description: 년, 월, 일을 입력받아 해당 기간의 계약 통계를 조회합니다. YEAR, MONTH, DAY 세 타입만 반환하며, 각각 paymentAmount, paymentCnt, refundAmount, refundCnt와 해당 기간의 ago(한 해 전/한 달 전/하루 전) 데이터를 포함합니다.
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
 *         description: 계약현황 통계 조회 성공
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
 *                   example: 계약현황 통계 조회 성공
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       type:
 *                         type: string
 *                         enum: [YEAR, MONTH, DAY]
 *                         description: 기간 타입
 *                         example: YEAR
 *                       paymentAmount:
 *                         type: integer
 *                         description: 결제 금액 합계
 *                         example: 4510372306
 *                       paymentCnt:
 *                         type: integer
 *                         description: 결제 건수
 *                         example: 10225
 *                       refundAmount:
 *                         type: integer
 *                         description: 환불 금액 합계
 *                         example: 120000000
 *                       refundCnt:
 *                         type: integer
 *                         description: 환불 건수
 *                         example: 657
 *                       ago:
 *                         type: object
 *                         description: 비교 데이터 (type에 따라 yearAgo / monthAgo / dayAgo 중 하나만 포함, paymentCnt만)
 *                         properties:
 *                           yearAgo:
 *                             type: integer
 *                             description: 한 해 전 결제 건수 (type이 YEAR일 때만)
 *                             example: 9000
 *                           monthAgo:
 *                             type: integer
 *                             description: 한 달 전 결제 건수 (type이 MONTH일 때만)
 *                             example: 950
 *                           dayAgo:
 *                             type: integer
 *                             description: 하루 전 결제 건수 (type이 DAY일 때만)
 *                             example: 15
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/contractStats', isAuthMiddleware.isAuthAdmin, statController.getContractStats);

module.exports = router;
