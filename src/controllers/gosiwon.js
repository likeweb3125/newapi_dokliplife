const { Op } = require('sequelize');
const { gosiwon, history, mariaDBSequelize } = require('../models');
const jwt = require('jsonwebtoken');
const errorHandler = require('../middleware/error');
const enumConfig = require('../middleware/enum');
const { getWriterAdminId } = require('../utils/auth');
const { next: idsNext } = require('../utils/idsNext');

const CLEAN_DAY_NAMES = ['월', '화', '수', '목', '금', '토', '일'];

const verifyAdminToken = (req) => {
	const authHeader = req.get('Authorization');
	if (!authHeader) {
		errorHandler.errorThrow(401, '토큰이 없습니다.');
	}

	const token = authHeader.split(' ')[1];
	if (!token) {
		errorHandler.errorThrow(401, '토큰 형식이 올바르지 않습니다.');
	}

	let decodedToken;
	try {
		decodedToken = jwt.decode(token);
		console.log('📦 디코딩된 토큰 정보:', decodedToken);
	} catch (err) {
		errorHandler.errorThrow(401, '토큰 디코딩에 실패했습니다.');
	}

	if (!decodedToken || (!decodedToken.admin && !decodedToken.partner)) {
		errorHandler.errorThrow(401, '관리자 정보가 없습니다.');
	}

	if (decodedToken.admin) {
		console.log('👤 관리자 ID:', decodedToken.admin);
	} else if (decodedToken.partner) {
		console.log('👤 파트너 ID:', decodedToken.partner);
	}
	return decodedToken;
};

const GOSIWON_PREFIX = 'GOSI';
const GOSIWON_PADDING = 10;

const HISTORY_PREFIX = 'HISTORY';
const HISTORY_PADDING = 10;

/** gosiwonBuilding.parking, elevator를 DB 저장 형식(^T^, ^F^)으로 변환 */
const normalizeGosiwonBuildingBoolean = (building) => {
	if (!building || typeof building !== 'object') return building;
	const out = { ...building };
	const toCaret = (v) => {
		if (v === '^T^' || v === '^F^') return v;
		const s = v == null ? '' : String(v).trim().toUpperCase();
		if (s === 'T' || s === 'TRUE' || s === '1' || s === 'Y') return '^T^';
		return '^F^';
	};
	if (Object.prototype.hasOwnProperty.call(out, 'parking')) out.parking = toCaret(out.parking);
	if (Object.prototype.hasOwnProperty.call(out, 'elevator')) out.elevator = toCaret(out.elevator);
	return out;
};

// 히스토리 ID 생성 함수
const generateHistoryId = async (transaction) => {
	const latest = await history.findOne({
		attributes: ['esntlId'],
		order: [['esntlId', 'DESC']],
		transaction,
		lock: transaction ? transaction.LOCK.UPDATE : undefined,
	});

	if (!latest || !latest.esntlId) {
		return `${HISTORY_PREFIX}${String(1).padStart(HISTORY_PADDING, '0')}`;
	}

	const numberPart = parseInt(
		latest.esntlId.replace(HISTORY_PREFIX, ''),
		10
	);
	const nextNumber = Number.isNaN(numberPart) ? 1 : numberPart + 1;
	return `${HISTORY_PREFIX}${String(nextNumber).padStart(
		HISTORY_PADDING,
		'0'
	)}`;
};

// TINYINT(1) 필드를 boolean으로 변환하는 공통 함수
const convertTinyIntToBoolean = (obj) => {
	if (!obj || typeof obj !== 'object') return obj;
	
	const booleanFields = [
		'use_deposit',
		'use_sale_commision',
		'use_settlement',
		'is_controlled',
		'is_favorite',
	];
	
	booleanFields.forEach((field) => {
		if (obj[field] !== undefined && obj[field] !== null) {
			obj[field] = obj[field] === 1 || obj[field] === true || obj[field] === '1';
		}
	});
	
	return obj;
};

const generateGosiwonId = async (transaction) => {
	const latest = await gosiwon.findOne({
		attributes: ['esntlId'],
		order: [['esntlId', 'DESC']],
		transaction,
		lock: transaction ? transaction.LOCK.UPDATE : undefined,
	});

	if (!latest || !latest.esntlId) {
		return `${GOSIWON_PREFIX}${String(1).padStart(GOSIWON_PADDING, '0')}`;
	}

	const numberPart = parseInt(
		latest.esntlId.replace(GOSIWON_PREFIX, ''),
		10
	);
	const nextNumber = Number.isNaN(numberPart) ? 1 : numberPart + 1;
	return `${GOSIWON_PREFIX}${String(nextNumber).padStart(
		GOSIWON_PADDING,
		'0'
	)}`;
};

// 고시원 정보 조회
// 토큰에서 관리자 아이디 확인 후, 검색 종류와 검색어로 고시원 정보 조회
exports.getGosiwonInfo = async (req, res, next) => {
	try {
		// 토큰 검증
		verifyAdminToken(req);

		// 요청 파라미터 확인
		const { esntlId } = req.query;

		if (!esntlId) {
			errorHandler.errorThrow(400, 'esntlId 입력해주세요.');
		}

		// 여러 테이블을 조인하여 고시원 정보 조회
		const query = `
                SELECT G.esntlId,G.address,G.address2,G.address3,G.longitude,G.latitude,G.name,G.keeperName,G.keeperHp,G.blog,G.homepage,G.youtube,G.tag,G.phone,G.subway,G.college,G.description,G.qrPoint,G.bank,G.bankAccount,G.accountHolder,G.email,G.corpNumber,G.gsw_metaport,G.serviceNumber,G.use_deposit,G.use_sale_commision,G.saleCommisionStartDate,G.saleCommisionEndDate,G.saleCommision,G.use_settlement,G.settlementReason,G.is_controlled,G.is_favorite,G.penaltyRate,G.penaltyMin, G.contract
                    ,GA.hp adminHP, GA.ceo admin
                    ,GF.safety,GF.fire,GF.vicinity,GF.temp,GF.internet,GF.meal,GF.equipment,GF.sanitation,GF.kitchen,GF.wash,GF.rest,GF.orderData
                    ,GB.floorInfo,GB.useFloor,GB.wallMaterial,GB.elevator,GB.parking
                    ,GU.deposit depositAmount,GU.qualified,GU.minAge,GU.maxAge,GU.minUsedDate,GU.gender,GU.foreignLanguage,GU.orderData useOrderData 
                    ,IGC.gsc_checkin_able_date ableCheckDays, IGC.gsc_sell_able_period ableContractDays, IGC.gsc_checkInTimeStart checkInTimeStart, IGC.gsc_checkInTimeEnd checkInTimeEnd, IGC.gsc_checkOutTime checkOutTime, IGC.gsc_use_checkInTime useCheckInTime, IGC.gsc_use_checkOutTime useCheckOutTime
			FROM gosiwon G 
			LEFT OUTER JOIN room R 
				ON G.esntlId = R.gosiwonEsntlId 
			LEFT OUTER JOIN gosiwonUse GU 
				ON G.esntlId = GU.esntlId 
			LEFT OUTER JOIN gosiwonBuilding GB 
				ON G.esntlId = GB.esntlId 
			LEFT OUTER JOIN gosiwonFacilities GF 
				ON G.esntlId = GF.esntlId 
			LEFT OUTER JOIN gosiwonAdmin GA 
				ON G.adminEsntlId = GA.esntlId 
			LEFT OUTER JOIN il_gosiwon_config IGC 
				ON G.esntlId = IGC.gsw_eid 
			WHERE G.esntlId = :esntlId 
			GROUP BY G.esntlId
		`;
		//위약금비율:penaltyRate
		//최소위약금:penaltyMin
		//부대시설 : rest (^readingRoom^rooftop^fitness)
		//식사제공 : meal (^rice^kimchi^noodle^coffee^)
		//전입신고 : qualified (^T^)		//입실가능기간 : "ableCheckDays": 2,
		//계약가능기간 : "ableContractDays": 10,
		//입실가능시작시간 :"checkInTimeStart": null,
		//입실가능종료시간 :"checkInTimeEnd": null,
		//퇴실시간 :"checkOutTime": null




		const [gosiwonInfo] = await mariaDBSequelize.query(query, {
			replacements: { esntlId: esntlId },
			type: mariaDBSequelize.QueryTypes.SELECT,
		});

		if (!gosiwonInfo) {
			errorHandler.errorThrow(404, '고시원 정보를 찾을 수 없습니다.');
		}

		// TINYINT(1) 필드를 boolean으로 변환
		convertTinyIntToBoolean(gosiwonInfo);

		// useCheckInTime, useCheckOutTime을 boolean으로 변환
		gosiwonInfo.useCheckInTime = gosiwonInfo.useCheckInTime === 1 || gosiwonInfo.useCheckInTime === true || gosiwonInfo.useCheckInTime === '1' ? true : false;
		gosiwonInfo.useCheckOutTime = gosiwonInfo.useCheckOutTime === 1 || gosiwonInfo.useCheckOutTime === true || gosiwonInfo.useCheckOutTime === '1' ? true : false;

		// /v1/gosiwon/names와 동일한 형식의 추가 정보 추가
		gosiwonInfo.address = gosiwonInfo.address || '';
		gosiwonInfo.isControlled = Number(gosiwonInfo.is_controlled) === 1 ? '관제' : '';
		gosiwonInfo.deposit = Number(gosiwonInfo.use_deposit) === 1 ? '보증급 관리' : '';
		gosiwonInfo.settle = Number(gosiwonInfo.use_settlement) === 1 ? '정산지급' : '';

		// 결과 반환
		errorHandler.successThrow(res, '고시원 정보 조회 성공', gosiwonInfo);
	} catch (err) {
		next(err);
	}
};

// 관리자 계약 정보 조회
exports.getAdminContract = async (req, res, next) => {
	try {
		// 토큰 검증
		verifyAdminToken(req);

		// adminContract 테이블에서 numberOrder ASC로 정렬하여 첫 번째 레코드 조회
		const query = `
			SELECT title, content
			FROM adminContract
			ORDER BY numberOrder ASC
			LIMIT 1
		`;

		const [adminContract] = await mariaDBSequelize.query(query, {
			type: mariaDBSequelize.QueryTypes.SELECT,
		});

		if (!adminContract) {
			errorHandler.errorThrow(404, '관리자 계약 정보를 찾을 수 없습니다.');
		}

		// 결과 반환
		errorHandler.successThrow(res, '관리자 계약 정보 조회 성공', adminContract);
	} catch (err) {
		next(err);
	}
};

// 대시보드 집계 (전체/관제/제휴/전산지급/정산중지/수수료할인 고시원 수)
exports.getDashboardCnt = async (req, res, next) => {
	try {
		verifyAdminToken(req);

		const [row] = await mariaDBSequelize.query(
			`
			SELECT
				COUNT(*) AS total,
				SUM(CASE WHEN is_controlled = 1 THEN 1 ELSE 0 END) AS controlled,
				SUM(CASE WHEN is_controlled = 0 THEN 1 ELSE 0 END) AS partner,
				SUM(CASE WHEN use_settlement = 1 THEN 1 ELSE 0 END) AS useSettlement,
				SUM(CASE WHEN use_settlement = 0 THEN 1 ELSE 0 END) AS settlementStopped,
				SUM(CASE WHEN (COALESCE(CAST(commision AS DECIMAL(10,2)), 7) < 7) THEN 1 ELSE 0 END) AS commissionDiscount
			FROM gosiwon
			`,
			{ type: mariaDBSequelize.QueryTypes.SELECT }
		);

		const data = {
			total: Number(row?.total ?? 0),
			controlled: Number(row?.controlled ?? 0),
			partner: Number(row?.partner ?? 0),
			useSettlement: Number(row?.useSettlement ?? 0),
			settlementStopped: Number(row?.settlementStopped ?? 0),
			commissionDiscount: Number(row?.commissionDiscount ?? 0),
		};

		errorHandler.successThrow(res, '대시보드 집계 조회 성공', data);
	} catch (err) {
		next(err);
	}
};

// 고시원 이름 목록 조회
exports.getGosiwonNames = async (req, res, next) => {
	try {
		verifyAdminToken(req);

		const { searchValue, limit } = req.query;

		if (!searchValue) {
			errorHandler.errorThrow(400, '검색어를 입력해주세요.');
		}

		const take = limit && parseInt(limit, 10) > 0 ? parseInt(limit, 10) : 10;

		const gosiwonNames = await gosiwon.findAll({
			where: {
				name: {
					[Op.like]: `%${searchValue}%`,
				},
			},
			attributes: ['name', 'esntlId', 'address', 'is_controlled', 'use_deposit', 'use_settlement'],
			limit: take,
			order: [['name', 'ASC']],
			raw: true,
		});

		const names = gosiwonNames.map((item) => ({
			name: item.name,
			esntID: item.esntlId,
			address: item.address || '',
			isControlled: Number(item.is_controlled) === 1 ? '관제' : '',
			deposit: Number(item.use_deposit) === 1 ? '보증급 관리' : '',
			settle: Number(item.use_settlement) === 1 ? '정산지급' : '',
		}));

		errorHandler.successThrow(res, '고시원 이름 목록 조회 성공', names);
	} catch (err) {
		next(err);
	}
};

// 즐겨찾기 고시원 목록 조회
exports.getFavoriteGosiwonList = async (req, res, next) => {
	try {
		verifyAdminToken(req);

		const favoriteGosiwons = await gosiwon.findAll({
			where: {
				is_favorite: 1,
			},
			attributes: ['esntlId', 'name'],
			order: [['name', 'ASC']],
			raw: true,
		});

		const result = favoriteGosiwons.map((item) => ({
			esntlId: item.esntlId,
			name: item.name,
		}));

		errorHandler.successThrow(res, '즐겨찾기 고시원 목록 조회 성공', result);
	} catch (err) {
		next(err);
	}
};

// 고시원 즐겨찾기 토글
exports.toggleFavorite = async (req, res, next) => {
	const transaction = await mariaDBSequelize.transaction();
	try {
		const decodedToken = verifyAdminToken(req);
		const writerAdminId = getWriterAdminId(decodedToken);

				const {
			esntlId,
			ableCheckDays,
			ableContractDays,
			checkInTimeStart,
			checkInTimeEnd,
			checkOutTime,
			useCheckInTime,
			useCheckOutTime,
		} = req.body;

		if (!esntlId) {
			errorHandler.errorThrow(400, 'esntlId 입력해주세요.');
		}

		// 고시원 정보 조회
		const gosiwonInfo = await gosiwon.findOne({
			where: {
				esntlId: esntlId,
			},
			raw: true,
		});

		if (!gosiwonInfo) {
			errorHandler.errorThrow(404, '고시원 정보를 찾을 수 없습니다.');
		}

		// 현재 즐겨찾기 상태 확인 및 토글
		const currentFavorite = gosiwonInfo.is_favorite || 0;
		const newFavorite = currentFavorite === 1 ? 0 : 1;

		// 즐겨찾기 상태 업데이트
		await gosiwon.update(
			{
				is_favorite: newFavorite,
			},
			{
				where: {
					esntlId: esntlId,
				},
				transaction,
			}
		);

		// History 기록 생성
		try {
			const historyId = await generateHistoryId(transaction);
			const action = newFavorite === 1 ? '추가' : '제거';
			const historyContent = `고시원 즐겨찾기 ${action}: ${gosiwonInfo.name}`;

			await history.create(
				{
					esntlId: historyId,
					gosiwonEsntlId: esntlId,
					etcEsntlId: esntlId,
					content: historyContent,
					category: 'GOSIWON',
					priority: 'NORMAL',
					publicRange: 0,
					writerAdminId: writerAdminId,
					writerType: 'ADMIN',
					deleteYN: 'N',
				},
				{ transaction }
			);
		} catch (historyErr) {
			console.error('History 생성 실패:', historyErr);
			// History 생성 실패해도 즐겨찾기 토글 프로세스는 계속 진행
		}

		await transaction.commit();

		// 업데이트된 정보 반환
		const updatedInfo = await gosiwon.findOne({
			where: {
				esntlId: esntlId,
			},
			attributes: ['esntlId', 'name', 'is_favorite'],
			raw: true,
		});

		// TINYINT(1) 필드를 boolean으로 변환
		convertTinyIntToBoolean(updatedInfo);

		errorHandler.successThrow(
			res,
			`즐겨찾기 ${newFavorite === 1 ? '추가' : '제거'} 성공`,
			{
				esntlId: updatedInfo.esntlId,
				name: updatedInfo.name,
				isFavorite: updatedInfo.is_favorite,
			}
		);
	} catch (err) {
		await transaction.rollback();
		next(err);
	}
};

// 고시원 정보 등록
exports.createGosiwon = async (req, res, next) => {
	const transaction = await mariaDBSequelize.transaction();
	try {
		const decodedToken = verifyAdminToken(req);
		const writerAdminId = getWriterAdminId(decodedToken);

		const {
			name,
			address,
			address2,
			address3,
			longitude,
			latitude,
			gsw_grade,
			numOfRooms,
			homepage,
			blog,
			youtube,
			gsw_metaport,
			keeperName,
			keeperHp,
			phone,
			tag,
			email,
			subway,
			college,
			corpNumber,
			bank,
			bankAccount,
			commision,
			description,
			manager,
			point,
			acceptDate,
			gsw_signup_path_cd,
			gsw_signup_path_etc,
			alarmTalk,
			alarmEmail,
			process,
			rejectText,
			contractText,
			monthCalculate,
			accountHolder,
			contract,
			contractFile,
			contractFileOrgName,
			serviceNumber,
			district,
			is_controlled,
			penaltyRate,
			penaltyMin,
			qrPoint,
			use_deposit,
			use_sale_commision,
			saleCommisionStartDate,
			saleCommisionEndDate,
			saleCommision,
			use_settlement,
			settlementReason,
			// 관련 테이블 데이터
			gosiwonUse,
			gosiwonBuilding,
			gosiwonFacilities,
			// il_gosiwon_config 데이터
			ableCheckDays,
			ableContractDays,
			checkInTimeStart,
			checkInTimeEnd,
			checkOutTime,
			useCheckInTime,
			useCheckOutTime,
		} = req.body;

		if (!name) {
			errorHandler.errorThrow(400, '고시원 이름을 입력해주세요.');
		}

		if (!decodedToken.admin && !decodedToken.partner) {
			errorHandler.errorThrow(400, '관리자 정보가 필요합니다.');
		}

		const esntlId = await generateGosiwonId(transaction);

		// gosiwon 테이블에 데이터 삽입
		await gosiwon.create(
			{
				esntlId: esntlId,
				name: name || null,
				address: address || null,
				address2: address2 || null,
				address3: address3 || null,
				longitude: longitude || null,
				latitude: latitude || null,
				gsw_grade: gsw_grade || '',
				numOfRooms: numOfRooms || null,
				homepage: homepage || null,
				blog: blog || null,
				youtube: youtube || null,
				gsw_metaport: gsw_metaport || null,
				keeperName: keeperName || null,
				keeperHp: keeperHp || null,
				phone: phone || null,
				tag: tag || null,
				email: email || null,
				subway: subway || null,
				college: college || null,
				corpNumber: corpNumber || null,
				bank: bank || null,
				bankAccount: bankAccount || null,
				commision: commision || '7',
				description: description || null,
				manager: manager || null,
				point: point !== undefined ? parseInt(point, 10) : 0,
				acceptDate: acceptDate || null,
				gsw_signup_path_cd: gsw_signup_path_cd || null,
				gsw_signup_path_etc: gsw_signup_path_etc || '',
				alarmTalk: alarmTalk || null,
				alarmEmail: alarmEmail || null,
				process: process || null,
				rejectText: rejectText || null,
				contractText: contractText || null,
				monthCalculate: monthCalculate || null,
				accountHolder: accountHolder || null,
				contract: contract || null,
				contractFile: contractFile || null,
				contractFileOrgName: contractFileOrgName || null,
				serviceNumber: serviceNumber || null,
				district: district || null,
				adminEsntlId: decodedToken.admin || decodedToken.partner,
				is_controlled: is_controlled !== undefined ? (is_controlled === true || is_controlled === 'true' || is_controlled === 1 ? 1 : 0) : 0,
				// penaltyRate는 INT 컬럼이므로 빈 문자열이 들어오면 null 처리
				penaltyRate:
					penaltyRate !== undefined && penaltyRate !== ''
						? parseInt(penaltyRate, 10)
						: null,
				// penaltyMin도 숫자 컬럼이므로 빈 문자열이면 0, 숫자면 정수로 변환
				penaltyMin:
					penaltyMin !== undefined && penaltyMin !== ''
						? parseInt(penaltyMin, 10) || 0
						: 0,
				qrPoint: qrPoint || null,
				use_deposit: use_deposit !== undefined ? (use_deposit === true || use_deposit === 'true' || use_deposit === 1 ? 1 : 0) : 0,
				use_sale_commision: use_sale_commision !== undefined ? (use_sale_commision === true || use_sale_commision === 'true' || use_sale_commision === 1 ? 1 : 0) : 0,
				saleCommisionStartDate: saleCommisionStartDate || null,
				saleCommisionEndDate: saleCommisionEndDate || null,
				saleCommision: saleCommision !== undefined ? saleCommision : null,
				use_settlement: use_settlement !== undefined ? (use_settlement === true || use_settlement === 'true' || use_settlement === 1 ? 1 : 0) : 0,
				settlementReason: settlementReason || null,
			},
			{ transaction }
		);

		// gosiwonUse 테이블에 데이터 삽입 (데이터가 있는 경우)
		if (gosiwonUse) {
			const useColumns = Object.keys(gosiwonUse)
				.map((key) => `\`${key}\``)
				.join(', ');
			const useValues = Object.keys(gosiwonUse)
				.map(() => '?')
				.join(', ');
			const useParams = [esntlId, ...Object.values(gosiwonUse)];

			await mariaDBSequelize.query(
				`INSERT INTO gosiwonUse (esntlId, ${useColumns}) VALUES (?, ${useValues})`,
				{
					replacements: useParams,
					transaction,
					type: mariaDBSequelize.QueryTypes.INSERT,
				}
			);
		}

		// gosiwonBuilding 테이블에 데이터 삽입 (데이터가 있는 경우). parking/elevator는 ^T^/^F^ 형식으로 저장
		if (gosiwonBuilding) {
			const building = normalizeGosiwonBuildingBoolean(gosiwonBuilding);
			const buildingColumns = Object.keys(building)
				.map((key) => `\`${key}\``)
				.join(', ');
			const buildingValues = Object.keys(building)
				.map(() => '?')
				.join(', ');
			const buildingParams = [esntlId, ...Object.values(building)];

			await mariaDBSequelize.query(
				`INSERT INTO gosiwonBuilding (esntlId, ${buildingColumns}) VALUES (?, ${buildingValues})`,
				{
					replacements: buildingParams,
					transaction,
					type: mariaDBSequelize.QueryTypes.INSERT,
				}
			);
		}

		// gosiwonFacilities 테이블에 데이터 삽입 (데이터가 있는 경우)
		if (gosiwonFacilities) {
			const facilitiesColumns = Object.keys(gosiwonFacilities)
				.map((key) => `\`${key}\``)
				.join(', ');
			const facilitiesValues = Object.keys(gosiwonFacilities)
				.map(() => '?')
				.join(', ');
			const facilitiesParams = [esntlId, ...Object.values(gosiwonFacilities)];

			await mariaDBSequelize.query(
				`INSERT INTO gosiwonFacilities (esntlId, ${facilitiesColumns}) VALUES (?, ${facilitiesValues})`,
				{
					replacements: facilitiesParams,
					transaction,
					type: mariaDBSequelize.QueryTypes.INSERT,
				}
			);
		}

		// il_gosiwon_config 테이블에 데이터 삽입/업데이트 (데이터가 있는 경우)
		if (ableCheckDays !== undefined || ableContractDays !== undefined || checkInTimeStart !== undefined || checkInTimeEnd !== undefined || checkOutTime !== undefined) {
			const configData = {};
			if (ableCheckDays !== undefined) configData.gsc_checkin_able_date = ableCheckDays;
			if (ableContractDays !== undefined) configData.gsc_sell_able_period = ableContractDays;
			if (checkInTimeStart !== undefined) configData.gsc_checkInTimeStart = checkInTimeStart;
			if (checkInTimeEnd !== undefined) configData.gsc_checkInTimeEnd = checkInTimeEnd;
			if (checkOutTime !== undefined) configData.gsc_checkOutTime = checkOutTime;
			
			// 등록한 관리자 ID 필수 추가 (고시원 관리자 ID 또는 등록한 관리자 ID)
			const registrantId = decodedToken.admin || decodedToken.partner || writerAdminId;

			// 먼저 존재 여부 확인
			const [existingConfig] = await mariaDBSequelize.query(
				`SELECT gsw_eid FROM il_gosiwon_config WHERE gsw_eid = ?`,
				{
					replacements: [esntlId],
					type: mariaDBSequelize.QueryTypes.SELECT,
					transaction,
				}
			);

			if (existingConfig) {
				// UPDATE 시: 업데이트 시간(NOW() = 한국 시간)과 업데이트한 관리자 ID 추가
				configData.gsc_update_dtm = null; // SQL에서 NOW() 사용
				configData.gsc_updater_id = registrantId;
				const configKeys = Object.keys(configData);
				const configSetClause = configKeys
					.map((key) => (key === 'gsc_update_dtm' ? '`gsc_update_dtm` = NOW()' : `\`${key}\` = ?`))
					.join(', ');
				const configParams = [...configKeys.filter((k) => k !== 'gsc_update_dtm').map((k) => configData[k]), esntlId];

				await mariaDBSequelize.query(
					`UPDATE il_gosiwon_config SET ${configSetClause} WHERE gsw_eid = ?`,
					{
						replacements: configParams,
						transaction,
						type: mariaDBSequelize.QueryTypes.UPDATE,
					}
				);
			} else {
				// INSERT 시: 등록자 ID 추가 (등록/수정 시각은 테이블 DEFAULT 또는 DB NOW())
				configData.gsc_registrant_id = registrantId;
				const configColumns = Object.keys(configData)
					.map((key) => `\`${key}\``)
					.join(', ');
				const configValues = Object.keys(configData)
					.map(() => '?')
					.join(', ');
				const configInsertParams = [esntlId, ...Object.values(configData)];

				await mariaDBSequelize.query(
					`INSERT INTO il_gosiwon_config (gsw_eid, ${configColumns}) VALUES (?, ${configValues})`,
					{
						replacements: configInsertParams,
						transaction,
						type: mariaDBSequelize.QueryTypes.INSERT,
					}
				);
			}
		}

		// History 기록 생성
		try {
			const historyId = await generateHistoryId(transaction);
			const historyContent = `고시원 생성: ${name}${address ? `, 주소: ${address}` : ''}${phone ? `, 전화: ${phone}` : ''}${keeperName ? `, 관리자: ${keeperName}` : ''}`;

			await history.create(
				{
					esntlId: historyId,
					gosiwonEsntlId: esntlId,
					etcEsntlId: esntlId,
					content: historyContent,
					category: 'GOSIWON',
					priority: 'NORMAL',
					publicRange: 0,
					writerAdminId: writerAdminId,
					writerType: 'ADMIN',
					deleteYN: 'N',
				},
				{ transaction }
			);
		} catch (historyErr) {
			console.error('History 생성 실패:', historyErr);
			// History 생성 실패해도 고시원 생성 프로세스는 계속 진행
		}

		await transaction.commit();

		errorHandler.successThrow(res, '고시원 정보 등록 성공', { esntlId: esntlId });
	} catch (err) {
		await transaction.rollback();
		next(err);
	}
};

// 고시원 정보 수정
exports.updateGosiwon = async (req, res, next) => {
	const transaction = await mariaDBSequelize.transaction();
	try {
		const decodedToken = verifyAdminToken(req);
		const writerAdminId = getWriterAdminId(decodedToken);

		const { 
			esntlId, 
			gosiwonUse, 
			gosiwonBuilding, 
			gosiwonFacilities,
			// il_gosiwon_config 데이터
			ableCheckDays,
			ableContractDays,
			checkInTimeStart,
			checkInTimeEnd,
			checkOutTime,
			useCheckInTime,
			useCheckOutTime,
		} = req.body;

		if (!esntlId) {
			errorHandler.errorThrow(400, 'esntlId를 입력해주세요.');
		}

		// 조인 쿼리로 고시원 정보 확인
		const checkQuery = `
			SELECT G.esntlId
			FROM gosiwon G 
			WHERE G.esntlId = :esntlId
		`;

		const [gosiwonInfo] = await mariaDBSequelize.query(checkQuery, {
			replacements: { esntlId: esntlId },
			type: mariaDBSequelize.QueryTypes.SELECT,
			transaction,
		});

		if (!gosiwonInfo) {
			errorHandler.errorThrow(404, '고시원 정보를 찾을 수 없습니다.');
		}

		// 수정 전 고시원 정보 조회 (변경사항 추적 및 history 기록용)
		const beforeGosiwon = await gosiwon.findByPk(esntlId, {
			transaction,
		});

		const updateData = {};

		// 요청된 필드만 업데이트
		if (req.body.name !== undefined) updateData.name = req.body.name;
		if (req.body.address !== undefined) updateData.address = req.body.address;
		if (req.body.address2 !== undefined) updateData.address2 = req.body.address2;
		if (req.body.address3 !== undefined) updateData.address3 = req.body.address3;
		if (req.body.longitude !== undefined) updateData.longitude = req.body.longitude;
		if (req.body.latitude !== undefined) updateData.latitude = req.body.latitude;
		if (req.body.gsw_grade !== undefined) updateData.gsw_grade = req.body.gsw_grade;
		if (req.body.numOfRooms !== undefined) updateData.numOfRooms = req.body.numOfRooms;
		if (req.body.homepage !== undefined) updateData.homepage = req.body.homepage;
		if (req.body.blog !== undefined) updateData.blog = req.body.blog;
		if (req.body.youtube !== undefined) updateData.youtube = req.body.youtube;
		if (req.body.gsw_metaport !== undefined) updateData.gsw_metaport = req.body.gsw_metaport;
		if (req.body.keeperName !== undefined) updateData.keeperName = req.body.keeperName;
		if (req.body.keeperHp !== undefined) updateData.keeperHp = req.body.keeperHp;
		if (req.body.phone !== undefined) updateData.phone = req.body.phone;
		if (req.body.tag !== undefined) updateData.tag = req.body.tag;
		if (req.body.email !== undefined) updateData.email = req.body.email;
		if (req.body.subway !== undefined) updateData.subway = req.body.subway;
		if (req.body.college !== undefined) updateData.college = req.body.college;
		if (req.body.corpNumber !== undefined) updateData.corpNumber = req.body.corpNumber;
		if (req.body.bank !== undefined) updateData.bank = req.body.bank;
		if (req.body.bankAccount !== undefined) updateData.bankAccount = req.body.bankAccount;
		if (req.body.commision !== undefined) updateData.commision = req.body.commision;
		if (req.body.description !== undefined) updateData.description = req.body.description;
		if (req.body.manager !== undefined) updateData.manager = req.body.manager;
		if (req.body.point !== undefined) updateData.point = parseInt(req.body.point, 10);
		if (req.body.acceptDate !== undefined) updateData.acceptDate = req.body.acceptDate;
		if (req.body.gsw_signup_path_cd !== undefined) updateData.gsw_signup_path_cd = req.body.gsw_signup_path_cd;
		if (req.body.gsw_signup_path_etc !== undefined) updateData.gsw_signup_path_etc = req.body.gsw_signup_path_etc;
		if (req.body.alarmTalk !== undefined) updateData.alarmTalk = req.body.alarmTalk;
		if (req.body.alarmEmail !== undefined) updateData.alarmEmail = req.body.alarmEmail;
		if (req.body.process !== undefined) updateData.process = req.body.process;
		if (req.body.rejectText !== undefined) updateData.rejectText = req.body.rejectText;
		if (req.body.contractText !== undefined) updateData.contractText = req.body.contractText;
		if (req.body.monthCalculate !== undefined) updateData.monthCalculate = req.body.monthCalculate;
		if (req.body.accountHolder !== undefined) updateData.accountHolder = req.body.accountHolder;
		if (req.body.contract !== undefined) updateData.contract = req.body.contract;
		if (req.body.contractFile !== undefined) updateData.contractFile = req.body.contractFile;
		if (req.body.contractFileOrgName !== undefined) updateData.contractFileOrgName = req.body.contractFileOrgName;
		if (req.body.serviceNumber !== undefined) updateData.serviceNumber = req.body.serviceNumber;
		if (req.body.district !== undefined) updateData.district = req.body.district;
		if (req.body.is_controlled !== undefined) {
			updateData.is_controlled = req.body.is_controlled === true || req.body.is_controlled === 'true' || req.body.is_controlled === 1 ? 1 : 0;
		}
		if (req.body.penaltyRate !== undefined) {
			// 빈 문자열이 오면 null, 숫자 문자열이면 정수 변환
			if (req.body.penaltyRate === '' || req.body.penaltyRate === null) {
				updateData.penaltyRate = null;
			} else {
				const parsed = parseInt(req.body.penaltyRate, 10);
				updateData.penaltyRate = Number.isNaN(parsed) ? null : parsed;
			}
		}
		if (req.body.penaltyMin !== undefined) {
			// penaltyMin도 숫자 컬럼이므로 빈 문자열이면 0, 숫자면 정수로 변환
			if (req.body.penaltyMin === '' || req.body.penaltyMin === null) {
				updateData.penaltyMin = 0;
			} else {
				const parsedMin = parseInt(req.body.penaltyMin, 10);
				updateData.penaltyMin = Number.isNaN(parsedMin) ? 0 : parsedMin;
			}
		}
		if (req.body.qrPoint !== undefined) updateData.qrPoint = req.body.qrPoint;
		if (req.body.use_deposit !== undefined) {
			updateData.use_deposit = req.body.use_deposit === true || req.body.use_deposit === 'true' || req.body.use_deposit === 1 ? 1 : 0;
		}
		if (req.body.use_sale_commision !== undefined) {
			updateData.use_sale_commision = req.body.use_sale_commision === true || req.body.use_sale_commision === 'true' || req.body.use_sale_commision === 1 ? 1 : 0;
		}
		if (req.body.saleCommisionStartDate !== undefined) updateData.saleCommisionStartDate = req.body.saleCommisionStartDate;
		if (req.body.saleCommisionEndDate !== undefined) updateData.saleCommisionEndDate = req.body.saleCommisionEndDate;
		if (req.body.saleCommision !== undefined) updateData.saleCommision = req.body.saleCommision;
		if (req.body.use_settlement !== undefined) {
			updateData.use_settlement = req.body.use_settlement === true || req.body.use_settlement === 'true' || req.body.use_settlement === 1 ? 1 : 0;
		}
		if (req.body.settlementReason !== undefined) updateData.settlementReason = req.body.settlementReason;
		if (req.body.update_dtm !== undefined) updateData.update_dtm = mariaDBSequelize.literal('NOW()');

		// gosiwon 테이블 업데이트
		if (Object.keys(updateData).length > 0) {
			await gosiwon.update(updateData, {
				where: { esntlId: esntlId },
				transaction,
			});
		}

		// gosiwonUse 테이블 업데이트 (데이터가 있는 경우)
		if (gosiwonUse) {
			const useSetClause = Object.keys(gosiwonUse)
				.map((key) => `\`${key}\` = ?`)
				.join(', ');
			const useParams = [...Object.values(gosiwonUse), esntlId];

			// 먼저 존재 여부 확인
			const [existingUse] = await mariaDBSequelize.query(
				`SELECT esntlId FROM gosiwonUse WHERE esntlId = ?`,
				{
					replacements: [esntlId],
					type: mariaDBSequelize.QueryTypes.SELECT,
					transaction,
				}
			);

			if (existingUse) {
				await mariaDBSequelize.query(
					`UPDATE gosiwonUse SET ${useSetClause} WHERE esntlId = ?`,
					{
						replacements: useParams,
						transaction,
						type: mariaDBSequelize.QueryTypes.UPDATE,
					}
				);
			} else {
				const useColumns = Object.keys(gosiwonUse)
					.map((key) => `\`${key}\``)
					.join(', ');
				const useValues = Object.keys(gosiwonUse)
					.map(() => '?')
					.join(', ');
				const insertParams = [esntlId, ...Object.values(gosiwonUse)];

				await mariaDBSequelize.query(
					`INSERT INTO gosiwonUse (esntlId, ${useColumns}) VALUES (?, ${useValues})`,
					{
						replacements: insertParams,
						transaction,
						type: mariaDBSequelize.QueryTypes.INSERT,
					}
				);
			}
		}

		// gosiwonBuilding 테이블 업데이트 (데이터가 있는 경우). parking/elevator는 ^T^/^F^ 형식으로 저장
		if (gosiwonBuilding) {
			const building = normalizeGosiwonBuildingBoolean(gosiwonBuilding);
			const buildingSetClause = Object.keys(building)
				.map((key) => `\`${key}\` = ?`)
				.join(', ');
			const buildingParams = [...Object.values(building), esntlId];

			const [existingBuilding] = await mariaDBSequelize.query(
				`SELECT esntlId FROM gosiwonBuilding WHERE esntlId = ?`,
				{
					replacements: [esntlId],
					type: mariaDBSequelize.QueryTypes.SELECT,
					transaction,
				}
			);

			if (existingBuilding) {
				await mariaDBSequelize.query(
					`UPDATE gosiwonBuilding SET ${buildingSetClause} WHERE esntlId = ?`,
					{
						replacements: buildingParams,
						transaction,
						type: mariaDBSequelize.QueryTypes.UPDATE,
					}
				);
			} else {
				const buildingColumns = Object.keys(building)
					.map((key) => `\`${key}\``)
					.join(', ');
				const buildingValues = Object.keys(building)
					.map(() => '?')
					.join(', ');
				const insertParams = [esntlId, ...Object.values(building)];

				await mariaDBSequelize.query(
					`INSERT INTO gosiwonBuilding (esntlId, ${buildingColumns}) VALUES (?, ${buildingValues})`,
					{
						replacements: insertParams,
						transaction,
						type: mariaDBSequelize.QueryTypes.INSERT,
					}
				);
			}
		}

		// gosiwonFacilities 테이블 업데이트 (데이터가 있는 경우)
		if (gosiwonFacilities) {
			const facilitiesSetClause = Object.keys(gosiwonFacilities)
				.map((key) => `\`${key}\` = ?`)
				.join(', ');
			const facilitiesParams = [...Object.values(gosiwonFacilities), esntlId];

			const [existingFacilities] = await mariaDBSequelize.query(
				`SELECT esntlId FROM gosiwonFacilities WHERE esntlId = ?`,
				{
					replacements: [esntlId],
					type: mariaDBSequelize.QueryTypes.SELECT,
					transaction,
				}
			);

			if (existingFacilities) {
				await mariaDBSequelize.query(
					`UPDATE gosiwonFacilities SET ${facilitiesSetClause} WHERE esntlId = ?`,
					{
						replacements: facilitiesParams,
						transaction,
						type: mariaDBSequelize.QueryTypes.UPDATE,
					}
				);
			} else {
				const facilitiesColumns = Object.keys(gosiwonFacilities)
					.map((key) => `\`${key}\``)
					.join(', ');
				const facilitiesValues = Object.keys(gosiwonFacilities)
					.map(() => '?')
					.join(', ');
				const insertParams = [esntlId, ...Object.values(gosiwonFacilities)];

				await mariaDBSequelize.query(
					`INSERT INTO gosiwonFacilities (esntlId, ${facilitiesColumns}) VALUES (?, ${facilitiesValues})`,
					{
						replacements: insertParams,
						transaction,
						type: mariaDBSequelize.QueryTypes.INSERT,
					}
				);
			}
		}

		// il_gosiwon_config 테이블 업데이트 (데이터가 있는 경우)
		if (ableCheckDays !== undefined || ableContractDays !== undefined || checkInTimeStart !== undefined || checkInTimeEnd !== undefined || checkOutTime !== undefined) {
			const configData = {};
			if (ableCheckDays !== undefined) configData.gsc_checkin_able_date = ableCheckDays;
			if (ableContractDays !== undefined) configData.gsc_sell_able_period = ableContractDays;
			if (checkInTimeStart !== undefined) configData.gsc_checkInTimeStart = checkInTimeStart;
			if (checkInTimeEnd !== undefined) configData.gsc_checkInTimeEnd = checkInTimeEnd;
			if (checkOutTime !== undefined) configData.gsc_checkOutTime = checkOutTime;

			const [existingConfig] = await mariaDBSequelize.query(
				`SELECT gsw_eid FROM il_gosiwon_config WHERE gsw_eid = ?`,
				{
					replacements: [esntlId],
					type: mariaDBSequelize.QueryTypes.SELECT,
					transaction,
				}
			);

			if (existingConfig) {
				const configSetClause = Object.keys(configData)
					.map((key) => `\`${key}\` = ?`)
					.join(', ');
				const configParams = [...Object.values(configData), esntlId];

				await mariaDBSequelize.query(
					`UPDATE il_gosiwon_config SET ${configSetClause} WHERE gsw_eid = ?`,
					{
						replacements: configParams,
						transaction,
						type: mariaDBSequelize.QueryTypes.UPDATE,
					}
				);
			} else {
				const configColumns = Object.keys(configData)
					.map((key) => `\`${key}\``)
					.join(', ');
				const configValues = Object.keys(configData)
					.map(() => '?')
					.join(', ');
				const configInsertParams = [esntlId, ...Object.values(configData)];

				await mariaDBSequelize.query(
					`INSERT INTO il_gosiwon_config (gsw_eid, ${configColumns}) VALUES (?, ${configValues})`,
					{
						replacements: configInsertParams,
						transaction,
						type: mariaDBSequelize.QueryTypes.INSERT,
					}
				);
			}
		}

		// History 기록 생성 (변경사항 추적)
		try {
			if (Object.keys(updateData).length > 0) {
				const historyId = await generateHistoryId(transaction);
				const changes = [];
				
				// 주요 필드 변경사항 추적
				if (updateData.name && updateData.name !== beforeGosiwon.name) {
					changes.push(`이름: ${beforeGosiwon.name} → ${updateData.name}`);
				}
				if (updateData.address && updateData.address !== beforeGosiwon.address) {
					changes.push(`주소 변경`);
				}
				if (updateData.phone && updateData.phone !== beforeGosiwon.phone) {
					changes.push(`전화번호 변경`);
				}
				if (updateData.keeperName && updateData.keeperName !== beforeGosiwon.keeperName) {
					changes.push(`관리자명: ${beforeGosiwon.keeperName} → ${updateData.keeperName}`);
				}
				if (updateData.use_deposit !== undefined && updateData.use_deposit !== beforeGosiwon.use_deposit) {
					changes.push(`보증금 사용: ${beforeGosiwon.use_deposit ? 'Y' : 'N'} → ${updateData.use_deposit ? 'Y' : 'N'}`);
				}
				if (updateData.use_sale_commision !== undefined && updateData.use_sale_commision !== beforeGosiwon.use_sale_commision) {
					changes.push(`판매 수수료 사용: ${beforeGosiwon.use_sale_commision ? 'Y' : 'N'} → ${updateData.use_sale_commision ? 'Y' : 'N'}`);
				}
				if (updateData.use_settlement !== undefined && updateData.use_settlement !== beforeGosiwon.use_settlement) {
					changes.push(`정산 사용: ${beforeGosiwon.use_settlement ? 'Y' : 'N'} → ${updateData.use_settlement ? 'Y' : 'N'}`);
				}
				
				// 변경사항이 많으면 요약
				if (changes.length === 0) {
					changes.push('정보 수정');
				} else if (changes.length > 5) {
					changes.splice(5);
					changes.push(`외 ${Object.keys(updateData).length - 5}개 필드 수정`);
				}

				const historyContent = `고시원 정보 수정: ${changes.join(', ')}`;

				await history.create(
					{
						esntlId: historyId,
						gosiwonEsntlId: esntlId,
						etcEsntlId: esntlId,
						content: historyContent,
						category: 'GOSIWON',
						priority: 'NORMAL',
						publicRange: 0,
						writerAdminId: writerAdminId,
						writerType: 'ADMIN',
						deleteYN: 'N',
					},
					{ transaction }
				);
			}
		} catch (historyErr) {
			console.error('History 생성 실패:', historyErr);
			// History 생성 실패해도 고시원 수정 프로세스는 계속 진행
		}

		await transaction.commit();

		errorHandler.successThrow(res, '고시원 정보 수정 성공');
	} catch (err) {
		await transaction.rollback();
		next(err);
	}
};

// 고시원 정보 삭제
exports.deleteGosiwon = async (req, res, next) => {
	const transaction = await mariaDBSequelize.transaction();
	try {
		const decodedToken = verifyAdminToken(req);
		const writerAdminId = getWriterAdminId(decodedToken);

		const { esntlId } = req.query;

		if (!esntlId) {
			errorHandler.errorThrow(400, 'esntlId를 입력해주세요.');
		}

		// 삭제 전 고시원 정보 조회 (history 기록용)
		const gosiwonInfo = await gosiwon.findByPk(esntlId, {
			transaction,
		});

		if (!gosiwonInfo) {
			errorHandler.errorThrow(404, '고시원 정보를 찾을 수 없습니다.');
		}

		// 관련 테이블들 삭제 (CASCADE가 설정되어 있지 않은 경우를 대비)
		// gosiwonUse 삭제
		await mariaDBSequelize.query(
			`DELETE FROM gosiwonUse WHERE esntlId = ?`,
			{
				replacements: [esntlId],
				transaction,
				type: mariaDBSequelize.QueryTypes.DELETE,
			}
		);

		// gosiwonBuilding 삭제
		await mariaDBSequelize.query(
			`DELETE FROM gosiwonBuilding WHERE esntlId = ?`,
			{
				replacements: [esntlId],
				transaction,
				type: mariaDBSequelize.QueryTypes.DELETE,
			}
		);

		// gosiwonFacilities 삭제
		await mariaDBSequelize.query(
			`DELETE FROM gosiwonFacilities WHERE esntlId = ?`,
			{
				replacements: [esntlId],
				transaction,
				type: mariaDBSequelize.QueryTypes.DELETE,
			}
		);

		// gosiwon 테이블 삭제 (메인 테이블은 마지막에 삭제)
		const deleted = await gosiwon.destroy({
			where: {
				esntlId: esntlId,
			},
			transaction,
		});

		if (!deleted) {
			errorHandler.errorThrow(404, '고시원 정보를 찾을 수 없습니다.');
		}

		// History 기록 생성
		try {
			const historyId = await generateHistoryId(transaction);
			const historyContent = `고시원 삭제: ${gosiwonInfo.name}${gosiwonInfo.address ? ` (${gosiwonInfo.address})` : ''}`;

			await history.create(
				{
					esntlId: historyId,
					gosiwonEsntlId: esntlId,
					etcEsntlId: esntlId,
					content: historyContent,
					category: 'GOSIWON',
					priority: 'NORMAL',
					publicRange: 0,
					writerAdminId: writerAdminId,
					writerType: 'ADMIN',
					deleteYN: 'N',
				},
				{ transaction }
			);
		} catch (historyErr) {
			console.error('History 생성 실패:', historyErr);
			// History 생성 실패해도 고시원 삭제 프로세스는 계속 진행
		}

		await transaction.commit();

		errorHandler.successThrow(res, '고시원 정보 삭제 성공');
	} catch (err) {
		await transaction.rollback();
		next(err);
	}
};


// 운영환경설정 조회
exports.getGosiwonConfig = async (req, res, next) => {
	try {
		verifyAdminToken(req);

		const { esntlId } = req.query;

		if (!esntlId) {
			errorHandler.errorThrow(400, 'esntlId를 입력해주세요.');
		}

		// 고시원 존재 여부 확인
		const gosiwonInfo = await gosiwon.findOne({
			where: {
				esntlId: esntlId,
			},
		});

		if (!gosiwonInfo) {
			errorHandler.errorThrow(404, '고시원 정보를 찾을 수 없습니다.');
		}

		// 운영환경설정 조회
				const query = `
			SELECT 
				gsc_checkin_able_date AS ableCheckDays,
				gsc_sell_able_period AS ableContractDays,
				gsc_checkInTimeStart AS checkInTimeStart,
				gsc_checkInTimeEnd AS checkInTimeEnd,
				gsc_checkOutTime AS checkOutTime,
				gsc_use_checkInTime AS useCheckInTime,
				gsc_use_checkOutTime AS useCheckOutTime
			FROM il_gosiwon_config
			WHERE gsw_eid = ?
		`;

		const [configData] = await mariaDBSequelize.query(query, {
			replacements: [esntlId],
			type: mariaDBSequelize.QueryTypes.SELECT,
		});

		const response = {
			esntlId: esntlId,
			ableCheckDays: configData?.ableCheckDays || null,
			ableContractDays: configData?.ableContractDays || null,
			checkInTimeStart: configData?.checkInTimeStart || null,
			checkInTimeEnd: configData?.checkInTimeEnd || null,
			checkOutTime: configData?.checkOutTime || null,
			useCheckInTime: configData?.useCheckInTime === 1 || configData?.useCheckInTime === true || configData?.useCheckInTime === '1',
			useCheckOutTime: configData?.useCheckOutTime === 1 || configData?.useCheckOutTime === true || configData?.useCheckOutTime === '1',
		
			useCheckInTime: configData?.useCheckInTime === 1 || configData?.useCheckInTime === true || configData?.useCheckInTime === '1',
			useCheckOutTime: configData?.useCheckOutTime === 1 || configData?.useCheckOutTime === true || configData?.useCheckOutTime === '1',};

		errorHandler.successThrow(res, '운영환경설정 조회 성공', response);
	} catch (err) {
		next(err);
	}
};
// 운영환경설정 저장
exports.updateGosiwonConfig = async (req, res, next) => {
	const transaction = await mariaDBSequelize.transaction();
	try {
		const decodedToken = verifyAdminToken(req);
		const writerAdminId = getWriterAdminId(decodedToken);

		const {
			esntlId,
			ableCheckDays,
			ableContractDays,
			checkInTimeStart,
			checkInTimeEnd,
			checkOutTime,
			useCheckInTime,
			useCheckOutTime,
		} = req.body;



		if (!esntlId) {
			errorHandler.errorThrow(400, 'esntlId를 입력해주세요.');
		}

		// 고시원 존재 여부 확인
		const gosiwonInfo = await gosiwon.findOne({
			where: {
				esntlId: esntlId,
			},
			transaction,
		});

		if (!gosiwonInfo) {
			errorHandler.errorThrow(404, '고시원 정보를 찾을 수 없습니다.');
		}

		// 저장할 데이터 구성
		const configData = {};
		if (ableCheckDays !== undefined) configData.gsc_checkin_able_date = ableCheckDays;
		if (ableContractDays !== undefined) configData.gsc_sell_able_period = ableContractDays;
		if (checkInTimeStart !== undefined) configData.gsc_checkInTimeStart = checkInTimeStart;
		if (checkInTimeEnd !== undefined) configData.gsc_checkInTimeEnd = checkInTimeEnd;
		if (checkOutTime !== undefined) configData.gsc_checkOutTime = checkOutTime;
		if (useCheckInTime !== undefined)
			configData.gsc_use_checkInTime =
				useCheckInTime === true || useCheckInTime === 'true' || useCheckInTime === 1 ? 1 : 0;
		if (useCheckOutTime !== undefined)
			configData.gsc_use_checkOutTime =
				useCheckOutTime === true || useCheckOutTime === 'true' || useCheckOutTime === 1 ? 1 : 0;
		if (useCheckInTime !== undefined) configData.gsc_use_checkInTime = useCheckInTime === true || useCheckInTime === 'true' || useCheckInTime === 1 ? 1 : 0;
		if (useCheckOutTime !== undefined) configData.gsc_use_checkOutTime = useCheckOutTime === true || useCheckOutTime === 'true' || useCheckOutTime === 1 ? 1 : 0;

		
		if (useCheckInTime !== undefined) configData.gsc_use_checkInTime = useCheckInTime === true || useCheckInTime === 'true' || useCheckInTime === 1 ? 1 : 0;
		if (useCheckOutTime !== undefined) configData.gsc_use_checkOutTime = useCheckOutTime === true || useCheckOutTime === 'true' || useCheckOutTime === 1 ? 1 : 0;// 등록한 관리자 ID 필수 추가
		const registrantId = decodedToken.admin || decodedToken.partner || writerAdminId;

		// 먼저 존재 여부 확인
		const [existingConfig] = await mariaDBSequelize.query(
			`SELECT gsw_eid FROM il_gosiwon_config WHERE gsw_eid = ?`,
			{
				replacements: [esntlId],
				type: mariaDBSequelize.QueryTypes.SELECT,
				transaction,
			}
		);

		if (existingConfig) {
			// UPDATE 시: 업데이트 시간(NOW() = 한국 시간)과 업데이트한 관리자 ID 추가
			configData.gsc_update_dtm = null; // SQL에서 NOW() 사용
			configData.gsc_updater_id = registrantId;
			const configKeys = Object.keys(configData);
			const configSetClause = configKeys
				.map((key) => (key === 'gsc_update_dtm' ? '`gsc_update_dtm` = NOW()' : `\`${key}\` = ?`))
				.join(', ');
			const configParams = [...configKeys.filter((k) => k !== 'gsc_update_dtm').map((k) => configData[k]), esntlId];

			await mariaDBSequelize.query(
				`UPDATE il_gosiwon_config SET ${configSetClause} WHERE gsw_eid = ?`,
				{
					replacements: configParams,
					transaction,
					type: mariaDBSequelize.QueryTypes.UPDATE,
				}
			);
		} else {
			// INSERT 시: 등록자 ID 추가
			configData.gsc_registrant_id = registrantId;

			const configColumns = Object.keys(configData)
				.map((key) => `\`${key}\``)
				.join(', ');
			const configValues = Object.keys(configData)
				.map(() => '?')
				.join(', ');
			const configInsertParams = [esntlId, ...Object.values(configData)];

			if (useCheckInTime !== undefined) changes.push(`체크인시간 사용: ${useCheckInTime ? 'Y' : 'N'}`);
			if (useCheckOutTime !== undefined) changes.push(`체크아웃시간 사용: ${useCheckOutTime ? 'Y' : 'N'}`);
			await mariaDBSequelize.query(
				`INSERT INTO il_gosiwon_config (gsw_eid, ${configColumns}) VALUES (?, ${configValues})`,
				{
					replacements: configInsertParams,
					transaction,
					type: mariaDBSequelize.QueryTypes.INSERT,
				}
			);
		}

		// History 기록 생성
		try {
			const historyId = await generateHistoryId(transaction);
			const changes = [];
			if (ableCheckDays !== undefined) changes.push(`입실가능기간: ${ableCheckDays}`);
			if (ableContractDays !== undefined) changes.push(`계약가능기간: ${ableContractDays}`);
			if (checkInTimeStart !== undefined) changes.push(`입실가능시작시간: ${checkInTimeStart}`);
			if (checkInTimeEnd !== undefined) changes.push(`입실가능종료시간: ${checkInTimeEnd}`);
			if (checkOutTime !== undefined) changes.push(`퇴실시간: ${checkOutTime}`);
			if (useCheckInTime !== undefined) changes.push(`체크인시간 사용: ${useCheckInTime ? 'Y' : 'N'}`);
			if (useCheckOutTime !== undefined) changes.push(`체크아웃시간 사용: ${useCheckOutTime ? 'Y' : 'N'}`);

			const historyContent = `운영환경설정 저장: ${changes.length > 0 ? changes.join(', ') : '설정 변경'}`;

			await history.create(
				{
					esntlId: historyId,
					gosiwonEsntlId: esntlId,
					etcEsntlId: esntlId,
					content: historyContent,
					category: 'GOSIWON',
					priority: 'NORMAL',
					publicRange: 0,
					writerAdminId: writerAdminId,
					writerType: 'ADMIN',
					deleteYN: 'N',
				},
				{ transaction }
			);
		} catch (historyErr) {
			console.error('History 생성 실패:', historyErr);
			// History 생성 실패해도 설정 저장 프로세스는 계속 진행
		}

		await transaction.commit();

		errorHandler.successThrow(res, '운영환경설정 저장 성공');
	} catch (err) {
		await transaction.rollback();
		next(err);
	}
};

// 청소 요일 저장 (새로 등록만, 삭제/수정 없음)
exports.postGosiwonClean = async (req, res, next) => {
	const transaction = await mariaDBSequelize.transaction();
	try {
		const decodedToken = verifyAdminToken(req);
		const writerAdminId = getWriterAdminId(decodedToken);

		const { gosiwonId, cleaningDays, applicationStartDate, applicationEndDate } = req.body;

		if (!gosiwonId) {
			errorHandler.errorThrow(400, 'gosiwonId를 입력해주세요.');
		}

		const gosiwonEsntlId = gosiwonId;

		// cleaningDays: ["월","수","금"] 또는 "월,수,금" 또는 "월 / 수 / 금"
		let daysArr = [];
		if (Array.isArray(cleaningDays)) {
			daysArr = cleaningDays.filter((d) => typeof d === 'string' && CLEAN_DAY_NAMES.includes(d.trim()));
		} else if (typeof cleaningDays === 'string') {
			daysArr = cleaningDays
				.split(/[\s,/\u002f]+/)
				.map((d) => d.trim())
				.filter((d) => CLEAN_DAY_NAMES.includes(d));
		}
		if (daysArr.length === 0) {
			errorHandler.errorThrow(400, '청소 요일(cleaningDays)을 하나 이상 입력해주세요. (예: 월, 수, 금)');
		}

		// 저장 형식: "월 / 수 / 금"
		const cleaningDaysStr = [...new Set(daysArr)].sort(
			(a, b) => CLEAN_DAY_NAMES.indexOf(a) - CLEAN_DAY_NAMES.indexOf(b)
		).join(' / ');

		const gosiwonInfo = await gosiwon.findOne({
			where: { esntlId: gosiwonEsntlId },
			transaction,
		});
		if (!gosiwonInfo) {
			errorHandler.errorThrow(404, '고시원 정보를 찾을 수 없습니다.');
		}

		const cleanEsntlId = await idsNext('gosiwonClean', 'GCLN', transaction);

		await mariaDBSequelize.query(
			`INSERT INTO gosiwonClean (esntlId, gosiwonEsntlId, cleaning_days, application_start_date, application_end_date, writer_admin_id, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, NOW())`,
			{
				replacements: [
					cleanEsntlId,
					gosiwonEsntlId,
					cleaningDaysStr,
					applicationStartDate || null,
					applicationEndDate || null,
					writerAdminId || null,
				],
				transaction,
				type: mariaDBSequelize.QueryTypes.INSERT,
			}
		);

		await transaction.commit();

		errorHandler.successThrow(res, '청소 요일 등록 성공', {
			esntlId: cleanEsntlId,
			gosiwonEsntlId,
			cleaningDays: cleaningDaysStr,
			applicationStartDate: applicationStartDate || null,
			applicationEndDate: applicationEndDate || null,
		});
	} catch (err) {
		await transaction.rollback();
		next(err);
	}
};

// 청소 요일 조회 (현재 적용 설정 + 이력 목록)
exports.getGosiwonClean = async (req, res, next) => {
	try {
		verifyAdminToken(req);

		const { gosiwonId } = req.query;

		if (!gosiwonId) {
			errorHandler.errorThrow(400, 'gosiwonId를 입력해주세요.');
		}

		const gosiwonEsntlId = gosiwonId;

		const gosiwonInfo = await gosiwon.findOne({
			where: { esntlId: gosiwonEsntlId },
		});
		if (!gosiwonInfo) {
			errorHandler.errorThrow(404, '고시원 정보를 찾을 수 없습니다.');
		}

		// 현재 적용 설정: 오늘 날짜가 적용기간 안에 있거나 적용기간이 없는 것 중 최신 1건
		const [currentRow] = await mariaDBSequelize.query(
			`SELECT esntlId, gosiwonEsntlId, cleaning_days AS cleaningDays,
				application_start_date AS applicationStartDate, application_end_date AS applicationEndDate,
				writer_admin_id AS writerAdminId, created_at AS createdAt
			 FROM gosiwonClean
			 WHERE gosiwonEsntlId = ?
			 ORDER BY
			   (application_start_date IS NULL AND application_end_date IS NULL) DESC,
			   (CURDATE() BETWEEN COALESCE(application_start_date, '1000-01-01') AND COALESCE(application_end_date, '9999-12-31')) DESC,
			   created_at DESC
			 LIMIT 1`,
			{
				replacements: [gosiwonEsntlId],
				type: mariaDBSequelize.QueryTypes.SELECT,
			}
		);

		// 이력 목록 (적용기간, 구분(청소요일), 담당자 표시용)
		const list = await mariaDBSequelize.query(
			`SELECT esntlId, cleaning_days AS cleaningDays,
				application_start_date AS applicationStartDate, application_end_date AS applicationEndDate,
				writer_admin_id AS writerAdminId, created_at AS createdAt
			 FROM gosiwonClean
			 WHERE gosiwonEsntlId = ?
			 ORDER BY created_at DESC`,
			{
				replacements: [gosiwonEsntlId],
				type: mariaDBSequelize.QueryTypes.SELECT,
			}
		);

		const current = currentRow
			? {
					...currentRow,
					cleaningDaysArray: currentRow.cleaningDays ? currentRow.cleaningDays.split(' / ').filter(Boolean) : [],
				}
			: null;

		const listFormatted = (list || []).map((row) => ({
			esntlId: row.esntlId,
			cleaningDays: row.cleaningDays,
			applicationStartDate: row.applicationStartDate,
			applicationEndDate: row.applicationEndDate,
			applicationPeriod:
				row.applicationStartDate && row.applicationEndDate
					? `${row.applicationStartDate} ~ ${row.applicationEndDate}`
					: '설정 안 함',
			writerAdminId: row.writerAdminId,
			createdAt: row.createdAt,
		}));

		errorHandler.successThrow(res, '청소 요일 조회 성공', {
			gosiwonEsntlId,
			current,
			list: listFormatted,
		});
	} catch (err) {
		next(err);
	}
};

// 청소 요일 수정
exports.putGosiwonClean = async (req, res, next) => {
	const transaction = await mariaDBSequelize.transaction();
	try {
		const decodedToken = verifyAdminToken(req);
		const writerAdminId = getWriterAdminId(decodedToken);

		const { esntlId, cleaningDays, applicationStartDate, applicationEndDate } = req.body;

		if (!esntlId) {
			errorHandler.errorThrow(400, 'esntlId를 입력해주세요.');
		}

		const [existing] = await mariaDBSequelize.query(
			`SELECT esntlId, gosiwonEsntlId, cleaning_days, application_start_date, application_end_date
			 FROM gosiwonClean WHERE esntlId = ? LIMIT 1`,
			{
				replacements: [esntlId],
				type: mariaDBSequelize.QueryTypes.SELECT,
				transaction,
			}
		);
		if (!existing) {
			errorHandler.errorThrow(404, '청소 설정을 찾을 수 없습니다.');
		}

		let cleaningDaysStr = existing.cleaning_days;
		if (cleaningDays !== undefined) {
			let daysArr = [];
			if (Array.isArray(cleaningDays)) {
				daysArr = cleaningDays.filter((d) => typeof d === 'string' && CLEAN_DAY_NAMES.includes(d.trim()));
			} else if (typeof cleaningDays === 'string') {
				daysArr = cleaningDays
					.split(/[\s,/\u002f]+/)
					.map((d) => d.trim())
					.filter((d) => CLEAN_DAY_NAMES.includes(d));
			}
			if (daysArr.length === 0) {
				errorHandler.errorThrow(400, '청소 요일(cleaningDays)을 하나 이상 입력해주세요. (예: 월, 수, 금)');
			}
			cleaningDaysStr = [...new Set(daysArr)]
				.sort((a, b) => CLEAN_DAY_NAMES.indexOf(a) - CLEAN_DAY_NAMES.indexOf(b))
				.join(' / ');
		}

		const applicationStartDateVal = applicationStartDate !== undefined ? (applicationStartDate || null) : existing.application_start_date;
		const applicationEndDateVal = applicationEndDate !== undefined ? (applicationEndDate || null) : existing.application_end_date;

		await mariaDBSequelize.query(
			`UPDATE gosiwonClean
			 SET cleaning_days = ?, application_start_date = ?, application_end_date = ?, writer_admin_id = ?
			 WHERE esntlId = ?`,
			{
				replacements: [cleaningDaysStr, applicationStartDateVal, applicationEndDateVal, writerAdminId || null, esntlId],
				transaction,
				type: mariaDBSequelize.QueryTypes.UPDATE,
			}
		);

		await transaction.commit();

		errorHandler.successThrow(res, '청소 요일 수정 성공', {
			esntlId,
			cleaningDays: cleaningDaysStr,
			applicationStartDate: applicationStartDateVal,
			applicationEndDate: applicationEndDateVal,
		});
	} catch (err) {
		await transaction.rollback();
		next(err);
	}
};

// 청소 요일 삭제
exports.deleteGosiwonClean = async (req, res, next) => {
	const transaction = await mariaDBSequelize.transaction();
	try {
		verifyAdminToken(req);

		const esntlId = req.query.esntlId || req.body?.esntlId;

		if (!esntlId) {
			errorHandler.errorThrow(400, 'esntlId를 입력해주세요.');
		}

		const [existing] = await mariaDBSequelize.query(
			`SELECT esntlId FROM gosiwonClean WHERE esntlId = ? LIMIT 1`,
			{
				replacements: [esntlId],
				type: mariaDBSequelize.QueryTypes.SELECT,
				transaction,
			}
		);
		if (!existing) {
			errorHandler.errorThrow(404, '청소 설정을 찾을 수 없습니다.');
		}

		await mariaDBSequelize.query(
			`DELETE FROM gosiwonClean WHERE esntlId = ?`,
			{
				replacements: [esntlId],
				transaction,
				type: mariaDBSequelize.QueryTypes.DELETE,
			}
		);

		await transaction.commit();

		errorHandler.successThrow(res, '청소 요일 삭제 성공');
	} catch (err) {
		await transaction.rollback();
		next(err);
	}
};

// 고시원 리스트 조회 (관리자용)
exports.selectListToAdminNew = async (req, res, next) => {
	try {
		verifyAdminToken(req);

		const params = {
			page: parseInt(req.query.page) || 1,
			limit: Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 500),
			status: req.query.status,
			startDate: req.query.startDate,
			endDate: req.query.endDate,
			searchString: req.query.searchString,
			order: req.query.order || 'DESC',
			stateType: req.query.stateType // 전체, 관제, 제휴, 전산지급, 정산중지, 수수료할인적용
		};

		const buildWhereConditions = () => {
			const conditions = ['1=1'];
			const values = [];
			
			if (params.startDate && params.endDate) {
				conditions.push('G.acceptDate BETWEEN ? AND ?');
				values.push(params.startDate, params.endDate);
			}
			
			if (params.searchString) {
				conditions.push('(G.esntlId LIKE ? OR G.name LIKE ? OR G.address LIKE ? OR G.phone LIKE ?)');
				const searchPattern = `%${params.searchString}%`;
				values.push(searchPattern, searchPattern, searchPattern, searchPattern);
			}
			
			if (params.status) {
				conditions.push('G.status = ?');
				values.push(params.status);
			}
			
			// 상태 타입 필터 추가
			if (params.stateType && params.stateType !== 'all') {
				switch (params.stateType) {
					case 'controlled':
						// 관제 (is_controlled=1)
						conditions.push('G.is_controlled = 1');
						break;
					case 'partner':
						// 제휴 (is_controlled=0)
						conditions.push('G.is_controlled = 0');
						break;
					case 'useSettlement':
						// 전산지급 (use_settlement=1)
						conditions.push('G.use_settlement = 1');
						break;
					case 'settlementStopped':
						// 정산중지 (use_settlement=0)
						conditions.push('G.use_settlement = 0');
						break;
					case 'commissionDiscount':
						// 수수료할인적용 (commision<7)
						conditions.push('CAST(COALESCE(G.commision, 7) AS DECIMAL(10,2)) < 7');
						break;
				}
			}
			
			return { whereClause: conditions.join(' AND '), values };
		};

		const { whereClause, values: whereValues } = buildWhereConditions();
		const orderDirection = params.order === 'ASC' ? 'ASC' : 'DESC';
		const limit = params.limit;
		const offset = (params.page - 1) * limit;

		// 성능 최적화: COUNT(*) OVER() 제거하고 별도 카운트 쿼리 사용
		// paymentLog 집계를 서브쿼리로 최적화
		// 불필요한 JOIN 제거 (room, customer는 집계만 필요)
		
		// 전체 개수 조회 (먼저 실행하여 빠른 응답)
		const countQuery = `
			SELECT COUNT(DISTINCT G.esntlId) AS total
			FROM gosiwon G
			WHERE ${whereClause}
		`;

		// 메인 데이터 조회 쿼리 (최적화)
		const optimizedQuery = `
			SELECT 
				G.esntlId,
				SUBSTRING_INDEX(SUBSTRING_INDEX(G.address, ' ', 2), ' ', -2) AS region,
				G.acceptDate AS contractDate,
				COALESCE(PL.pTime, '') AS pTime,
				COALESCE(PL.minStartDate, '') AS startDate,
				COALESCE(PL.maxEndDate, '') AS endDate,
				COALESCE(PL.totalMonth, 0) AS month,
				G.esntlId AS gosiwonEsntlId,
				G.name AS gosiwonName,
				G.address AS gosiwonAddress,
				'' AS contract,
				'' AS spacialContract,
				CAST(COALESCE(PL.roomCount, 0) AS CHAR) AS roomNumber,
				'' AS roomType,
				'' AS window,
				CAST(COALESCE(PL.customerCount, 0) AS CHAR) AS customerName,
				'' AS customerPhone,
				'' AS gender,
				0 AS age,
				COALESCE(PL.pyl_goods_amount, 0) AS pyl_goods_amount,
				FORMAT(COALESCE(PL.paymentAmount, 0), 0) AS paymentAmount,
				COALESCE(PL.paymentAmount, 0) AS payment_amount,
				FORMAT(COALESCE(PL.paymentPoint, 0), 0) AS paymentPoint,
				FORMAT(COALESCE(PL.paymentCoupon, 0), 0) AS paymentCoupon,
				FORMAT(COALESCE(PL.cAmount, 0), 0) AS cAmount,
				FORMAT(COALESCE(PL.cPercent, 0), 0) AS cPercent,
				1 AS paymentCount,
				-- 추가 필드들
				COALESCE(G.is_favorite, 0) AS is_favorite,
				COALESCE(G.serviceNumber, '') AS serviceNumber,
				COALESCE(RM.total_room, 0) AS total_room,
				COALESCE(RM.contract_room, 0) AS contract_room,
				COALESCE(RM.open_room, 0) AS open_room,
				COALESCE(RM.wait_room, 0) AS wait_room,
				COALESCE(RM.empty_room, 0) AS empty_room,
				G.address AS address,
				COALESCE(G.address3, '') AS address3,
				COALESCE(GA.ceo, '') AS ceo,
				COALESCE(DP.deposit_yn, 'F') AS deposit_yn,
				COALESCE(RL_AGG.likes, 0) AS likes,
				COALESCE(RS_AGG.see, 0) AS see,
				COALESCE(G.commision, '') AS commision,
				-- gosiwon 테이블의 주요 상태 값
				COALESCE(G.is_controlled, 0) AS is_controlled,
				COALESCE(G.use_settlement, 0) AS use_settlement,
				COALESCE(G.status, '') AS status
			FROM gosiwon G
			LEFT JOIN gosiwonAdmin GA ON G.adminEsntlId = GA.esntlId
			LEFT JOIN (
				SELECT 
					RC.gosiwonEsntlId,
					MAX(PL2.pTime) AS pTime,
					MIN(RC.startDate) AS minStartDate,
					MAX(RC.endDate) AS maxEndDate,
					SUM(COALESCE(RC.month, 0)) AS totalMonth,
					COUNT(DISTINCT RC.roomEsntlId) AS roomCount,
					COUNT(DISTINCT RC.customerEsntlId) AS customerCount,
					SUM(COALESCE(PL2.pyl_goods_amount, 0)) AS pyl_goods_amount,
					SUM(COALESCE(PL2.paymentAmount, 0)) AS paymentAmount,
					SUM(COALESCE(PL2.paymentPoint, 0)) AS paymentPoint,
					SUM(COALESCE(PL2.paymentCoupon, 0)) AS paymentCoupon,
					SUM(COALESCE(PL2.cAmount, 0)) AS cAmount,
					AVG(COALESCE(PL2.cPercent, 0)) AS cPercent
				FROM roomContract RC
				LEFT JOIN paymentLog PL2 ON RC.esntlId = PL2.contractEsntlId
				GROUP BY RC.gosiwonEsntlId
			) PL ON G.esntlId = PL.gosiwonEsntlId
			LEFT JOIN (
				SELECT 
					R.gosiwonEsntlId,
					COUNT(*) AS total_room,
					SUM(CASE WHEN R.status = 'CONTRACT' THEN 1 ELSE 0 END) AS contract_room,
					SUM(CASE WHEN R.status = 'OPEN' THEN 1 ELSE 0 END) AS open_room,
					SUM(CASE WHEN R.status = 'RESERVE' OR R.status = 'VBANK' THEN 1 ELSE 0 END) AS wait_room,
					SUM(CASE WHEN R.status = 'EMPTY' OR R.status = '' OR R.status IS NULL THEN 1 ELSE 0 END) AS empty_room
				FROM room R
				GROUP BY R.gosiwonEsntlId
			) RM ON G.esntlId = RM.gosiwonEsntlId
			LEFT JOIN (
				SELECT 
					R.gosiwonEsntlId,
					COUNT(*) AS see
				FROM room R
				INNER JOIN roomSee RS ON R.esntlId = RS.roomEsntlId
				GROUP BY R.gosiwonEsntlId
			) RS_AGG ON G.esntlId = RS_AGG.gosiwonEsntlId
			LEFT JOIN (
				SELECT 
					R.gosiwonEsntlId,
					COUNT(*) AS likes
				FROM room R
				INNER JOIN roomLike RL ON R.esntlId = RL.roomEsntlId
				GROUP BY R.gosiwonEsntlId
			) RL_AGG ON G.esntlId = RL_AGG.gosiwonEsntlId
			LEFT JOIN (
				SELECT 
					gsw_eid,
					IF(COUNT(*) > 0, 'T', 'F') AS deposit_yn
				FROM il_deposit
				WHERE dps_status = 'ACTIVE' AND dps_manager = 'DOKLIPLIFE'
				GROUP BY gsw_eid
			) DP ON G.esntlId = DP.gsw_eid
			WHERE ${whereClause}
			ORDER BY COALESCE(G.is_favorite, 0) DESC, (CASE WHEN COALESCE(G.status, '') = 'OPERATE' THEN 0 ELSE 1 END) ASC, G.name ASC
			LIMIT ? OFFSET ?
		`;

		// 합계 조회용 최적화 쿼리
		const summaryQuery = `
			SELECT 
				FORMAT(COALESCE(SUM(PL.paymentAmount), 0), 0) AS paymentAmount,
				FORMAT(COALESCE(SUM(PL.paymentPoint), 0), 0) AS paymentPoint,
				FORMAT(COALESCE(SUM(PL.paymentCoupon), 0), 0) AS paymentCoupon,
				FORMAT(COALESCE(SUM(PL.cAmount), 0), 0) AS cAmount,
				FORMAT(COALESCE(AVG(PL.cPercent), 0), 0) AS cPercent
			FROM gosiwon G
			LEFT JOIN (
				SELECT 
					RC.gosiwonEsntlId,
					SUM(COALESCE(PL2.paymentAmount, 0)) AS paymentAmount,
					SUM(COALESCE(PL2.paymentPoint, 0)) AS paymentPoint,
					SUM(COALESCE(PL2.paymentCoupon, 0)) AS paymentCoupon,
					SUM(COALESCE(PL2.cAmount, 0)) AS cAmount,
					AVG(COALESCE(PL2.cPercent, 0)) AS cPercent
				FROM roomContract RC
				LEFT JOIN paymentLog PL2 ON RC.esntlId = PL2.contractEsntlId
				GROUP BY RC.gosiwonEsntlId
			) PL ON G.esntlId = PL.gosiwonEsntlId
			WHERE ${whereClause}
		`;

		// 병렬 실행으로 성능 개선
		const [countResult, mainResult, summaryResult] = await Promise.all([
			mariaDBSequelize.query(countQuery, {
				replacements: whereValues,
				type: mariaDBSequelize.QueryTypes.SELECT,
			}),
			mariaDBSequelize.query(optimizedQuery, {
				replacements: [...whereValues, limit, offset],
				type: mariaDBSequelize.QueryTypes.SELECT,
			}),
			mariaDBSequelize.query(summaryQuery, {
				replacements: whereValues,
				type: mariaDBSequelize.QueryTypes.SELECT,
			})
		]);

		const totalCount = countResult[0]?.total || 0;
		const resultList = Array.isArray(mainResult) ? mainResult : [];
		const summary = summaryResult[0] || {};
		const lastPage = Math.ceil(totalCount / limit) || 1;

		// 원본 함수와 동일한 리턴 구조 + limit, lastPage 추가
		const response = {
			result: 'SUCCESS',
			resultList: resultList,
			totcnt: totalCount,
			limit: limit,
			page: params.page,
			lastPage: lastPage,
			totPaymentAmount: summary.paymentAmount || '0',
			totPaymentPoint: summary.paymentPoint || '0',
			totPaymentCoupon: summary.paymentCoupon || '0',
			totCAmount: summary.cAmount || '0',
			totCPercent: summary.cPercent || '0',
		};
		
		res.json(response);
	} catch (err) {
		console.error('[selectListToAdminNew] Database error:', err);
		res.json({ result: 'FAIL' });
	}
};
