const express = require('express');
const router = express.Router();

const gosiwonRegistController = require('../controllers/gosiwonRegist');

/**
 * @swagger
 * tags:
 *   - name: 고시원등록관리
 *     description: 고시원 가입 관리 API (gosiwonRegist)
 */

/**
 * @swagger
 * /v1/gosiwonRegist/list:
 *   get:
 *     summary: 가입 관리 목록 조회
 *     description: "고시원 가입 요청 목록을 조회합니다. gosiwon, gosiwonAdmin, il_gosiwon_file(사업자등록증·통장사본·도장)을 조인하여 반환합니다. gosiwon 테이블 추가 컬럼(use_deposit, use_sale_commision, saleCommisionStartDate, saleCommisionEndDate, saleCommision, use_settlement, settlementReason, is_controlled, is_favorite, penaltyRate, penaltyMin, useDoklipPenaltyRule 등) 포함."
 *     tags: [고시원등록관리]
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
 *         description: 페이지당 건수
 *       - in: query
 *         name: startDate
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *         description: "조회 시작일 (acceptDate 기준, YYYY-MM-DD)"
 *       - in: query
 *         name: endDate
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *         description: "조회 종료일 (acceptDate 기준, YYYY-MM-DD)"
 *       - in: query
 *         name: status
 *         required: false
 *         schema:
 *           type: string
 *           enum: [ALL, PENDING, OPERATE, REJECT, 등]
 *         description: "상태 필터 (ALL이면 status IS NOT NULL, 그 외 해당 값으로 필터)"
 *       - in: query
 *         name: searchString
 *         required: false
 *         schema:
 *           type: string
 *         description: "검색어 (고시원명, 주소 부분 일치)"
 *     responses:
 *       200:
 *         description: 가입 관리 목록 조회 성공
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
 *                   example: 가입 관리 목록 조회 성공
 *                 data:
 *                   type: object
 *                   properties:
 *                     resultList:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           esntlId:
 *                             type: string
 *                             description: 고시원 고유아이디
 *                           acceptDate:
 *                             type: string
 *                             description: 가입일시
 *                           name:
 *                             type: string
 *                             description: 고시원명
 *                           status:
 *                             type: string
 *                             description: 고시원상태
 *                           address:
 *                             type: string
 *                             description: 주소
 *                           certificate_name:
 *                             type: string
 *                             nullable: true
 *                             description: "사업자등록증 원본명 (il_gosiwon_file)"
 *                           bankbook_name:
 *                             type: string
 *                             nullable: true
 *                             description: "통장사본 원본명 (il_gosiwon_file)"
 *                           stamp_name:
 *                             type: string
 *                             nullable: true
 *                             description: "도장 원본명 (il_gosiwon_file)"
 *                           use_deposit:
 *                             type: integer
 *                             description: 보증금 사용 여부
 *                           use_sale_commision:
 *                             type: integer
 *                             description: 할인 수수료 적용 여부
 *                           saleCommisionStartDate:
 *                             type: string
 *                             nullable: true
 *                             description: 할인수수료 시작일
 *                           saleCommisionEndDate:
 *                             type: string
 *                             nullable: true
 *                             description: 할인수수료 종료일
 *                           saleCommision:
 *                             type: integer
 *                             nullable: true
 *                             description: 할인 수수료율
 *                           use_settlement:
 *                             type: integer
 *                             description: 정산 사용 여부
 *                           is_controlled:
 *                             type: integer
 *                             description: 관제서비스 이용 여부
 *                     totcnt:
 *                       type: integer
 *                       description: 전체 건수
 *                     page:
 *                       type: integer
 *                       description: 현재 페이지
 *                     limit:
 *                       type: integer
 *                       description: 페이지당 건수
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/list', gosiwonRegistController.getAcceptList);

/**
 * @swagger
 * /v1/gosiwonRegist/selectFileToId:
 *   get:
 *     summary: 계약서 파일 조회
 *     description: "고시원 esntlId로 gosiwon 테이블의 contractFile, contractFileOrgName을 조회합니다."
 *     tags: [고시원등록관리]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: esntlId
 *         required: true
 *         schema:
 *           type: string
 *         description: 고시원 고유아이디
 *     responses:
 *       200:
 *         description: 계약서 파일 조회 성공
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
 *                   example: 계약서 파일 조회 성공
 *                 data:
 *                   type: object
 *                   properties:
 *                     contractFile:
 *                       type: string
 *                       nullable: true
 *                       description: "계약서 파일 경로/명 (gosiwon.contractFile)"
 *                     contractFileOrgName:
 *                       type: string
 *                       nullable: true
 *                       description: "계약서 원본 파일명 (gosiwon.contractFileOrgName)"
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/selectFileToId', gosiwonRegistController.selectFileToId);

/**
 * @swagger
 * /v1/gosiwonRegist/updateFile:
 *   put:
 *     summary: 계약서 파일 수정
 *     description: "고시원 esntlId에 해당하는 gosiwon의 contractFile, contractFileOrgName을 수정합니다."
 *     tags: [고시원등록관리]
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
 *               contractFile:
 *                 type: string
 *                 nullable: true
 *                 description: "계약서 파일 경로/명"
 *               contractFileOrgName:
 *                 type: string
 *                 nullable: true
 *                 description: "계약서 원본 파일명"
 *     responses:
 *       200:
 *         description: 계약서 파일 수정 성공
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put('/updateFile', gosiwonRegistController.updateFile);

/**
 * @swagger
 * /v1/gosiwonRegist/update:
 *   put:
 *     summary: 가입 관리 고시원 정보 수정
 *     description: "gosiwon 테이블 정보를 수정합니다. status가 DORMANT일 경우 해당 고시원의 OPEN 방을 EMPTY로 변경합니다. process는 status가 OPERATE/DORMANT일 때 T, 그 외 F로 자동 설정. terminate_reason/terminate_date는 status가 FIN/DORMANT일 때만 반영."
 *     tags: [고시원등록관리]
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
 *               corpNumber:
 *                 type: string
 *                 description: 사업자번호
 *               name:
 *                 type: string
 *                 description: 고시원명
 *               address:
 *                 type: string
 *               address2:
 *                 type: string
 *               address3:
 *                 type: string
 *               latitude:
 *                 type: string
 *               longitude:
 *                 type: string
 *               status:
 *                 type: string
 *                 description: "고시원상태 (OPERATE, DORMANT, FIN 등)"
 *               rejectText:
 *                 type: string
 *                 description: 반려사유
 *               terminate_reason:
 *                 type: string
 *                 description: "해지사유 (status가 FIN/DORMANT일 때만 반영)"
 *               terminate_date:
 *                 type: string
 *                 format: date
 *                 description: "해지일 (status가 FIN/DORMANT일 때만 반영)"
 *               adminSn:
 *                 type: string
 *                 description: "수정자 ID (미입력 시 토큰 기반)"
 *               gsw_grade:
 *                 type: string
 *               bank:
 *                 type: string
 *               bankAccount:
 *                 type: string
 *               accountHolder:
 *                 type: string
 *               use_deposit:
 *                 type: integer
 *                 description: 보증금 사용 여부 (0/1)
 *               use_sale_commision:
 *                 type: integer
 *                 description: 할인 수수료 적용 여부 (0/1)
 *               saleCommisionStartDate:
 *                 type: string
 *                 format: date-time
 *                 description: 할인수수료 시작일
 *               saleCommisionEndDate:
 *                 type: string
 *                 format: date-time
 *                 description: 할인수수료 종료일
 *               saleCommision:
 *                 type: integer
 *                 description: 할인 수수료율
 *               use_settlement:
 *                 type: integer
 *                 description: 정산 사용 여부 (0/1)
 *               settlementReason:
 *                 type: string
 *                 description: 정산 사용 사유
 *               penaltyRate:
 *                 type: integer
 *                 description: 위약금 비율
 *               penaltyMin:
 *                 type: integer
 *                 description: 최소 위약금
 *               useDoklipPenaltyRule:
 *                 type: integer
 *                 description: 독립생활 환불 룰 사용 (0/1)
 *               is_controlled:
 *                 type: integer
 *                 description: 관제서비스 이용 여부 (0/1)
 *               is_favorite:
 *                 type: integer
 *                 description: 즐겨찾기 (0/1)
 *     responses:
 *       200:
 *         description: 가입 관리 고시원 정보 수정 성공
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put('/update', gosiwonRegistController.updateGosiwonRegist);

module.exports = router;
