const { Op } = require('sequelize');
const {
	room,
	roomActionHistory,
	customer,
	mariaDBSequelize,
} = require('../models');
const jwt = require('jsonwebtoken');
const errorHandler = require('../middleware/error');

// 공통 토큰 검증 함수
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

const ACTION_PREFIX = 'RACN';
const ACTION_PADDING = 10;

const generateActionId = async (transaction) => {
	const latest = await roomActionHistory.findOne({
		attributes: ['esntlId'],
		order: [['esntlId', 'DESC']],
		transaction,
		lock: transaction ? transaction.LOCK.UPDATE : undefined,
	});

	if (!latest || !latest.esntlId) {
		return `${ACTION_PREFIX}${String(1).padStart(ACTION_PADDING, '0')}`;
	}

	const numberPart = parseInt(latest.esntlId.replace(ACTION_PREFIX, ''), 10);
	const nextNumber = Number.isNaN(numberPart) ? 1 : numberPart + 1;
	return `${ACTION_PREFIX}${String(nextNumber).padStart(ACTION_PADDING, '0')}`;
};

// 액션 이력 조회 (단일 방)
exports.getRoomActionHistory = async (req, res, next) => {
	try {
		verifyAdminToken(req);

		const { roomEsntlId, actionType, startDate, endDate } = req.query;

		if (!roomEsntlId) {
			errorHandler.errorThrow(400, 'roomEsntlId를 입력해주세요.');
		}

		// 방 존재 여부 확인
		const roomInfo = await room.findOne({
			where: { esntlId: roomEsntlId },
			raw: true,
		});
		if (!roomInfo) {
			errorHandler.errorThrow(404, '방 정보를 찾을 수 없습니다.');
		}

		const whereCondition = { roomEsntlId };
		if (actionType) {
			whereCondition.actionType = actionType;
		}
		if (startDate || endDate) {
			whereCondition.createdAt = {};
			if (startDate) whereCondition.createdAt[Op.gte] = new Date(startDate);
			if (endDate) whereCondition.createdAt[Op.lte] = new Date(endDate);
		}

		const historyList = await roomActionHistory.findAll({
			where: whereCondition,
			order: [['createdAt', 'DESC']],
			include: [
				{
					model: customer,
					as: 'actorCustomer',
					attributes: ['esntlId', 'name', 'phone'],
					required: false,
				},
			],
			raw: false,
		});

		const response = historyList.map((item) => ({
			esntlId: item.esntlId,
			roomEsntlId: item.roomEsntlId,
			actionType: item.actionType,
			statusFrom: item.statusFrom,
			statusTo: item.statusTo,
			actorAdminId: item.actorAdminId,
			actorCustomerId: item.actorCustomerId,
			amount: item.amount,
			currency: item.currency,
			paymentMethod: item.paymentMethod,
			reservationId: item.reservationId,
			memo: item.memo,
			metadata: item.metadata,
			createdAt: item.createdAt,
			updatedAt: item.updatedAt,
			actorCustomer: item.actorCustomer || null,
		}));

		errorHandler.successThrow(res, '방 액션 이력 조회 성공', response);
	} catch (err) {
		next(err);
	}
};

// 액션 이력 생성
exports.createRoomActionHistory = async (req, res, next) => {
	const transaction = await mariaDBSequelize.transaction();
	try {
		const decodedToken = verifyAdminToken(req);

		const {
			roomEsntlId,
			contractEsntlId,
			actionType,
			statusFrom,
			statusTo,
			actorAdminId,
			actorCustomerId,
			amount,
			currency,
			paymentMethod,
			reservationId,
			memo,
			metadata,
		} = req.body;

		if (!roomEsntlId) {
			errorHandler.errorThrow(400, 'roomEsntlId를 입력해주세요.');
		}
		if (!actionType) {
			errorHandler.errorThrow(400, 'actionType을 입력해주세요.');
		}

		// 방 존재 여부 확인
		const roomInfo = await room.findOne({
			where: { esntlId: roomEsntlId },
			transaction,
		});
		if (!roomInfo) {
			errorHandler.errorThrow(404, '방 정보를 찾을 수 없습니다.');
		}

		const actionId = await generateActionId(transaction);

		await roomActionHistory.create(
			{
				esntlId: actionId,
				roomEsntlId,
				contractEsntlId: contractEsntlId || null,
				actionType,
				statusFrom: statusFrom || null,
				statusTo: statusTo || null,
				actorAdminId: actorAdminId || decodedToken?.admin?.id || null,
				actorCustomerId: actorCustomerId || null,
				amount: amount !== undefined ? amount : null,
				currency: currency || 'KRW',
				paymentMethod: paymentMethod || null,
				reservationId: reservationId || null,
				memo: memo || null,
				metadata: metadata ? JSON.stringify(metadata) : null,
			},
			{ transaction }
		);

		await transaction.commit();

		errorHandler.successThrow(res, '방 액션 이력 등록 성공', {
			esntlId: actionId,
		});
	} catch (err) {
		await transaction.rollback();
		next(err);
	}
};

// 여러 방 액션 이력 조회 (고시원 단위)
exports.getMultipleRoomActionHistory = async (req, res, next) => {
	try {
		verifyAdminToken(req);

		const { gosiwonEsntlId, actionType, startDate, endDate } = req.query;

		if (!gosiwonEsntlId) {
			errorHandler.errorThrow(400, 'gosiwonEsntlId를 입력해주세요.');
		}

		const rooms = await room.findAll({
			where: { gosiwonEsntlId },
			attributes: ['esntlId', 'roomNumber'],
			raw: true,
		});

		if (!rooms || rooms.length === 0) {
			return errorHandler.successThrow(res, '방 액션 이력 조회 성공', []);
		}

		const roomIds = rooms.map((r) => r.esntlId);
		const whereCondition = {
			roomEsntlId: { [Op.in]: roomIds },
		};
		if (actionType) {
			whereCondition.actionType = actionType;
		}
		if (startDate || endDate) {
			whereCondition.createdAt = {};
			if (startDate) whereCondition.createdAt[Op.gte] = new Date(startDate);
			if (endDate) whereCondition.createdAt[Op.lte] = new Date(endDate);
		}

		const historyList = await roomActionHistory.findAll({
			where: whereCondition,
			order: [
				['roomEsntlId', 'ASC'],
				['createdAt', 'DESC'],
			],
			include: [
				{
					model: customer,
					as: 'actorCustomer',
					attributes: ['esntlId', 'name', 'phone'],
					required: false,
				},
			],
			raw: false,
		});

		const grouped = {};
		rooms.forEach((r) => {
			grouped[r.esntlId] = {
				roomEsntlId: r.esntlId,
				roomNumber: r.roomNumber,
				history: [],
			};
		});

		historyList.forEach((item) => {
			if (grouped[item.roomEsntlId]) {
				grouped[item.roomEsntlId].history.push({
					esntlId: item.esntlId,
					actionType: item.actionType,
					statusFrom: item.statusFrom,
					statusTo: item.statusTo,
					actorAdminId: item.actorAdminId,
					actorCustomerId: item.actorCustomerId,
					amount: item.amount,
					currency: item.currency,
					paymentMethod: item.paymentMethod,
					reservationId: item.reservationId,
					memo: item.memo,
					metadata: item.metadata,
					createdAt: item.createdAt,
					updatedAt: item.updatedAt,
					actorCustomer: item.actorCustomer || null,
				});
			}
		});

		errorHandler.successThrow(res, '방 액션 이력 조회 성공', Object.values(grouped));
	} catch (err) {
		next(err);
	}
};

