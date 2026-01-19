const { Op } = require('sequelize');
const { parking, gosiwon, history, mariaDBSequelize } = require('../models');
const jwt = require('jsonwebtoken');
const errorHandler = require('../middleware/error');
const { getWriterAdminId } = require('../utils/auth');

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
	} catch (err) {
		errorHandler.errorThrow(401, '토큰 디코딩에 실패했습니다.');
	}

	if (!decodedToken || (!decodedToken.admin && !decodedToken.partner)) {
		errorHandler.errorThrow(401, '관리자 정보가 없습니다.');
	}
	return decodedToken;
};

const PARKING_PREFIX = 'PARK';
const PARKING_PADDING = 10;

const HISTORY_PREFIX = 'HISTORY';
const HISTORY_PADDING = 10;

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

const generateParkingId = async (transaction) => {
	const latest = await parking.findOne({
		attributes: ['esntlId'],
		order: [['esntlId', 'DESC']],
		transaction,
		lock: transaction ? transaction.LOCK.UPDATE : undefined,
	});

	if (!latest || !latest.esntlId) {
		return `${PARKING_PREFIX}${String(1).padStart(PARKING_PADDING, '0')}`;
	}

	const numberPart = parseInt(
		latest.esntlId.replace(PARKING_PREFIX, ''),
		10
	);
	const nextNumber = Number.isNaN(numberPart) ? 1 : numberPart + 1;
	return `${PARKING_PREFIX}${String(nextNumber).padStart(
		PARKING_PADDING,
		'0'
	)}`;
};

// 주차장 정보 조회 (GET)
exports.getParkingInfo = async (req, res, next) => {
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

		const parkingInfo = await parking.findOne({
			where: {
				gosiwonEsntlId: esntlId,
			},
			raw: true,
		});

		if (!parkingInfo) {
			errorHandler.errorThrow(404, '주차장 정보를 찾을 수 없습니다.');
		}

		const response = {
			parkingID: parkingInfo.esntlId,
			gosiwonEsntlId: parkingInfo.gosiwonEsntlId,
			structure: parkingInfo.structure || '',
			auto: parkingInfo.auto || 0,
			autoPrice: parkingInfo.autoPrice || 0,
			bike: parkingInfo.bike || 0,
			bikePrice: parkingInfo.bikePrice || 0,
			createdAt: parkingInfo.created_at,
		};

		errorHandler.successThrow(res, '주차장 정보 조회 성공', response);
	} catch (err) {
		next(err);
	}
};

// 주차장 정보 등록 (POST)
exports.createParking = async (req, res, next) => {
	const transaction = await mariaDBSequelize.transaction();
	try {
		const decodedToken = verifyAdminToken(req);
		const writerAdminId = getWriterAdminId(decodedToken);

		const { esntlId, structure, auto, autoPrice, bike, bikePrice } = req.body;

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

		// 이미 등록된 주차장 정보가 있는지 확인
		const existing = await parking.findOne({
			where: {
				gosiwonEsntlId: esntlId,
			},
			transaction,
		});

		if (existing) {
			errorHandler.errorThrow(400, '이미 등록된 주차장 정보가 있습니다.');
		}

		const parkingId = await generateParkingId(transaction);

		await parking.create(
			{
				esntlId: parkingId,
				gosiwonEsntlId: esntlId,
				structure: structure || null,
				auto: parseInt(auto, 10) || 0,
				autoPrice: parseInt(autoPrice, 10) || 0,
				bike: parseInt(bike, 10) || 0,
				bikePrice: parseInt(bikePrice, 10) || 0,
			},
			{ transaction }
		);

		// History 기록 생성
		try {
			const historyId = await generateHistoryId(transaction);
			const historyContent = `주차장 정보 생성: 구조 ${structure || '미지정'}, 자동차 ${parseInt(auto, 10) || 0}대(${parseInt(autoPrice, 10) || 0}원), 오토바이 ${parseInt(bike, 10) || 0}대(${parseInt(bikePrice, 10) || 0}원)`;

			await history.create(
				{
					esntlId: historyId,
					gosiwonEsntlId: esntlId,
					etcEsntlId: parkingId,
					content: historyContent,
					category: 'PARKING',
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
			// History 생성 실패해도 주차장 생성 프로세스는 계속 진행
		}

		await transaction.commit();

		errorHandler.successThrow(res, '주차장 정보 등록 성공', {
			parkingID: parkingId,
		});
	} catch (err) {
		await transaction.rollback();
		next(err);
	}
};

// 주차장 정보 수정 (PUT)
exports.updateParking = async (req, res, next) => {
	const transaction = await mariaDBSequelize.transaction();
	try {
		const decodedToken = verifyAdminToken(req);
		const writerAdminId = getWriterAdminId(decodedToken);

		const { parkingID, structure, auto, autoPrice, bike, bikePrice } = req.body;

		if (!parkingID) {
			errorHandler.errorThrow(400, 'parkingID를 입력해주세요.');
		}

		const parkingInfo = await parking.findByPk(parkingID, {
			transaction,
		});
		if (!parkingInfo) {
			errorHandler.errorThrow(404, '주차장 정보를 찾을 수 없습니다.');
		}

		// 수정 전 정보 저장 (변경사항 추적용)
		const beforeParking = {
			structure: parkingInfo.structure,
			auto: parkingInfo.auto,
			autoPrice: parkingInfo.autoPrice,
			bike: parkingInfo.bike,
			bikePrice: parkingInfo.bikePrice,
		};

		await parking.update(
			{
				structure:
					structure !== undefined ? structure : parkingInfo.structure,
				auto: auto !== undefined ? parseInt(auto, 10) : parkingInfo.auto,
				autoPrice:
					autoPrice !== undefined
						? parseInt(autoPrice, 10)
						: parkingInfo.autoPrice,
				bike: bike !== undefined ? parseInt(bike, 10) : parkingInfo.bike,
				bikePrice:
					bikePrice !== undefined
						? parseInt(bikePrice, 10)
						: parkingInfo.bikePrice,
			},
			{
				where: { esntlId: parkingID },
				transaction,
			}
		);

		// History 기록 생성 (변경사항 추적)
		try {
			const historyId = await generateHistoryId(transaction);
			const changes = [];
			
			if (structure !== undefined && structure !== beforeParking.structure) {
				changes.push(`구조: ${beforeParking.structure || '미지정'} → ${structure || '미지정'}`);
			}
			if (auto !== undefined && parseInt(auto, 10) !== beforeParking.auto) {
				changes.push(`자동차 대수: ${beforeParking.auto}대 → ${parseInt(auto, 10)}대`);
			}
			if (autoPrice !== undefined && parseInt(autoPrice, 10) !== beforeParking.autoPrice) {
				changes.push(`자동차 가격: ${beforeParking.autoPrice}원 → ${parseInt(autoPrice, 10)}원`);
			}
			if (bike !== undefined && parseInt(bike, 10) !== beforeParking.bike) {
				changes.push(`오토바이 대수: ${beforeParking.bike}대 → ${parseInt(bike, 10)}대`);
			}
			if (bikePrice !== undefined && parseInt(bikePrice, 10) !== beforeParking.bikePrice) {
				changes.push(`오토바이 가격: ${beforeParking.bikePrice}원 → ${parseInt(bikePrice, 10)}원`);
			}

			if (changes.length > 0) {
				const historyContent = `주차장 정보 수정: ${changes.join(', ')}`;

				await history.create(
					{
						esntlId: historyId,
						gosiwonEsntlId: parkingInfo.gosiwonEsntlId,
						etcEsntlId: parkingID,
						content: historyContent,
						category: 'PARKING',
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
			// History 생성 실패해도 주차장 수정 프로세스는 계속 진행
		}

		await transaction.commit();

		errorHandler.successThrow(res, '주차장 정보 수정 성공');
	} catch (err) {
		await transaction.rollback();
		next(err);
	}
};

// 주차장 정보 삭제 (DELETE)
exports.deleteParking = async (req, res, next) => {
	const transaction = await mariaDBSequelize.transaction();
	try {
		const decodedToken = verifyAdminToken(req);
		const writerAdminId = getWriterAdminId(decodedToken);

		const { parkingID } = req.query;

		if (!parkingID) {
			errorHandler.errorThrow(400, 'parkingID를 입력해주세요.');
		}

		// 삭제 전 주차장 정보 조회 (history 기록용)
		const parkingInfo = await parking.findByPk(parkingID, {
			transaction,
		});
		if (!parkingInfo) {
			errorHandler.errorThrow(404, '주차장 정보를 찾을 수 없습니다.');
		}

		await parking.destroy({
			where: {
				esntlId: parkingID,
			},
			transaction,
		});

		// History 기록 생성
		try {
			const historyId = await generateHistoryId(transaction);
			const historyContent = `주차장 정보 삭제: 구조 ${parkingInfo.structure || '미지정'}, 자동차 ${parkingInfo.auto || 0}대, 오토바이 ${parkingInfo.bike || 0}대`;

			await history.create(
				{
					esntlId: historyId,
					gosiwonEsntlId: parkingInfo.gosiwonEsntlId,
					etcEsntlId: parkingID,
					content: historyContent,
					category: 'PARKING',
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
			// History 생성 실패해도 주차장 삭제 프로세스는 계속 진행
		}

		await transaction.commit();

		errorHandler.successThrow(res, '주차장 정보 삭제 성공');
	} catch (err) {
		await transaction.rollback();
		next(err);
	}
};

// 주차장 목록 조회 (GET) - 검색 및 페이지네이션 지원
exports.getParkingList = async (req, res, next) => {
	try {
		verifyAdminToken(req);

		const page = parseInt(req.query.page) || 1;
		const limit = parseInt(req.query.limit) || 10;
		const gosiwonName = req.query.gosiwonName || ''; // 고시원 이름 검색
		const structure = req.query.structure || ''; // 주차장 구조 검색

		const offset = (page - 1) * limit;

		// 검색 조건 구성
		const whereCondition = {};
		const includeWhereCondition = {};

		// 주차장 구조 검색
		if (structure) {
			whereCondition.structure = {
				[Op.like]: `%${structure}%`,
			};
		}

		// 고시원 이름 검색
		if (gosiwonName) {
			includeWhereCondition.name = {
				[Op.like]: `%${gosiwonName}%`,
			};
		}

		// include 조건 구성
		const includeOptions = {
			model: gosiwon,
			as: 'gosiwon',
			attributes: ['esntlId', 'name', 'address'],
			required: false, // LEFT JOIN으로 고시원 정보가 없는 주차장도 포함
		};

		// 고시원 이름 검색 시 where 조건 추가
		if (Object.keys(includeWhereCondition).length > 0) {
			includeOptions.where = includeWhereCondition;
			includeOptions.required = true; // 고시원 이름 검색 시 INNER JOIN
		}

		// 주차장 목록 조회 (고시원 정보 포함)
		const parkingList = await parking.findAndCountAll({
			where: whereCondition,
			include: [includeOptions],
			limit: limit,
			offset: offset,
			order: [['created_at', 'DESC']],
			attributes: [
				'esntlId',
				'gosiwonEsntlId',
				'structure',
				'auto',
				'autoPrice',
				'bike',
				'bikePrice',
				'created_at',
			],
		});

		// 결과 포맷팅
		const lastPage = Math.ceil(parkingList.count / limit);
		const parkingItems = parkingList.rows.map((item) => {
			const parkingData = item.get({ plain: true });
			return {
				parkingID: parkingData.esntlId,
				gosiwonEsntlId: parkingData.gosiwonEsntlId,
				gosiwonName: parkingData.gosiwon ? parkingData.gosiwon.name : null,
				gosiwonAddress: parkingData.gosiwon ? parkingData.gosiwon.address : null,
				structure: parkingData.structure || '',
				auto: parkingData.auto || 0,
				autoPrice: parkingData.autoPrice || 0,
				bike: parkingData.bike || 0,
				bikePrice: parkingData.bikePrice || 0,
				createdAt: parkingData.created_at,
			};
		});

		const response = {
			limit: limit,
			currentPage: page,
			lastPage: lastPage,
			totalCount: parkingList.count,
			parkingList: parkingItems,
		};

		errorHandler.successThrow(res, '주차장 목록 조회 성공', response);
	} catch (err) {
		next(err);
	}
};

