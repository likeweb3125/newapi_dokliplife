const { parking, gosiwon, mariaDBSequelize } = require('../models');
const jwt = require('jsonwebtoken');
const errorHandler = require('../middleware/error');

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

	if (!decodedToken || !decodedToken.admin) {
		errorHandler.errorThrow(401, '관리자 정보가 없습니다.');
	}
	return decodedToken;
};

const PARKING_PREFIX = 'PARK';
const PARKING_PADDING = 10;

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
		verifyAdminToken(req);

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

		await transaction.commit();

		errorHandler.successThrow(res, '주차장 정보 등록 성공', {
			parkingID: parkingId,
		});
	} catch (err) {
		await transaction.rollback();
		next(err);
	}
};

// 주차장 정보 수정 (PATCH)
exports.updateParking = async (req, res, next) => {
	const transaction = await mariaDBSequelize.transaction();
	try {
		verifyAdminToken(req);

		const { parkingID, structure, auto, autoPrice, bike, bikePrice } = req.body;

		if (!parkingID) {
			errorHandler.errorThrow(400, 'parkingID를 입력해주세요.');
		}

		const parkingInfo = await parking.findByPk(parkingID);
		if (!parkingInfo) {
			errorHandler.errorThrow(404, '주차장 정보를 찾을 수 없습니다.');
		}

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
		verifyAdminToken(req);

		const { parkingID } = req.query;

		if (!parkingID) {
			errorHandler.errorThrow(400, 'parkingID를 입력해주세요.');
		}

		const parkingInfo = await parking.findByPk(parkingID);
		if (!parkingInfo) {
			errorHandler.errorThrow(404, '주차장 정보를 찾을 수 없습니다.');
		}

		await parking.destroy({
			where: {
				esntlId: parkingID,
			},
			transaction,
		});

		await transaction.commit();

		errorHandler.successThrow(res, '주차장 정보 삭제 성공');
	} catch (err) {
		await transaction.rollback();
		next(err);
	}
};

