const express = require('express');
const router = express.Router();

const paymentController = require('../controllers/payment');

/**
 * @swagger
 * tags:
 *   name: 결제
 *   description: 결제 API
 */

/**
 * @swagger
 * /v1/payment/prepare:
 *   post:
 *     summary: 결제 준비
 *     description: "PG 결제창 호출 전 paymentLog에 결제 준비 건을 INSERT 합니다. calculateStatus=REQUEST, pDate/pTime은 NOW(), pyl_expected_settlement_date는 영업일 4일 후로 저장됩니다. 반환된 esntlId(imp_uid)를 PG 결제 요청 시 사용합니다."
 *     tags: [결제]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - paymentType
 *               - gosiwonEsntlId
 *               - roomEsntlId
 *               - customerEsntlId
 *               - calAmount
 *               - pyl_goods_amount
 *             properties:
 *               paymentType:
 *                 type: string
 *                 description: "결제 종류"
 *                 example: accountPayment
 *               gosiwonEsntlId:
 *                 type: string
 *                 description: "고시원 고유아이디"
 *                 example: GOSI0000000199
 *               roomEsntlId:
 *                 type: string
 *                 description: "방 고유아이디"
 *                 example: ROOM0000019357
 *               customerEsntlId:
 *                 type: string
 *                 description: "고객 고유아이디"
 *                 example: CUS0000000001
 *               contractEsntlId:
 *                 type: string
 *                 nullable: true
 *                 description: "계약 고유아이디 (계약 전이면 생략 또는 빈 문자열)"
 *                 example: RCTT0000000001
 *               paymentAmount:
 *                 type: integer
 *                 description: "실 결제 금액 (총 금액 - 쿠폰 - 포인트)"
 *                 default: 0
 *                 example: 500000
 *               pointAmount:
 *                 type: integer
 *                 description: "결제 시 사용한 포인트(금액)"
 *                 default: 0
 *                 example: 0
 *               couponAmount:
 *                 type: integer
 *                 description: "결제 시 사용한 쿠폰(금액)"
 *                 default: 0
 *                 example: 0
 *               ucp_eid:
 *                 type: string
 *                 nullable: true
 *                 description: "결제 시 사용한 쿠폰 고유아이디"
 *                 example: null
 *               collectPoint:
 *                 type: integer
 *                 description: "적립 포인트"
 *                 default: 0
 *                 example: 0
 *               calAmount:
 *                 type: string
 *                 description: "수수료 산정 금액"
 *                 example: "500000"
 *               pyl_goods_amount:
 *                 type: integer
 *                 description: "입실료"
 *                 example: 500000
 *               feeAmount:
 *                 type: number
 *                 nullable: true
 *                 description: "수수료(금액)"
 *                 example: 15000
 *               feePercent:
 *                 type: string
 *                 nullable: true
 *                 description: "수수료(%)"
 *                 example: "3"
 *               tid:
 *                 type: string
 *                 description: "PG 승인아이디 (준비 단계에서는 빈 문자열 가능)"
 *                 example: ""
 *               pyl_contract_data:
 *                 type: string
 *                 nullable: true
 *                 description: "계약 데이터 (JSON 등)"
 *                 example: null
 *     responses:
 *       200:
 *         description: "결제 준비 성공"
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
 *                   example: "결제 준비가 완료되었습니다."
 *                 data:
 *                   type: object
 *                   properties:
 *                     esntlId:
 *                       type: string
 *                       description: "paymentLog 고유아이디 (PG 결제 요청 시 imp_uid로 사용)"
 *                       example: PYMT0000000001
 *                     imp_uid:
 *                       type: string
 *                       description: "PG 결제 요청 시 사용할 imp_uid (준비 단계에서는 esntlId와 동일)"
 *                       example: PYMT0000000001
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/prepare', paymentController.preparePayment);

module.exports = router;
