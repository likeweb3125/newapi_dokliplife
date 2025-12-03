const { roomSpecialAgreement, room, mariaDBSequelize } = require('../models');
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

const SPECIAL_AGREEMENT_PREFIX = 'SPCL';
const SPECIAL_AGREEMENT_PADDING = 10;

const generateSpecialAgreementId = async (transaction) => {
	const latest = await roomSpecialAgreement.findOne({
		attributes: ['esntlId'],
		order: [['esntlId', 'DESC']],
		transaction,
		lock: transaction ? transaction.LOCK.UPDATE : undefined,
	});

	if (!latest || !latest.esntlId) {
		return `${SPECIAL_AGREEMENT_PREFIX}${String(1).padStart(SPECIAL_AGREEMENT_PADDING, '0')}`;
	}

	const numberPart = parseInt(
		latest.esntlId.replace(SPECIAL_AGREEMENT_PREFIX, ''),
		10
	);
	const nextNumber = Number.isNaN(numberPart) ? 1 : numberPart + 1;
	return `${SPECIAL_AGREEMENT_PREFIX}${String(nextNumber).padStart(
		SPECIAL_AGREEMENT_PADDING,
		'0'
	)}`;
};

// 방 특약 목록 조회 (GET)
exports.getRoomSpecialAgreementList = async (req, res, next) => {
	try {
		verifyAdminToken(req);

		const { roomEsntlId } = req.query;

		if (!roomEsntlId) {
			errorHandler.errorThrow(400, 'roomEsntlId를 입력해주세요.');
		}

		// 방 존재 여부 확인
		const roomInfo = await room.findOne({
			where: {
				esntlId: roomEsntlId,
			},
		});

		if (!roomInfo) {
			errorHandler.errorThrow(404, '방 정보를 찾을 수 없습니다.');
		}

		const agreementList = await roomSpecialAgreement.findAll({
			where: {
				roomEsntlId: roomEsntlId,
			},
			order: [['created_at', 'DESC']],
			raw: true,
		});

		const response = agreementList.map((agreement) => ({
			agreementID: agreement.esntlId,
			roomEsntlId: agreement.roomEsntlId,
			agreementType: agreement.agreementType || '',
			agreementContent: agreement.agreementContent || '',
			createdAt: agreement.created_at,
		}));

		errorHandler.successThrow(res, '방 특약 목록 조회 성공', response);
	} catch (err) {
		next(err);
	}
};

// 방 특약 상세 조회 (GET)
exports.getRoomSpecialAgreementInfo = async (req, res, next) => {
	try {
		verifyAdminToken(req);

		const { agreementID } = req.query;

		if (!agreementID) {
			errorHandler.errorThrow(400, 'agreementID를 입력해주세요.');
		}

		const agreementInfo = await roomSpecialAgreement.findOne({
			where: {
				esntlId: agreementID,
			},
			raw: true,
		});

		if (!agreementInfo) {
			errorHandler.errorThrow(404, '방 특약 정보를 찾을 수 없습니다.');
		}

		const response = {
			agreementID: agreementInfo.esntlId,
			roomEsntlId: agreementInfo.roomEsntlId,
			agreementType: agreementInfo.agreementType || '',
			agreementContent: agreementInfo.agreementContent || '',
			createdAt: agreementInfo.created_at,
		};

		errorHandler.successThrow(res, '방 특약 정보 조회 성공', response);
	} catch (err) {
		next(err);
	}
};

// 방 특약 등록 (POST)
exports.createRoomSpecialAgreement = async (req, res, next) => {
	const transaction = await mariaDBSequelize.transaction();
	try {
		verifyAdminToken(req);

		const { roomEsntlId, agreementType, agreementContent } = req.body;

		if (!roomEsntlId) {
			errorHandler.errorThrow(400, 'roomEsntlId를 입력해주세요.');
		}

		if (!agreementType) {
			errorHandler.errorThrow(400, 'agreementType을 입력해주세요.');
		}

		// 특약 타입 유효성 검사
		const validTypes = ['GENERAL', 'GOSIWON', 'ROOM'];
		if (!validTypes.includes(agreementType)) {
			errorHandler.errorThrow(
				400,
				'agreementType은 GENERAL, GOSIWON, ROOM 중 하나여야 합니다.'
			);
		}

		// 방 존재 여부 확인
		const roomInfo = await room.findOne({
			where: {
				esntlId: roomEsntlId,
			},
			transaction,
		});

		if (!roomInfo) {
			errorHandler.errorThrow(404, '방 정보를 찾을 수 없습니다.');
		}

		const agreementId = await generateSpecialAgreementId(transaction);

		await roomSpecialAgreement.create(
			{
				esntlId: agreementId,
				roomEsntlId: roomEsntlId,
				agreementType: agreementType,
				agreementContent: agreementContent || null,
			},
			{ transaction }
		);

		await transaction.commit();

		errorHandler.successThrow(res, '방 특약 등록 성공', {
			agreementID: agreementId,
		});
	} catch (err) {
		await transaction.rollback();
		next(err);
	}
};

// 방 특약 수정 (PATCH)
exports.updateRoomSpecialAgreement = async (req, res, next) => {
	const transaction = await mariaDBSequelize.transaction();
	try {
		verifyAdminToken(req);

		const { agreementID, agreementType, agreementContent } = req.body;

		if (!agreementID) {
			errorHandler.errorThrow(400, 'agreementID를 입력해주세요.');
		}

		const agreementInfo = await roomSpecialAgreement.findByPk(agreementID);
		if (!agreementInfo) {
			errorHandler.errorThrow(404, '방 특약 정보를 찾을 수 없습니다.');
		}

		// 특약 타입 유효성 검사
		if (agreementType) {
			const validTypes = ['GENERAL', 'GOSIWON', 'ROOM'];
			if (!validTypes.includes(agreementType)) {
				errorHandler.errorThrow(
					400,
					'agreementType은 GENERAL, GOSIWON, ROOM 중 하나여야 합니다.'
				);
			}
		}

		await roomSpecialAgreement.update(
			{
				agreementType:
					agreementType !== undefined
						? agreementType
						: agreementInfo.agreementType,
				agreementContent:
					agreementContent !== undefined
						? agreementContent
						: agreementInfo.agreementContent,
			},
			{
				where: { esntlId: agreementID },
				transaction,
			}
		);

		await transaction.commit();

		errorHandler.successThrow(res, '방 특약 수정 성공');
	} catch (err) {
		await transaction.rollback();
		next(err);
	}
};

// 방 특약 삭제 (DELETE)
exports.deleteRoomSpecialAgreement = async (req, res, next) => {
	const transaction = await mariaDBSequelize.transaction();
	try {
		verifyAdminToken(req);

		const { agreementID } = req.query;

		if (!agreementID) {
			errorHandler.errorThrow(400, 'agreementID를 입력해주세요.');
		}

		const agreementInfo = await roomSpecialAgreement.findByPk(agreementID);
		if (!agreementInfo) {
			errorHandler.errorThrow(404, '방 특약 정보를 찾을 수 없습니다.');
		}

		await roomSpecialAgreement.destroy({
			where: {
				esntlId: agreementID,
			},
			transaction,
		});

		await transaction.commit();

		errorHandler.successThrow(res, '방 특약 삭제 성공');
	} catch (err) {
		await transaction.rollback();
		next(err);
	}
};

