const express = require('express');
const router = express.Router();

const messageController = require('../controllers/message');

/**
 * @swagger
 * /v1/message/send:
 *   post:
 *     summary: 문자 발송 (Aligo)
 *     description: Authorization 토큰이 필요한 관리자/파트너용 문자 발송 API입니다.
 *     tags: [Message]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - receiver
 *               - message
 *             properties:
 *               receiver:
 *                 type: string
 *                 description: 수신자 번호 (여러 명일 경우 콤마로 구분)
 *                 example: "01012345678,01098765432"
 *               message:
 *                 type: string
 *                 description: 문자 내용
 *                 example: "입실 안내 메시지입니다."
 *               title:
 *                 type: string
 *                 description: 문자 제목 (LMS/MMS에서 사용, SMS는 무시)
 *                 example: "고시원 안내"
 *               gosiwonEsntlId:
 *                 type: string
 *                 description: 고시원 ID (이력 저장용)
 *                 example: GOSI0000000199
 *     responses:
 *       200:
 *         description: 문자 발송 성공
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
 *                     result:
 *                       type: object
 *                       description: 알리고 API 응답
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/send', messageController.sendSMS);

/**
 * @swagger
 * /v1/message/history:
 *   get:
 *     summary: 발송 메시지 리스트
 *     description: messageSmsHistory 테이블에서 발송한 메시지 이력을 페이징하여 조회합니다.
 *     tags: [Message]
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *         description: 한 페이지에 보일 데이터 수 (1~500)
 *     responses:
 *       200:
 *         description: 조회 성공
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
 *                   example: 조회 성공
 *                 data:
 *                   type: object
 *                   properties:
 *                     list:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           sentDate:
 *                             type: string
 *                             description: "보낸날짜 (YY-MM-DD 형식, 예: 26-01-30)"
 *                             example: "26-01-30"
 *                           sentById:
 *                             type: string
 *                             description: 보낸 ID (createdBy)
 *                             example: ADMN0000000001
 *                           title:
 *                             type: string
 *                             description: 제목
 *                           content:
 *                             type: string
 *                             description: 내용
 *                           gosiwonName:
 *                             type: string
 *                             description: 고시원명 (gosiwon 조인)
 *                           userName:
 *                             type: string
 *                             description: 사용자명 (수신자 customer 조인)
 *                     total:
 *                       type: integer
 *                       description: 전체 건수
 *                     page:
 *                       type: integer
 *                       description: 현재 페이지
 *                     limit:
 *                       type: integer
 *                       description: 한 페이지 데이터 수
 *                     totalPages:
 *                       type: integer
 *                       description: 전체 페이지 수
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/history', messageController.getMessageHistory);

module.exports = router;
