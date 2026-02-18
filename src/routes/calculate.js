const express = require('express');
const router = express.Router();

const calculateController = require('../controllers/calculate');

/**
 * @swagger
 * tags:
 *   name: 일일 정산관리
 *   description: 일별 고시원 정산 관리 API
 */

/**
 * @swagger
 * /v1/calculate/daily/list:
 *   post:
 *     summary: 일별 고시원 정산 목록 조회
 *     description: 일별 고시원 정산 목록을 조회합니다. DataTables 형식으로 반환됩니다.
 *     tags: [일일 정산관리]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - gosiwonEsntlId
 *               - baseDate
 *             properties:
 *               gosiwonEsntlId:
 *                 type: string
 *                 description: 고시원 고유 아이디
 *                 example: GOSI0000000199
 *               baseDate:
 *                 type: string
 *                 format: date
 *                 description: '기준 날짜 (YYYY-MM 형식, 예: 2023-08)'
 *                 example: '2023-08'
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
 *         description: 일별 고시원 정산 목록 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 result:
 *                   type: string
 *                   example: SUCCESS
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       dsc_sno:
 *                         type: integer
 *                         description: 일일 매출 마감 일련번호
 *                         example: 1
 *                       dsc_base_date:
 *                         type: string
 *                         format: date
 *                         description: 기준일자 (YYYY-MM-DD)
 *                         example: '2023-08-01'
 *                       gsw_eid:
 *                         type: string
 *                         description: 고시원 고유 아이디
 *                         example: GOSI0000000199
 *                       dsc_selling_cnt:
 *                         type: integer
 *                         description: 판매 건수
 *                         example: 10
 *                       dsc_payment_cnt:
 *                         type: integer
 *                         description: 결제 건수
 *                         example: 8
 *                       dsc_refund_cnt:
 *                         type: integer
 *                         description: 환불 건수
 *                         example: 2
 *                       dsc_goods_total_amt:
 *                         type: integer
 *                         description: 상품금액 합계
 *                         example: 5000000
 *                       dsc_gosiwon_coupon_total_amt:
 *                         type: integer
 *                         description: 자체발행 쿠폰 합계
 *                         example: 100000
 *                       dsc_selling_total_amt:
 *                         type: integer
 *                         description: 판매금액 합계
 *                         example: 4900000
 *                       dsc_average_fee_percent:
 *                         type: number
 *                         format: float
 *                         description: 평균 수수료율
 *                         example: 5.5
 *                       dsc_fee_total_amt:
 *                         type: integer
 *                         description: 수수료 합계
 *                         example: 269500
 *                       dsc_use_coupon_total_amt:
 *                         type: integer
 *                         description: 독립생활 쿠폰 합계
 *                         example: 50000
 *                       dsc_use_point_total_amt:
 *                         type: integer
 *                         description: 독립생활 포인트 합계
 *                         example: 25000
 *                       dsc_payment_total_amt:
 *                         type: integer
 *                         description: 결제금액 합계
 *                         example: 4825000
 *                       dsc_calculation_total_amt:
 *                         type: integer
 *                         description: 정산금액 합계
 *                         example: 4630500
 *                       dsc_coupon_refund_amt:
 *                         type: integer
 *                         description: 쿠폰 환불 금액
 *                         example: 0
 *                       dsc_point_refund_amt:
 *                         type: integer
 *                         description: 포인트 환불 금액
 *                         example: 0
 *                       dsc_fee_refund_amt:
 *                         type: integer
 *                         description: 수수료 환불 금액
 *                         example: 0
 *                       dsc_business_support_amt:
 *                         type: integer
 *                         description: 사업 지원 금액
 *                         example: 0
 *                       dsc_support_total_amt:
 *                         type: integer
 *                         description: 지원 합계 금액
 *                         example: 0
 *                       dsc_expected_payment_total_amt:
 *                         type: integer
 *                         description: 예상 정산금액 합계
 *                         example: 4630500
 *                       dsc_refund_base_date:
 *                         type: string
 *                         format: date
 *                         nullable: true
 *                         description: 환불 기준일자
 *                         example: '2023-08-01'
 *                       dsc_complete_dtm:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                         description: 완료 일시
 *                         example: '2023-08-01 14:30:00'
 *                 recordsTotal:
 *                   type: integer
 *                   description: 전체 레코드 수
 *                   example: 31
 *                 recordsFiltered:
 *                   type: integer
 *                   description: 필터링된 레코드 수
 *                   example: 31
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/daily/list', calculateController.selectListToCalculateDaily);

/**
 * @swagger
 * /v1/calculate/daily/admin/list:
 *   post:
 *     summary: 일별 고시원 정산 목록 조회 - 관리자
 *     description: 관리자용 일별 고시원 정산 목록을 조회합니다. DataTables 형식으로 반환됩니다.
 *     tags: [일일 정산관리]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               baseDate:
 *                 type: string
 *                 format: date
 *                 description: '기준 날짜 (YYYY-MM-DD 형식, 예: 2023-08-01)'
 *                 example: '2023-08-01'
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
 *         description: 일별 고시원 정산 목록 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 result:
 *                   type: string
 *                   example: SUCCESS
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       dsc_sno:
 *                         type: integer
 *                         description: 일일 매출 마감 일련번호
 *                         example: 1
 *                       dsc_base_date:
 *                         type: string
 *                         format: date
 *                         description: 기준일자 (YYYY-MM-DD)
 *                         example: '2023-08-01'
 *                       gsw_name:
 *                         type: string
 *                         description: 고시원명
 *                         example: '성수 고시원'
 *                       gsw_eid:
 *                         type: string
 *                         description: 고시원 고유 아이디
 *                         example: GOSI0000000199
 *                       dsc_selling_cnt:
 *                         type: integer
 *                         description: 판매 건수
 *                         example: 10
 *                       dsc_payment_cnt:
 *                         type: integer
 *                         description: 결제 건수
 *                         example: 8
 *                       dsc_refund_cnt:
 *                         type: integer
 *                         description: 환불 건수
 *                         example: 2
 *                       dsc_goods_total_amt:
 *                         type: integer
 *                         description: 상품금액 합계
 *                         example: 5000000
 *                       dsc_gosiwon_coupon_total_amt:
 *                         type: integer
 *                         description: 자체발행 쿠폰 합계
 *                         example: 100000
 *                       dsc_selling_total_amt:
 *                         type: integer
 *                         description: 판매금액 합계
 *                         example: 4900000
 *                       dsc_average_fee_percent:
 *                         type: number
 *                         format: float
 *                         description: 평균 수수료율
 *                         example: 5.5
 *                       dsc_fee_total_amt:
 *                         type: integer
 *                         description: 수수료 합계
 *                         example: 269500
 *                       dsc_use_coupon_total_amt:
 *                         type: integer
 *                         description: 독립생활 쿠폰 합계
 *                         example: 50000
 *                       dsc_use_point_total_amt:
 *                         type: integer
 *                         description: 독립생활 포인트 합계
 *                         example: 25000
 *                       dsc_payment_total_amt:
 *                         type: integer
 *                         description: 결제금액 합계
 *                         example: 4825000
 *                       dsc_calculation_total_amt:
 *                         type: integer
 *                         description: 정산금액 합계
 *                         example: 4630500
 *                       dsc_coupon_refund_amt:
 *                         type: integer
 *                         description: 쿠폰 환불 금액
 *                         example: 0
 *                       dsc_point_refund_amt:
 *                         type: integer
 *                         description: 포인트 환불 금액
 *                         example: 0
 *                       dsc_fee_refund_amt:
 *                         type: integer
 *                         description: 수수료 환불 금액
 *                         example: 0
 *                       dsc_business_support_amt:
 *                         type: integer
 *                         description: 사업 지원 금액
 *                         example: 0
 *                       dsc_support_total_amt:
 *                         type: integer
 *                         description: 지원 합계 금액
 *                         example: 0
 *                       dsc_expected_payment_total_amt:
 *                         type: integer
 *                         description: 예상 정산금액 합계
 *                         example: 4630500
 *                       dsc_refund_base_date:
 *                         type: string
 *                         format: date
 *                         nullable: true
 *                         description: 환불 기준일자
 *                         example: '2023-08-01'
 *                       dsc_complete_dtm:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                         description: 완료 일시
 *                         example: '2023-08-01 14:30:00'
 *                       gsw_corp_no:
 *                         type: string
 *                         description: 사업자 등록번호
 *                         example: '123-45-67890'
 *                       gsw_bank_name:
 *                         type: string
 *                         description: 은행명
 *                         example: '국민은행'
 *                       gsw_bank_account:
 *                         type: string
 *                         description: 계좌번호
 *                         example: '123-456-789012'
 *                       gsw_account_holder:
 *                         type: string
 *                         description: 예금주명
 *                         example: '홍길동'
 *                       gsw_keeper_email:
 *                         type: string
 *                         description: 총무 이메일
 *                         example: 'keeper@example.com'
 *                       gsw_keeper_name:
 *                         type: string
 *                         description: 총무명
 *                         example: '김총무'
 *                       gsw_keeper_hp:
 *                         type: string
 *                         description: 총무 휴대폰 번호
 *                         example: '010-1234-5678'
 *                       gsw_admin_name:
 *                         type: string
 *                         description: 관리자명
 *                         example: '이관리'
 *                       gsw_admin_hp:
 *                         type: string
 *                         description: 관리자 휴대폰 번호
 *                         example: '010-9876-5432'
 *                       gsw_manager:
 *                         type: string
 *                         description: 담당자
 *                         example: '박담당'
 *                 recordsTotal:
 *                   type: integer
 *                   description: 전체 레코드 수
 *                   example: 50
 *                 recordsFiltered:
 *                   type: integer
 *                   description: 필터링된 레코드 수
 *                   example: 50
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/daily/admin/list', calculateController.selectCalculateAdminByDate);

/**
 * @swagger
 * /v1/calculate/daily/detail:
 *   post:
 *     summary: 일별 고시원 정산 세부 내역 조회
 *     description: 일별 고시원 정산 세부 내역을 조회합니다. 결제/환불 구분별로 조회 가능합니다.
 *     tags: [일일 정산관리]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - gosiwonEsntlId
 *               - baseDate
 *             properties:
 *               gosiwonEsntlId:
 *                 type: string
 *                 description: 고시원 고유 아이디
 *                 example: GOSI0000000199
 *               baseDate:
 *                 type: string
 *                 format: date
 *                 description: '기준 날짜 (YYYY-MM-DD 형식, 예: 2023-08-01)'
 *                 example: '2023-08-01'
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
 *         description: 일별 고시원 정산 세부 내역 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 result:
 *                   type: string
 *                   example: SUCCESS
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       dsc_base_date:
 *                         type: string
 *                         format: date
 *                         description: 기준일자 (YYYY-MM-DD)
 *                         example: '2023-08-01'
 *                       dsc_selling_type_cd:
 *                         type: string
 *                         enum: [PAYMENT, REFUND]
 *                         description: '판매 유형 (PAYMENT: 결제, REFUND: 환불)'
 *                         example: PAYMENT
 *                       dsc_selling_cnt:
 *                         type: integer
 *                         description: 판매 건수
 *                         example: 8
 *                       dsc_goods_total_amt:
 *                         type: integer
 *                         description: 상품금액 합계
 *                         example: 5000000
 *                       dsc_gosiwon_coupon_total_amt:
 *                         type: integer
 *                         description: 자체발행 쿠폰 합계
 *                         example: 100000
 *                       dsc_selling_total_amt:
 *                         type: integer
 *                         description: 판매금액 합계
 *                         example: 4900000
 *                       dsc_average_fee_percent:
 *                         type: number
 *                         format: float
 *                         description: 평균 수수료율
 *                         example: 5.5
 *                       dsc_fee_total_amt:
 *                         type: integer
 *                         description: 수수료 합계
 *                         example: 269500
 *                       dsc_use_coupon_total_amt:
 *                         type: integer
 *                         description: 독립생활 쿠폰 합계
 *                         example: 50000
 *                       dsc_use_point_total_amt:
 *                         type: integer
 *                         description: 독립생활 포인트 합계
 *                         example: 25000
 *                       dsc_payment_total_amt:
 *                         type: integer
 *                         description: 결제금액 합계
 *                         example: 4825000
 *                       dsc_calculation_total_amt:
 *                         type: integer
 *                         description: 정산금액 합계
 *                         example: 4630500
 *                       dsc_coupon_refund_amt:
 *                         type: integer
 *                         description: 쿠폰 환불 금액
 *                         example: 0
 *                       dsc_point_refund_amt:
 *                         type: integer
 *                         description: 포인트 환불 금액
 *                         example: 0
 *                       dsc_fee_refund_amt:
 *                         type: integer
 *                         description: 수수료 환불 금액
 *                         example: 0
 *                       dsc_business_support_amt:
 *                         type: integer
 *                         description: 사업 지원 금액
 *                         example: 0
 *                       dsc_support_total_amt:
 *                         type: integer
 *                         description: 지원 합계 금액
 *                         example: 0
 *                       dsc_expected_payment_total_amt:
 *                         type: integer
 *                         description: 예상 정산금액 합계
 *                         example: 4630500
 *                       dsc_refund_base_date:
 *                         type: string
 *                         format: date
 *                         nullable: true
 *                         description: 환불 기준일자
 *                         example: '2023-08-01'
 *                       dsc_complete_dtm:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                         description: 완료 일시
 *                         example: '2023-08-01 14:30:00'
 *                 recordsTotal:
 *                   type: integer
 *                   description: 전체 레코드 수
 *                   example: 2
 *                 recordsFiltered:
 *                   type: integer
 *                   description: 필터링된 레코드 수
 *                   example: 2
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/daily/detail', calculateController.selectListCalculateCompleteByType);

/**
 * @swagger
 * /v1/calculate/daily/payment/list:
 *   post:
 *     summary: 일별 고시원 정산 결제 내역 조회 - 월별
 *     description: 일별 고시원 정산 결제 내역을 조회합니다. DataTables 형식으로 반환됩니다.
 *     tags: [일일 정산관리]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - gosiwonEsntlId
 *               - baseDate
 *             properties:
 *               gosiwonEsntlId:
 *                 type: string
 *                 description: 고시원 고유 아이디
 *                 example: GOSI0000000199
 *               baseDate:
 *                 type: string
 *                 format: date
 *                 description: '기준 날짜 (YYYY-MM 형식, 예: 2023-08)'
 *                 example: '2023-08'
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
 *         description: 일별 고시원 정산 결제 내역 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 result:
 *                   type: string
 *                   example: SUCCESS
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       esntlId:
 *                         type: string
 *                         description: 결제 로그 고유 아이디
 *                         example: PAYL0000000001
 *                       pDateTime:
 *                         type: string
 *                         format: date-time
 *                         description: 결제 일시
 *                         example: '2023-08-01 14:30:00'
 *                       paymentType:
 *                         type: string
 *                         enum: [APPLE, BANK, CARD, FCARD, KAKAO, NAVER, PAYCO, SAMSUNG, VBANK, REFUND]
 *                         description: 결제 유형
 *                         example: KAKAO
 *                       contractEsntlId:
 *                         type: string
 *                         description: 계약서 고유 아이디
 *                         example: RCTT0000000001
 *                       gosiwonEsntlId:
 *                         type: string
 *                         description: 고시원 고유 아이디
 *                         example: GOSI0000000199
 *                       roomEsntlId:
 *                         type: string
 *                         description: 방 고유 아이디
 *                         example: ROOM0000019357
 *                       roomName:
 *                         type: string
 *                         description: 방 이름
 *                         example: '101호'
 *                       customerEsntlId:
 *                         type: string
 *                         description: 고객 고유 아이디
 *                         example: CUTR0000000001
 *                       customerName:
 *                         type: string
 *                         description: 고객명
 *                         example: '홍길동'
 *                       paymentAmount:
 *                         type: integer
 *                         description: 결제금액
 *                         example: 500000
 *                       paymentPoint:
 *                         type: integer
 *                         description: 결제 포인트
 *                         example: 0
 *                       paymentCoupon:
 *                         type: integer
 *                         description: 결제 쿠폰
 *                         example: 10000
 *                       collectPoint:
 *                         type: integer
 *                         description: 적립 포인트
 *                         example: 500
 *                       code:
 *                         type: string
 *                         description: 결과 코드
 *                         example: SUCCESS
 *                       reason:
 *                         type: string
 *                         nullable: true
 *                         description: 사유
 *                         example: ''
 *                       calAmount:
 *                         type: integer
 *                         description: 정산금액
 *                         example: 475000
 *                       imp_uid:
 *                         type: string
 *                         nullable: true
 *                         description: 아임포트 고유 아이디
 *                         example: 'imp_1234567890'
 *                       cAmount:
 *                         type: integer
 *                         description: 수수료 금액
 *                         example: 25000
 *                       cPercent:
 *                         type: number
 *                         format: float
 *                         description: 수수료율
 *                         example: 5.0
 *                       calculateStatus:
 *                         type: string
 *                         description: 정산 상태
 *                         example: SUCCESS
 *                       tid:
 *                         type: string
 *                         nullable: true
 *                         description: 거래 아이디
 *                         example: 'tid_1234567890'
 *                 recordsTotal:
 *                   type: integer
 *                   description: 전체 레코드 수
 *                   example: 100
 *                 recordsFiltered:
 *                   type: integer
 *                   description: 필터링된 레코드 수
 *                   example: 100
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
// router.post('/daily/payment/list', calculateController.selectListToPaymentLogMonth);

/**
 * @swagger
 * /v1/calculate/daily/payment/detail:
 *   post:
 *     summary: 일별 고시원 정산 결제 내역 조회 - 일별
 *     description: 특정 일자의 고시원 정산 결제 내역을 조회합니다. 결제와 환불을 모두 포함합니다.
 *     tags: [일일 정산관리]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - gosiwonEsntlId
 *               - baseDate
 *             properties:
 *               gosiwonEsntlId:
 *                 type: string
 *                 description: 고시원 고유 아이디
 *                 example: GOSI0000000199
 *               baseDate:
 *                 type: string
 *                 format: date
 *                 description: '기준 날짜 (YYYY-MM-DD 형식, 예: 2023-08-01)'
 *                 example: '2023-08-01'
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
 *         description: 일별 고시원 정산 결제 내역 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 result:
 *                   type: string
 *                   example: SUCCESS
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       esntlId:
 *                         type: string
 *                         description: 결제 로그 고유 아이디
 *                         example: PAYL0000000001
 *                       pDateTime:
 *                         type: string
 *                         format: date-time
 *                         description: 결제 일시
 *                         example: '2023-08-01 14:30:00'
 *                       paymentType:
 *                         type: string
 *                         enum: [APPLE, BANK, CARD, FCARD, KAKAO, NAVER, PAYCO, SAMSUNG, VBANK, REFUND]
 *                         description: 결제 유형
 *                         example: KAKAO
 *                       rom_name:
 *                         type: string
 *                         description: 방 이름
 *                         example: '101호'
 *                       cus_name:
 *                         type: string
 *                         description: 고객명
 *                         example: '홍길동'
 *                       pyl_goods_amount:
 *                         type: integer
 *                         description: 상품금액
 *                         example: 500000
 *                       paymentAmount:
 *                         type: integer
 *                         description: 결제금액
 *                         example: 500000
 *                       paymentPoint:
 *                         type: integer
 *                         description: 결제 포인트
 *                         example: 0
 *                       paymentCoupon:
 *                         type: integer
 *                         description: 결제 쿠폰 (독립생활 쿠폰)
 *                         example: 10000
 *                       collectPoint:
 *                         type: integer
 *                         description: 적립 포인트
 *                         example: 500
 *                       code:
 *                         type: string
 *                         description: 결과 코드
 *                         example: SUCCESS
 *                       calAmount:
 *                         type: integer
 *                         description: 정산금액
 *                         example: 475000
 *                       imp_uid:
 *                         type: string
 *                         nullable: true
 *                         description: 아임포트 고유 아이디
 *                         example: 'imp_1234567890'
 *                       cAmount:
 *                         type: integer
 *                         description: 수수료 금액
 *                         example: 25000
 *                       cPercent:
 *                         type: number
 *                         format: float
 *                         description: 수수료율
 *                         example: 5.0
 *                       calculateStatus:
 *                         type: string
 *                         description: 정산 상태
 *                         example: SUCCESS
 *                       tid:
 *                         type: string
 *                         nullable: true
 *                         description: 거래 아이디
 *                         example: 'tid_1234567890'
 *                       gosiwonCoupon:
 *                         type: integer
 *                         description: 자체발행 쿠폰 (고시원 쿠폰)
 *                         example: 0
 *                 recordsTotal:
 *                   type: integer
 *                   description: 전체 레코드 수
 *                   example: 20
 *                 recordsFiltered:
 *                   type: integer
 *                   description: 필터링된 레코드 수
 *                   example: 20
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @swagger
 * /v1/calculate/daily/closing/run:
 *   post:
 *     summary: 일일 매출 마감 1회 실행
 *     description: "일일 매출 마감 잡을 1회 수동 실행합니다. 전일 PAYMENT/REFUND 건을 il_daily_selling_closing에 INSERT하며, 매일 자정 스케줄러와 동일 로직입니다. 테스트·재실행용."
 *     tags: [일일 정산관리]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: 일일 매출 마감 1회 실행 완료
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 result:
 *                   type: string
 *                   example: SUCCESS
 *                 message:
 *                   type: string
 *                   example: "일일 매출 마감 1회 실행 완료"
 *                 data:
 *                   type: object
 *                   properties:
 *                     sel_target_cnt:
 *                       type: integer
 *                       description: "처리 대상 건수 (PAYMENT + REFUND INSERT 행 수)"
 *                     sel_success_cnt:
 *                       type: integer
 *                       description: "성공 건수"
 *                     sel_skip_cnt:
 *                       type: integer
 *                       description: "스킵 건수"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/daily/closing/run', calculateController.runDailySellingClosing);

router.post('/daily/payment/detail', calculateController.selectListToPaymentLog);

module.exports = router;

