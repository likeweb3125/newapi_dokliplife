const express = require('express');
const router = express.Router();

const memoController = require('../controllers/memo');

/**
 * @swagger
 * tags:
 *   name: Memo
 *   description: 범용 메모 관리 API
 */

/**
 * @swagger
 * /v1/memo/list:
 *   get:
 *     summary: 메모 목록 조회
 *     description: 다양한 필터 조건으로 메모 목록을 조회합니다. 페이징을 지원합니다.
 *     tags: [Memo]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: gosiwonEsntlId
 *         required: false
 *         schema:
 *           type: string
 *         description: 고시원 고유아이디
 *       - in: query
 *         name: roomEsntlId
 *         required: false
 *         schema:
 *           type: string
 *         description: 방 고유아이디
 *       - in: query
 *         name: contractEsntlId
 *         required: false
 *         schema:
 *           type: string
 *         description: 방계약 고유아이디
 *       - in: query
 *         name: depositEsntlId
 *         required: false
 *         schema:
 *           type: string
 *         description: 보증금 고유아이디
 *       - in: query
 *         name: etcEsntlId
 *         required: false
 *         schema:
 *           type: string
 *         description: 기타 고유아이디
 *       - in: query
 *         name: category
 *         required: false
 *         schema:
 *           type: string
 *           enum: [GOSIWON, ROOM, CONTRACT, DEPOSIT, CUSTOMER, ETC]
 *         description: 메모 카테고리
 *       - in: query
 *         name: priority
 *         required: false
 *         schema:
 *           type: string
 *           enum: [LOW, NORMAL, HIGH, URGENT]
 *         description: 중요도
 *       - in: query
 *         name: writerType
 *         required: false
 *         schema:
 *           type: string
 *           enum: [ADMIN, PARTNER]
 *         description: 작성자 타입
 *       - in: query
 *         name: writerAdminId
 *         required: false
 *         schema:
 *           type: string
 *         description: 작성한 관리자 ID
 *       - in: query
 *         name: writerCustomerId
 *         required: false
 *         schema:
 *           type: string
 *         description: 작성한 고객 고유아이디
 *       - in: query
 *         name: isPinned
 *         required: false
 *         schema:
 *           type: boolean
 *         description: 고정 여부
 *       - in: query
 *         name: search
 *         required: false
 *         schema:
 *           type: string
 *         description: 검색어 (메모 내용, 태그 검색)
 *       - in: query
 *         name: hideDeleted
 *         required: false
 *         schema:
 *           type: boolean
 *           default: true
 *         description: 삭제된 항목 숨기기
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
 *       - in: query
 *         name: sortBy
 *         required: false
 *         schema:
 *           type: string
 *           default: createdAt
 *         description: 정렬 기준
 *       - in: query
 *         name: sortOrder
 *         required: false
 *         schema:
 *           type: string
 *           enum: [ASC, DESC]
 *           default: DESC
 *         description: 정렬 순서
 *     responses:
 *       200:
 *         description: 메모 목록 조회 성공
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/list', memoController.getMemoList);

/**
 * @swagger
 * /v1/memo:
 *   post:
 *     summary: 메모 생성
 *     description: '새로운 메모를 생성합니다. ID 규칙: roomEsntlId가 있으면 gosiwonEsntlId 필수. contractEsntlId가 있으면 gosiwonEsntlId, roomEsntlId 필수. depositEsntlId가 있으면 gosiwonEsntlId, roomEsntlId, contractEsntlId 필수.'
 *     tags: [Memo]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - memo
 *             properties:
 *               gosiwonEsntlId:
 *                 type: string
 *                 description: 고시원 고유아이디
 *               roomEsntlId:
 *                 type: string
 *                 description: 방 고유아이디
 *               contractEsntlId:
 *                 type: string
 *                 description: 방계약 고유아이디
 *               depositEsntlId:
 *                 type: string
 *                 description: 보증금 고유아이디
 *               etcEsntlId:
 *                 type: string
 *                 description: 기타 고유아이디
 *               memo:
 *                 type: string
 *                 description: 메모 내용 (필수)
 *               category:
 *                 type: string
 *                 enum: [GOSIWON, ROOM, CONTRACT, DEPOSIT, CUSTOMER, ETC]
 *                 description: 메모 카테고리
 *               priority:
 *                 type: string
 *                 enum: [LOW, NORMAL, HIGH, URGENT]
 *                 default: NORMAL
 *                 description: 중요도
 *               publicRange:
 *                 type: integer
 *                 enum: [0, 1]
 *                 default: 0
 *                 description: '공개범위 (0: 비공개, 1: 공개)'
 *               writerCustomerId:
 *                 type: string
 *                 description: 작성한 고객 고유아이디
 *               writerType:
 *                 type: string
 *                 enum: [ADMIN, PARTNER]
 *                 default: ADMIN
 *                 description: 작성자 타입
 *               tags:
 *                 type: string
 *                 description: 태그 (쉼표로 구분)
 *               isPinned:
 *                 type: integer
 *                 enum: [0, 1]
 *                 default: 0
 *                 description: '고정 여부 (0: 일반, 1: 고정)'
 *     responses:
 *       201:
 *         description: 메모 생성 성공
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/', memoController.createMemo);

/**
 * @swagger
 * /v1/memo/{memoId}:
 *   get:
 *     summary: 메모 상세 조회
 *     description: 메모 ID로 메모 상세 정보를 조회합니다.
 *     tags: [Memo]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: memoId
 *         required: true
 *         schema:
 *           type: string
 *         description: 메모 고유아이디
 *     responses:
 *       200:
 *         description: 메모 상세 조회 성공
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/:memoId', memoController.getMemoDetail);

/**
 * @swagger
 * /v1/memo/{memoId}:
 *   put:
 *     summary: 메모 수정
 *     description: '메모 정보를 수정합니다. ID 규칙: roomEsntlId가 있으면 gosiwonEsntlId 필수. contractEsntlId가 있으면 gosiwonEsntlId, roomEsntlId 필수. depositEsntlId가 있으면 gosiwonEsntlId, roomEsntlId, contractEsntlId 필수.'
 *     tags: [Memo]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: memoId
 *         required: true
 *         schema:
 *           type: string
 *         description: 메모 고유아이디
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               memo:
 *                 type: string
 *                 description: 메모 내용
 *               category:
 *                 type: string
 *                 enum: [GOSIWON, ROOM, CONTRACT, DEPOSIT, CUSTOMER, ETC]
 *                 description: 메모 카테고리
 *               priority:
 *                 type: string
 *                 enum: [LOW, NORMAL, HIGH, URGENT]
 *                 description: 중요도
 *               publicRange:
 *                 type: integer
 *                 enum: [0, 1]
 *                 description: '공개범위 (0: 비공개, 1: 공개)'
 *               tags:
 *                 type: string
 *                 description: 태그 (쉼표로 구분)
 *               isPinned:
 *                 type: integer
 *                 enum: [0, 1]
 *                 description: '고정 여부 (0: 일반, 1: 고정)'
 *     responses:
 *       200:
 *         description: 메모 수정 성공
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put('/:memoId', memoController.updateMemo);

/**
 * @swagger
 * /v1/memo/{memoId}:
 *   delete:
 *     summary: 메모 삭제
 *     description: 메모를 삭제합니다 (소프트 삭제).
 *     tags: [Memo]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: memoId
 *         required: true
 *         schema:
 *           type: string
 *         description: 메모 고유아이디
 *     responses:
 *       200:
 *         description: 메모 삭제 성공
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete('/:memoId', memoController.deleteMemo);

module.exports = router;

