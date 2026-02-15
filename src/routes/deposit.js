const express = require('express');
const router = express.Router();

const depositController = require('../controllers/deposit');

/**
 * @swagger
 * tags:
 *   name: Deposit
 *   description: 보증금(예약금) 관리 API
 */




/**
 * @swagger
 * /v1/deposit/reservationList:
 *   get:
 *     summary: 예약금 목록 조회
 *     description: 삭제되지 않은 방(room.deleteYN이 'N')을 기준으로 예약금 목록을 조회합니다. 검색, 필터링, 페이징을 지원합니다. roomStatus.status가 ON_SALE이고 subStatus가 END가 아닌 경우의 statusStartDate 기준 내림차순으로 정렬됩니다.
 *     tags: [Deposit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: gosiwonName
 *         required: false
 *         schema:
 *           type: string
 *         description: "고시원명 필터 (값이 있으면 해당 고시원명으로 필터링)"
 *       - in: query
 *         name: gosiwonCode
 *         required: false
 *         schema:
 *           type: string
 *         description: "고시원코드 필터 (값이 있으면 해당 고시원코드로 필터링)"
 *       - in: query
 *         name: searchString
 *         required: false
 *         schema:
 *           type: string
 *         description: "검색어 (roomName, roomEsntlId, checkinName, contractorName을 like 검색)"
 *       - in: query
 *         name: canCheckin
 *         required: false
 *         schema:
 *           type: boolean
 *         description: "입실가능한 방만 보기 (roomStatus.status가 CAN_CHECKIN이고 subStatus가 END가 아닌 경우)"
 *       - in: query
 *         name: reservationStatus
 *         required: false
 *         schema:
 *           type: boolean
 *         description: "예약금요청상태만보기 (deposit.type이 RESERVATION이고 deposit.status가 PENDING인 경우만)"
 *       - in: query
 *         name: page
 *         required: false
 *         schema:
 *           type: integer
 *           default: 1
 *         description: 페이지 번호
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           default: 50
 *         description: 페이지당 항목 수
 *     responses:
 *       200:
 *         description: 예약금 예약 목록 조회 성공
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
 *                   example: 예약금 예약 목록 조회 성공
 *                 data:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                       description: 전체 항목 수
 *                       example: 100
 *                     page:
 *                       type: integer
 *                       description: 현재 페이지 번호
 *                       example: 1
 *                     limit:
 *                       type: integer
 *                       description: 페이지당 항목 수
 *                       example: 50
 *                     data:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           depositEsntlId:
 *                             type: string
 *                             nullable: true
 *                             description: 예약금 고유 아이디 (해당 방의 가장 최근 deposit.esntlId, 없으면 null)
 *                             example: DEPO0000000001
 *                           contractEsntlId:
 *                             type: string
 *                             nullable: true
 *                             description: 현재 활성 계약의 고유 아이디 (roomContract.status = 'CONTRACT' 중 최신 계약)
 *                             example: RCTT0000000001
 *                           roomEsntlId:
 *                             type: string
 *                             description: 방 고유 아이디
 *                             example: ROOM0000019357
 *                           roomNumber:
 *                             type: string
 *                             description: 방 이름(방번호)
 *                             example: 101호
 *                           roomStatus:
 *                             type: string
 *                             nullable: true
 *                             description: 방 상태 (없으면 null)
 *                             example: ON_SALE
 *                           checkinName:
 *                             type: string
 *                             nullable: true
 *                             description: 입실자 정보(입실자 이름)
 *                             example: 홍길동
 *                           checkinPhone:
 *                             type: string
 *                             nullable: true
 *                             description: 입실자 정보(입실자 전화번호)
 *                             example: 010-1234-5678
 *                           contractorName:
 *                             type: string
 *                             nullable: true
 *                             description: 계약자 정보(계약자 이름)
 *                             example: 홍길동
 *                           checkInDate:
 *                             type: string
 *                             format: date
 *                             nullable: true
 *                             description: 입실일
 *                             example: '2024-01-01'
 *                           checkOutDate:
 *                             type: string
 *                             format: date
 *                             nullable: true
 *                             description: 퇴실일
 *                             example: '2024-12-31'
 *                           depositStatus:
 *                             type: string
 *                             nullable: true
 *                             description: 예약금상태 (deposit.type이 RESERVATION인 경우의 deposit.status, 해당방의 마지막 상태값, 없으면 null)
 *                             example: PENDING
 *                           depositHistory:
 *                             type: array
 *                             description: 해당 방의 예약금 내역 히스토리 (최대 30개)
 *                             items:
 *                               type: object
 *                               properties:
 *                                 roomEsntlId:
 *                                   type: string
 *                                   description: 방 고유 아이디
 *                                   example: ROOM0000019357
 *                                 gosiwonEsntlId:
 *                                   type: string
 *                                   description: 고시원 고유 아이디
 *                                   example: GOSI0000000199
 *                                 content:
 *                                   type: object
 *                                   description: 내용 정보
 *                                   properties:
 *                                     status:
 *                                       type: string
 *                                       description: 상태값
 *                                       example: PENDING
 *                                     amount:
 *                                       type: integer
 *                                       description: 금액
 *                                       example: 500000
 *                                     checkInDate:
 *                                       type: string
 *                                       format: date
 *                                       nullable: true
 *                                       description: 입실일
 *                                       example: '2024-01-01'
 *                                     checkinName:
 *                                       type: string
 *                                       nullable: true
 *                                       description: 입실자 이름 (deposit.depositorName)
 *                                       example: 홍길동
 *                                     checkinPhone:
 *                                       type: string
 *                                       nullable: true
 *                                       description: 입실자 전화번호 (deposit.depositorPhone)
 *                                       example: '010-1234-5678'
 *                                 manager:
 *                                   type: string
 *                                   nullable: true
 *                                   description: 담당자(관리자)
 *                                   example: 관리자
 *                                 recordDate:
 *                                   type: string
 *                                   format: date
 *                                   nullable: true
 *                                   description: 기록날짜 (서울 시간, YYYY-MM-DD 형식)
 *                                   example: '2024-01-01'
 *                                 recordTime:
 *                                   type: string
 *                                   nullable: true
 *                                   description: 시간 (서울 시간, HH:MM 형식)
 *                                   example: '14:30'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/reservationList', depositController.getReservationList);


/**
 * @swagger
 * /v1/deposit/reservationRegist:
 *   post:
 *     summary: 예약금 등록
 *     description: 보증금 입금을 등록합니다. 부분입금과 완전입금을 자동으로 구분합니다.
 *     tags: [Deposit]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - depositDate
 *               - amount
 *               - roomEsntlId
 *             properties:
 *               contractEsntlId:
 *                 type: string
 *                 description: 계약서 고유 아이디 (선택, 해당 계약서와 예약금을 연결할 때 사용)
 *                 example: RCTT0000000001
 *               roomEsntlId:
 *                 type: string
 *                 description: 방 고유 아이디 (roomEsntlId로 고시원 정보 자동 조회)
 *                 example: ROOM0000019357
 *               gosiwonEsntlId:
 *                 type: string
 *                 description: 고시원 고유 아이디 (선택, 입력하지 않으면 roomEsntlId로 자동 조회)
 *                 example: GOSI0000000199
 *               depositDate:
 *                 type: string
 *                 format: date-time
 *                 description: 입금일시
 *               depositorName:
 *                 type: string
 *                 description: 입금자명
 *               amount:
 *                 type: integer
 *                 description: 입금금액
 *               manager:
 *                 type: string
 *                 description: 담당자
 *     responses:
 *       200:
 *         description: 입금 등록 성공
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/reservationRegist', depositController.registerDeposit);

/**
 * @swagger
 * /v1/deposit/reservationRegist/list:
 *   get:
 *     summary: 예약금 등록 이력 목록
 *     description: 계약서 ID 또는 방 ID 기준으로 입금(등록) 이력을 조회합니다.
 *     tags: [Deposit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: contractEsntlId
 *         required: false
 *         schema:
 *           type: string
 *         description: 계약서 고유 아이디 (contractEsntlId 또는 roomEsntlId 중 하나 필수)
 *       - in: query
 *         name: roomEsntlId
 *         required: false
 *         schema:
 *           type: string
 *         description: 방 고유 아이디 (contractEsntlId 또는 roomEsntlId 중 하나 필수)
 *       - in: query
 *         name: page
 *         required: false
 *         schema:
 *           type: integer
 *           default: 1
 *         description: 페이지 번호
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           default: 50
 *         description: 페이지당 항목 수
 *     responses:
 *       200:
 *         description: 입금 이력 목록 조회 성공
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get(
	'/reservationRegist/list',
	depositController.getDepositHistoryDepositList
);

/**
 * @swagger
 * /v1/deposit/reservationHistoryList:
 *   get:
 *     summary: 방의 예약금 내역 히스토리 조회
 *     description: 방 ID를 입력받아 해당 방의 예약금 요청 내역을 최대 30개까지 조회합니다.
 *     tags: [Deposit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: roomEsntlId
 *         required: true
 *         schema:
 *           type: string
 *         description: 방 고유 아이디
 *         example: ROOM0000019357
 *     responses:
 *       200:
 *         description: 방의 예약금 내역 조회 성공
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
 *                   example: 방의 예약금 내역 조회 성공
 *                 data:
 *                   type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           roomEsntlId:
 *                             type: string
 *                             description: 방 고유 아이디
 *                             example: ROOM0000019357
 *                           gosiwonEsntlId:
 *                             type: string
 *                             description: 고시원 고유 아이디
 *                             example: GOSI0000000199
 *                           content:
 *                             type: object
 *                             description: 내용 정보
 *                             properties:
 *                               status:
 *                                 type: string
 *                                 description: 상태값
 *                                 example: PENDING
 *                               amount:
 *                                 type: integer
 *                                 description: 금액
 *                                 example: 500000
 *                               checkInDate:
 *                                 type: string
 *                                 format: date
 *                                 description: 입실일
 *                                 example: '2024-01-01'
 *                               checkinName:
 *                                 type: string
 *                                 description: 입실자 이름 (deposit.depositorName)
 *                                 example: 홍길동
 *                               checkinPhone:
 *                                 type: string
 *                                 description: 입실자 전화번호 (deposit.depositorPhone)
 *                                 example: '010-1234-5678'
 *                           manager:
 *                             type: string
 *                             description: 담당자(관리자)
 *                             example: 관리자
 *                           recordDate:
 *                             type: string
 *                             format: date
 *                             description: 기록날짜 (서울 시간, YYYY-MM-DD 형식)
 *                             example: '2024-01-01'
 *                           recordTime:
 *                             type: string
 *                             description: 시간 (서울 시간, HH:MM 형식)
 *                             example: '14:30'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/reservationHistoryList', depositController.getDepositGroupByDepositor);

/**
 * @swagger
 * /v1/deposit/reservationDelete:
 *   delete:
 *     summary: 예약금/보증금 삭제
 *     description: "depositEsntlId(보증금 PK)로 il_room_deposit만 soft delete(rdp_delete_dtm, rdp_deleter_id 업데이트)합니다. il_room_deposit_history는 삭제하지 않습니다."
 *     tags: [Deposit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: depositEsntlId
 *         required: true
 *         schema:
 *           type: string
 *         description: 보증금 고유 아이디 (il_room_deposit.rdp_eid)
 *         example: RDP0000000001
 *       - in: query
 *         name: esntlId
 *         required: false
 *         schema:
 *           type: string
 *         description: "depositEsntlId와 동일 (호환용)"
 *     responses:
 *       200:
 *         description: 보증금 삭제 성공
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
 *                   example: 보증금 삭제 성공
 *                 data:
 *                   type: object
 *                   properties:
 *                     depositEsntlId:
 *                       type: string
 *                       description: 삭제된 보증금 고유 아이디
 *                       example: RDP0000000001
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete('/reservationDelete', depositController.deleteDeposit);


/**
 * @swagger
 * /v1/deposit/depositList:
 *   get:
 *     summary: 보증금 목록 조회
 *     description: "보증금 목록을 조회합니다. 검색, 필터링, 페이징을 지원합니다. 입실자가 있을 때(roomStatus=CONTRACT) 계약자, 환불계좌번호, 입실일, 퇴실일, 계약상태가 추가로 반환됩니다."
 *     tags: [Deposit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: gosiwonName
 *         required: false
 *         schema:
 *           type: string
 *         description: "고시원명 필터 (값이 있으면 해당 고시원명으로 필터링)"
 *       - in: query
 *         name: gosiwonCode
 *         required: false
 *         schema:
 *           type: string
 *         description: "고시원코드 필터 (값이 있으면 해당 고시원코드로 필터링)"
 *       - in: query
 *         name: contractEsntlId
 *         required: false
 *         schema:
 *           type: string
 *         description: "계약서 아이디 필터 (값이 있으면 해당 계약서 아이디로 필터링)"
 *       - in: query
 *         name: searchString
 *         required: false
 *         schema:
 *           type: string
 *         description: "검색어 (roomName, roomEsntlId, checkinName, contractorName을 like 검색)"
 *       - in: query
 *         name: disableDeleted
 *         required: false
 *         schema:
 *           type: boolean
 *         description: "삭제된 항목 숨기기 (deposit.deleteYN이 N인 경우만 보기)"
 *       - in: query
 *         name: disableCompleted
 *         required: false
 *         schema:
 *           type: boolean
 *         description: "입금완료된 항목 숨기기 (deposit.status가 COMPLETED인 경우 안보이게)"
 *       - in: query
 *         name: page
 *         required: false
 *         schema:
 *           type: integer
 *           default: 1
 *         description: 페이지 번호
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           default: 50
 *         description: 페이지당 항목 수
 *     responses:
 *       200:
 *         description: 보증금 목록 조회 성공
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
 *                   example: 보증금 목록 조회 성공
 *                 data:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                       description: 전체 항목 수
 *                       example: 100
 *                     page:
 *                       type: integer
 *                       description: 현재 페이지 번호
 *                       example: 1
 *                     limit:
 *                       type: integer
 *                       description: 페이지당 항목 수
 *                       example: 50
 *                     data:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           gosiwonEsntlId:
 *                             type: string
 *                             nullable: true
 *                             description: 고시원 고유 아이디 (room.gosiwonEsntlId)
 *                             example: GOSI0000000199
 *                           gosiwonName:
 *                             type: string
 *                             nullable: true
 *                             description: 고시원명 (gosiwon.name)
 *                             example: 성수 고시원
 *                           roomEsntlId:
 *                             type: string
 *                             description: 방 고유 아이디
 *                             example: ROOM0000019357
 *                           roomNumber:
 *                             type: string
 *                             description: 방 이름(방번호)
 *                             example: 101호
 *                           currentOccupantName:
 *                             type: string
 *                             nullable: true
 *                             description: 현재 입실자 (room.customerEsntlId 기준 customer.name)
 *                             example: 홍길동
 *                           currentOccupantID:
 *                             type: string
 *                             nullable: true
 *                             description: 현재 입실자 ID (room.customerEsntlId)
 *                             example: CUSTOMER0000000001
 *                           customerBank:
 *                             type: string
 *                             nullable: true
 *                             description: 현재 입실자 은행명 (customer.bank)
 *                             example: 국민은행
 *                           customerBankAccount:
 *                             type: string
 *                             nullable: true
 *                             description: 현재 입실자 계좌번호 (customer.bankAccount)
 *                             example: 123-456-789012
 *                           refundBankAccount:
 *                             type: string
 *                             nullable: true
 *                             description: "환불계좌번호 (il_customer_refund.cre_bank_name + cre_account_number)"
 *                             example: "국민은행 123-456-789012"
 *                           checkinName:
 *                             type: string
 *                             nullable: true
 *                             description: 입실자 정보 (roomContract.checkinName)
 *                             example: 홍길동
 *                           checkinPhone:
 *                             type: string
 *                             nullable: true
 *                             description: 입실자 전화번호 (roomContract.checkinPhone)
 *                             example: 010-1234-5678
 *                           contractorName:
 *                             type: string
 *                             nullable: true
 *                             description: 계약자 정보 (roomContract.customerName)
 *                             example: 홍길동
 *                           contractorPhone:
 *                             type: string
 *                             nullable: true
 *                             description: 계약자 전화번호 (roomContract.customerPhone)
 *                             example: 010-1234-5678
 *                           depositAmount:
 *                             type: integer
 *                             nullable: true
 *                             description: 보증금 (deposit.amount)
 *                             example: 500000
 *                           contractEsntlId:
 *                             type: string
 *                             nullable: true
 *                             description: 계약 고유 아이디 (roomContract.esntlId)
 *                             example: RCTT0000000001
 *                           moveInDate:
 *                             type: string
 *                             format: date
 *                             nullable: true
 *                             description: 입실일 (roomContract.startDate)
 *                             example: '2024-01-01'
 *                           moveOutDate:
 *                             type: string
 *                             format: date
 *                             nullable: true
 *                             description: 퇴실일 (roomContract.endDate)
 *                             example: '2024-12-31'
 *                           contractStatus:
 *                             type: string
 *                             nullable: true
 *                             description: 계약상태 (roomContract.status - roomEsntlId 기준)
 *                             example: CONTRACT
 *                           depositStatus:
 *                             type: string
 *                             nullable: true
 *                             description: "보증금 상태 (il_room_deposit_history 최신 이력 기준). PENDING, COMPLETE, PARTIAL, DELETED"
 *                             example: PENDING
 *                           depositLastestAmount:
 *                             type: integer
 *                             nullable: true
 *                             description: 해당 계약서 기준 제일 최근의 마지막 deposit.paidAmount값
 *                             example: 500000
 *                           depositLastestTime:
 *                             type: string
 *                             nullable: true
 *                             description: 'depositLastestAmount의 입금일자 (deposit.createdAt, 형식: YYYY-MM-DD HH:MM)'
 *                             example: '2026-01-01 04:33'
 *                           refundStatus:
 *                             type: string
 *                             nullable: true
 *                             description: '보증금 환불 상태 (depositRefund.status - 해당 계약서 기준 제일 최근의 마지막 status값)'
 *                             example: 'PARTIAL'
 *                           refundCreatedAt:
 *                             type: string
 *                             nullable: true
 *                             description: '보증금 환불 등록일자 (depositRefund.createdAt, 형식: YYYY-MM-DD HH:MM)'
 *                             example: '2026-01-01 14:00'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/depositList', depositController.getDepositList);

/**
 * @swagger
 * /v1/deposit/contract-coupon-info:
 *   get:
 *     summary: 사용쿠폰, 계좌정보 확인 (보증금 환불 등록시 사전 조회용)
 *     description: 계약서 ID로 해당 계약의 쿠폰 사용 여부, 사용된 쿠폰 정보, 계약 기간, 고객 계좌정보를 조회합니다.
 *     tags: [Deposit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: contractEsntlId
 *         required: true
 *         schema:
 *           type: string
 *         description: 계약서 고유 아이디
 *         example: CONT0000000001
 *     responses:
 *       200:
 *         description: 사용쿠폰, 계좌정보 확인 성공
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
 *                   example: 사용쿠폰, 계좌정보 확인 성공
 *                 data:
 *                   type: object
 *                   properties:
 *                     contractEsntlId:
 *                       type: string
 *                       description: 계약서 고유 아이디
 *                       example: CONT0000000001
 *                     period:
 *                       type: object
 *                       description: 계약 기간
 *                       properties:
 *                         startDate:
 *                           type: string
 *                           description: 계약 시작일
 *                           example: '2024-01-01'
 *                         endDate:
 *                           type: string
 *                           description: 계약 종료일
 *                           example: '2024-12-31'
 *                     hasCoupon:
 *                       type: boolean
 *                       description: 쿠폰 사용 여부
 *                       example: true
 *                     coupon:
 *                       type: object
 *                       nullable: true
 *                       description: 쿠폰 정보 (쿠폰을 사용한 경우에만 반환)
 *                       properties:
 *                         esntId:
 *                           type: string
 *                           description: 쿠폰 고유 아이디
 *                           example: CPON0000000001
 *                         name:
 *                           type: string
 *                           description: 쿠폰명
 *                           example: 신규가입 쿠폰
 *                         description:
 *                           type: string
 *                           description: 쿠폰 설명
 *                           example: 10% 할인 쿠폰
 *                         value:
 *                           type: string
 *                           description: 쿠폰 가격/할인 금액
 *                           example: '10000'
 *                     customerName:
 *                       type: string
 *                       nullable: true
 *                       description: 고객 이름 (roomContract.customerEsntlId 기준 customer.name)
 *                       example: '홍길동'
 *                     bank:
 *                       type: string
 *                       nullable: true
 *                       description: 고객 은행명 (roomContract.customerEsntlId 기준 customer.bank)
 *                       example: '신한은행'
 *                     bankAccount:
 *                       type: string
 *                       nullable: true
 *                       description: 고객 계좌번호 (roomContract.customerEsntlId 기준 customer.bankAccount)
 *                       example: '110-123-456789'
 *                     remainAmount:
 *                       type: integer
 *                       description: '잔액 (depositRefund 테이블에서 해당 contractEsntlId의 최신 값의 status가 PARTIAL이면 remainAmount, 아니면 0)'
 *                       example: 50000
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/contract-coupon-info', depositController.getContractCouponInfo);

/**
 * @swagger
 * /v1/deposit/depositRefundRegist:
 *   post:
 *     summary: 보증금 환불 등록
 *     description: 보증금 환불 정보를 등록합니다. 환불 금액과 전체 예약금을 비교하여 status를 자동으로 설정합니다.
 *     tags: [Deposit]
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
 *               - refundItems
 *               - totalDepositAmount
 *               - refundAmount
 *             properties:
 *               contractEsntlId:
 *                 type: string
 *                 description: 계약서 고유 아이디
 *                 example: RCTT0000000001
 *               bank:
 *                 type: string
 *                 description: 환불 받을 은행명
 *                 example: '신한은행'
 *               bankAccount:
 *                 type: string
 *                 description: 환불 받을 계좌번호
 *                 example: '110-123-456789'
 *               accountHolder:
 *                 type: string
 *                 description: 계좌소유자 이름
 *                 example: '홍길동'
 *               refundItems:
 *                 type: array
 *                 description: 환불 항목 배열 (내용, 금액)
 *                 items:
 *                   type: object
 *                   required:
 *                     - content
 *                     - amount
 *                   properties:
 *                     content:
 *                       type: string
 *                       description: 환불 항목 내용
 *                       example: '위약금 차감'
 *                     amount:
 *                       type: integer
 *                       description: 환불 항목 금액
 *                       example: 50000
 *               totalDepositAmount:
 *                 type: integer
 *                 description: 전체 예약금 금액
 *                 example: 1000000
 *               refundAmount:
 *                 type: integer
 *                 description: 환불 항목 합계 금액 (기존 환불액 합계에 추가됩니다)
 *                 example: 80000
 *     responses:
 *       200:
 *         description: 보증금 환불 등록 성공
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
 *                   example: 보증금 환불 등록 성공
 *                 data:
 *                   type: object
 *                   properties:
 *                     depositRefundEsntlId:
 *                       type: string
 *                       description: 보증금 환불 고유 아이디
 *                       example: DERF0000000001
 *                     contractEsntlId:
 *                       type: string
 *                       description: 계약서 고유 아이디
 *                       example: RCTT0000000001
 *                     status:
 *                       type: string
 *                       description: '환불 상태 (COMPLETED: 전액환불, PARTIAL: 부분환불)'
 *                       example: PARTIAL
 *                     totalDepositAmount:
 *                       type: integer
 *                       description: 전체 예약금 금액
 *                       example: 1000000
 *                     refundAmount:
 *                       type: integer
 *                       description: 환불 항목 합계 금액
 *                       example: 920000
 *                     remainAmount:
 *                       type: integer
 *                       description: '잔여 환불 금액 (totalDepositAmount - 전체 refundAmount 합계, 0이면 COMPLETED)'
 *                       example: 920000
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/depositRefundRegist', depositController.createDepositRefund);

/**
 * @swagger
 * /v1/deposit/depositReturn/list:
 *   get:
 *     summary: 보증금 반환 이력 목록
 *     description: 계약서 ID 또는 방 ID 기준으로 보증금 환불 이력을 조회합니다. (depositRefund 테이블 사용)
 *     tags: [Deposit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: contractEsntlId
 *         required: false
 *         schema:
 *           type: string
 *         description: 계약서 고유 아이디 (contractEsntlId 또는 roomEsntlId 중 하나 필수)
 *       - in: query
 *         name: roomEsntlId
 *         required: false
 *         schema:
 *           type: string
 *         description: 방 고유 아이디 (contractEsntlId 또는 roomEsntlId 중 하나 필수)
 *       - in: query
 *         name: page
 *         required: false
 *         schema:
 *           type: integer
 *           default: 1
 *         description: 페이지 번호
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           default: 50
 *         description: 페이지당 항목 수
 *     responses:
 *       200:
 *         description: 반환 이력 목록 조회 성공
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get(
	'/depositReturn/list',
	depositController.getDepositHistoryReturnList
);

/**
 * @swagger
 * /v1/deposit/depositInfo:
 *   get:
 *     summary: '보증금(예약금)  상세 정보 조회'
 *     description: 보증금 ID로 상세 정보와 입금/반환 이력을 조회합니다.
 *     tags: [Deposit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: esntlId
 *         required: true
 *         schema:
 *           type: string
 *         description: 보증금 고유 아이디
 *     responses:
 *       200:
 *         description: 보증금 정보 조회 성공
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/depositInfo', depositController.getDepositInfo);

/**
 * @swagger
 * /v1/deposit/depositCreate:
 *   post:
 *     summary: 보증금 등록 (type=DEPOSIT 고정)
 *     description: '보증금을 등록합니다. type은 DEPOSIT만 허용되며 다른 값이면 오류를 반환합니다.'
 *     tags: [Deposit]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - roomEsntlId
 *               - gosiwonEsntlId
 *               - amount
 *               - depositDate
 *             properties:
 *               roomEsntlId:
 *                 type: string
 *                 description: 방 고유 아이디
 *                 example: ROOM0000019357
 *               gosiwonEsntlId:
 *                 type: string
 *                 description: 고시원 고유 아이디
 *                 example: GOSI0000000199
 *               customerEsntlId:
 *                 type: string
 *                 description: 예약자/입실자 고유 아이디 (DEPOSIT 타입일 때만 유효)
 *                 example: CUTR0000000001
 *               contractorEsntlId:
 *                 type: string
 *                 description: 계약자 고유 아이디 (DEPOSIT 타입일 때만 유효)
 *                 example: CUTR0000000001
 *               contractEsntlId:
 *                 type: string
 *                 description: 방계약 고유 아이디 (선택)
 *                 example: RCO0000000001
 *               amount:
 *                 type: integer
 *                 description: 입금금액
 *                 example: 500000
 *               depositDate:
 *                 type: string
 *                 format: date-time
 *                 description: 입금일시
 *                 example: '2024-01-01T10:00:00'
 *               depositorName:
 *                 type: string
 *                 description: 입금자명
 *                 example: 홍길동
 *               depositorPhone:
 *                 type: string
 *                 description: 입금자 전화번호
 *                 example: '010-1234-5678'
 *               accountBank:
 *                 type: string
 *                 description: 은행명
 *                 example: '신한은행'
 *               accountNumber:
 *                 type: string
 *                 description: 계좌번호
 *                 example: '110-123-456789'
 *               accountHolder:
 *                 type: string
 *                 description: 예금주명
 *                 example: '홍길동'
 *               virtualAccountNumber:
 *                 type: string
 *                 description: 가상계좌번호
 *                 example: '1234567890'
 *               virtualAccountExpiryDate:
 *                 type: string
 *                 format: date-time
 *                 description: 가상계좌 만료일시
 *                 example: '2024-01-31T23:59:59'
 *     responses:
 *       200:
 *         description: 보증금 등록 성공
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
 *                   example: 보증금 등록 성공
 *                 data:
 *                   type: object
 *                   properties:
 *                     esntlId:
 *                       type: string
 *                       description: 생성/수정된 보증금 고유 아이디
 *                       example: RDP0000000001
 *                     updated:
 *                       type: boolean
 *                       description: 기존 레코드 금액만 업데이트된 경우 true
 *                     receiver:
 *                       type: string
 *                       description: 수신자 휴대폰 번호 (depositorPhone/expectedOccupantPhone). 알림톡 발송 시 YawnMessage.send()의 targetData.receiver로 넘기면 msl_send_tel_no에 정상 저장됨
 *                       example: '01012345678'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/depositCreate', depositController.createDeposit);

router.put('/update', depositController.updateDeposit);

/**
 * @swagger
 * /v1/deposit/depositDelete:
 *   delete:
 *     summary: 보증금 삭제 (type=DEPOSIT만)
 *     description: '보증금 정보를 삭제합니다. type이 DEPOSIT인 경우만 삭제 가능합니다. deleteYN을 Y로 설정하고, status를 DELETED로 변경하며, 삭제 이력을 depositHistory에 기록합니다.'
 *     tags: [Deposit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: esntlId
 *         required: true
 *         schema:
 *           type: string
 *         description: 보증금 고유 아이디
 *         example: DEPO0000000001
 *     responses:
 *       200:
 *         description: 보증금 삭제 성공
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
 *                   example: 보증금 삭제 성공
 *                 data:
 *                   type: object
 *                   properties:
 *                     esntlId:
 *                       type: string
 *                       description: 삭제된 보증금 고유 아이디
 *                       example: DEPO0000000001
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete('/depositDelete', depositController.deleteDepositOnly);


router.get('/history', depositController.getDepositHistory);

/**
 * @swagger
 * /v1/deposit/gosiwonList:
 *   get:
 *     summary: 고시원 목록 조회 (입금대기 건수 포함)
 *     description: 'status가 OPERATE인 고시원 목록을 조회하고, 입금대기(PENDING) 건수를 카운트하여 반환합니다. 카운트가 있으면 상단으로 정렬됩니다.'
 *     tags: [Deposit]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 고시원 목록 조회 성공
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
 *                   example: 고시원 목록 조회 성공
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       esntlId:
 *                         type: string
 *                         description: 고시원 고유 아이디
 *                         example: GOSI0000000199
 *                       name:
 *                         type: string
 *                         description: 고시원 이름
 *                         example: 성수 고시원
 *                       pendingCount:
 *                         type: integer
 *                         description: 입금대기 건수
 *                         example: 8
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/gosiwonList', depositController.getGosiwonList);

/**
 * @swagger
 * /v1/deposit/getRoomDepositList:
 *   get:
 *     summary: 방 기준 보증금·예약금 이력 조회
 *     description: 'il_room_deposit_history 테이블에서 roomEsntlId(방 고유 아이디) 기준으로 이력을 조회합니다.'
 *     tags: [Deposit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: roomEsntlId
 *         required: true
 *         schema:
 *           type: string
 *         description: 방 고유 아이디
 *         example: ROOM0000019357
 *       - in: query
 *         name: type
 *         required: false
 *         schema:
 *           type: string
 *           enum: [DEPOSIT, RETURN]
 *         description: '조회 타입 (DEPOSIT: 보증금 입금, RETURN: 환불)'
 *         example: DEPOSIT
 *     responses:
 *       200:
 *         description: 방 보증금/예약금 이력 조회 성공
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
 *                   example: 방 보증금/예약금 이력 조회 성공
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       esntlId:
 *                         type: string
 *                         description: 이력 고유아이디
 *                       depositEsntlId:
 *                         type: string
 *                         description: 보증금 고유아이디
 *                       contractEsntlId:
 *                         type: string
 *                         description: 계약서 고유아이디
 *                       type:
 *                         type: string
 *                         description: DEPOSIT(입금), RETURN(반환)
 *                       status:
 *                         type: string
 *                         description: 상태 (PENDING, COMPLETED 등)
 *                       date:
 *                         type: string
 *                         format: date-time
 *                         description: 입금일시(depositDate) 또는 생성일
 *                       amount:
 *                         type: integer
 *                         description: 금액
 *                       paidAmount:
 *                         type: integer
 *                         description: 입금 완료액
 *                       unpaidAmount:
 *                         type: integer
 *                         description: 미납액
 *                       manager:
 *                         type: string
 *                         description: 담당자
 *                       depositorName:
 *                         type: string
 *                         description: 입금자명
 *                         nullable: true
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/getRoomDepositList', depositController.getRoomDepositList);

module.exports = router;

