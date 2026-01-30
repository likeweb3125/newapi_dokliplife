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
 *                 example: GOSI0000000001
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

module.exports = router;
