const express = require('express');
const router = express.Router();

const roomController = require('../controllers/room');

/**
 * @swagger
 * tags:
 *   name: Room
 *   description: 방 관련 API
 */

/**
 * @swagger
 * /v1/room/list:
 *   post:
 *     summary: 방 목록 조회
 *     description: 고시원 ID로 방 목록을 조회합니다. roomName이 제공되면 추가 필터링됩니다.
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
 *                 description: 고시원 고유 아이디
 *                 example: GOSI0000002130
 *               roomName:
 *                 type: string
 *                 description: 방이름 (선택사항, 부분 일치 검색)
 *                 example: 101
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
 *                     description: 방 정보 전체
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/list', roomController.getRoomList);

module.exports = router;

