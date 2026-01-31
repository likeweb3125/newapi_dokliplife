const express = require('express');
const router = express.Router();

const roomController = require('../controllers/room');
const roomCategoryController = require('../controllers/roomCategory');

/**
 * @swagger
 * tags:
 *   name: Room
 *   description: 방 관련 API
 */

/**
 * @swagger
 * tags:
 *   name: 계약현황
 *   description: 계약현황 관리 API
 */

/**
 * @swagger
 * /v1/room/list:
 *   get:
 *     summary: 방 목록 조회
 *     description: 고시원 ID로 방 목록을 조회합니다. roomStatus(방별 최신 레코드), roomSee, roomLike, il_room_reservation 테이블을 조인하여 판매/계약 기간, 상태, 조회수, 좋아요 수, 예약 정보를 포함합니다.
 *     tags: [Room]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: goID
 *         required: true
 *         schema:
 *           type: string
 *         description: 고시원 고유 아이디
 *         example: GOSI0000002130
 *       - in: query
 *         name: roomName
 *         required: false
 *         schema:
 *           type: string
 *         description: 방이름 (선택사항, 부분 일치 검색)
 *         example: 101
 *       - in: query
 *         name: sortBy
 *         required: false
 *         schema:
 *           type: string
 *           enum: [roomName, roomStatus, roomType, winType, rentFee]
 *         description: 정렬 기준 (선택사항, 기본값은 orderNo 오름차순)
 *         example: rentFee
 *     responses:
 *       200:
 *         description: 방 목록 조회 성공
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
 *                   example: 방 목록 조회 성공
 *                 data:
 *                   type: object
 *                   properties:
 *                     gosiwonName:
 *                       type: string
 *                       description: 고시원 이름
 *                       example: '독립생활 고시원'
 *                     rooms:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           esntlId:
 *                             type: string
 *                             description: 방 고유 아이디
 *                           roomType:
 *                             type: string
 *                             description: 방 타입
 *                           roomCategory:
 *                             type: string
 *                             description: 방 카테고리 고유아이디
 *                           roomCategoryName:
 *                             type: string
 *                             description: 방 카테고리명
 *                           availableGender:
 *                             type: string
 *                             enum: [DEFAULT, MALE, FEMALE]
 *                             description: "이용 가능 성별 (DEFAULT: 제한없음, MALE: 남성, FEMALE: 여성)"
 *                           rom_deposit:
 *                             type: number
 *                             description: 보증금(만원 단위)
 *                           monthlyRent:
 *                             type: string
 *                             description: 입실료
 *                           window:
 *                             type: string
 *                             description: 창 타입
 *                           option:
 *                             type: string
 *                             description: 방 옵션
 *                           orderOption:
 *                             type: string
 *                             description: 방 옵션 정렬 값
 *                           roomNumber:
 *                             type: string
 *                             description: 방번호
 *                           floor:
 *                             type: string
 *                             description: 층
 *                           intro:
 *                             type: string
 *                             description: 소개
 *                           empty:
 *                             type: string
 *                             description: 빈방 여부
 *                           status:
 *                             type: string
 *                             description: 방 상태
 *                           description:
 *                             type: string
 *                             description: 방 설명
 *                           top:
 *                             type: string
 *                             description: 상단 표시 여부
 *                           rom_checkout_expected_date:
 *                             type: string
 *                             description: 예정 퇴실일
 *                           startDate:
 *                             type: string
 *                             description: 판매/계약 시작일 (roomStatus 방별 최신 레코드)
 *                           endDate:
 *                             type: string
 *                             description: 판매/계약 종료일 (roomStatus 방별 최신 레코드)
 *                           nowStatus:
 *                             type: string
 *                             description: 방 현재 상태 (roomStatus.status, 예: ON_SALE, IN_USE 등)
 *                           month:
 *                             type: string
 *                             description: 판매/계약 기간 월 수 (roomStatus 기간 기준)
 *                           customerEsntlId:
 *                             type: string
 *                             description: 사용자 고유아이디
 *                           rom_successor_eid:
 *                             type: string
 *                             description: 승계 방 고유아이디
 *                           rom_dp_at:
 *                             type: string
 *                             description: DP방 여부
 *                           deleteYN:
 *                             type: string
 *                             description: 삭제 여부
 *                           see:
 *                             type: integer
 *                             description: 조회수 (roomSee 카운트)
 *                           likes:
 *                             type: integer
 *                             description: 좋아요 수 (roomLike 카운트)
 *                           ror_sn:
 *                             type: string
 *                             description: 예약 고유번호 (il_room_reservation, WAIT 상태만)
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/list', roomController.getRoomList);

/**
 * @swagger
 * /v1/room/dashboardCnt:
 *   get:
 *     summary: roomStatus - 계약현황용 대시보드 집계 조회
 *     description: roomStatus 테이블의 status 별 건수를 반환합니다. 전체, 입금대기중(PENDING), 예약중(RESERVED), 이용중(IN_USE), 체납상태(OVERDUE), 퇴실확정(CHECKOUT_CONFIRMED), 보증금 미납(UNPAID)입니다.
 *     tags: [계약현황]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 대시보드 집계 조회 성공
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
 *                   example: 대시보드 집계 조회 성공
 *                 data:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                       description: 전체 (roomStatus 총 개수)
 *                       example: 500
 *                     pending:
 *                       type: integer
 *                       description: 입금대기중 (status = PENDING)
 *                       example: 10
 *                     reserved:
 *                       type: integer
 *                       description: 예약중 (status = RESERVED)
 *                       example: 20
 *                     inUse:
 *                       type: integer
 *                       description: 이용중 (status = IN_USE)
 *                       example: 300
 *                     overdue:
 *                       type: integer
 *                       description: 체납상태 (status = OVERDUE)
 *                       example: 5
 *                     checkoutConfirmed:
 *                       type: integer
 *                       description: 퇴실확정 (status = CHECKOUT_CONFIRMED)
 *                       example: 100
 *                     unpaid:
 *                       type: integer
 *                       description: 보증금 미납 (status = UNPAID)
 *                       example: 3
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/dashboardCnt', roomController.getDashboardCnt);

/**
 * @swagger
 * /v1/room/info:
 *   get:
 *     summary: 방 상세 정보 조회
 *     description: 방 아이디(esntlID)로 방 정보 전체를 조회합니다.
 *     tags: [Room]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: esntlID
 *         required: true
 *         schema:
 *           type: string
 *         description: 방 고유 아이디
 *         example: ROOM0000022725
 *     responses:
 *       200:
 *         description: 방 정보 조회 성공
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
 *                   example: 방 정보 조회 성공
 *                 data:
 *                   type: object
 *                   properties:
 *                     esntlId:
 *                       type: string
 *                       description: 방 고유 아이디
 *                     gosiwonEsntlId:
 *                       type: string
 *                       description: 고시원 고유 아이디
 *                     roomType:
 *                       type: string
 *                       description: 방 타입
 *                     roomCategory:
 *                       type: string
 *                       description: 방 카테고리
 *                     rom_deposit:
 *                       type: number
 *                       description: 보증금(만원 단위)
 *                     monthlyRent:
 *                       type: string
 *                       description: 입실료
 *                     startDate:
 *                       type: string
 *                       description: 계약 시작일
 *                     endDate:
 *                       type: string
 *                       description: 계약 종료일
 *                     rom_checkout_expected_date:
 *                       type: string
 *                       description: 예정 퇴실일
 *                     window:
 *                       type: string
 *                       description: 창 타입
 *                     option:
 *                       type: string
 *                       description: 방 옵션
 *                     orderOption:
 *                       type: string
 *                       description: 방 옵션 정렬 값
 *                     roomNumber:
 *                       type: string
 *                     floor:
 *                       type: string
 *                     intro:
 *                       type: string
 *                     empty:
 *                       type: string
 *                       description: 빈방 여부
 *                     status:
 *                       type: string
 *                       description: 방 상태
 *                     month:
 *                       type: string
 *                       description: 계약 기간
 *                     description:
 *                       type: string
 *                     top:
 *                       type: string
 *                     youtube:
 *                       type: string
 *                     customerEsntlId:
 *                       type: string
 *                     rom_successor_eid:
 *                       type: string
 *                     rom_dp_at:
 *                       type: string
 *                     deleteYN:
 *                       type: string
 *                     orderNo:
 *                       type: integer
 *                     gsw_deposit:
 *                       type: number
 *                       description: 고시원 보증금
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/info', roomController.getRoomInfo);

/**
 * @swagger
 * /v1/room/create:
 *   post:
 *     summary: 방 정보 등록
 *     description: 새로운 방 정보를 등록합니다.
 *     tags: [Room]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - goID
 *             properties:
 *               goID:
 *                 type: string
 *                 description: 고시원 고유 아이디
 *                 example: GOSI0000002130
 *               roomNumber:
 *                 type: string
 *                 description: 방번호(이름)
 *                 example: 101
 *               roomType:
 *                 type: string
 *                 description: 방타입
 *                 example: 원룸
 *               roomCategory:
 *                 type: string
 *                 description: 방 카테고리
 *               deposit:
 *                 type: integer
 *                 description: 보증금
 *                 example: 500000
 *               monthlyRent:
 *                 type: string
 *                 description: 입실료
 *                 example: 500000
 *               startDate:
 *                 type: string
 *                 description: 입실일
 *                 example: 2024-01-01
 *               endDate:
 *                 type: string
 *                 description: 퇴실일
 *                 example: 2024-12-31
 *               rom_checkout_expected_date:
 *                 type: string
 *                 description: 예정 퇴실일
 *               window:
 *                 type: string
 *                 description: 창타입
 *                 example: 남향
 *               option:
 *                 type: string
 *                 description: 방옵션
 *                 example: 에어컨, 냉장고
 *               orderOption:
 *                 type: string
 *                 description: 방옵션 정렬값
 *               floor:
 *                 type: string
 *                 description: 층수
 *                 example: 3층
 *               intro:
 *                 type: string
 *                 description: 소개
 *               empty:
 *                 type: string
 *                 description: '빈방 여부 (기본값: 1)'
 *                 example: 1
 *               status:
 *                 type: string
 *                 description: '방상태 (기본값: EMPTY)'
 *                 example: EMPTY
 *               month:
 *                 type: string
 *                 description: 월
 *               description:
 *                 type: string
 *                 description: 방설명
 *                 example: 깨끗하고 조용한 방입니다
 *               top:
 *                 type: string
 *                 description: 상단 표시 여부
 *               youtube:
 *                 type: string
 *                 description: VR룸투어 URL
 *                 example: https://youtube.com/watch?v=xxx
 *               customerEsntlId:
 *                 type: string
 *                 description: 사용자 고유아이디
 *               rom_successor_eid:
 *                 type: string
 *                 description: 승계 방 고유아이디
 *               rom_dp_at:
 *                 type: string
 *                 description: DP방 여부
 *               deleteYN:
 *                 type: string
 *                 description: 삭제 여부
 *               orderNo:
 *                 type: integer
 *                 description: '정렬순서 (기본값: 1)'
 *                 example: 1
 *               agreementType:
 *                 type: string
 *                 enum: [GENERAL, GOSIWON, ROOM]
 *                 description: |
 *                   특약타입
 *                   - GENERAL: 독립생활 일반 규정 11항 적용
 *                   - GOSIWON: 현재 고시원 특약사항 적용
 *                   - ROOM: 해당 방만 특약사항 수정
 *                 example: ROOM
 *               agreementContent:
 *                 type: string
 *                 description: 특약내용 (리치 텍스트)
 *                 example: <p>특약 내용입니다.</p>
 *               availableGender:
 *                 type: string
 *                 enum: [DEFAULT, MALE, FEMALE]
 *                 description: 이용 가능 성별 (DEFAULT는 제한없음, MALE는 남성, FEMALE는 여성)
 *                 example: DEFAULT
 *     responses:
 *       200:
 *         description: 방 정보 등록 성공
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
 *                   example: 방 정보 등록 성공
 *                 data:
 *                   type: object
 *                   properties:
 *                     esntlID:
 *                       type: string
 *                       example: ROOM0000022725
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/create', roomController.createRoom);

/**
 * @swagger
 * /v1/room/update:
 *   put:
 *     summary: 방 정보 수정
 *     description: 방 정보를 수정합니다.
 *     tags: [Room]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - esntlID
 *             properties:
 *               esntlID:
 *                 type: string
 *                 description: 수정할 방 고유 아이디
 *                 example: ROOM0000022725
 *               roomNumber:
 *                 type: string
 *                 description: 방번호(이름)
 *                 example: 101
 *               roomType:
 *                 type: string
 *                 description: 방타입
 *                 example: 원룸
 *               deposit:
 *                 type: integer
 *                 description: 보증금
 *                 example: 500000
 *               monthlyRent:
 *                 type: string
 *                 description: 입실료
 *                 example: 500000
 *               startDate:
 *                 type: string
 *                 description: 입실일
 *                 example: 2024-01-01
 *               endDate:
 *                 type: string
 *                 description: 퇴실일
 *                 example: 2024-12-31
 *               window:
 *                 type: string
 *                 description: 창타입
 *                 example: 남향
 *               option:
 *                 type: string
 *                 description: 방옵션
 *                 example: 에어컨, 냉장고
 *               floor:
 *                 type: string
 *                 description: 층수
 *                 example: 3층
 *               intro:
 *                 type: string
 *                 description: 소개
 *               status:
 *                 type: string
 *                 description: 방상태
 *                 example: EMPTY
 *               month:
 *                 type: string
 *                 description: 월
 *               description:
 *                 type: string
 *                 description: 방설명
 *                 example: 깨끗하고 조용한 방입니다
 *               youtube:
 *                 type: string
 *                 description: VR룸투어 URL
 *                 example: https://youtube.com/watch?v=xxx
 *               orderNo:
 *                 type: integer
 *                 description: 정렬순서
 *                 example: 1
 *               agreementType:
 *                 type: string
 *                 enum: [GENERAL, GOSIWON, ROOM]
 *                 description: |
 *                   특약타입
 *                   - GENERAL: 독립생활 일반 규정 11항 적용
 *                   - GOSIWON: 현재 고시원 특약사항 적용
 *                   - ROOM: 해당 방만 특약사항 수정
 *                 example: ROOM
 *               agreementContent:
 *                 type: string
 *                 description: 특약내용 (리치 텍스트)
 *                 example: <p>수정된 특약 내용입니다.</p>
 *               availableGender:
 *                 type: string
 *                 enum: [DEFAULT, MALE, FEMALE]
 *                 description: 이용 가능 성별 (DEFAULT는 제한없음, MALE는 남성, FEMALE는 여성)
 *                 example: DEFAULT
 *     responses:
 *       200:
 *         description: 방 정보 수정 성공
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put('/update', roomController.updateRoom);

/**
 * @swagger
 * /v1/room/agreement:
 *   put:
 *     summary: 방 특약 내역 수정
 *     description: 특정 방의 특약 타입과 특약 내용만 수정합니다.
 *     tags: [Room]
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
 *             properties:
 *               roomEsntlId:
 *                 type: string
 *                 description: 방 고유 아이디
 *                 example: ROOM0000022725
 *               agreementType:
 *                 type: string
 *                 enum: [GENERAL, GOSIWON, ROOM]
 *                 description: '특약 타입 (GENERAL=일반, GOSIWON=고시원, ROOM=방)'
 *                 example: ROOM
 *               agreementContent:
 *                 type: string
 *                 description: 특약 내용
 *                 example: 반려동물 입실 가능, 흡연 가능
 *     responses:
 *       200:
 *         description: 방 특약 내역 수정 성공
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
 *                   example: 방 특약 내역 수정 성공
 *                 data:
 *                   type: object
 *                   properties:
 *                     esntlId:
 *                       type: string
 *                       description: 방 고유 아이디
 *                       example: ROOM0000022725
 *                     agreementType:
 *                       type: string
 *                       description: 특약 타입
 *                       example: ROOM
 *                     agreementContent:
 *                       type: string
 *                       description: 특약 내용
 *                       example: 반려동물 입실 가능, 흡연 가능
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put('/agreement', roomController.updateRoomAgreement);

/**
 * @swagger
 * /v1/room/dp-at:
 *   put:
 *     summary: 방 DP 여부 수정
 *     description: 특정 방의 DP 여부(rom_dp_at)만 수정합니다. N 또는 Y 값만 허용됩니다.
 *     tags: [Room]
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
 *               - rom_dp_at
 *             properties:
 *               roomEsntlId:
 *                 type: string
 *                 description: 방 고유 아이디
 *                 example: ROOM0000022725
 *               rom_dp_at:
 *                 type: string
 *                 enum: [N, Y]
 *                 description: 'DP 방 여부 (N: 일반 방, Y: DP 방)'
 *                 example: Y
 *     responses:
 *       200:
 *         description: 방 DP 여부 수정 성공
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
 *                   example: 방 DP 여부 수정 성공
 *                 data:
 *                   type: object
 *                   properties:
 *                     esntlId:
 *                       type: string
 *                       description: 방 고유 아이디
 *                       example: ROOM0000022725
 *                     rom_dp_at:
 *                       type: string
 *                       description: DP 방 여부
 *                       example: Y
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put('/dp-at', roomController.updateRoomDpAt);

/**
 * @swagger
 * /v1/room/reserveCancel:
 *   post:
 *     summary: 결제 요청 취소
 *     description: 방 예약의 결제 요청을 취소합니다. isReserve가 Y이면 예약만 취소하고, 아니면 예약 취소 후 방 상태도 업데이트합니다.
 *     tags: [Room]
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
 *             properties:
 *               roomEsntlId:
 *                 type: string
 *                 description: 방 고유 아이디
 *                 example: ROOM0000022725
 *               isReserve:
 *                 type: string
 *                 enum: [Y, N]
 *                 description: '예약만 취소 여부 (Y: 예약만 취소, N 또는 미입력: 예약 취소 + 방 상태 업데이트)'
 *                 example: Y
 *     responses:
 *       200:
 *         description: 결제 요청 취소 성공
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
 *                   example: 결제 요청 취소 성공
 *                 data:
 *                   type: object
 *                   properties:
 *                     roomEsntlId:
 *                       type: string
 *                       description: 방 고유 아이디
 *                       example: ROOM0000022725
 *                     isReserve:
 *                       type: boolean
 *                       description: 예약만 취소 여부
 *                       example: true
 *                     roomStatus:
 *                       type: string
 *                       description: 방 상태 (isReserve가 false인 경우)
 *                       example: EMPTY
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/reserveCancel', roomController.reserveCancel);

/**
 * @swagger
 * /v1/room/delete:
 *   delete:
 *     summary: 방 정보 삭제
 *     description: 방 정보를 삭제합니다.
 *     tags: [Room]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: esntlID
 *         required: true
 *         schema:
 *           type: string
 *         description: 삭제할 방 고유 아이디
 *         example: ROOM0000022725
 *     responses:
 *       200:
 *         description: 방 정보 삭제 성공
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete('/delete', roomController.deleteRoom);

/**
 * @swagger
 * /v1/room/category/list:
 *   get:
 *     summary: 방 카테고리 목록 조회
 *     description: 고시원 ID(goID)로 방 카테고리 목록과 옵션을 조회합니다.
 *     tags: [Room]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: goID
 *         required: true
 *         schema:
 *           type: string
 *         description: 고시원 고유 아이디
 *         example: GOSI0000002130
 *     responses:
 *       200:
 *         description: 카테고리 목록 조회 성공
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/category/list', roomCategoryController.getCategoryList);

/**
 * @swagger
 * /v1/room/category/create:
 *   post:
 *     summary: 방 카테고리 등록
 *     description: 고시원 카테고리를 등록하고 옵션을 함께 저장합니다.
 *     tags: [Room]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - goID
 *               - categoryName
 *               - basePrice
 *             properties:
 *               goID:
 *                 type: string
 *                 example: GOSI0000002130
 *               categoryName:
 *                 type: string
 *                 example: 트리니티룸
 *               basePrice:
 *                 type: integer
 *                 description: 정가 (원 단위)
 *                 example: 85000
 *               memo:
 *                 type: string
 *               options:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     optionName:
 *                       type: string
 *                       example: 정가(2인)
 *                     optionAmount:
 *                       type: number
 *                       format: float
 *                       example: 100
 *                     sortOrder:
 *                       type: integer
 *                       example: 1
 *     responses:
 *       200:
 *         description: 카테고리 등록 성공
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/category/create', roomCategoryController.createCategory);

/**
 * @swagger
 * /v1/room/category/update:
 *   put:
 *     summary: 방 카테고리 수정
 *     description: 카테고리 정보를 수정하고 옵션을 추가/수정합니다. 옵션의 esntlId가 제공되면 수정, 제공되지 않으면 추가됩니다. isDeleted true일 경우 삭제됩니다.
 *     tags: [Room]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - categoryID
 *             properties:
 *               categoryID:
 *                 type: string
 *                 description: 수정할 카테고리 ID
 *                 example: CATE0000000001
 *               categoryName:
 *                 type: string
 *                 description: 카테고리명
 *                 example: 라이크웹룸
 *               basePrice:
 *                 type: integer
 *                 example: 90000
 *               memo:
 *                 type: string
 *               options:
 *                 type: array
 *                 description: 옵션 배열 (isDeleted=true일 경우 삭제)
 *                 items:
 *                   type: object
 *                   properties:
 *                     esntlID:
 *                       type: string
 *                       description: 기존 옵션 ID (신규는 생략)
 *                       example: COPT0000000001
 *                     optionName:
 *                       type: string
 *                       example: 정가(1인)
 *                     optionAmount:
 *                       type: number
 *                       format: float
 *                       example: 50
 *                     sortOrder:
 *                       type: integer
 *                       example: 1
 *                     isDeleted:
 *                       type: boolean
 *                       description: true일 경우 삭제
 *                       example: false
 *     responses:
 *       200:
 *         description: 카테고리 수정 성공
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put('/category/update', roomCategoryController.updateCategory);

/**
 * @swagger
 * /v1/room/category/delete:
 *   delete:
 *     summary: 방 카테고리 삭제
 *     description: 카테고리를 삭제하면 연결된 옵션도 함께 삭제됩니다.
 *     tags: [Room]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: categoryID
 *         required: true
 *         schema:
 *           type: string
 *         description: 삭제할 카테고리 ID
 *         example: RCAT1700000000000
 *     responses:
 *       200:
 *         description: 카테고리 삭제 성공
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete('/category/delete', roomCategoryController.deleteCategory);

/**
 * @swagger
 * /v1/room/reserve:
 *   post:
 *     summary: 방 예약 및 결제 요청
 *     description: 방 예약을 등록하고 결제 요청을 발송합니다. 예약일이 오늘이 아니면 예약만 하고, 오늘이면 즉시 알림톡을 발송합니다.
 *     tags: [Room]
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
 *               - deposit
 *               - receiver
 *               - checkInDate
 *               - rorPeriod
 *             properties:
 *               roomEsntlId:
 *                 type: string
 *                 description: 방 고유아이디
 *                 example: ROOM0000000001
 *               deposit:
 *                 type: integer
 *                 description: 보증금 금액
 *                 example: 500000
 *               receiver:
 *                 type: string
 *                 description: 수신자 전화번호
 *                 example: 01012345678
 *               checkInDate:
 *                 type: string
 *                 format: date
 *                 description: 입실 예정일 (YYYY-MM-DD)
 *                 example: 2025-12-20
 *               paymentType:
 *                 type: string
 *                 enum: [accountPayment, cardPayment]
 *                 description: '결제 유형 (accountPayment: 계좌 결제, cardPayment: 카드 결제)'
 *                 example: accountPayment
 *               rorPeriod:
 *                 type: string
 *                 enum: [MONTH, PART]
 *                 description: '결제요청 계약기간 (MONTH: 월 단위, PART: 부분 결제)'
 *                 example: MONTH
 *               rorContractStartDate:
 *                 type: string
 *                 format: date
 *                 description: '부분 결제의 시작날짜 (rorPeriod가 PART인 경우 필수)'
 *                 example: 2025-12-20
 *               rorContractEndDate:
 *                 type: string
 *                 format: date
 *                 description: '부분 결제의 종료날짜 (rorPeriod가 PART인 경우 필수)'
 *                 example: 2026-01-20
 *               rorPayMethod:
 *                 type: string
 *                 enum: [APP, ACCOUNT]
 *                 description: '결제 방식 (APP: 앱 결제, ACCOUNT: 계좌 결제)'
 *                 example: ACCOUNT
 *               memo:
 *                 type: string
 *                 description: 메모 내용
 *                 example: 계약 관련 특이사항 메모
 *     responses:
 *       200:
 *         description: 예약 및 결제 요청 성공
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
 *                   example: 결제 요청이 발송되었습니다.
 *                 data:
 *                   type: object
 *                   properties:
 *                     reservationId:
 *                       type: string
 *                       description: 예약 고유번호
 *                     gsw_name:
 *                       type: string
 *                       description: 고시원명
 *                     rom_name:
 *                       type: string
 *                       description: 방번호
 *                     monthlyRent:
 *                       type: string
 *                       description: 월세 (포맷된 금액)
 *                     contractExpDateTime:
 *                       type: string
 *                       description: 계약 만료일시
 *                     req_type:
 *                       type: string
 *                       enum: [NEW, EXTENSION]
 *                       description: 요청 유형
 *                     cus_name:
 *                       type: string
 *                       description: 고객명
 *                     gosiwon_receiver:
 *                       type: string
 *                       description: 고시원 수신자 전화번호
 *                     rom_eid:
 *                       type: string
 *                       description: 방 고유아이디
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/reserve', roomController.roomReserve);

/**
 * @swagger
 * /v1/room/roomSell/start:
 *   post:
 *     summary: 방 판매 시작
 *     description: 선택한 방들의 판매를 시작합니다. roomStatus 테이블에 판매 정보를 저장합니다.sameAsCheckinInfo true 면 판개기간과 동일, 방아이디를 콤마로 구분하여 여러개 입력 가능
 *     tags: [Room]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - rooms
 *             properties:
 *               rooms:
 *                 type: array
 *                 description: 판매를 시작할 방 목록
 *                 items:
 *                   type: object
 *                   required:
 *                     - roomId
 *                     - statusStartDate
 *                     - statusEndDate
 *                     - sameAsCheckinInfo
 *                   properties:
 *                     roomId:
 *                       type: string
 *                       description: 방 고유아이디
 *                       example: ROOM0000000001
 *                     statusStartDate:
 *                       type: string
 *                       format: date-time
 *                       description: 판매 시작일
 *                       example: 2025-12-20 00:00:00
 *                     statusEndDate:
 *                       type: string
 *                       format: date-time
 *                       description: 판매 종료일
 *                       example: 2026-01-20 00:00:00
 *                     sameAsCheckinInfo:
 *                       type: boolean
 *                       description: 입실 가능 기간을 판매 기간과 동일하게 설정할지 여부
 *                       example: true
 *                     etcStartDate:
 *                       type: string
 *                       format: date-time
 *                       description: 입실 가능 시작일 (sameAsCheckinInfo가 false인 경우 필수)
 *                       example: 2025-12-22 00:00:00
 *                     etcEndDate:
 *                       type: string
 *                       format: date-time
 *                       description: 입실 가능 종료일 (sameAsCheckinInfo가 false인 경우 필수)
 *                       example: 2026-01-22 00:00:00
 *     responses:
 *       200:
 *         description: 방 판매 시작 성공
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
 *                   example: 방 판매 시작이 완료되었습니다.
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalCount:
 *                       type: integer
 *                       description: 처리된 방 개수
 *                       example: 2
 *                     results:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           roomId:
 *                             type: string
 *                             description: 방 고유아이디
 *                           action:
 *                             type: string
 *                             enum: [created, updated]
 *                             description: 수행된 작업 (created는 새로 생성, updated는 기존 레코드 업데이트)
 *                           esntlId:
 *                             type: string
 *                             description: roomStatus 고유아이디
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/roomSell/start', roomController.startRoomSell);

/**
 * @swagger
 * /v1/room/free/list:
 *   get:
 *     summary: 빈 방 목록 조회 (방이동시 사용)
 *     description: 고시원 ID로 roomStatus 테이블에서 상태가 ON_SALE, BEFORE_SALE인 방들의 목록을 조회합니다. room 테이블과 join하여 방 정보를 포함합니다.
 *     tags: [계약현황]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: goID
 *         required: true
 *         schema:
 *           type: string
 *         description: 고시원 고유 아이디
 *         example: GOSI0000002130
 *     responses:
 *       200:
 *         description: 빈 방 목록 조회 성공
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
 *                   example: 빈 방 목록 조회 성공
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       esntlId:
 *                         type: string
 *                         description: 방 고유 아이디
 *                       gosiwonEsntlId:
 *                         type: string
 *                         description: 고시원 고유 아이디
 *                       roomType:
 *                         type: string
 *                         description: 방 타입
 *                       roomCategory:
 *                         type: string
 *                         description: 방 카테고리
 *                       deposit:
 *                         type: integer
 *                         description: 보증금
 *                       monthlyRent:
 *                         type: string
 *                         description: 입실료
 *                       roomNumber:
 *                         type: string
 *                         description: 방번호
 *                       floor:
 *                         type: string
 *                         description: 층
 *                       status:
 *                         type: string
 *                         description: 방 상태
 *                       roomStatusId:
 *                         type: string
 *                         description: roomStatus 고유 아이디
 *                       roomStatusStatus:
 *                         type: string
 *                         enum: [ON_SALE, BEFORE_SALE]
 *                         description: roomStatus 상태
 *                       statusStartDate:
 *                         type: string
 *                         format: date-time
 *                         description: 판매 시작일
 *                       statusEndDate:
 *                         type: string
 *                         format: date-time
 *                         description: 판매 종료일
 *                       etcStartDate:
 *                         type: string
 *                         format: date-time
 *                         description: 입실 가능 시작일
 *                       etcEndDate:
 *                         type: string
 *                         format: date-time
 *                         description: 입실 가능 종료일
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/free/list', roomController.getFreeRoomList);

module.exports = router;

