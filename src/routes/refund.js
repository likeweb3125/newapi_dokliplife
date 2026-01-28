const express = require('express');
const router = express.Router();

const refundController = require('../controllers/refund');

/**
 * @swagger
 * tags:
 *   - name: 계약현황
 *     description: 계약현황 관리 API
 *   - name: 환불관리
 *     description: 환불관리 API
 */

/**
 * @swagger
 * /v1/refund/process:
 *   post:
 *     summary: 환불 및 퇴실처리
 *     description: '계약에 대한 환불 및 퇴실처리를 수행합니다. 환불 요청을 il_room_refund_request 테이블에 저장하고, roomStatus를 CHECKOUT_CONFIRMED로 업데이트하며, history에 기록을 남깁니다. 취소사유 (FULL: 만기퇴실, INTERIM: 중도퇴실, CANCEL: 계약취소, ETC: 기타), liabilityReason: 귀책사유 (OWNER: 사장님, OCCUPANT: 입실자). check_basic_sell이 true인 경우 기본 판매 설정을 사용하고, false인 경우 unableCheckInReason이 있으면 BEFORE_SALES 상태로 설정하며, 없으면 사용자 지정 날짜를 사용합니다.'
 *     tags: [환불관리]
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
 *               - cancelReason
 *               - cancelDate
 *             properties:
 *               contractEsntlId:
 *                 type: string
 *                 description: 계약 고유아이디
 *                 example: RCO0000000001
 *               cancelReason:
 *                 type: string
 *                 enum: [FULL, INTERIM, CANCEL, ETC]
 *                 description: '취소사유 (FULL: 만기퇴실, INTERIM: 중도퇴실, CANCEL: 계약취소, ETC: 기타)'
 *                 example: FULL
 *               cancelDate:
 *                 type: string
 *                 format: date
 *                 description: 취소날짜 (YYYY-MM-DD)
 *                 example: '2025-11-06'
 *               cancelMemo:
 *                 type: string
 *                 description: 취소메모
 *                 example: '개인 사정으로 인한 중도퇴실'
 *               liabilityReason:
 *                 type: string
 *                 enum: [OWNER, OCCUPANT]
 *                 description: '귀책사유 (OWNER: 사장님, OCCUPANT: 입실자)'
 *                 example: OCCUPANT
 *               contactedOwner:
 *                 type: boolean
 *                 description: 사장님과 연락이 되었는지 유무
 *                 example: true
 *               refundMethod:
 *                 type: string
 *                 description: '환불수단 (예: 계좌이체, 현금, 카드취소 등)'
 *                 example: '계좌이체'
 *               paymentAmount:
 *                 type: integer
 *                 description: 결제금액
 *                 example: 300000
 *               proratedRent:
 *                 type: integer
 *                 description: 일할입실료
 *                 example: 200000
 *               penalty:
 *                 type: integer
 *                 description: 위약금
 *                 example: 30000
 *               totalRefundAmount:
 *                 type: integer
 *                 description: 총환불금액
 *                 example: 70000
 *               check_basic_sell:
 *                 type: boolean
 *                 description: '기본 판매 설정 사용 여부 (true: 기본 설정 사용, false: 사용자 지정 날짜 사용)'
 *                 example: true
 *               unableCheckInReason:
 *                 type: string
 *                 enum: [CHECKOUT, CHECK, CONTRACT, ROOM_MOVE, FREE_EXPERIENCE, OTHER, ETC]
 *                 description: '입실 불가 사유 (check_basic_sell이 false일 때만 사용, 값이 있으면 BEFORE_SALES 상태로 설정. 퇴실:CHECKOUT, 점검:CHECK, 계약중:CONTRACT, 방이동:ROOM_MOVE, 무료체험:FREE_EXPERIENCE, 타업체:OTHER, 기타:ETC)'
 *                 example: null
 *               check_room_only_config:
 *                 type: boolean
 *                 description: '방별 설정 사용 여부 (check_basic_sell이 false이고 unableCheckInReason이 없을 때 true이면 ON_SALE과 CAN_CHECKIN 상태 생성)'
 *                 example: true
 *               sell_able_start_date:
 *                 type: string
 *                 format: date-time
 *                 description: 판매 가능 시작일 (check_basic_sell이 false이고 check_room_only_config가 true일 때 필수)
 *                 example: '2025-11-10T00:00:00'
 *               sell_able_end_date:
 *                 type: string
 *                 format: date-time
 *                 description: 판매 가능 종료일 (check_basic_sell이 false이고 check_room_only_config가 true일 때 필수)
 *                 example: '2025-11-20T00:00:00'
 *               can_checkin_start_date:
 *                 type: string
 *                 format: date-time
 *                 description: 입실 가능 시작일 (check_basic_sell이 false이고 check_room_only_config가 true일 때 필수)
 *                 example: '2025-11-15T00:00:00'
 *               can_checkin_end_date:
 *                 type: string
 *                 format: date-time
 *                 description: 입실 가능 종료일 (check_basic_sell이 false이고 check_room_only_config가 true일 때 필수)
 *                 example: '2025-12-15T00:00:00'
 *     responses:
 *       200:
 *         description: 환불 및 퇴실처리 성공
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
 *                   example: 환불 및 퇴실처리 성공
 *                 data:
 *                   type: object
 *                   properties:
 *                     rrr_sno:
 *                       type: integer
 *                       description: 환불요청 일련번호
 *                       example: 1
 *                     historyId:
 *                       type: string
 *                       description: 히스토리 고유아이디
 *                       example: HISTORY0000000001
 *                     roomStatus:
 *                       type: string
 *                       description: 업데이트된 방 상태
 *                       example: CHECKOUT_CONFIRMED
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/process', refundController.processRefundAndCheckout);

/**
 * @swagger
 * /v1/refund/refundInsert:
 *   post:
 *     summary: 환불 요청 등록
 *     description: '환불 요청 정보를 il_room_refund_request 테이블에 등록합니다. 퇴실 타입은 FULL(만기퇴실), INTERIM(중도퇴실), CANCEL(계약취소), ETC(기타) 중 하나여야 합니다.'
 *     tags: [환불관리]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - gswId
 *               - romId
 *               - mbrId
 *               - contractId
 *               - type
 *               - checkoutDate
 *               - reason
 *             properties:
 *               gswId:
 *                 type: string
 *                 description: 고시원 고유아이디
 *                 example: 'GOSI0000000001'
 *               romId:
 *                 type: string
 *                 description: 방 고유 아이디
 *                 example: 'ROOM0000000001'
 *               mbrId:
 *                 type: string
 *                 description: 회원 고유 아이디
 *                 example: 'CUTR0000000001'
 *               contractId:
 *                 type: string
 *                 description: 계약 고유 아이디
 *                 example: 'RCTT0000000001'
 *               type:
 *                 type: string
 *                 enum: [FULL, INTERIM, CANCEL, ETC]
 *                 description: '퇴실 타입 (FULL: 만기퇴실, INTERIM: 중도퇴실, CANCEL: 계약취소, ETC: 기타)'
 *                 example: 'INTERIM'
 *               checkoutDate:
 *                 type: string
 *                 format: date
 *                 description: 퇴실일시 (YYYY-MM-DD)
 *                 example: '2025-01-15'
 *               reason:
 *                 type: string
 *                 description: 퇴실 사유
 *                 example: '개인 사정으로 인한 중도퇴실'
 *               paymentAmt:
 *                 type: integer
 *                 description: 결제금액
 *                 example: 300000
 *               usePeriod:
 *                 type: integer
 *                 description: 사용기간 (일수)
 *                 example: 30
 *               useAmt:
 *                 type: integer
 *                 description: 일할입실료
 *                 example: 200000
 *               penalty:
 *                 type: integer
 *                 description: 위약금
 *                 example: 30000
 *               refundAmt:
 *                 type: integer
 *                 description: 환불총액
 *                 example: 70000
 *     responses:
 *       200:
 *         description: 환불 요청 등록 성공
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
 *                   example: 환불 요청 등록 성공
 *                 data:
 *                   type: object
 *                   properties:
 *                     rrr_sno:
 *                       type: integer
 *                       description: 환불요청 일련번호
 *                       example: 115
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/refundInsert', refundController.refundInsert);

/**
 * @swagger
 * /v1/refund/list:
 *   get:
 *     summary: 환불 요청 목록 조회
 *     description: '환불 요청 목록을 조회합니다. DataTables 형식으로 응답하며, 고시원 ID로 필터링할 수 있습니다.'
 *     tags: [환불관리]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: eId
 *         required: false
 *         schema:
 *           type: string
 *         description: '고시원 고유아이디 (GOSI로 시작하는 경우 필터링, 선택)'
 *         example: 'GOSI0000000001'
 *       - in: query
 *         name: year
 *         required: false
 *         schema:
 *           type: integer
 *         description: '년도 필터 (YYYY)'
 *         example: 2026
 *       - in: query
 *         name: month
 *         required: false
 *         schema:
 *           type: integer
 *         description: '월 필터 (MM, year와 함께 사용)'
 *         example: 1
 *       - in: query
 *         name: day
 *         required: false
 *         schema:
 *           type: integer
 *         description: '일 필터 (DD, year와 month와 함께 사용)'
 *         example: 6
 *       - in: query
 *         name: search
 *         required: false
 *         schema:
 *           type: string
 *         description: '검색어 (고시원명, 방번호, 입실자명, 연락처 검색)'
 *         example: 'test'
 *       - in: query
 *         name: page
 *         required: false
 *         schema:
 *           type: integer
 *           default: 1
 *         description: 페이지 번호 (depositList와 동일)
 *         example: 1
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           default: 50
 *         description: 페이지당 항목 수 (depositList와 동일)
 *         example: 20
 *     responses:
 *       200:
 *         description: 환불 요청 목록 조회 성공
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
 *                   example: 환불 요청 목록 조회 성공
 *                 data:
 *                   type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         type: object
 *                     recordsTotal:
 *                       type: integer
 *                       description: 전체 레코드 수
 *                     recordsFiltered:
 *                       type: integer
 *                       description: 필터링된 레코드 수
 *                     draw:
 *                       type: integer
 *                       description: DataTables draw 값
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/list', refundController.getRefundRequestList);

/**
 * @swagger
 * /v1/refund/updateStatus:
 *   put:
 *     summary: 환불 요청 상태 업데이트
 *     description: '환불 요청의 처리 상태를 업데이트합니다. 상태는 REQUEST(요청), APPROVAL(승인), REJECT(반려), CANCELLATION(취소) 중 하나여야 합니다.'
 *     tags: [환불관리]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *               - cttEid
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [REQUEST, APPROVAL, REJECT, CANCELLATION]
 *                 description: '처리 상태 (REQUEST: 요청, APPROVAL: 승인, REJECT: 반려, CANCELLATION: 취소)'
 *                 example: 'APPROVAL'
 *               processReason:
 *                 type: string
 *                 description: 처리 사유
 *                 example: '환불 승인 완료'
 *               cttEid:
 *                 type: string
 *                 description: 계약 고유 아이디
 *                 example: 'RCTT0000000001'
 *     responses:
 *       200:
 *         description: 환불 요청 상태 업데이트 성공
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put('/updateStatus', refundController.updateRefundRequestStatus);

/**
 * @swagger
 * /v1/refund/refundData:
 *   get:
 *     summary: 환불 데이터 조회 (결제 정보 포함)
 *     description: '계약서 ID를 기준으로 환불 데이터와 결제 정보를 조회합니다.'
 *     tags: [환불관리]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: contractId
 *         required: true
 *         schema:
 *           type: string
 *         description: 계약 고유 아이디
 *         example: 'RCTT0000000001'
 *     responses:
 *       200:
 *         description: 환불 데이터 조회 성공
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
 *                   example: 환불 데이터 조회 성공
 *                 data:
 *                   type: object
 *                   properties:
 *                     paymentAmt:
 *                       type: integer
 *                       description: 결제금액
 *                     refundAmt:
 *                       type: integer
 *                       description: 환불총액
 *                     tid:
 *                       type: string
 *                       description: 거래 ID
 *                     paymentType:
 *                       type: string
 *                       description: 결제 타입
 *                     MOID:
 *                       type: string
 *                       description: 주문 번호
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/refundData', refundController.getRefundData);

/**
 * @swagger
 * /v1/refund/data:
 *   get:
 *     summary: 계약서 기반 환불 요청 데이터 조회
 *     description: '계약서 ID를 기준으로 환불 요청과 관련된 모든 정보를 조회합니다.'
 *     tags: [환불관리]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: cttEid
 *         required: true
 *         schema:
 *           type: string
 *         description: 계약 고유 아이디
 *         example: 'RCTT0000000001'
 *     responses:
 *       200:
 *         description: 환불 요청 데이터 조회 성공
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
 *                   example: 환불 요청 데이터 조회 성공
 *                 data:
 *                   type: object
 *                   properties:
 *                     esntlId:
 *                       type: string
 *                       description: 계약서 고유 아이디
 *                     startDate:
 *                       type: string
 *                       format: date
 *                       description: 계약 시작일
 *                     endDate:
 *                       type: string
 *                       format: date
 *                       description: 계약 종료일
 *                     dateDiff:
 *                       type: integer
 *                       description: 계약 시작일로부터 경과 일수
 *                     paymentAmount:
 *                       type: integer
 *                       description: 결제금액
 *                     paymentType:
 *                       type: string
 *                       description: 결제 타입
 *                     monthlyRent:
 *                       type: integer
 *                       description: 월 임대료
 *                     name:
 *                       type: string
 *                       description: 고객 이름
 *                     phone:
 *                       type: string
 *                       description: 고객 전화번호
 *                     romId:
 *                       type: string
 *                       description: 방 고유 아이디
 *                     roomStatus:
 *                       type: string
 *                       description: 방 상태
 *                     roomContractStatus:
 *                       type: string
 *                       description: 계약 상태
 *                     contractDate:
 *                       type: string
 *                       format: date-time
 *                       description: 계약일시
 *                     gswId:
 *                       type: string
 *                       description: 고시원 고유 아이디
 *                     mbrId:
 *                       type: string
 *                       description: 회원 고유 아이디
 *                     leaveType:
 *                       type: string
 *                       description: 퇴실 타입
 *                     reason:
 *                       type: string
 *                       description: 퇴실 사유
 *                     liabilityReason:
 *                       type: string
 *                       enum: [OWNER, OCCUPANT]
 *                       nullable: true
 *                       description: '귀책사유 (OWNER: 사장님, OCCUPANT: 입실자)'
 *                       example: OCCUPANT
 *                     cancelDate:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
 *                       description: 취소일자(생성일)
 *                       example: '2025-11-06T10:30:00'
 *                     refundMethod:
 *                       type: string
 *                       nullable: true
 *                       description: 환불수단
 *                       example: 계좌이체
 *                     refundPaymentAmount:
 *                       type: integer
 *                       nullable: true
 *                       description: 결제금액 (refund 테이블)
 *                       example: 300000
 *                     proratedRent:
 *                       type: integer
 *                       nullable: true
 *                       description: 일할입실료
 *                       example: 200000
 *                     penalty:
 *                       type: integer
 *                       nullable: true
 *                       description: 위약금
 *                       example: 30000
 *                     totalRefundAmount:
 *                       type: integer
 *                       nullable: true
 *                       description: 총환불금액
 *                       example: 70000
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/data', refundController.getRefundRequestData);

/**
 * @swagger
 * /v1/refund/update:
 *   put:
 *     summary: 환불 요청 정보 업데이트
 *     description: '환불 요청의 상태, 사용기간, 일할입실료, 위약금, 환불총액을 업데이트합니다.'
 *     tags: [환불관리]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - contractId
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [REQUEST, APPROVAL, REJECT, CANCELLATION]
 *                 description: '처리 상태 (REQUEST: 요청, APPROVAL: 승인, REJECT: 반려, CANCELLATION: 취소)'
 *                 example: 'APPROVAL'
 *               usePeriod:
 *                 type: integer
 *                 description: 사용기간 (일수)
 *                 example: 30
 *               useAmt:
 *                 type: integer
 *                 description: 일할입실료
 *                 example: 200000
 *               penalty:
 *                 type: integer
 *                 description: 위약금
 *                 example: 30000
 *               refundAmt:
 *                 type: integer
 *                 description: 환불총액
 *                 example: 70000
 *               contractId:
 *                 type: string
 *                 description: 계약 고유 아이디
 *                 example: 'RCTT0000000001'
 *     responses:
 *       200:
 *         description: 환불 요청 정보 업데이트 성공
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put('/update', refundController.updateRefundRequest);

module.exports = router;
