const express = require('express');
const router = express.Router();

const extraPaymentController = require('../controllers/extraPayment');

/**
 * @swagger
 * tags:
 *   name: 계약현황
 *   description: 계약현황 관리 API
 */

/**
 * @swagger
 * /v1/roomExtraPayment:
 *   post:
 *     summary: 추가 결제 요청
 *     description: 계약에 대한 추가 결제 요청을 등록합니다. 주차비, 추가 입실료, 직접 입력 등 여러 종류의 추가 비용을 한 번에 등록할 수 있습니다. extendWithPayment = ture 인 경우 연장시 함께 결제 됩니다. extraCostName= '추가비용명칭 (주차비, 추가 입실료, 직접 입력 등)' optionName='자동차/오토바이/직접입력'
 *     tags: [계약현황]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - contractEsntlId
 *               - extraPayments
 *             properties:
 *               contractEsntlId:
 *                 type: string
 *                 description: 계약 고유아이디
 *                 example: RCO0000000001
 *               extraPayments:
 *                 type: array
 *                 description: 추가 결제 항목 배열
 *                 items:
 *                   type: object
 *                   required:
 *                     - extraCostName
 *                     - cost
 *                   properties:
 *                     extraCostName:
 *                       type: string
 *                       description: '추가비용명칭 (주차비, 추가 입실료, 직접 입력 등)'
 *                       example: 주차비
 *                     cost:
 *                       type: integer
 *                       description: '비용 (음수 입력 가능 - 부분 환불 시)'
 *                       example: 20000
 *                     memo:
 *                       type: string
 *                       description: 메모 (ex. 2인 추가 / 정가 계산 등)
 *                       example: 2인 추가
 *                     extendWithPayment:
 *                       type: boolean
 *                       description: 연장시 함께 결제 여부
 *                       example: true
 *                     useStartDate:
 *                       type: string
 *                       format: date
 *                       description: 이용 시작 일자 (주차비, 직접 입력의 경우)
 *                       example: '2025-11-03'
 *                     optionInfo:
 *                       type: string
 *                       description: '옵션정보 (주차비의 경우 차량정보, 직접 입력의 경우 옵션명 등)'
 *                       example: '충남 52 1234 더'
 *                     optionName:
 *                       type: string
 *                       description: 옵션명 (직접 입력의 경우)
 *                       example: '기타 비용'
 *               receiverPhone:
 *                 type: string
 *                 description: 입실자 핸드폰 번호
 *                 example: '010-1234-5678'
 *               sendDate:
 *                 type: string
 *                 format: date
 *                 description: '발송일 (계약기간 안에만 입력 가능)'
 *                 example: '2025-11-05'
 *     responses:
 *       200:
 *         description: 추가 결제 요청 성공
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
 *                   example: 추가 결제 요청이 완료되었습니다.
 *                 data:
 *                   type: object
 *                   properties:
 *                     contractEsntlId:
 *                       type: string
 *                       description: 계약 고유아이디
 *                       example: RCO0000000001
 *                     totalAmount:
 *                       type: integer
 *                       description: 총 결제 금액
 *                       example: 30000
 *                     paymentCount:
 *                       type: integer
 *                       description: 결제 항목 개수
 *                       example: 2
 *                     payments:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           esntlId:
 *                             type: string
 *                             description: 추가 결제 고유아이디
 *                             example: EXTR0000000001
 *                           extraCostName:
 *                             type: string
 *                             description: 추가비용명칭
 *                             example: 주차비
 *                           cost:
 *                             type: integer
 *                             description: 비용
 *                             example: 20000
 *                     historyId:
 *                       type: string
 *                       description: 히스토리 고유아이디
 *                       example: HISTORY0000000001
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/', extraPaymentController.roomExtraPayment);

module.exports = router;
