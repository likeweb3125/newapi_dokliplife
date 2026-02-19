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
 *         description: "페이지 번호. 1=오늘~1개월 전, 2=1개월 전~2개월 전(과거). 0=오늘~1개월 후, -1=1개월후~2개월후(미래)"
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
 *                       description: "roomStatus 전체 값 (CONTRACT, OVERDUE, CHECKOUT_REQUESTED, ROOM_MOVE, RESERVE_*, PENDING, ON_SALE, CHECKOUT_ONSALE, END_DEPOSIT, END, ETC, BEFORE_SALES, CHECKOUT_CONFIRMED). 계약서 없으면 계약 관련 필드는 null, className은 timeline-item 고정"
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
 *                           itemStatus:
 *                             type: string
 *                             description: "roomStatus.status (CONTRACT, OVERDUE, CHECKOUT_REQUESTED, ROOM_MOVE, RESERVE_PENDING, RESERVED, VBANK_PENDING)"
 *                           typeName:
 *                             type: string
 *                             description: "상태 한글 명칭 (예: 이용중, 체납상태, 퇴실요청, 방이동). STATUS_MAP.label 기반"
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
 *                             description: "계약 시작 일시 (roomContract.startDate, 계약서 없으면 null)"
 *                           contractEnd:
 *                             type: string
 *                             format: date-time
 *                             nullable: true
 *                             description: "계약 종료 일시 (roomContract.endDate, 계약서 없으면 null)"
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
 *                             description: "CSS 클래스명 (고정값: timeline-item)"
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
 *                           depositEsntlId:
 *                             type: string
 *                             nullable: true
 *                             description: 'items 8개 상태일 때, il_room_deposit에서 방·rdp_customer_name·계약기간 내 rdp_completed_dtm 기록이 있으면 해당 rdp_eid'
 *                           depositCompleteDate:
 *                             type: string
 *                             format: date-time
 *                             nullable: true
 *                             description: 'il_room_deposit.rdp_completed_dtm (입금완료일시)'
 *                           depositPrice:
 *                             type: integer
 *                             nullable: true
 *                             description: 'il_room_deposit.rdp_price (보증금 금액)'
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
 *                       description: "방별 상태 이력. 방(group index)당 1건, content 배열에 '상태명 YY-MM-DD HH:mm:ss 관리자명(관리자)' 형식 문자열"
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             description: "상태 블록 ID (예: room-0-statuses-0)"
 *                           group:
 *                             type: integer
 *                             description: "그룹 인덱스 (groups 순서와 동일)"
 *                           itemType:
 *                             type: string
 *                             description: "아이템 타입 (고정값: system)"
 *                           content:
 *                             type: array
 *                             items:
 *                               type: string
 *                             description: "상태 이력 문자열 배열 (예: '판매신청 20-10-01 10:40:08 김소연(관리자)')"
 *                           start:
 *                             type: string
 *                             description: "해당 방 상태 이력의 시작일 (YYYY-MM-DD)"
 *                           end:
 *                             type: string
 *                             description: "해당 방 상태 이력의 종료일 (YYYY-MM-DD)"
 *                           className:
 *                             type: string
 *                             description: "CSS 클래스명 (고정값: room-statuses)"
 *                           colors:
 *                             type: array
 *                             items:
 *                               type: string
 *                             description: "각 상태별 색상 코드 배열"
 *                     statusLabels:
 *                       type: object
 *                       description: "상태 코드 → 한글 명칭 맵 (STATUS_MAP 기반, 관리 편의)"
 *                       additionalProperties:
 *                         type: string
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

module.exports = router;

