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
 * /v1/deposit/list:
 *   get:
 *     summary: '보증금(예약금) 현황 목록 조회'
 *     description: 고시원별 보증금 현황 목록을 조회합니다. 검색, 필터링, 페이징을 지원합니다.
 *     tags: [Deposit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         required: false
 *         schema:
 *           type: string
 *           enum: [RESERVATION, DEPOSIT]
 *         description: '타입 (RESERVATION: 예약금, DEPOSIT: 보증금) - 첫 번째 검색 필드'
 *         example: RESERVATION
 *       - in: query
 *         name: searchType
 *         required: false
 *         schema:
 *           type: string
 *           enum:
 *             - gosiwonName
 *             - gosiwonCode
 *             - roomName
 *             - roomEsntlId
 *             - reservationName
 *             - contractName
 *         description: "검색 대상 종류 (고시원명/코드, 방이름/방ID, 예약자명, 계약자명)"
 *       - in: query
 *         name: search
 *         required: false
 *         schema:
 *           type: string
 *         description: "검색어 (searchType별 필드: gosiwonName→gosiwon.name, gosiwonCode→gosiwon.esntlId, roomName→room.roomNumber, roomEsntlId→room.esntlId, reservationName→roomStatus.reservationName, contractName→roomStatus.contractorName)"
 *       - in: query
 *         name: amount
 *         required: false
 *         schema:
 *           type: integer
 *           example: 20000
 *         description: "금액 필터 (예약금/보증금 중 하나 일치)"
 *       - in: query
 *         name: status
 *         required: false
 *         schema:
 *           type: string
 *           enum: [DEPOSIT_PENDING, PARTIAL_DEPOSIT, DEPOSIT_COMPLETED, RETURN_COMPLETED, DELETED]
 *         description: 입금상태
 *       - in: query
 *         name: contractStatus
 *         required: false
 *         schema:
 *           type: string
 *         description: 계약상태
 *       - in: query
 *         name: hideDeleted
 *         required: false
 *         schema:
 *           type: boolean
 *         description: 삭제된 항목 숨기기
 *       - in: query
 *         name: hideCompleted
 *         required: false
 *         schema:
 *           type: boolean
 *         description: 입금완료된 항목 숨기기
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
 *         description: 보증금 현황 목록 조회 성공
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/list', depositController.getDepositList);

/**
 * @swagger
 * /v1/deposit/info:
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
router.get('/info', depositController.getDepositInfo);

/**
 * @swagger
 * /v1/deposit/create:
 *   post:
 *     summary: 보증금 등록
 *     description: 새로운 보증금(예약금) 정보를 등록합니다.
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
 *               - type
 *               - amount
 *             properties:
 *               roomEsntlId:
 *                 type: string
 *                 description: 방 고유 아이디
 *               gosiwonEsntlId:
 *                 type: string
 *                 description: 고시원 고유 아이디
 *                 example: GOSI0000002130
 *               customerEsntlId:
 *                 type: string
 *                 description: 예약자/입실자 고유 아이디
 *               contractorEsntlId:
 *                 type: string
 *                 description: 계약자 고유 아이디
 *               contractEsntlId:
 *                 type: string
 *                 description: 방계약 고유 아이디
 *               type:
 *                 type: string
 *                 enum: [RESERVATION, DEPOSIT]
 *                 description: '타입 (RESERVATION: 예약금, DEPOSIT: 보증금)'
 *                 example: DEPOSIT
 *               amount:
 *                 type: integer
 *                 description: 금액 (예약금 또는 보증금)
 *                 example: 500000
 *               reservationDepositAmount:
 *                 type: integer
 *                 description: 예약금 금액 (하위 호환성, 사용 중단 예정)
 *               depositAmount:
 *                 type: integer
 *                 description: 보증금 금액 (하위 호환성, 사용 중단 예정)
 *               accountBank:
 *                 type: string
 *                 description: 은행명
 *               accountNumber:
 *                 type: string
 *                 description: 계좌번호
 *               accountHolder:
 *                 type: string
 *                 description: 예금주명
 *               expectedOccupantName:
 *                 type: string
 *                 description: 입실예정자명 (type이 RESERVATION일 때 사용)
 *                 example: 홍길동
 *               expectedOccupantPhone:
 *                 type: string
 *                 description: 입실예정자연락처 (type이 RESERVATION일 때 사용)
 *                 example: 010-1234-5678
 *               moveInDate:
 *                 type: string
 *                 format: date
 *                 description: 입실일
 *               moveOutDate:
 *                 type: string
 *                 format: date
 *                 description: 퇴실일
 *               contractStatus:
 *                 type: string
 *                 description: 계약상태
 *               virtualAccountNumber:
 *                 type: string
 *                 description: 가상계좌번호
 *               virtualAccountExpiryDate:
 *                 type: string
 *                 format: date-time
 *                 description: 가상계좌 만료일시
 *     responses:
 *       200:
 *         description: 보증금 등록 성공
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/create', depositController.createDeposit);

/**
 * @swagger
 * /v1/deposit/update:
 *   put:
 *     summary: 보증금 수정
 *     description: 보증금 정보를 수정합니다.
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
 *               - esntlId
 *             properties:
 *               esntlId:
 *                 type: string
 *                 description: 보증금 고유 아이디
 *               gosiwonEsntlId:
 *                 type: string
 *                 description: 고시원 고유 아이디
 *                 example: GOSI0000002130
 *               customerEsntlId:
 *                 type: string
 *                 description: 예약자/입실자 고유 아이디
 *               contractorEsntlId:
 *                 type: string
 *                 description: 계약자 고유 아이디
 *               contractEsntlId:
 *                 type: string
 *                 description: 방계약 고유 아이디
 *               type:
 *                 type: string
 *                 enum: [RESERVATION, DEPOSIT]
 *                 description: '타입 (RESERVATION: 예약금, DEPOSIT: 보증금)'
 *                 example: DEPOSIT
 *               amount:
 *                 type: integer
 *                 description: 금액 (예약금 또는 보증금)
 *                 example: 500000
 *               reservationDepositAmount:
 *                 type: integer
 *                 description: 예약금 금액 (하위 호환성, 사용 중단 예정)
 *               depositAmount:
 *                 type: integer
 *                 description: 보증금 금액 (하위 호환성, 사용 중단 예정)
 *               accountBank:
 *                 type: string
 *                 description: 은행명
 *               accountNumber:
 *                 type: string
 *                 description: 계좌번호
 *               accountHolder:
 *                 type: string
 *                 description: 예금주명
 *               expectedOccupantName:
 *                 type: string
 *                 description: 입실예정자명 (type이 RESERVATION일 때 사용)
 *                 example: 홍길동
 *               expectedOccupantPhone:
 *                 type: string
 *                 description: 입실예정자연락처 (type이 RESERVATION일 때 사용)
 *                 example: 010-1234-5678
 *               moveInDate:
 *                 type: string
 *                 format: date
 *                 description: 입실일
 *               moveOutDate:
 *                 type: string
 *                 format: date
 *                 description: 퇴실일
 *               contractStatus:
 *                 type: string
 *                 description: 계약상태
 *               virtualAccountNumber:
 *                 type: string
 *                 description: 가상계좌번호
 *               virtualAccountExpiryDate:
 *                 type: string
 *                 format: date-time
 *                 description: 가상계좌 만료일시
 *     responses:
 *       200:
 *         description: 보증금 수정 성공
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put('/update', depositController.updateDeposit);

/**
 * @swagger
 * /v1/deposit/delete:
 *   delete:
 *     summary: 보증금 삭제
 *     description: 보증금 정보를 삭제합니다 (논리 삭제).
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
 *         description: 보증금 삭제 성공
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete('/delete', depositController.deleteDeposit);

/**
 * @swagger
 * /v1/deposit/register-deposit:
 *   post:
 *     summary: 입금 등록
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
 *               - esntlId
 *               - depositDate
 *               - amount
 *             properties:
 *               esntlId:
 *                 type: string
 *                 description: 보증금 고유 아이디
 *               roomEsntlId:
 *                 type: string
 *                 description: 방 고유 아이디
 *                 example: ROOM0000025359
 *               contractEsntlId:
 *                 type: string
 *                 description: 방계약 고유 아이디(선택)
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
router.post('/register-deposit', depositController.registerDeposit);

/**
 * @swagger
 * /v1/deposit/register-return:
 *   post:
 *     summary: 반환 등록
 *     description: 보증금 반환을 등록합니다. 차감 항목을 포함하여 반환금액을 계산합니다.
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
 *               - esntlId
 *               - refundDate
 *             properties:
 *               esntlId:
 *                 type: string
 *                 description: 보증금 고유 아이디
 *               roomEsntlId:
 *                 type: string
 *                 description: 방 고유 아이디
 *                 example: ROOM0000025359
 *               contractEsntlId:
 *                 type: string
 *                 description: 방계약 고유 아이디(선택)
 *               refundDate:
 *                 type: string
 *                 format: date-time
 *                 description: 반환일시
 *               accountBank:
 *                 type: string
 *                 description: 계좌 은행명
 *               accountNumber:
 *                 type: string
 *                 description: 계좌번호
 *               accountHolder:
 *                 type: string
 *                 description: 예금주명
 *               deductions:
 *                 type: array
 *                 description: 차감 항목 배열
 *                 items:
 *                   type: object
 *                   properties:
 *                     deductionName:
 *                       type: string
 *                       description: 차감명
 *                     deductionAmount:
 *                       type: integer
 *                       description: 차감금액
 *               refundAmount:
 *                 type: integer
 *                 description: 반환금액 (자동 계산되지만 수동 입력 가능)
 *               manager:
 *                 type: string
 *                 description: 담당자
 *     responses:
 *       200:
 *         description: 반환 등록 성공
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/register-return', depositController.registerReturn);

/**
 * @swagger
 * /v1/deposit/register-deposit/list:
 *   get:
 *     summary: 입금 등록 이력 목록
 *     description: 방 ID 또는 보증금 ID 기준으로 입금(등록) 이력을 조회합니다.
 *     tags: [Deposit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: depositEsntlId
 *         required: false
 *         schema:
 *           type: string
 *         description: 보증금 고유 아이디 (depositEsntlId 또는 roomEsntlId 중 하나 필수)
 *       - in: query
 *         name: roomEsntlId
 *         required: false
 *         schema:
 *           type: string
 *         description: 방 고유 아이디 (depositEsntlId 또는 roomEsntlId 중 하나 필수)
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
	'/register-deposit/list',
	depositController.getDepositHistoryDepositList
);

/**
 * @swagger
 * /v1/deposit/register-return/list:
 *   get:
 *     summary: 반환 등록 이력 목록
 *     description: 방 ID 또는 보증금 ID 기준으로 반환(등록) 이력을 조회합니다.
 *     tags: [Deposit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: depositEsntlId
 *         required: false
 *         schema:
 *           type: string
 *         description: 보증금 고유 아이디 (depositEsntlId 또는 roomEsntlId 중 하나 필수)
 *       - in: query
 *         name: roomEsntlId
 *         required: false
 *         schema:
 *           type: string
 *         description: 방 고유 아이디 (depositEsntlId 또는 roomEsntlId 중 하나 필수)
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
	'/register-return/list',
	depositController.getDepositHistoryReturnList
);

/**
 * @swagger
 * /v1/deposit/history:
 *   get:
 *     summary: 입금/반환 이력 조회
 *     description: 보증금 또는 방 기준으로 입금/반환 이력을 조회합니다.
 *     tags: [Deposit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: depositEsntlId
 *         required: false
 *         schema:
 *           type: string
 *         description: 보증금 고유 아이디 (depositEsntlId 또는 roomEsntlId 중 하나 필수)
 *       - in: query
 *         name: roomEsntlId
 *         required: false
 *         schema:
 *           type: string
 *         description: 방 고유 아이디 (depositEsntlId 또는 roomEsntlId 중 하나 필수)
 *       - in: query
 *         name: type
 *         required: false
 *         schema:
 *           type: string
 *           enum: [DEPOSIT, RETURN]
 *         description: "타입 (DEPOSIT: 입금, RETURN: 반환)"
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
 *         description: 입금/반환 이력 조회 성공
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/history', depositController.getDepositHistory);

module.exports = router;

