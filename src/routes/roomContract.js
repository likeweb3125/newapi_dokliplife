const express = require('express');
const router = express.Router();

const roomContractController = require('../controllers/roomContract');

/**
 * @swagger
 * tags:
 *   name: RoomContract
 *   description: 방 계약현황 관리 API
 */

/**
 * @swagger
 * /v1/roomContract/list:
 *   get:
 *     summary: 계약현황 목록 조회
 *     description: 계약현황 목록을 조회합니다. roomContract, gosiwon, customer, room, paymentLog 테이블을 조인하여 계약 정보, 고시원 정보, 고객 정보, 방 정보, 결제 정보를 포함합니다.
 *     tags: [RoomContract]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         required: false
 *         schema:
 *           type: integer
 *           default: 1
 *         description: 페이지 번호
 *         example: 1
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           default: 50
 *         description: 페이지당 항목 수
 *         example: 50
 *       - in: query
 *         name: status
 *         required: false
 *         schema:
 *           type: string
 *         description: 계약 상태 필터
 *         example: ACTIVE
 *       - in: query
 *         name: startDate
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *         description: 계약일 시작일 (YYYY-MM-DD)
 *         example: 2024-01-01
 *       - in: query
 *         name: endDate
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *         description: 계약일 종료일 (YYYY-MM-DD)
 *         example: 2024-12-31
 *       - in: query
 *         name: searchString
 *         required: false
 *         schema:
 *           type: string
 *         description: 검색어 (고시원 ID, 고시원명, 고객명, 고객 전화번호)
 *         example: 홍길동
 *       - in: query
 *         name: order
 *         required: false
 *         schema:
 *           type: string
 *           enum: [ASC, DESC]
 *           default: DESC
 *         description: 정렬 순서
 *         example: DESC
 *     responses:
 *       200:
 *         description: 계약현황 목록 조회 성공
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
 *                   example: 계약현황 목록 조회 성공
 *                 data:
 *                   type: object
 *                   properties:
 *                     resultList:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           esntlId:
 *                             type: string
 *                             description: 계약 고유 아이디
 *                           region:
 *                             type: string
 *                             description: 지역 (주소에서 추출)
 *                           contractDate:
 *                             type: string
 *                             description: 계약일
 *                           pTime:
 *                             type: string
 *                             description: 결제 시간
 *                           startDate:
 *                             type: string
 *                             description: 계약 시작일
 *                           endDate:
 *                             type: string
 *                             description: 계약 종료일
 *                           month:
 *                             type: string
 *                             description: 계약 기간 (월)
 *                           gosiwonEsntlId:
 *                             type: string
 *                             description: 고시원 고유 아이디
 *                           gosiwonName:
 *                             type: string
 *                             description: 고시원명
 *                           gosiwonAddress:
 *                             type: string
 *                             description: 고시원 주소
 *                           contract:
 *                             type: string
 *                             description: 계약서 일반
 *                           spacialContract:
 *                             type: string
 *                             description: 계약서 특약
 *                           roomNumber:
 *                             type: string
 *                             description: 방 번호
 *                           roomType:
 *                             type: string
 *                             description: 방 타입
 *                           window:
 *                             type: string
 *                             description: 창 타입
 *                           customerName:
 *                             type: string
 *                             description: 고객명
 *                           customerPhone:
 *                             type: string
 *                             description: 고객 전화번호
 *                           gender:
 *                             type: string
 *                             description: 성별
 *                           age:
 *                             type: integer
 *                             description: 나이
 *                           pyl_goods_amount:
 *                             type: number
 *                             description: 상품 금액
 *                           paymentAmount:
 *                             type: string
 *                             description: 결제 금액 (포맷팅)
 *                           payment_amount:
 *                             type: number
 *                             description: 결제 금액 (숫자)
 *                           paymentPoint:
 *                             type: string
 *                             description: 포인트 결제 금액 (포맷팅)
 *                           paymentCoupon:
 *                             type: string
 *                             description: 쿠폰 결제 금액 (포맷팅)
 *                           cAmount:
 *                             type: string
 *                             description: 수수료 금액 (포맷팅)
 *                           cPercent:
 *                             type: string
 *                             description: 수수료 비율 (포맷팅)
 *                           paymentCount:
 *                             type: integer
 *                             description: 결제 횟수
 *                           totcnt:
 *                             type: integer
 *                             description: 전체 개수
 *                     totcnt:
 *                       type: integer
 *                       description: 전체 개수
 *                     totPaymentAmount:
 *                       type: string
 *                       description: 전체 결제 금액 합계
 *                     totPaymentPoint:
 *                       type: string
 *                       description: 전체 포인트 결제 금액 합계
 *                     totPaymentCoupon:
 *                       type: string
 *                       description: 전체 쿠폰 결제 금액 합계
 *                     totCAmount:
 *                       type: string
 *                       description: 전체 수수료 금액 합계
 *                     totCPercent:
 *                       type: string
 *                       description: 전체 수수료 비율 평균
 *                     page:
 *                       type: integer
 *                       description: 현재 페이지
 *                     limit:
 *                       type: integer
 *                       description: 페이지당 항목 수
 *                     totalPages:
 *                       type: integer
 *                       description: 전체 페이지 수
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/list', roomContractController.getContractList);

/**
 * @swagger
 * /v1/roomContract/detail:
 *   get:
 *     summary: 계약 상세보기 (결제 내역 조회)
 *     description: 계약 고유 아이디로 해당 계약의 결제 내역을 조회합니다. paymentLog와 userCoupon 테이블을 조인하여 결제 정보와 쿠폰 정보를 포함합니다.
 *     tags: [RoomContract]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: contractEsntlId
 *         required: true
 *         schema:
 *           type: string
 *         description: 계약 고유 아이디
 *         example: RCO0000000001
 *     responses:
 *       200:
 *         description: 계약 상세보기 조회 성공
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
 *                   example: 계약 상세보기 조회 성공
 *                 data:
 *                   type: object
 *                   properties:
 *                     resultList:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           pDate:
 *                             type: string
 *                             description: 결제일
 *                           pTime:
 *                             type: string
 *                             description: 결제 시간
 *                           pyl_goods_amount:
 *                             type: number
 *                             description: 상품 금액
 *                           paymentAmount:
 *                             type: string
 *                             description: 결제 금액 (포맷팅)
 *                           paymentPoint:
 *                             type: string
 *                             description: 포인트 결제 금액 (포맷팅)
 *                           paymentCoupon:
 *                             type: string
 *                             description: 쿠폰 결제 금액 (포맷팅)
 *                           couponName:
 *                             type: string
 *                             description: 쿠폰명
 *                           paymentType:
 *                             type: string
 *                             description: 결제 타입
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/detail', roomContractController.getContractDetail);

module.exports = router;
