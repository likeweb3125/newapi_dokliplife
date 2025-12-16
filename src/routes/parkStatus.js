const express = require('express');
const router = express.Router();

const parkStatusController = require('../controllers/parkStatus');

/**
 * @swagger
 * tags:
 *   name: ParkStatus
 *   description: 주차 상태 관리 API
 */

/**
 * @swagger
 * /v1/parkStatus/list:
 *   get:
 *     summary: 주차 상태 목록 조회
 *     description: 다양한 필터 조건으로 주차 상태 목록을 조회합니다. 페이징을 지원합니다.
 *     tags: [ParkStatus]
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
 *         name: contractEsntlId
 *         required: false
 *         schema:
 *           type: string
 *         description: 방계약 고유아이디
 *       - in: query
 *         name: customerEsntlId
 *         required: false
 *         schema:
 *           type: string
 *         description: 고객 고유아이디
 *       - in: query
 *         name: status
 *         required: false
 *         schema:
 *           type: string
 *           enum: [AVAILABLE, IN_USE, RESERVED, EXPIRED]
 *         description: 주차 상태
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
 *         description: 주차 상태 목록 조회 성공
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/list', parkStatusController.getParkStatusList);

/**
 * @swagger
 * /v1/parkStatus:
 *   post:
 *     summary: 주차 상태 생성
 *     description: 새로운 주차 상태를 생성합니다.
 *     tags: [ParkStatus]
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
 *                 description: 고시원 고유아이디 (필수)
 *               contractEsntlId:
 *                 type: string
 *                 description: 방계약 고유아이디
 *               customerEsntlId:
 *                 type: string
 *                 description: 고객 고유아이디
 *               status:
 *                 type: string
 *                 enum: [AVAILABLE, IN_USE, RESERVED, EXPIRED]
 *                 default: AVAILABLE
 *                 description: 주차 상태
 *               useStartDate:
 *                 type: string
 *                 format: date
 *                 description: 사용 시작일 (YYYY-MM-DD)
 *               useEndDate:
 *                 type: string
 *                 format: date
 *                 description: 사용 종료일 (YYYY-MM-DD)
 *     responses:
 *       201:
 *         description: 주차 상태 생성 성공
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/', parkStatusController.createParkStatus);

/**
 * @swagger
 * /v1/parkStatus/{parkStatusId}:
 *   get:
 *     summary: 주차 상태 상세 조회
 *     description: 주차 상태 ID로 주차 상태 상세 정보를 조회합니다.
 *     tags: [ParkStatus]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: parkStatusId
 *         required: true
 *         schema:
 *           type: string
 *         description: 주차 상태 고유아이디
 *     responses:
 *       200:
 *         description: 주차 상태 상세 조회 성공
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/:parkStatusId', parkStatusController.getParkStatusDetail);

/**
 * @swagger
 * /v1/parkStatus/{parkStatusId}:
 *   put:
 *     summary: 주차 상태 수정
 *     description: 주차 상태 정보를 수정합니다.
 *     tags: [ParkStatus]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: parkStatusId
 *         required: true
 *         schema:
 *           type: string
 *         description: 주차 상태 고유아이디
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               gosiwonEsntlId:
 *                 type: string
 *                 description: 고시원 고유아이디
 *               contractEsntlId:
 *                 type: string
 *                 description: 방계약 고유아이디
 *               customerEsntlId:
 *                 type: string
 *                 description: 고객 고유아이디
 *               status:
 *                 type: string
 *                 enum: [AVAILABLE, IN_USE, RESERVED, EXPIRED]
 *                 description: 주차 상태
 *               useStartDate:
 *                 type: string
 *                 format: date
 *                 description: 사용 시작일 (YYYY-MM-DD)
 *               useEndDate:
 *                 type: string
 *                 format: date
 *                 description: 사용 종료일 (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: 주차 상태 수정 성공
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put('/:parkStatusId', parkStatusController.updateParkStatus);

/**
 * @swagger
 * /v1/parkStatus/{parkStatusId}:
 *   delete:
 *     summary: 주차 상태 삭제
 *     description: 주차 상태를 삭제합니다 (소프트 삭제).
 *     tags: [ParkStatus]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: parkStatusId
 *         required: true
 *         schema:
 *           type: string
 *         description: 주차 상태 고유아이디
 *     responses:
 *       200:
 *         description: 주차 상태 삭제 성공
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete('/:parkStatusId', parkStatusController.deleteParkStatus);

module.exports = router;
