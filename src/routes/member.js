const express = require('express');
const router = express.Router();

const memberController = require('../controllers/member');
const isAuthMiddleware = require('../middleware/is-auth');

/**
 * @swagger
 * /v1/admin/member/customer/register:
 *   post:
 *     summary: 회원 등록
 *     description: customer 테이블에 새로운 회원을 등록합니다. byAdmin이 true이면 isByAdmin이 1로 저장됩니다.
 *     tags: [Member]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - phone
 *               - id
 *               - pass
 *             properties:
 *               name:
 *                 type: string
 *                 description: 회원 이름
 *                 example: 홍길동
 *               gender:
 *                 type: string
 *                 description: 성별 (남/여/선택 안함)
 *                 example: 남
 *               phone:
 *                 type: string
 *                 description: 휴대폰 번호
 *                 example: "01012345678"
 *               id:
 *                 type: string
 *                 format: email
 *                 description: 이메일 (로그인 시 사용)
 *                 example: test@example.com
 *               pass:
 *                 type: string
 *                 description: 비밀번호 (영문+숫자+특수문자 6자리 이상)
 *                 example: password123!
 *               byAdmin:
 *                 type: boolean
 *                 description: 관리자 등록 여부 (true이면 isByAdmin이 1로 저장)
 *                 example: true
 *               cusCollectYn:
 *                 type: string
 *                 description: 개인정보 수집 및 이용 동의 (Y/N, 기본 N)
 *                 example: Y
 *               cusLocationYn:
 *                 type: string
 *                 description: 위치정보 이용 약관 동의 (Y/N, 기본 N)
 *                 example: N
 *               cusPromotionYn:
 *                 type: string
 *                 description: 프로모션 정보 수신 동의 (Y/N, 기본 N)
 *                 example: Y
 *           example:
 *             name: 홍길동
 *             gender: 남
 *             phone: "01012345678"
 *             id: test@example.com
 *             pass: password123!
 *             byAdmin: true
 *             cusCollectYn: Y
 *             cusLocationYn: N
 *             cusPromotionYn: Y
 *     responses:
 *       200:
 *         description: 회원 등록 성공
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
 *                   example: 회원 등록 성공
 *                 data:
 *                   type: object
 *                   properties:
 *                     esntlId:
 *                       type: string
 *                       description: 고유 아이디
 *                       example: 550e8400-e29b-41d4-a716-446655440000
 *                     id:
 *                       type: string
 *                       description: 이메일
 *                       example: test@example.com
 *                     name:
 *                       type: string
 *                       description: 회원 이름
 *                       example: 홍길동
 *       400:
 *         description: 잘못된 요청 (필수 필드 누락 또는 이메일 중복)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardError'
 *             examples:
 *               missingField:
 *                 value:
 *                   statusCode: 400
 *                   message: 이름을 입력해주세요.
 *               duplicateEmail:
 *                 value:
 *                   statusCode: 400
 *                   message: 이미 등록된 이메일입니다.
 *       500:
 *         description: 서버 내부 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardError'
 */
router.post(
	'/customer/register',
	memberController.postCustomerRegister
); //회원 등록 (customer 테이블)

/**
 * @swagger
 * /v1/admin/member/customer/login:
 *   post:
 *     summary: 회원 로그인
 *     description: customer 테이블의 id와 비밀번호로 로그인합니다.
 *     tags: [Member]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - id
 *               - pass
 *             properties:
 *               id:
 *                 type: string
 *                 format: email
 *                 description: 회원 아이디(이메일)
 *                 example: test@example.com
 *               pass:
 *                 type: string
 *                 description: 로그인 비밀번호
 *                 example: password123!
 *     responses:
 *       200:
 *         description: 로그인 성공
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
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *       400:
 *         description: 필수 값 누락
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardError'
 *       401:
 *         description: 비밀번호 불일치
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardError'
 *       404:
 *         description: 회원 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardError'
 */
router.post('/customer/login', memberController.postCustomerLogin); //회원 로그인

/**
 * @swagger
 * /v1/admin/member/customer:
 *   put:
 *     summary: 회원 정보 수정
 *     description: esntlId를 기준으로 customer 정보를 수정합니다. 전달한 필드만 업데이트됩니다.
 *     tags: [Member]
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
 *                 description: "회원 고유 아이디 (예: CUTR0000000001)"
 *               name:
 *                 type: string
 *               gender:
 *                 type: string
 *                 description: M/F 로 저장됩니다.
 *               phone:
 *                 type: string
 *               id:
 *                 type: string
 *                 format: email
 *               pass:
 *                 type: string
 *                 description: 새 비밀번호
 *               cusCollectYn:
 *                 type: string
 *                 description: 개인정보 수집 동의 (Y/N)
 *               cusLocationYn:
 *                 type: string
 *                 description: 위치정보 동의 (Y/N)
 *               cusPromotionYn:
 *                 type: string
 *                 description: 프로모션 수신 동의 (Y/N)
 *           example:
 *             esntlId: CUTR0000000001
 *             name: 수정된 이름
 *             gender: F
 *             phone: 01099998888
 *             cusCollectYn: Y
 *             cusLocationYn: Y
 *             cusPromotionYn: Y
 *     responses:
 *       200:
 *         description: 회원 정보 수정 성공
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
 *                     updatedFields:
 *                       type: array
 *                       items:
 *                         type: string
 *       400:
 *         description: 잘못된 요청
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardError'
 *       404:
 *         description: 회원을 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardError'
 *       500:
 *         description: 서버 내부 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardError'
 */
router.put('/customer', memberController.putCustomerUpdate); // 회원 수정 (customer 테이블)

/**
 * @swagger
 * /v1/admin/member/search:
 *   get:
 *     summary: memberSearch
 *     description: 고시원코드, 이름/연락처 텍스트, 성별(선택)으로 customer 테이블을 검색합니다. 해당 고시원에 계약 이력이 있는 회원만 대상이며, 현재 계약이 활성 상태(roomContract.status = 'USED')인 경우 사용기간(startDate, endDate)도 함께 반환합니다.
 *     tags: [Member]
 *     parameters:
 *       - in: query
 *         name: gosiwonEsntlId
 *         required: true
 *         schema:
 *           type: string
 *         description: 고시원코드
 *       - in: query
 *         name: searchText
 *         required: false
 *         schema:
 *           type: string
 *         description: 이름 또는 연락처 검색 텍스트 (부분 일치)
 *       - in: query
 *         name: gender
 *         required: false
 *         schema:
 *           type: string
 *         description: "성별 (없으면 전부, 예: M / F / 남 / 여)"
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
 *                           esntlId:
 *                             type: string
 *                             description: 회원 고유 아이디
 *                           name:
 *                             type: string
 *                             description: 이름
 *                           phone:
 *                             type: string
 *                             description: 연락처
 *                           gender:
 *                             type: string
 *                             description: 성별
 *                           age:
 *                             type: string
 *                             description: "customer.birth 기준 현재 나이 (없으면 빈값)"
 *                           startDate:
 *                             type: string
 *                             description: 사용기간 시작일 (활성 계약이 있을 때만 포함)
 *                           endDate:
 *                             type: string
 *                             description: 사용기간 종료일 (활성 계약이 있을 때만 포함)
 *       400:
 *         description: 고시원코드 누락
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardError'
 *       500:
 *         description: 서버 내부 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardError'
 */
router.get('/search', memberController.getMemberSearch); // 회원 검색 (memberSearch)

module.exports = router;
