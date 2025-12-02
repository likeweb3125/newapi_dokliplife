const { Op } = require('sequelize');
const { room, mariaDBSequelize } = require('../models');
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
		console.log('📦 디코딩된 토큰 정보:', decodedToken);
	} catch (err) {
		errorHandler.errorThrow(401, '토큰 디코딩에 실패했습니다.');
	}

	if (!decodedToken || !decodedToken.admin) {
		errorHandler.errorThrow(401, '관리자 정보가 없습니다.');
	}
	return decodedToken;
};

const ROOM_PREFIX = 'ROOM';
const ROOM_PADDING = 10;

const generateRoomId = async (transaction) => {
	const latest = await room.findOne({
		attributes: ['esntlId'],
		order: [['esntlId', 'DESC']],
		transaction,
		lock: transaction ? transaction.LOCK.UPDATE : undefined,
	});

	if (!latest || !latest.esntlId) {
		return `${ROOM_PREFIX}${String(1).padStart(ROOM_PADDING, '0')}`;
	}

	const numberPart = parseInt(
		latest.esntlId.replace(ROOM_PREFIX, ''),
		10
	);
	const nextNumber = Number.isNaN(numberPart) ? 1 : numberPart + 1;
	return `${ROOM_PREFIX}${String(nextNumber).padStart(
		ROOM_PADDING,
		'0'
	)}`;
};

// 방 목록 조회
exports.getRoomList = async (req, res, next) => {
	try {
		verifyAdminToken(req);

		const { goID, roomName, sortBy } = req.query;

		if (!goID) {
			errorHandler.errorThrow(400, 'goID를 입력해주세요.');
		}

		// 기본 검색 조건: goID
		const whereCondition = {
			gosiwonEsntlId: goID,
		};

		// roomName이 있으면 추가 검색 조건
		if (roomName) {
			whereCondition.roomNumber = {
				[Op.like]: `%${roomName}%`,
			};
		}

		// 정렬 기준 설정 (기본값: orderNo)
		let orderBy = [['orderNo', 'ASC']];

		if (sortBy) {
			const sortMap = {
				roomName: 'roomNumber',
				roomStatus: 'status',
				roomType: 'roomType',
				winType: 'window',
				rentFee: 'monthlyRent',
			};

			const sortColumn = sortMap[sortBy];
			if (sortColumn) {
				orderBy = [[sortColumn, 'ASC']];
			}
		}

		const roomList = await room.findAll({
			where: whereCondition,
			order: orderBy,
			raw: true,
			// attributes를 지정하지 않아 모든 컬럼 반환
		});

		errorHandler.successThrow(res, '방 목록 조회 성공', roomList);
	} catch (err) {
		next(err);
	}
};

// 방 정보 조회
exports.getRoomInfo = async (req, res, next) => {
	try {
		verifyAdminToken(req);

		const { esntlID } = req.query;

		if (!esntlID) {
			errorHandler.errorThrow(400, 'esntlID를 입력해주세요.');
		}

		const roomInfo = await room.findOne({
			where: {
				esntlId: esntlID,
			},
			raw: true,
		});

		if (!roomInfo) {
			errorHandler.errorThrow(404, '방 정보를 찾을 수 없습니다.');
		}

		errorHandler.successThrow(res, '방 정보 조회 성공', roomInfo);
	} catch (err) {
		next(err);
	}
};

// 방 정보 등록
exports.createRoom = async (req, res, next) => {
	const transaction = await mariaDBSequelize.transaction();
	try {
		verifyAdminToken(req);

		const {
			goID,
			roomNumber,
			roomType,
			deposit,
			monthlyRent,
			startDate,
			endDate,
			window,
			option,
			floor,
			intro,
			status,
			month,
			description,
			youtube,
			orderNo,
			empty,
		} = req.body;

		if (!goID) {
			errorHandler.errorThrow(400, 'goID를 입력해주세요.');
		}

		const roomId = await generateRoomId(transaction);

		await room.create(
			{
				esntlId: roomId,
				gosiwonEsntlId: goID,
				roomNumber: roomNumber || null,
				roomType: roomType || null,
				deposit: deposit !== undefined ? parseInt(deposit, 10) : null,
				monthlyRent: monthlyRent || null,
				startDate: startDate || null,
				endDate: endDate || null,
				window: window || null,
				option: option || null,
				floor: floor || null,
				intro: intro || null,
				status: status || 'EMPTY',
				month: month || null,
				description: description || null,
				youtube: youtube || null,
				orderNo: orderNo !== undefined ? parseInt(orderNo, 10) : 1,
				empty: empty || '1',
			},
			{ transaction }
		);

		await transaction.commit();

		errorHandler.successThrow(res, '방 정보 등록 성공', { esntlID: roomId });
	} catch (err) {
		await transaction.rollback();
		next(err);
	}
};

// 방 정보 수정
exports.updateRoom = async (req, res, next) => {
	const transaction = await mariaDBSequelize.transaction();
	try {
		verifyAdminToken(req);

		const {
			esntlID,
			roomNumber,
			roomType,
			deposit,
			monthlyRent,
			startDate,
			endDate,
			window,
			option,
			floor,
			intro,
			status,
			month,
			description,
			youtube,
			orderNo,
		} = req.body;

		if (!esntlID) {
			errorHandler.errorThrow(400, 'esntlID를 입력해주세요.');
		}

		const roomInfo = await room.findByPk(esntlID);
		if (!roomInfo) {
			errorHandler.errorThrow(404, '방 정보를 찾을 수 없습니다.');
		}

		const updateData = {};

		if (roomNumber !== undefined) updateData.roomNumber = roomNumber;
		if (roomType !== undefined) updateData.roomType = roomType;
		if (deposit !== undefined) updateData.deposit = parseInt(deposit, 10);
		if (monthlyRent !== undefined) updateData.monthlyRent = monthlyRent;
		if (startDate !== undefined) updateData.startDate = startDate;
		if (endDate !== undefined) updateData.endDate = endDate;
		if (window !== undefined) updateData.window = window;
		if (option !== undefined) updateData.option = option;
		if (floor !== undefined) updateData.floor = floor;
		if (intro !== undefined) updateData.intro = intro;
		if (status !== undefined) updateData.status = status;
		if (month !== undefined) updateData.month = month;
		if (description !== undefined) updateData.description = description;
		if (youtube !== undefined) updateData.youtube = youtube;
		if (orderNo !== undefined) updateData.orderNo = parseInt(orderNo, 10);

		await room.update(updateData, {
			where: { esntlId: esntlID },
			transaction,
		});

		await transaction.commit();

		errorHandler.successThrow(res, '방 정보 수정 성공');
	} catch (err) {
		await transaction.rollback();
		next(err);
	}
};

// 방 정보 삭제
exports.deleteRoom = async (req, res, next) => {
	const transaction = await mariaDBSequelize.transaction();
	try {
		verifyAdminToken(req);

		const { esntlID } = req.query;

		if (!esntlID) {
			errorHandler.errorThrow(400, 'esntlID를 입력해주세요.');
		}

		const roomInfo = await room.findByPk(esntlID);
		if (!roomInfo) {
			errorHandler.errorThrow(404, '방 정보를 찾을 수 없습니다.');
		}

		const deleted = await room.destroy({
			where: {
				esntlId: esntlID,
			},
			transaction,
		});

		await transaction.commit();

		if (!deleted) {
			errorHandler.errorThrow(404, '방 정보를 찾을 수 없습니다.');
		}

		errorHandler.successThrow(res, '방 정보 삭제 성공');
	} catch (err) {
		await transaction.rollback();
		next(err);
	}
};

