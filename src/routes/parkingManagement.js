const express = require('express');
const router = express.Router();

const parkingManagementController = require('../controllers/parkingManagement');

/**
 * @swagger
 * tags:
 *   name: 계약현황
 *   description: 계약현황 관리 API
 */

/**
 * @swagger
 * /v1/parking:
 *   post:
 *     summary: 주차 등록
 *     description: 계약에 대한 주차를 등록합니다. 주차비가 0원인 경우(입실료 포함)에도 paymentLog, gosiwonParking, parkStatus에 기록됩니다.
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
 *               - optionName
 *             properties:
 *               contractEsntlId:
 *                 type: string
 *                 description: 계약 고유아이디
 *                 example: RCO0000000001
 *               optionName:
 *                 type: string
 *                 enum: [자동차, 오토바이]
 *                 description: 차량 구분
 *                 example: 자동차
 *               optionInfo:
 *                 type: string
 *                 description: 차량번호 또는 차량 정보
 *                 example: 12가3456
 *               useStartDate:
 *                 type: string
 *                 format: date
 *                 description: 사용 시작일 (YYYY-MM-DD)
 *                 example: '2025-11-03'
 *               useEndDate:
 *                 type: string
 *                 format: date
 *                 description: 사용 종료일 (YYYY-MM-DD)
 *                 example: '2025-12-02'
 *               cost:
 *                 type: integer
 *                 description: 주차비 (0원 가능, 입실료 포함 시 0원)
 *                 default: 0
 *                 example: 0
 *               extend:
 *                 type: boolean
 *                 description: 다음 연장 시 주차 정보도 같이 연장 여부
 *                 default: false
 *                 example: false
 *     responses:
 *       200:
 *         description: 주차 등록 성공
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/', parkingManagementController.createParking);

/**
 * @swagger
 * /v1/parking:
 *   get:
 *     summary: 주차 목록 조회
 *     description: 계약별 주차 목록을 조회합니다.
 *     tags: [계약현황]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: contractEsntlId
 *         required: true
 *         schema:
 *           type: string
 *         description: 계약 고유아이디
 *         example: RCO0000000001
 *     responses:
 *       200:
 *         description: 주차 목록 조회 성공
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
 *                   example: 주차 목록 조회 성공
 *                 data:
 *                   type: object
 *                   properties:
 *                     list:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           paymentLogId:
 *                             type: string
 *                             description: 결제 로그 ID
 *                           parkStatusId:
 *                             type: string
 *                             description: 주차 상태 ID
 *                           optionName:
 *                             type: string
 *                             description: 차량 구분 (자동차/오토바이)
 *                           optionInfo:
 *                             type: string
 *                             description: 차량번호
 *                           useStartDate:
 *                             type: string
 *                             description: 사용 시작일
 *                           useEndDate:
 *                             type: string
 *                             description: 사용 종료일
 *                           cost:
 *                             type: number
 *                             description: 주차비
 *                           paymentStatus:
 *                             type: string
 *                             description: 결제 상태 (입실료 포함/별도 결제)
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/', parkingManagementController.getParkingList);

/**
 * @swagger
 * /v1/parking/{parkingId}:
 *   put:
 *     summary: 주차 정보 수정
 *     description: 주차 정보를 수정합니다.
 *     tags: [계약현황]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: parkingId
 *         required: true
 *         schema:
 *           type: string
 *         description: 주차 ID (paymentLog의 esntlId)
 *         example: PYLG0000000001
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               optionName:
 *                 type: string
 *                 enum: [자동차, 오토바이]
 *                 description: 차량 구분
 *               optionInfo:
 *                 type: string
 *                 description: 차량번호 또는 차량 정보
 *               useStartDate:
 *                 type: string
 *                 format: date
 *                 description: 사용 시작일 (YYYY-MM-DD)
 *               useEndDate:
 *                 type: string
 *                 format: date
 *                 description: 사용 종료일 (YYYY-MM-DD)
 *               extend:
 *                 type: boolean
 *                 description: 다음 연장 시 주차 정보도 같이 연장 여부
 *     responses:
 *       200:
 *         description: 주차 정보 수정 성공
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put('/:parkingId', parkingManagementController.updateParking);

/**
 * @swagger
 * /v1/parking/{parkingId}:
 *   delete:
 *     summary: 주차 삭제
 *     description: 주차 정보를 삭제합니다. gosiwonParking의 사용 대수도 감소하고, parkStatus는 소프트 삭제됩니다.
 *     tags: [계약현황]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: parkingId
 *         required: true
 *         schema:
 *           type: string
 *         description: 주차 ID (paymentLog의 esntlId)
 *         example: PYLG0000000001
 *     responses:
 *       200:
 *         description: 주차 삭제 성공
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete('/:parkingId', parkingManagementController.deleteParking);

module.exports = router;
