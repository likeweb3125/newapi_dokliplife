const express = require('express');
const router = express.Router();

const messageController = require('../controllers/message');
const multerMiddleware = require('../middleware/multer');

/**
 * @swagger
 * /v1/message/send:
 *   post:
 *     summary: 문자 발송 (SMS/LMS/MMS)
 *     description: "Authorization 토큰이 필요한 관리자/파트너용 문자 발송 API. application/json이면 SMS/LMS, multipart/form-data에 image를 넣으면 MMS(이미지 문자)로 발송됩니다."
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
 *                 example: "01089400670, 01091039151"
 *               message:
 *                 type: string
 *                 description: 문자 내용
 *                 example: "입실 안내 메시지입니다."
 *               title:
 *                 type: string
 *                 description: "문자 제목 (LMS/MMS에서 사용, SMS는 무시)"
 *                 example: "고시원 안내"
 *               gosiwonEsntlId:
 *                 type: string
 *                 description: 고시원 ID (이력 저장용)
 *                 example: GOSI0000000199
 *               userEsntlId:
 *                 type: string
 *                 description: 사용자 ID (이력 저장용, 미입력 시 수신 번호로 조회)
 *               roomEsntlId:
 *                 type: string
 *                 description: 방 ID (이력 저장용)
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - receiver
 *               - message
 *             properties:
 *               receiver:
 *                 type: string
 *                 description: 수신자 번호 (여러 명일 경우 콤마로 구분)
 *                 example: "01089400670, 01091039151"
 *               message:
 *                 type: string
 *                 description: 문자 내용
 *                 example: "입실 안내 메시지입니다."
 *               title:
 *                 type: string
 *                 description: "문자 제목 (LMS/MMS에서 사용)"
 *                 example: "고시원 안내"
 *               gosiwonEsntlId:
 *                 type: string
 *                 description: 고시원 ID (이력 저장용)
 *               userEsntlId:
 *                 type: string
 *                 description: "사용자 ID (이력 저장용, 미입력 시 수신 번호로 조회)"
 *               roomEsntlId:
 *                 type: string
 *                 description: 방 ID (이력 저장용)
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: "MMS 첨부 이미지 (JPEG/PNG/GIF, 선택). 첨부 시 MMS로 발송. 스웨거 UI에서 'Choose File'로 선택 가능"
 *           encoding:
 *             image:
 *               contentType: "image/jpeg, image/png, image/gif"
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
// multipart/form-data일 때만 이미지 업로드 multer 적용 후 발송, 그 외에는 JSON body로 발송
router.post('/send', (req, res, next) => {
	if (req.is('multipart/form-data')) {
		return multerMiddleware.messageImageMulter(req, res, (err) => {
			if (err) return next(err);
			return messageController.sendSMS(req, res, next);
		});
	}
	return messageController.sendSMS(req, res, next);
});

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
 *                           imagePath:
 *                             type: string
 *                             nullable: true
 *                             description: "MMS 첨부 이미지 저장 경로 (있으면 /upload 기준 URL로 조회 가능)"
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
