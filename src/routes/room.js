const express = require('express');
const router = express.Router();

const roomController = require('../controllers/room');
const roomCategoryController = require('../controllers/roomCategory');
const roomMemoController = require('../controllers/roomMemo');

/**
 * @swagger
 * tags:
 *   name: Room
 *   description: 방 관련 API
 */

/**
 * @swagger
 * /v1/room/list:
 *   get:
 *     summary: 방 목록 조회
 *     description: 고시원 ID로 방 목록을 조회합니다. roomContract, roomSee, roomLike, il_room_reservation 테이블을 조인하여 계약 정보, 조회수, 좋아요 수, 예약 정보를 포함합니다.
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
 *       - in: query
 *         name: contractStatus
 *         required: false
 *         schema:
 *           type: string
 *         description: 계약 상태 필터 (선택사항, roomContract 테이블의 status 필터링)
 *         example: ACTIVE
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
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       esntlId:
 *                         type: string
 *                         description: 방 고유 아이디
 *                       roomType:
 *                         type: string
 *                         description: 방 타입
 *                       roomCategory:
 *                         type: string
 *                         description: 방 카테고리
 *                       rom_deposit:
 *                         type: number
 *                         description: 보증금(만원 단위)
 *                       monthlyRent:
 *                         type: string
 *                         description: 입실료
 *                       window:
 *                         type: string
 *                         description: 창 타입
 *                       option:
 *                         type: string
 *                         description: 방 옵션
 *                       orderOption:
 *                         type: string
 *                         description: 방 옵션 정렬 값
 *                       roomNumber:
 *                         type: string
 *                         description: 방번호
 *                       floor:
 *                         type: string
 *                         description: 층
 *                       intro:
 *                         type: string
 *                         description: 소개
 *                       empty:
 *                         type: string
 *                         description: 빈방 여부
 *                       status:
 *                         type: string
 *                         description: 방 상태
 *                       description:
 *                         type: string
 *                         description: 방 설명
 *                       top:
 *                         type: string
 *                         description: 상단 표시 여부
 *                       rom_checkout_expected_date:
 *                         type: string
 *                         description: 예정 퇴실일
 *                       startDate:
 *                         type: string
 *                         description: 계약 시작일 (roomContract)
 *                       endDate:
 *                         type: string
 *                         description: 계약 종료일 (roomContract)
 *                       month:
 *                         type: string
 *                         description: 계약 기간 (roomContract)
 *                       customerEsntlId:
 *                         type: string
 *                         description: 사용자 고유아이디
 *                       rom_successor_eid:
 *                         type: string
 *                         description: 승계 방 고유아이디
 *                       rom_dp_at:
 *                         type: string
 *                         description: DP방 여부
 *                       deleteYN:
 *                         type: string
 *                         description: 삭제 여부
 *                       see:
 *                         type: integer
 *                         description: 조회수 (roomSee 카운트)
 *                       likes:
 *                         type: integer
 *                         description: 좋아요 수 (roomLike 카운트)
 *                       ror_sn:
 *                         type: string
 *                         description: 예약 고유번호 (il_room_reservation, WAIT 상태만)
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
 * /v1/room/memo/list:
 *   get:
 *     summary: 방 메모 목록 조회
 *     description: 방 ID로 해당 방의 메모 목록을 조회합니다.
 *     tags: [Room]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: roomEsntlId
 *         required: true
 *         schema:
 *           type: string
 *         description: 방 고유 아이디
 *         example: ROOM0000022725
 *     responses:
 *       200:
 *         description: 방 메모 목록 조회 성공
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
 *                   example: 방 메모 목록 조회 성공
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       memoID:
 *                         type: string
 *                         example: RMEM000000001
 *                       roomEsntlId:
 *                         type: string
 *                         example: ROOM0000022725
 *                       memo:
 *                         type: string
 *                         example: 방 상태 양호
 *                       publicRange:
 *                         type: integer
 *                         example: 0
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/memo/list', roomMemoController.getRoomMemoList);

/**
 * @swagger
 * /v1/room/memo/info:
 *   get:
 *     summary: 방 메모 상세 조회
 *     description: 메모 ID로 방 메모 상세 정보를 조회합니다.
 *     tags: [Room]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: memoID
 *         required: true
 *         schema:
 *           type: string
 *         description: 방 메모 고유 아이디
 *         example: RMEM000000001
 *     responses:
 *       200:
 *         description: 방 메모 정보 조회 성공
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
 *                   example: 방 메모 정보 조회 성공
 *                 data:
 *                   type: object
 *                   properties:
 *                     memoID:
 *                       type: string
 *                       example: RMEM000000001
 *                     roomEsntlId:
 *                       type: string
 *                       example: ROOM0000022725
 *                     memo:
 *                       type: string
 *                       example: 방 상태 양호
 *                     publicRange:
 *                       type: integer
 *                       example: 0
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/memo/info', roomMemoController.getRoomMemoInfo);

/**
 * @swagger
 * /v1/room/memo/create:
 *   post:
 *     summary: 방 메모 등록
 *     description: 방에 메모를 등록합니다.
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
 *               memo:
 *                 type: string
 *                 description: 메모내용
 *                 example: 방 상태 양호, 청소 완료
 *               publicRange:
 *                 type: integer
 *                 description: '공개범위 (0: 비공개, 1: 공개)'
 *                 example: 0
 *     responses:
 *       200:
 *         description: 방 메모 등록 성공
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
 *                   example: 방 메모 등록 성공
 *                 data:
 *                   type: object
 *                   properties:
 *                     memoID:
 *                       type: string
 *                       example: RMEM000000001
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/memo/create', roomMemoController.createRoomMemo);

/**
 * @swagger
 * /v1/room/memo/update:
 *   put:
 *     summary: 방 메모 수정
 *     description: 방 메모 정보를 수정합니다.
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
 *               - memoID
 *             properties:
 *               memoID:
 *                 type: string
 *                 description: 방 메모 고유 아이디
 *                 example: RMEM000000001
 *               memo:
 *                 type: string
 *                 description: 메모내용
 *                 example: 방 상태 양호, 청소 완료
 *               publicRange:
 *                 type: integer
 *                 description: '공개범위 (0: 비공개, 1: 공개)'
 *                 example: 0
 *     responses:
 *       200:
 *         description: 방 메모 수정 성공
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put('/memo/update', roomMemoController.updateRoomMemo);

/**
 * @swagger
 * /v1/room/memo/delete:
 *   delete:
 *     summary: 방 메모 삭제
 *     description: 방 메모를 삭제합니다.
 *     tags: [Room]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: memoID
 *         required: true
 *         schema:
 *           type: string
 *         description: 삭제할 방 메모 고유 아이디
 *         example: RMEM000000001
 *     responses:
 *       200:
 *         description: 방 메모 삭제 성공
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete('/memo/delete', roomMemoController.deleteRoomMemo);

module.exports = router;

