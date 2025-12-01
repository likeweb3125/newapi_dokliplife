const express = require('express');
const router = express.Router();

const gosiwonController = require('../controllers/gosiwon');

/**
 * @swagger
 * /v1/gosiwon/info:
 *   get:
 *     summary: 고시원 상세 정보 조회
 *     description: esntlId로 고시원 정보를 조회합니다.
 *     tags: [Gosiwon]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: esntlId
 *         required: true
 *         schema:
 *           type: string
 *         description: 고시원 고유아이디
 *         example: GOSI0000002130
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
router.get('/info', gosiwonController.getGosiwonInfo);

/**
 * @swagger
 * /v1/gosiwon/names:
 *   get:
 *     summary: 고시원 이름 검색
 *     description: 검색어를 포함한 고시원 이름 목록을 반환합니다.
 *     tags: [Gosiwon]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: searchValue
 *         required: true
 *         schema:
 *           type: string
 *         description: 검색할 이름
 *         example: 성수
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *         description: 최대 반환 개수 (기본 10)
 *         example: 5
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
 *                       esntlId:
 *                         type: string
 *                       address:
 *                         type: string
 *                         description: 고시원 주소
 *                       isControlled:
 *                         type: string
 *                         description: 관제 여부 (관제 또는 빈 문자열)
 *                         example: 관제
 *                       deposit:
 *                         type: string
 *                         description: 보증급 관리 여부 (하드코딩)
 *                         example: 보증급 관리
 *                       settle:
 *                         type: string
 *                         description: 정산 지급 여부 (하드코딩)
 *                         example: 정산지급
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
router.get('/names', gosiwonController.getGosiwonNames);

/**
 * @swagger
 * /v1/gosiwon/favorite:
 *   patch:
 *     summary: 고시원 즐겨찾기 토글
 *     description: 고시원의 즐겨찾기 상태를 토글합니다. 체크박스 방식으로 사용됩니다.
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
 *               - esntlId
 *             properties:
 *               esntlId:
 *                 type: string
 *                 description: 고시원 고유아이디
 *             example:
 *               esntlId: GOSI0000002130
 *     responses:
 *       200:
 *         description: 즐겨찾기 토글 성공
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
 *                   type: object
 *                   properties:
 *                     esntlId:
 *                       type: string
 *                     name:
 *                       type: string
 *                     isFavorite:
 *                       type: boolean
 *                       description: 즐겨찾기 여부 (true=즐겨찾기, false=일반)
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
router.patch('/favorite', gosiwonController.toggleFavorite);

module.exports = router;

