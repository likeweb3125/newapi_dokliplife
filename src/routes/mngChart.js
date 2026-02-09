const express = require('express');
const router = express.Router();

const mngChartController = require('../controllers/mngChart');
const isAuthMiddleware = require('../middleware/is-auth');

/**
 * @swagger
 * tags:
 *   name: 관리객실현황
 *   description: 관리객실현황 차트 데이터 조회 API
 */

/**
 * @swagger
 * /v1/mngChart/main:
 *   get:
 *     summary: 관리객실현황 차트 데이터 조회
 *     description: "고시원 ID를 입력받아 해당 고시원의 방 목록(groups), 계약 및 상태 정보(items), 방 상태 이력(roomStatuses)을 조회합니다. 별도 room_move 아이템 없이, roomStatus.subStatus가 ROOM_MOVE_IN/ROOM_MOVE_OUT인 contract item에 moveID(유니크), moveFrom, moveTo, moveRole(out=이 방에서 나감, in=이 방으로 들어옴)로 이동 쌍을 표시합니다."
 *     tags: [관리객실현황]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: gosiwonEsntlId
 *         required: true
 *         schema:
 *           type: string
 *         description: 고시원 고유 아이디
 *         example: GOSI0000000199
 *       - in: query
 *         name: page
 *         required: false
 *         schema:
 *           type: integer
 *           default: 1
 *         description: 페이지 번호 (1=오늘~1개월 전, 2=1개월 전~2개월 전, ...)
 *         example: 1
 *     responses:
 *       200:
 *         description: 관리객실현황 차트 데이터 조회 성공
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
 *                   example: 관리객실현황 차트 데이터 조회 성공
 *                 data:
 *                   type: object
 *                   properties:
 *                     gosiwonEsntlId:
 *                       type: string
 *                       description: 현재 검색 중인 고시원 고유 아이디
 *                       example: GOSI0000000199
 *                     gosiwonCeo:
 *                       type: string
 *                       nullable: true
 *                       description: "고시원 대표자명 (gosiwonAdmin.ceo, gosiwon.adminEsntlId로 조회)"
 *                     gosiwonCeoHp:
 *                       type: string
 *                       nullable: true
 *                       description: "고시원 대표자 연락처 (gosiwonAdmin.hp)"
 *                     groups:
 *                       type: array
 *                       description: 방 목록 (vis-timeline groups)
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                             description: 그룹 인덱스
 *                           roomEsntlId:
 *                             type: string
 *                             description: 방 고유 아이디
 *                           roomNumber:
 *                             type: string
 *                             description: 방 번호
 *                           roomName:
 *                             type: string
 *                             description: 방 이름
 *                           status:
 *                             type: string
 *                             description: 방 상태 (판매신청전, 판매중, 입금대기중, 예약중, 이용중 등)
 *                           type:
 *                             type: string
 *                             description: 방 타입 (원룸 등)
 *                           window:
 *                             type: string
 *                             description: 창 타입 (외창 등)
 *                           monthlyRent:
 *                             type: integer
 *                             description: 월 임대료
 *                           currentGuest:
 *                             type: string
 *                             description: 현재 입실자 이름
 *                           stayPeriod:
 *                             type: string
 *                             description: 체류 기간 (yy-mm-dd~yy-mm-dd 형식)
 *                           value:
 *                             type: integer
 *                             description: 정렬 순서
 *                           color:
 *                             type: object
 *                             properties:
 *                               sidebar:
 *                                 type: string
 *                                 description: 사이드바 색상
 *                               statusBorder:
 *                                 type: string
 *                                 description: 상태 테두리 색상
 *                               statusText:
 *                                 type: string
 *                                 description: 상태 텍스트 색상
 *                     items:
 *                       type: array
 *                       description: "roomStatus 테이블 기준 계약 및 상태 정보 (vis-timeline items). start/end는 roomStatus 값, contractStart/contractEnd는 roomContract의 startDate/endDate"
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                             description: 아이템 ID
 *                           group:
 *                             type: string
 *                             description: 방 고유 아이디 (roomEsntlId)
 *                           itemType:
 *                             type: string
 *                             enum: [contract, disabled, system]
 *                             description: '아이템 타입 (contract: 계약, disabled: 비활성 상태, system: 시스템 상태). 방이동은 contract+subStatus ROOM_MOVE_IN/OUT으로 moveID·moveRole로 표시'
 *                           start:
 *                             type: string
 *                             format: date-time
 *                             description: 시작 일시 (roomStatus 기준)
 *                           end:
 *                             type: string
 *                             format: date-time
 *                             description: 종료 일시 (roomStatus 기준)
 *                           contractStart:
 *                             type: string
 *                             format: date-time
 *                             nullable: true
 *                             description: "계약 시작 일시 (roomContract.startDate, 계약 연동 시에만)"
 *                           contractEnd:
 *                             type: string
 *                             format: date-time
 *                             nullable: true
 *                             description: "계약 종료 일시 (roomContract.endDate, 계약 연동 시에만)"
 *                           moveID:
 *                             type: integer
 *                             nullable: true
 *                             description: "방이동 쌍 ID (roomStatus.subStatus가 ROOM_MOVE_IN/OUT인 contract item에만, 동일 이동 쌍은 같은 moveID)"
 *                           moveFrom:
 *                             type: integer
 *                             nullable: true
 *                             description: "방이동 출발 item id (어디서 이동했는지)"
 *                           moveTo:
 *                             type: integer
 *                             nullable: true
 *                             description: "방이동 도착 item id (어디로 이동했는지)"
 *                           moveRole:
 *                             type: string
 *                             enum: [out, in]
 *                             nullable: true
 *                             description: "방이동 역할. out=이 방에서 나감, in=이 방으로 들어옴 (subStatus ROOM_MOVE_OUT/ROOM_MOVE_IN인 contract item에만)"
 *                           period:
 *                             type: string
 *                             description: 기간 표시 (MM-dd ~ MM-dd 형식)
 *                           currentGuest:
 *                             type: string
 *                             description: 현재 입실자 이름
 *                           className:
 *                             type: string
 *                             description: CSS 클래스명 (timeline-item in-progress, timeline-item leave, disabled 등)
 *                           contractNumber:
 *                             type: string
 *                             description: 계약 번호 (itemType이 contract일 때)
 *                           guest:
 *                             type: string
 *                             description: 입실자 정보 (이름 / 나이 / 성별(전화번호))
 *                           contractPerson:
 *                             type: string
 *                             description: 계약자 정보 (이름 / 나이 / 성별(전화번호))
 *                           periodType:
 *                             type: string
 *                             description: '계약 기간 타입 (예: 1개월)'
 *                           contractType:
 *                             type: string
 *                             enum: [신규, 연장]
 *                             description: 계약 타입
 *                           entryFee:
 *                             type: string
 *                             description: '입실료 (예: 75 만원)'
 *                           paymentAmount:
 *                             type: string
 *                             description: '결제 금액 (예: 70 만원)'
 *                           accountInfo:
 *                             type: string
 *                             description: 계좌 정보 (은행 계좌번호 계약자명)
 *                           deposit:
 *                             type: string
 *                             description: '보증금 (예: 200,000 원)'
 *                           additionalPaymentOption:
 *                             type: string
 *                             description: '추가 결제 옵션 (예: 주차비 10만원)'
 *                           content:
 *                             type: string
 *                             description: '비활성 상태 표시 내용 (예: 퇴실, 점검중)'
 *                           reason:
 *                             type: string
 *                             description: 비활성 상태 사유
 *                           description:
 *                             type: string
 *                             description: 비활성 상태 설명
 *                           colors:
 *                             type: array
 *                             items:
 *                               type: string
 *                             description: 상태 색상 배열 (system 타입일 때)
 *                     roomStatuses:
 *                       type: array
 *                       description: 방 상태 이력 (vis-timeline system items)
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             description: 상태 아이템 ID
 *                           group:
 *                             type: string
 *                             description: 방 고유 아이디 (roomEsntlId)
 *                           itemType:
 *                             type: string
 *                             enum: [system]
 *                             description: 아이템 타입
 *                           content:
 *                             type: array
 *                             items:
 *                               type: string
 *                             description: 상태 내용 배열
 *                           colors:
 *                             type: array
 *                             items:
 *                               type: string
 *                             description: 상태 색상 배열
 *                           start:
 *                             type: string
 *                             format: date-time
 *                             description: 시작 일시
 *                           end:
 *                             type: string
 *                             nullable: true
 *                             description: 종료 일시 (null)
 *                           className:
 *                             type: string
 *                             description: CSS 클래스명
 *                     page:
 *                       type: integer
 *                       description: 현재 페이지 번호
 *                     totalPages:
 *                       type: integer
 *                       description: 전체 페이지 수
 *                     dateRange:
 *                       type: object
 *                       description: 현재 페이지의 날짜 범위
 *                       properties:
 *                         startDate:
 *                           type: string
 *                           format: date
 *                           description: 시작 날짜 (YYYY-MM-DD)
 *                         endDate:
 *                           type: string
 *                           format: date
 *                           description: 종료 날짜 (YYYY-MM-DD)
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/main', isAuthMiddleware.isAuthAdmin, mngChartController.mngChartMain);

/**
 * @swagger
 * /v1/mngChart/test-data:
 *   post:
 *     summary: 관리객실현황 테스트 데이터 생성
 *     description: 관리객실현황 차트 테스트를 위한 샘플 데이터를 생성합니다. (room, customer, roomStatus, roomContract, paymentLog, extraPayment)
 *     tags: [관리객실현황]
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
 *             properties:
 *               gosiwonEsntlId:
 *                 type: string
 *                 description: 고시원 고유 아이디
 *                 example: GOSI0000000199
 *     responses:
 *       200:
 *         description: 테스트 데이터 생성 성공
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
 *                   example: 테스트 데이터 생성 성공
 *                 data:
 *                   type: object
 *                   properties:
 *                     rooms:
 *                       type: array
 *                       items:
 *                         type: object
 *                     customers:
 *                       type: array
 *                       items:
 *                         type: object
 *                     roomStatuses:
 *                       type: array
 *                       items:
 *                         type: object
 *                     contracts:
 *                       type: array
 *                       items:
 *                         type: object
 *                     paymentLogs:
 *                       type: array
 *                       items:
 *                         type: object
 *                     extraPayments:
 *                       type: array
 *                       items:
 *                         type: object
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.post('/test-data', isAuthMiddleware.isAuthAdmin, mngChartController.createTestData);

module.exports = router;

