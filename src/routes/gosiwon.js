const express = require('express');
const router = express.Router();

const gosiwonController = require('../controllers/gosiwon');
const parkingController = require('../controllers/parking');

/**
 * @swagger
 * /v1/gosiwon/info:
 *   get:
 *     summary: 고시원 상세 정보 조회
 *     description: esntlId로 고시원 정보를 조회합니다. gosiwon, room, gosiwonUse, gosiwonBuilding, gosiwonFacilities, gosiwonAdmin 테이블을 조인하여 모든 정보를 반환합니다.
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
 *         description: 고시원 정보 조회 성공 (조인된 모든 테이블 데이터 포함)
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
 *                   example: 고시원 정보 조회 성공
 *                 data:
 *                   $ref: '#/components/schemas/GosiwonInfo'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/info', gosiwonController.getGosiwonInfo);

/**
 * @swagger
 * /v1/gosiwon/info:
 *   post:
 *     summary: 고시원 정보 등록
 *     description: 새로운 고시원 정보를 등록합니다.
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
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 description: 고시원 이름
 *                 example: 성수 고시원
 *               address:
 *                 type: string
 *                 description: 주소
 *                 example: 서울시 성동구 성수동
 *               address2:
 *                 type: string
 *                 description: 상세주소
 *               address3:
 *                 type: string
 *                 description: 참고주소
 *               longitude:
 *                 type: string
 *                 description: 경도
 *               latitude:
 *                 type: string
 *                 description: 위도
 *               gsw_grade:
 *                 type: string
 *                 description: 등급
 *               numOfRooms:
 *                 type: string
 *                 description: 보유방수
 *               homepage:
 *                 type: string
 *                 description: 홈페이지주소
 *               blog:
 *                 type: string
 *                 description: 블로그주소
 *               youtube:
 *                 type: string
 *                 description: 유튜브주소
 *               gsw_metaport:
 *                 type: string
 *                 description: 룸투어URL
 *               keeperName:
 *                 type: string
 *                 description: 총무이름
 *               keeperHp:
 *                 type: string
 *                 description: 총무연락처
 *               phone:
 *                 type: string
 *                 description: 고시원연락처
 *               tag:
 *                 type: string
 *                 description: 검색태그
 *               email:
 *                 type: string
 *                 description: 이메일주소
 *               subway:
 *                 type: string
 *                 description: 주변지하철
 *               college:
 *                 type: string
 *                 description: 주변대학
 *               corpNumber:
 *                 type: string
 *                 description: 사업자번호
 *               bank:
 *                 type: string
 *                 description: 은행명
 *               bankAccount:
 *                 type: string
 *                 description: 계좌번호
 *               commision:
 *                 type: string
 *                 description: 수수료율, 기본값 7
 *                 example: 7
 *               description:
 *                 type: string
 *                 description: 고시원설명
 *               manager:
 *                 type: string
 *                 description: 영업담당자
 *               point:
 *                 type: integer
 *                 description: 포인트, 기본값 0
 *                 example: 0
 *               acceptDate:
 *                 type: string
 *                 description: 가입일시
 *               gsw_signup_path_cd:
 *                 type: string
 *                 description: 가입경로코드
 *               gsw_signup_path_etc:
 *                 type: string
 *                 description: 가입경로 기타
 *               alarmTalk:
 *                 type: string
 *                 description: 알림톡 설정
 *               alarmEmail:
 *                 type: string
 *                 description: 알림이메일 설정
 *               status:
 *                 type: string
 *                 description: 고시원상태
 *               process:
 *                 type: string
 *                 description: 운영여부
 *               rejectText:
 *                 type: string
 *                 description: 거절사유
 *               contractText:
 *                 type: string
 *                 description: 계약서 텍스트
 *               monthCalculate:
 *                 type: string
 *                 description: 월정산 여부
 *               accountHolder:
 *                 type: string
 *                 description: 예금주명
 *               contract:
 *                 type: string
 *                 description: 계약서일반
 *               contractFile:
 *                 type: string
 *                 description: 계약서 파일 경로
 *               contractFileOrgName:
 *                 type: string
 *                 description: 계약서 원본 파일명
 *               serviceNumber:
 *                 type: string
 *                 description: 050번호
 *               district:
 *                 type: string
 *                 description: 지역
 *               is_controlled:
 *                 type: boolean
 *                 description: 관제서비스 이용 여부
 *                 example: false
 *               penaltyRate:
 *                 type: integer
 *                 description: 위약금 비율
 *                 example: 10
 *               penaltyMin:
 *                 type: integer
 *                 description: 최소 위약금
 *                 example: 50000
 *               qrPoint:
 *                 type: string
 *                 description: QR 포인트
 *               use_deposit:
 *                 type: boolean
 *                 description: 보증금 사용 여부
 *                 example: false
 *               use_sale_commision:
 *                 type: boolean
 *                 description: 할인 수수료 적용 여부
 *                 example: false
 *               saleCommisionStartDate:
 *                 type: string
 *                 description: 할인 수수료 시작일
 *               saleCommisionEndDate:
 *                 type: string
 *                 description: 할인 수수료 종료일
 *               saleCommision:
 *                 type: integer
 *                 description: 할인 수수료율
 *               use_settlement:
 *                 type: boolean
 *                 description: 정산 사용 여부
 *                 example: false
 *               settlementReason:
 *                 type: string
 *                 description: 정산 사용 사유
 *               ableCheckDays:
 *                 type: integer
 *                 description: 입실 가능 기간
 *                 example: 2
 *               ableContractDays:
 *                 type: integer
 *                 description: 계약 가능 기간
 *                 example: 10
 *               checkInTimeStart:
 *                 type: string
 *                 description: 체크인 가능 시작시간 (ex - AM|9|00)
 *               checkInTimeEnd:
 *                 type: string
 *                 description: 체크인 가능 종료시간 (ex - PM|9|00)
 *               checkOutTime:
 *                 type: string
 *                 description: 퇴실시간 (ex - AM|11|00)
 *               gosiwonUse:
 *                 type: object
 *                 description: 고시원 사용 정보 (선택사항)
 *                 additionalProperties: true
 *                 example:
 *                   deposit: 500000
 *                   qualified: "^T^"
 *                   minAge: 18
 *                   maxAge: 35
 *                   minUsedDate: 30
 *                   gender: "M"
 *                   foreignLanguage: "Y"
 *                   orderData: 1
 *               gosiwonBuilding:
 *                 type: object
 *                 description: 고시원 건물 정보 (선택사항)
 *                 additionalProperties: true
 *                 example:
 *                   floorInfo: "지하1층~5층"
 *                   useFloor: "1층~5층"
 *                   wallMaterial: "콘크리트"
 *                   elevator: "Y"
 *                   parking: "Y"
 *               gosiwonFacilities:
 *                 type: object
 *                 description: 고시원 시설 정보 (선택사항)
 *                 additionalProperties: true
 *                 example:
 *                   safety: "Y"
 *                   fire: "Y"
 *                   vicinity: "지하철역 도보 5분"
 *                   temp: "개별난방"
 *                   internet: "Y"
 *                   meal: "^rice^kimchi^noodle^coffee^"
 *                   equipment: "냉장고,세탁기"
 *                   sanitation: "Y"
 *                   kitchen: "공용주방"
 *                   wash: "공용세탁실"
 *                   rest: "^readingRoom^rooftop^fitness"
 *                   orderData: 1
 *     responses:
 *       200:
 *         description: 고시원 정보 등록 성공
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
 *                   example: 고시원 정보 등록 성공
 *                 data:
 *                   type: object
 *                   properties:
 *                     esntlId:
 *                       type: string
 *                       example: GOSI0000002131
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/info', gosiwonController.createGosiwon);

/**
 * @swagger
 * /v1/gosiwon/info:
 *   put:
 *     summary: 고시원 정보 수정
 *     description: 고시원 정보를 수정합니다.
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
 *                 example: GOSI0000002130
 *               name:
 *                 type: string
 *                 description: 고시원 이름
 *               address:
 *                 type: string
 *                 description: 주소
 *               address2:
 *                 type: string
 *                 description: 상세주소
 *               address3:
 *                 type: string
 *                 description: 참고주소
 *               longitude:
 *                 type: string
 *                 description: 경도
 *               latitude:
 *                 type: string
 *                 description: 위도
 *               gsw_grade:
 *                 type: string
 *                 description: 등급
 *               numOfRooms:
 *                 type: string
 *                 description: 보유방수
 *               homepage:
 *                 type: string
 *                 description: 홈페이지주소
 *               blog:
 *                 type: string
 *                 description: 블로그주소
 *               youtube:
 *                 type: string
 *                 description: 유튜브주소
 *               gsw_metaport:
 *                 type: string
 *                 description: 룸투어URL
 *               keeperName:
 *                 type: string
 *                 description: 총무이름
 *               keeperHp:
 *                 type: string
 *                 description: 총무연락처
 *               phone:
 *                 type: string
 *                 description: 고시원연락처
 *               tag:
 *                 type: string
 *                 description: 검색태그
 *               email:
 *                 type: string
 *                 description: 이메일주소
 *               subway:
 *                 type: string
 *                 description: 주변지하철
 *               college:
 *                 type: string
 *                 description: 주변대학
 *               corpNumber:
 *                 type: string
 *                 description: 사업자번호
 *               bank:
 *                 type: string
 *                 description: 은행명
 *               bankAccount:
 *                 type: string
 *                 description: 계좌번호
 *               commision:
 *                 type: string
 *                 description: 수수료율
 *               description:
 *                 type: string
 *                 description: 고시원설명
 *               manager:
 *                 type: string
 *                 description: 영업담당자
 *               point:
 *                 type: integer
 *                 description: 포인트
 *               acceptDate:
 *                 type: string
 *                 description: 가입일시
 *               gsw_signup_path_cd:
 *                 type: string
 *                 description: 가입경로코드
 *               gsw_signup_path_etc:
 *                 type: string
 *                 description: 가입경로 기타
 *               alarmTalk:
 *                 type: string
 *                 description: 알림톡 설정
 *               alarmEmail:
 *                 type: string
 *                 description: 알림이메일 설정
 *               status:
 *                 type: string
 *                 description: 고시원상태
 *               process:
 *                 type: string
 *                 description: 운영여부
 *               rejectText:
 *                 type: string
 *                 description: 거절사유
 *               contractText:
 *                 type: string
 *                 description: 계약서 텍스트
 *               monthCalculate:
 *                 type: string
 *                 description: 월정산 여부
 *               accountHolder:
 *                 type: string
 *                 description: 예금주명
 *               contract:
 *                 type: string
 *                 description: 계약서일반
 *               contractFile:
 *                 type: string
 *                 description: 계약서 파일 경로
 *               contractFileOrgName:
 *                 type: string
 *                 description: 계약서 원본 파일명
 *               serviceNumber:
 *                 type: string
 *                 description: 050번호
 *               district:
 *                 type: string
 *                 description: 지역
 *               is_controlled:
 *                 type: boolean
 *                 description: 관제서비스 이용 여부
 *               penaltyRate:
 *                 type: integer
 *                 description: 위약금 비율
 *                 example: 10
 *               penaltyMin:
 *                 type: integer
 *                 description: 최소 위약금
 *                 example: 50000
 *               qrPoint:
 *                 type: string
 *                 description: QR 포인트
 *               use_deposit:
 *                 type: boolean
 *                 description: 보증금 사용 여부
 *               use_sale_commision:
 *                 type: boolean
 *                 description: 할인 수수료 적용 여부
 *               saleCommisionStartDate:
 *                 type: string
 *                 description: 할인 수수료 시작일
 *               saleCommisionEndDate:
 *                 type: string
 *                 description: 할인 수수료 종료일
 *               saleCommision:
 *                 type: integer
 *                 description: 할인 수수료율
 *               use_settlement:
 *                 type: boolean
 *                 description: 정산 사용 여부
 *               settlementReason:
 *                 type: string
 *                 description: 정산 사용 사유
 *               ableCheckDays:
 *                 type: integer
 *                 description: 입실 가능 기간
 *                 example: 2
 *               ableContractDays:
 *                 type: integer
 *                 description: 계약 가능 기간
 *                 example: 10
 *               checkInTimeStart:
 *                 type: string
 *                 description: 체크인 가능 시작시간 (ex - AM|9|00)
 *               checkInTimeEnd:
 *                 type: string
 *                 description: 체크인 가능 종료시간 (ex - PM|9|00)
 *               checkOutTime:
 *                 type: string
 *                 description: 퇴실시간 (ex - AM|11|00)
 *               gosiwonUse:
 *                 type: object
 *                 description: 고시원 사용 정보 (선택사항, 존재하면 업데이트, 없으면 생성)
 *                 additionalProperties: true
 *                 example:
 *                   deposit: 500000
 *                   qualified: "^T^"
 *                   minAge: 18
 *                   maxAge: 35
 *                   minUsedDate: 30
 *                   gender: "M"
 *                   foreignLanguage: "Y"
 *                   orderData: 1
 *               gosiwonBuilding:
 *                 type: object
 *                 description: 고시원 건물 정보 (선택사항, 존재하면 업데이트, 없으면 생성)
 *                 additionalProperties: true
 *                 example:
 *                   floorInfo: "지하1층~5층"
 *                   useFloor: "1층~5층"
 *                   wallMaterial: "콘크리트"
 *                   elevator: "Y"
 *                   parking: "Y"
 *               gosiwonFacilities:
 *                 type: object
 *                 description: 고시원 시설 정보 (선택사항, 존재하면 업데이트, 없으면 생성)
 *                 additionalProperties: true
 *                 example:
 *                   safety: "Y"
 *                   fire: "Y"
 *                   vicinity: "지하철역 도보 5분"
 *                   temp: "개별난방"
 *                   internet: "Y"
 *                   meal: "^rice^kimchi^noodle^coffee^"
 *                   equipment: "냉장고,세탁기"
 *                   sanitation: "Y"
 *                   kitchen: "공용주방"
 *                   wash: "공용세탁실"
 *                   rest: "^readingRoom^rooftop^fitness"
 *                   orderData: 1
 *     responses:
 *       200:
 *         description: 고시원 정보 수정 성공 (관련 테이블도 함께 업데이트됨)
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
 *                   example: 고시원 정보 수정 성공
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put('/info', gosiwonController.updateGosiwon);

/**
 * @swagger
 * /v1/gosiwon/info:
 *   delete:
 *     summary: 고시원 정보 삭제
 *     description: 고시원 정보를 삭제합니다. 관련 테이블(gosiwonUse, gosiwonBuilding, gosiwonFacilities)의 데이터도 함께 삭제됩니다.
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
 *         description: 고시원 정보 삭제 성공 (관련 테이블 데이터도 함께 삭제됨)
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
 *                   example: 고시원 정보 삭제 성공
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete('/info', gosiwonController.deleteGosiwon);

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
 * /v1/gosiwon/favorites:
 *   get:
 *     summary: 즐겨찾기 고시원 목록 조회
 *     description: is_favorite가 1인 고시원 목록을 조회합니다. esntlId와 name만 반환합니다.
 *     tags: [Gosiwon]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 즐겨찾기 고시원 목록 조회 성공
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
 *                   example: 즐겨찾기 고시원 목록 조회 성공
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       esntlId:
 *                         type: string
 *                         description: 고시원 고유 아이디
 *                         example: GOSI0000002130
 *                       name:
 *                         type: string
 *                         description: 고시원명
 *                         example: 홍대 고시원
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/favorites', gosiwonController.getFavoriteGosiwonList);

/**
 * @swagger
 * /v1/gosiwon/favorite:
 *   put:
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
router.put('/favorite', gosiwonController.toggleFavorite);

/**
 * @swagger
 * /v1/gosiwon/parking/info:
 *   get:
 *     summary: 주차장 정보 조회
 *     description: 고시원 ID로 주차장 정보를 조회합니다.
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
 *         description: 주차장 정보 조회 성공
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
 *                   example: 주차장 정보 조회 성공
 *                 data:
 *                   type: object
 *                   properties:
 *                     parkingID:
 *                       type: string
 *                       example: PARK0000000001
 *                     gosiwonEsntlId:
 *                       type: string
 *                       example: GOSI0000002130
 *                     structure:
 *                       type: string
 *                       example: 필로티 구조
 *                     auto:
 *                       type: integer
 *                       example: 10
 *                     autoPrice:
 *                       type: integer
 *                       example: 50000
 *                     bike:
 *                       type: integer
 *                       example: 5
 *                     bikePrice:
 *                       type: integer
 *                       example: 30000
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/parking/info', parkingController.getParkingInfo);

/**
 * @swagger
 * /v1/gosiwon/parking/list:
 *   get:
 *     summary: 주차장 목록 조회
 *     description: 전체 주차장 목록을 조회합니다. 고시원 이름 또는 주차장 구조로 검색 가능합니다.
 *     tags: [Gosiwon]
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
 *         example: 1
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           default: 10
 *         description: 한 페이지당 항목 수
 *         example: 10
 *       - in: query
 *         name: gosiwonName
 *         required: false
 *         schema:
 *           type: string
 *         description: 고시원 이름 검색어 (부분 일치)
 *         example: 성수
 *       - in: query
 *         name: structure
 *         required: false
 *         schema:
 *           type: string
 *         description: 주차장 구조 검색어 (부분 일치)
 *         example: 필로티
 *     responses:
 *       200:
 *         description: 주차장 목록 조회 성공
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
 *                   example: 주차장 목록 조회 성공
 *                 data:
 *                   type: object
 *                   properties:
 *                     limit:
 *                       type: integer
 *                       example: 10
 *                     currentPage:
 *                       type: integer
 *                       example: 1
 *                     lastPage:
 *                       type: integer
 *                       example: 5
 *                     totalCount:
 *                       type: integer
 *                       example: 50
 *                     parkingList:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           parkingID:
 *                             type: string
 *                             example: PARK0000000001
 *                           gosiwonEsntlId:
 *                             type: string
 *                             example: GOSI0000002130
 *                           gosiwonName:
 *                             type: string
 *                             example: 성수 고시원
 *                           gosiwonAddress:
 *                             type: string
 *                             example: 서울시 성동구 성수동
 *                           structure:
 *                             type: string
 *                             example: 필로티 구조
 *                           auto:
 *                             type: integer
 *                             example: 10
 *                           autoPrice:
 *                             type: integer
 *                             example: 50000
 *                           bike:
 *                             type: integer
 *                             example: 5
 *                           bikePrice:
 *                             type: integer
 *                             example: 30000
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/parking/list', parkingController.getParkingList);

/**
 * @swagger
 * /v1/gosiwon/parking/create:
 *   post:
 *     summary: 주차장 정보 등록
 *     description: 고시원에 주차장 정보를 등록합니다.
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
 *                 example: GOSI0000002130
 *               structure:
 *                 type: string
 *                 description: 주차장 구조
 *                 example: 필로티 구조
 *               auto:
 *                 type: integer
 *                 description: 자동차 주차 가능 대수
 *                 example: 10
 *               autoPrice:
 *                 type: integer
 *                 description: 자동차 한달 주차비 (원)
 *                 example: 50000
 *               bike:
 *                 type: integer
 *                 description: 오토바이 주차 가능 대수
 *                 example: 5
 *               bikePrice:
 *                 type: integer
 *                 description: 오토바이 한달 주차비 (원)
 *                 example: 30000
 *     responses:
 *       200:
 *         description: 주차장 정보 등록 성공
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
 *                   example: 주차장 정보 등록 성공
 *                 data:
 *                   type: object
 *                   properties:
 *                     parkingID:
 *                       type: string
 *                       example: PARK0000000001
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/parking/create', parkingController.createParking);

/**
 * @swagger
 * /v1/gosiwon/parking/update:
 *   put:
 *     summary: 주차장 정보 수정
 *     description: 주차장 정보를 수정합니다.
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
 *               - parkingID
 *             properties:
 *               parkingID:
 *                 type: string
 *                 description: 주차장 고유아이디
 *                 example: PARK0000000001
 *               structure:
 *                 type: string
 *                 description: 주차장 구조
 *                 example: 필로티 구조
 *               auto:
 *                 type: integer
 *                 description: 자동차 주차 가능 대수
 *                 example: 10
 *               autoPrice:
 *                 type: integer
 *                 description: 자동차 한달 주차비 (원)
 *                 example: 50000
 *               bike:
 *                 type: integer
 *                 description: 오토바이 주차 가능 대수
 *                 example: 5
 *               bikePrice:
 *                 type: integer
 *                 description: 오토바이 한달 주차비 (원)
 *                 example: 30000
 *     responses:
 *       200:
 *         description: 주차장 정보 수정 성공
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put('/parking/update', parkingController.updateParking);

/**
 * @swagger
 * /v1/gosiwon/parking/delete:
 *   delete:
 *     summary: 주차장 정보 삭제
 *     description: 주차장 정보를 삭제합니다.
 *     tags: [Gosiwon]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: parkingID
 *         required: true
 *         schema:
 *           type: string
 *         description: 주차장 고유아이디
 *         example: PARK0000000001
 *     responses:
 *       200:
 *         description: 주차장 정보 삭제 성공
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete('/parking/delete', parkingController.deleteParking);

/**
 * @swagger
 * /v1/gosiwon/adminContract:
 *   get:
 *     summary: 관리자 계약 정보 조회
 *     description: gosiwonAdmin 테이블에서 numberOrder ASC로 정렬하여 첫 번째 레코드의 title, content를 조회합니다.
 *     tags: [Gosiwon]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 관리자 계약 정보 조회 성공
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
 *                   example: 관리자 계약 정보 조회 성공
 *                 data:
 *                   type: object
 *                   properties:
 *                     title:
 *                       type: string
 *                       description: 제목
 *                       example: 관리자 계약서
 *                     content:
 *                       type: string
 *                       description: 내용
 *                       example: 계약서 내용...
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/adminContract', gosiwonController.getAdminContract);

module.exports = router;

