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
 *         name: roomStatus
 *         required: false
 *         schema:
 *           type: string
 *           enum: [PENDING, RESERVED, IN_USE, OVERDUE, CHECKOUT_CONFIRMED, UNPAID]
 *         description: 방 상태 필터 (입금대기중(PENDING), 예약중(RESERVED), 이용중(IN_USE), 체납상태(OVERDUE), 퇴실확정(CHECKOUT_CONFIRMED), 보증금 미납(UNPAID))
 *         example: IN_USE
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
 *                           status:
 *                             type: string
 *                             description: 계약상태 (room 테이블의 status 값)
 *                             example: IN_USE
 *                           contractType:
 *                             type: string
 *                             enum: [month, part]
 *                             description: 계약유형 (startDate 기준 1달 후 날짜가 endDate와 같으면 month, 그 외는 part)
 *                             example: month
 *                           contractCategory:
 *                             type: string
 *                             enum: [extend, new]
 *                             description: 계약구분 (checkInTime이 RCTT로 시작되면 extend, 그 외는 new)
 *                             example: new
 *                           paymentCategory:
 *                             type: string
 *                             enum: [refund, pay]
 *                             description: 결제구분 (status가 CANCEL이면 refund, 그 외는 pay)
 *                             example: pay
 *                           depositStatus:
 *                             type: string
 *                             nullable: true
 *                             description: 보증금 상태 (deposit 테이블에서 방ID 기준 마지막 상태값)
 *                             example: COMPLETED
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
 *         example: RCTT0000025145
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
 *                         roomEsntlId:
 *                           type: string
 *                           description: 방 고유 아이디
 *                         gosiwonEsntlId:
 *                           type: string
 *                           description: 고시원 고유 아이디
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
 *                         gender:
 *                           type: string
 *                           description: 고객 성별
 *                         age:
 *                           type: integer
 *                           description: 고객 나이
 *                         checkinName:
 *                           type: string
 *                           description: 체크인한 사람 이름
 *                         checkinPhone:
 *                           type: string
 *                           description: 체크인한 사람 연락처
 *                         checkinGender:
 *                           type: string
 *                           description: 체크인한 사람 성별
 *                         checkinAge:
 *                           type: integer
 *                           description: 체크인한 사람 나이
 *                         contractCustomerName:
 *                           type: string
 *                           description: 고객 이름 (roomContract 테이블)
 *                         contractCustomerPhone:
 *                           type: string
 *                           description: 고객 연락처 (roomContract 테이블)
 *                         contractCustomerGender:
 *                           type: string
 *                           description: 고객 성별 (roomContract 테이블)
 *                         contractCustomerAge:
 *                           type: integer
 *                           description: 고객 나이 (roomContract 테이블)
 *                         startDate:
 *                           type: string
 *                           description: 계약 시작일
 *                         endDate:
 *                           type: string
 *                           description: 계약 종료일
 *                         contractStatus:
 *                           type: string
 *                           description: '계약 상태 (예: CONTRACT, RESERVE, VBANK, CANCEL)'
 *                           example: CONTRACT
 *                         paymentStatus:
 *                           type: string
 *                           description: '메인 결제 상태 (paymentLog isExtra=0 기준 최신 건의 calculateStatus, 예: SUCCESS, REQUEST)'
 *                           example: SUCCESS
 *                         isRoomMoveScheduled:
 *                           type: boolean
 *                           description: 방이동 예정 여부 (roomMoveStatus 테이블의 status가 PENDING인 경우 true)
 *                           example: true
 *                         roomMoveDate:
 *                           type: string
 *                           format: date-time
 *                           description: 방이동 예정 날짜 (moveDate, isRoomMoveScheduled가 true일 때만 반환)
 *                           example: '2025-11-15T00:00:00'
 *                     paymentLogList:
 *                       type: array
 *                       description: '연동 결제 내역 (paymentLog, isExtra=0인 일반 연장 결제)'
 *                       items:
 *                         type: object
 *                         properties:
 *                           esntlId:
 *                             type: string
 *                             description: paymentLog 고유 아이디
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
 *                           paymentType:
 *                             type: string
 *                             description: 결제 타입
 *                           code:
 *                             type: string
 *                             description: 성공 여부 코드
 *                           reason:
 *                             type: string
 *                             description: 실패 시 사유
 *                           withdrawalStatus:
 *                             type: string
 *                             description: 결제 취소 여부
 *                           isExtra:
 *                             type: integer
 *                             description: '0 (일반 연장 결제)'
 *                             example: 0
 *                     paymentList:
 *                       type: array
 *                       description: 추가 결제 내역 목록 (extraPayment)
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
 *     description: 계약 정보를 수정합니다. roomContract, customer(입주자), customer(계약자), deposit, room 테이블의 정보를 수정할 수 있습니다.
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
 *                 description: '입실시간 (예: 14:00  24시간 형식)'
 *                 example: '18"00'
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
 *               checkinName:
 *                 type: string
 *                 description: 체크인한 사람 이름
 *                 example: '홍길동'
 *               checkinPhone:
 *                 type: string
 *                 description: 체크인한 사람 연락처
 *                 example: '010-1234-5678'
 *               checkinGender:
 *                 type: string
 *                 description: 체크인한 사람 성별
 *                 example: '남성'
 *               checkinAge:
 *                 type: integer
 *                 description: 체크인한 사람 나이
 *                 example: 25
 *               contractCustomerName:
 *                 type: string
 *                 description: 고객 이름 (roomContract 테이블에 저장)
 *                 example: '홍길동'
 *               contractCustomerPhone:
 *                 type: string
 *                 description: 고객 연락처 (roomContract 테이블에 저장)
 *                 example: '010-1234-5678'
 *               contractCustomerGender:
 *                 type: string
 *                 description: 고객 성별 (roomContract 테이블에 저장)
 *                 example: '남성'
 *               contractCustomerAge:
 *                 type: integer
 *                 description: 고객 나이 (roomContract 테이블에 저장)
 *                 example: 30
 *               agreementType:
 *                 type: string
 *                 enum: [GENERAL, GOSIWON, ROOM]
 *                 description: '특약 타입 (room 테이블에 저장, GENERAL: 독립생활 일반 규정 11항 적용, GOSIWON: 현재 고시원 특약사항 적용, ROOM: 해당 방만 특약사항 수정)'
 *                 example: 'ROOM'
 *               agreementContent:
 *                 type: string
 *                 description: 특약 내용 (room 테이블에 저장)
 *                 example: '추가 특약사항 내용입니다.'
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

/**
 * @swagger
 * /v1/roomContract/depositAndExtra:
 *   get:
 *     summary: 보증금 및 추가 결제 정보 조회
 *     description: 계약서 ID를 입력받아 고시원 ID, 방 ID, 계약서 ID를 기본으로 반환하고, extraPayment 테이블에서 계약서 ID를 기준으로 결제 내역을 모두 조회하며, deposit 테이블에서 해당 계약의 보증금 정보를 조회합니다.
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
 *         example: RCTT0000025145
 *     responses:
 *       200:
 *         description: 보증금 및 추가 결제 정보 조회 성공
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
 *                   example: 보증금 및 추가 결제 정보 조회 성공
 *                 data:
 *                   type: object
 *                   properties:
 *                     contractEsntlId:
 *                       type: string
 *                       description: 계약 고유 아이디
 *                       example: RCTT0000025145
 *                     gosiwonEsntlId:
 *                       type: string
 *                       description: 고시원 고유 아이디
 *                       example: GOSI0000000001
 *                     roomEsntlId:
 *                       type: string
 *                       description: 방 고유 아이디
 *                       example: ROOM0000000001
 *                     extraData:
 *                       type: array
 *                       description: 추가 결제 내역 목록
 *                       items:
 *                         type: object
 *                         properties:
 *                           esntlId:
 *                             type: string
 *                             description: 추가 결제 고유 아이디
 *                           contractEsntlId:
 *                             type: string
 *                             description: 계약 고유 아이디
 *                           gosiwonEsntlId:
 *                             type: string
 *                             description: 고시원 고유 아이디
 *                           roomEsntlId:
 *                             type: string
 *                             description: 방 고유 아이디
 *                           customerEsntlId:
 *                             type: string
 *                             description: 고객 고유 아이디
 *                           uniqueId:
 *                             type: string
 *                             description: 고유 식별자
 *                           extraCostName:
 *                             type: string
 *                             description: 추가비용명칭
 *                           memo:
 *                             type: string
 *                             description: 메모
 *                           optionInfo:
 *                             type: string
 *                             description: 옵션정보
 *                           useStartDate:
 *                             type: string
 *                             description: 이용 시작 일자
 *                           optionName:
 *                             type: string
 *                             description: 옵션명
 *                           extendWithPayment:
 *                             type: integer
 *                             description: 연장시 함께 결제 여부
 *                           pDate:
 *                             type: string
 *                             description: 결제 날짜
 *                           pTime:
 *                             type: string
 *                             description: 결제 시간
 *                           paymentAmount:
 *                             type: string
 *                             description: 결제 금액
 *                           pyl_goods_amount:
 *                             type: integer
 *                             description: 상품금액
 *                           imp_uid:
 *                             type: string
 *                             description: PG 결제 고유아이디
 *                           paymentStatus:
 *                             type: string
 *                             description: 결제 상태
 *                           paymentType:
 *                             type: string
 *                             description: 결제 방식
 *                           withdrawalStatus:
 *                             type: string
 *                             description: 결제 취소 여부
 *                           deleteYN:
 *                             type: string
 *                             description: 삭제여부
 *                           deletedBy:
 *                             type: string
 *                             description: 삭제한 관리자 ID
 *                           deletedAt:
 *                             type: string
 *                             description: 삭제 시간
 *                           createdAt:
 *                             type: string
 *                             description: 생성일
 *                           updatedAt:
 *                             type: string
 *                             description: 수정일
 *                     depositData:
 *                       type: array
 *                       description: 보증금 정보 목록
 *                       items:
 *                         type: object
 *                         properties:
 *                           esntlId:
 *                             type: string
 *                             description: 보증금 고유 아이디
 *                           roomEsntlId:
 *                             type: string
 *                             description: 방 고유 아이디
 *                           gosiwonEsntlId:
 *                             type: string
 *                             description: 고시원 고유 아이디
 *                           customerEsntlId:
 *                             type: string
 *                             description: 예약자/입실자 고유아이디
 *                           contractorEsntlId:
 *                             type: string
 *                             description: 계약자 고유아이디
 *                           contractEsntlId:
 *                             type: string
 *                             description: 방계약 고유아이디
 *                           type:
 *                             type: string
 *                             description: '타입 (RESERVATION: 예약금, DEPOSIT: 보증금)'
 *                           amount:
 *                             type: integer
 *                             description: 금액 (예약금 또는 보증금)
 *                           paidAmount:
 *                             type: integer
 *                             description: 입금액
 *                           unpaidAmount:
 *                             type: integer
 *                             description: 미납금액
 *                           accountBank:
 *                             type: string
 *                             description: 은행명
 *                           accountNumber:
 *                             type: string
 *                             description: 계좌번호
 *                           accountHolder:
 *                             type: string
 *                             description: 예금주명
 *                           status:
 *                             type: string
 *                             description: 입금상태
 *                           manager:
 *                             type: string
 *                             description: 담당자
 *                           depositDate:
 *                             type: string
 *                             description: 입금일
 *                           returnDate:
 *                             type: string
 *                             description: 반환일
 *                           returnAmount:
 *                             type: integer
 *                             description: 반환금액
 *                           returnReason:
 *                             type: string
 *                             description: 반환사유
 *                           memo:
 *                             type: string
 *                             description: 메모
 *                           deleteYN:
 *                             type: string
 *                             description: 삭제여부
 *                           deletedBy:
 *                             type: string
 *                             description: 삭제한 관리자 ID
 *                           deletedAt:
 *                             type: string
 *                             description: 삭제 시간
 *                           createdAt:
 *                             type: string
 *                             description: 생성일
 *                           updatedAt:
 *                             type: string
 *                             description: 수정일
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/depositAndExtra', roomContractController.getDepositAndExtra);

module.exports = router;
