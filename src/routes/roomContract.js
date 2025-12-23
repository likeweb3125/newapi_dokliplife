const express = require('express');
const router = express.Router();

const roomContractController = require('../controllers/roomContract');

/**
 * @swagger
 * tags:
 *   name: 계약현황
 *   description: 계약현황 관리 API
 */

/**
 * @swagger
 * /v1/roomContract/list:
 *   get:
 *     summary: 계약현황 목록 조회
 *     description: 계약현황 목록을 조회합니다. roomContract, gosiwon, customer, room, paymentLog 테이블을 조인하여 계약 정보, 고시원 정보, 고객 정보, 방 정보, 결제 정보를 포함합니다.
 *     tags: [계약현황]
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
 *     description: 계약 고유 아이디로 해당 계약의 상세 정보와 결제 내역을 조회합니다. roomContract 테이블을 기준으로 계약 정보를 조회하고, 해당 계약의 paymentLog 목록을 함께 반환합니다.
 *     tags: [계약현황]
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
 *                     contractInfo:
 *                       type: object
 *                       description: 계약 정보
 *                       properties:
 *                         contractNumber:
 *                           type: string
 *                           description: 계약 고유 아이디
 *                         gosiwonName:
 *                           type: string
 *                           description: 고시원명
 *                         gosiwonAddress:
 *                           type: string
 *                           description: 고시원 주소
 *                         roomNumber:
 *                           type: string
 *                           description: 방 번호
 *                         roomType:
 *                           type: string
 *                           description: 방 타입
 *                         customerName:
 *                           type: string
 *                           description: 고객명
 *                         customerPhone:
 *                           type: string
 *                           description: 고객 전화번호
 *                         startDate:
 *                           type: string
 *                           description: 계약 시작일
 *                         endDate:
 *                           type: string
 *                           description: 계약 종료일
 *                         contractStatus:
 *                           type: string
 *                           description: 계약 상태
 *                     paymentList:
 *                       type: array
 *                       description: 결제 내역 목록
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
 *                           extraCostName:
 *                             type: string
 *                             description: 추가비용명칭
 *                           isExtra:
 *                             type: integer
 *                             description: '추가 결제 여부 (0: 일반 연장 결제, 1: 옵션에서 발생한 추가 결제)'
 *                           extendWithPayment:
 *                             type: integer
 *                             description: '연장시 함께 결제 여부 (0: 미사용, 1: 사용)'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/detail', roomContractController.getContractDetail);

/**
 * @swagger
 * /v1/roomContract/detail:
 *   put:
 *     summary: 계약 정보 수정
 *     description: 계약 정보를 수정합니다. roomContract, customer(입주자), customer(계약자), deposit 테이블의 정보를 수정할 수 있습니다.
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
 *             properties:
 *               contractEsntlId:
 *                 type: string
 *                 description: 계약 고유 아이디
 *                 example: RCO0000000001
 *               month:
 *                 type: string
 *                 description: 계약 기간 (월)
 *                 example: '1'
 *               startDate:
 *                 type: string
 *                 format: date
 *                 description: 계약 시작일
 *                 example: '2025-10-18'
 *               endDate:
 *                 type: string
 *                 format: date
 *                 description: 계약 종료일
 *                 example: '2025-11-17'
 *               checkinTime:
 *                 type: string
 *                 description: '입실시간 (예: AM|9|00 형식)'
 *                 example: 'AM|9|00'
 *               customerName:
 *                 type: string
 *                 description: 입주자명
 *                 example: 'test'
 *               customerPhone:
 *                 type: string
 *                 description: 입주자 연락처
 *                 example: '01055857382'
 *               customerGender:
 *                 type: string
 *                 description: 입주자 성별
 *                 example: '남성'
 *               customerBirth:
 *                 type: string
 *                 description: 입주자 생년월일
 *                 example: '1992-01-01'
 *               customerBank:
 *                 type: string
 *                 description: 입주자 은행
 *                 example: '신한은행'
 *               customerBankAccount:
 *                 type: string
 *                 description: 입주자 계좌번호
 *                 example: '123-456-789'
 *               contractorName:
 *                 type: string
 *                 description: 계약자명
 *                 example: '계약자명'
 *               contractorPhone:
 *                 type: string
 *                 description: 계약자 연락처
 *                 example: '01012345678'
 *               accountHolder:
 *                 type: string
 *                 description: 예금주
 *                 example: '홍길동'
 *               occupantMemo:
 *                 type: string
 *                 description: 입실자 메모(요청사항)
 *                 example: '안녕하세용!'
 *               occupantMemo2:
 *                 type: string
 *                 description: 입실자 메모2
 *               emergencyContact:
 *                 type: string
 *                 description: 비상연락망/관계
 *                 example: '010-1234-5678 / 부모'
 *     responses:
 *       200:
 *         description: 계약 정보 수정 성공
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
 *                   example: 계약 정보 수정 성공
 *                 data:
 *                   type: object
 *                   properties:
 *                     contractEsntlId:
 *                       type: string
 *                       description: 계약 고유 아이디
 *                     changes:
 *                       type: array
 *                       items:
 *                         type: string
 *                       description: 변경된 항목 목록
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put('/detail', roomContractController.updateContract);

module.exports = router;
