const express = require('express');
const router = express.Router();

const gosiwonController = require('../controllers/gosiwon');

/**
 * @swagger
 * /v1/gosiwon/info:
 *   post:
 *     summary: 고시원 상세 정보 조회
 *     description: searchType과 searchValue로 고시원 정보를 조회합니다.
 *     tags: [Gosiwon]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - esntID
 *             properties:
 *               esntID:
 *                 type: string
 *                 description: 고시원 고유아이디
 *             example:
 *               esntID: GOSI0000002130
 *     responses:
 *       200:
 *         description: 고시원 정보 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 statusCode:
 *                   type: integer
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/GosiwonInfo'
 *       400:
 *         description: 잘못된 요청
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardError'
 *       404:
 *         description: 데이터를 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardError'
 *       401:
 *         description: 인증 실패
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardError'
 */
router.post('/info', gosiwonController.getGosiwonInfo);

/**
 * @swagger
 * /v1/gosiwon/names:
 *   post:
 *     summary: 고시원 이름 검색
 *     description: 검색어를 포함한 고시원 이름 목록을 반환합니다.
 *     tags: [Gosiwon]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - searchValue
 *             properties:
 *               searchValue:
 *                 type: string
 *                 description: 검색할 이름
 *               limit:
 *                 type: integer
 *                 description: 최대 반환 개수 (기본 10)
 *             example:
 *               searchValue: 성수
 *               limit: 5
 *     responses:
 *       200:
 *         description: 고시원 이름 목록 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 statusCode:
 *                   type: integer
 *                 message:
 *                   type: string
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                       esntID:
 *                         type: string
 *       400:
 *         description: 잘못된 요청
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardError'
 *       401:
 *         description: 인증 실패
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardError'
 */
router.post('/names', gosiwonController.getGosiwonNames);

module.exports = router;

