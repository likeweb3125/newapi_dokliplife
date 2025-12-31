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

router.post('/create', depositController.createDeposit);

router.put('/update', depositController.updateDeposit);

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

/**
 * @swagger
 * /v1/deposit/contract-coupon-info:
 *   get:
 *     summary: 계약서 쿠폰 정보 조회
 *     description: 계약서 ID로 해당 계약의 쿠폰 사용 여부, 사용된 쿠폰 정보, 계약 기간을 조회합니다.
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
 *         description: 계약서 쿠폰 정보 조회 성공
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
 *                   example: 계약서 쿠폰 정보 조회 성공
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
 * /v1/deposit/gosiwonList:
 *   get:
 *     summary: 고시원 목록 조회 (입금대기 건수 포함)
 *     description: 'status가 OPERATE인 고시원 목록을 조회하고, 예약금(RESERVATION)과 보증금(DEPOSIT)의 입금대기(DEPOSIT_PENDING) 건수를 각각 카운트하여 반환합니다. 하나라도 카운트가 있으면 상단으로 정렬됩니다.'
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
 *                         example: GOSI0000000001
 *                       name:
 *                         type: string
 *                         description: 고시원 이름
 *                         example: 성수 고시원
 *                       reservePendingCount:
 *                         type: integer
 *                         description: 예약금 입금대기 건수
 *                         example: 5
 *                       depositPendingCount:
 *                         type: integer
 *                         description: 보증금 입금대기 건수
 *                         example: 3
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/gosiwonList', depositController.getGosiwonList);

/**
 * @swagger
 * /v1/deposit/reservationList:
 *   get:
 *     summary: 예약금 예약 목록 조회
 *     description: 예약금 예약 목록을 조회합니다. 검색, 필터링, 페이징을 지원합니다. roomStatus.status가 ON_SALE이고 subStatus가 END가 아닌 경우의 statusStartDate 기준 내림차순으로 정렬됩니다.
 *     tags: [Deposit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: searchType
 *         required: false
 *         schema:
 *           type: string
 *           enum:
 *             - gosiwonName
 *             - gosiwonCode
 *             - etc
 *         description: "검색 대상 종류 (gosiwonName: 고시원명, gosiwonCode: 고시원코드, etc: roomName, roomEsntlId, reservationName, contractName을 like 검색)"
 *       - in: query
 *         name: searchString
 *         required: false
 *         schema:
 *           type: string
 *         description: "검색어"
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
 *         description: "예약금요청상태만보기 (deposit.type이 RESERVATION이고 deposit.status가 DEPOSIT_PENDING인 경우만)"
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
 *                           roomEsntlId:
 *                             type: string
 *                             description: 방 고유 아이디
 *                             example: ROOM0000000001
 *                           roomNumber:
 *                             type: string
 *                             description: 방 이름(방번호)
 *                             example: 101호
 *                           roomStatus:
 *                             type: string
 *                             nullable: true
 *                             description: 방 상태 (없으면 null)
 *                             example: ON_SALE
 *                           reservationName:
 *                             type: string
 *                             nullable: true
 *                             description: 입실자 정보(예약자 이름)
 *                             example: 홍길동
 *                           contractorName:
 *                             type: string
 *                             nullable: true
 *                             description: 계약자 정보(계약자 이름)
 *                             example: 홍길동
 *                           moveInDate:
 *                             type: string
 *                             format: date
 *                             nullable: true
 *                             description: 입실일
 *                             example: '2024-01-01'
 *                           moveOutDate:
 *                             type: string
 *                             format: date
 *                             nullable: true
 *                             description: 퇴실일
 *                             example: '2024-12-31'
 *                           depositStatus:
 *                             type: string
 *                             nullable: true
 *                             description: 예약금상태 (해당방의 마지막 상태값, 없으면 null)
 *                             example: DEPOSIT_PENDING
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/reservationList', depositController.getReservationList);

module.exports = router;

