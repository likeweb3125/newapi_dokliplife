const { Op } = require('sequelize');
const {
	roomStatus,
	roomStatusHistory,
	room,
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

const ROOMSTATUS_PREFIX = 'RSTA';
const ROOMSTATUS_PADDING = 10;
const ROOMSTATUSHISTORY_PREFIX = 'RSTH';
const ROOMSTATUSHISTORY_PADDING = 10;

// 상태 코드 정의
const STATUS_CODES = {
	BEFORE_SALES: '판매신청전',
	ON_SALE: '판매중',
	DEPOSIT_PENDING: '입금대기중',
	RESERVED: '예약중',
	IN_USE: '이용중',
	OVERDUE: '체납상태',
	CHECKOUT_REQUESTED: '퇴실요청',
	CHECKOUT_CONFIRMED: '퇴실확정',
	ROOM_MOVE: '방이동',
};

const generateRoomStatusId = async (transaction) => {
	const latest = await roomStatus.findOne({
		attributes: ['esntlId'],
		order: [['esntlId', 'DESC']],
		transaction,
		lock: transaction ? transaction.LOCK.UPDATE : undefined,
	});

	if (!latest || !latest.esntlId) {
		return `${ROOMSTATUS_PREFIX}${String(1).padStart(ROOMSTATUS_PADDING, '0')}`;
	}

	const numberPart = parseInt(
		latest.esntlId.replace(ROOMSTATUS_PREFIX, ''),
		10
	);
	const nextNumber = Number.isNaN(numberPart) ? 1 : numberPart + 1;
	return `${ROOMSTATUS_PREFIX}${String(nextNumber).padStart(
		ROOMSTATUS_PADDING,
		'0'
	)}`;
};

const generateRoomStatusHistoryId = async (transaction) => {
	const latest = await roomStatusHistory.findOne({
		attributes: ['esntlId'],
		order: [['esntlId', 'DESC']],
		transaction,
		lock: transaction ? transaction.LOCK.UPDATE : undefined,
	});

	if (!latest || !latest.esntlId) {
		return `${ROOMSTATUSHISTORY_PREFIX}${String(1).padStart(ROOMSTATUSHISTORY_PADDING, '0')}`;
	}

	const numberPart = parseInt(
		latest.esntlId.replace(ROOMSTATUSHISTORY_PREFIX, ''),
		10
	);
	const nextNumber = Number.isNaN(numberPart) ? 1 : numberPart + 1;
	return `${ROOMSTATUSHISTORY_PREFIX}${String(nextNumber).padStart(
		ROOMSTATUSHISTORY_PADDING,
		'0'
	)}`;
};

// 방 현재 상태 조회
exports.getRoomStatus = async (req, res, next) => {
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

		const statusInfo = await roomStatus.findOne({
			where: {
				roomEsntlId: roomEsntlId,
			},
			include: [
				{
					model: customer,
					as: 'customer',
					attributes: ['esntlId', 'name', 'phone'],
					required: false,
				},
			],
			raw: false,
		});

		if (!statusInfo) {
			// 상태 정보가 없으면 기본값 반환
			return errorHandler.successThrow(res, '방 상태 조회 성공', {
				roomEsntlId: roomEsntlId,
				status: 'BEFORE_SALES',
				statusName: STATUS_CODES.BEFORE_SALES,
				customerEsntlId: null,
				customerName: null,
				contractStartDate: null,
				contractEndDate: null,
				memo: null,
			});
		}

		const response = {
			esntlId: statusInfo.esntlId,
			roomEsntlId: statusInfo.roomEsntlId,
			status: statusInfo.status,
			statusName: STATUS_CODES[statusInfo.status] || statusInfo.status,
			customerEsntlId: statusInfo.customerEsntlId,
			customerName: statusInfo.customerName,
			contractStartDate: statusInfo.contractStartDate,
			contractEndDate: statusInfo.contractEndDate,
			memo: statusInfo.memo,
			createdAt: statusInfo.createdAt,
			updatedAt: statusInfo.updatedAt,
			customer: statusInfo.customer || null,
		};

		errorHandler.successThrow(res, '방 상태 조회 성공', response);
	} catch (err) {
		next(err);
	}
};

// 방 상태 변경 (현재 상태 업데이트 + 히스토리 기록)
exports.updateRoomStatus = async (req, res, next) => {
	const transaction = await mariaDBSequelize.transaction();
	try {
		const decodedToken = verifyAdminToken(req);

		const {
			roomEsntlId,
			status,
			customerEsntlId,
			customerName,
			contractStartDate,
			contractEndDate,
			memo,
			historyStartDate,
			historyEndDate,
		} = req.body;

		if (!roomEsntlId) {
			errorHandler.errorThrow(400, 'roomEsntlId를 입력해주세요.');
		}

		if (!status) {
			errorHandler.errorThrow(400, 'status를 입력해주세요.');
		}

		// 상태 코드 유효성 검사
		if (!STATUS_CODES[status]) {
			errorHandler.errorThrow(
				400,
				`유효하지 않은 상태 코드입니다. 가능한 값: ${Object.keys(STATUS_CODES).join(', ')}`
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

		// 기존 상태 조회
		const existingStatus = await roomStatus.findOne({
			where: {
				roomEsntlId: roomEsntlId,
			},
			transaction,
		});

		// 현재 상태 업데이트 또는 생성
		if (existingStatus) {
			await roomStatus.update(
				{
					status: status,
					customerEsntlId: customerEsntlId || null,
					customerName: customerName || null,
					contractStartDate: contractStartDate || null,
					contractEndDate: contractEndDate || null,
					memo: memo || null,
				},
				{
					where: { roomEsntlId: roomEsntlId },
					transaction,
				}
			);
		} else {
			const statusId = await generateRoomStatusId(transaction);
			await roomStatus.create(
				{
					esntlId: statusId,
					roomEsntlId: roomEsntlId,
					status: status,
					customerEsntlId: customerEsntlId || null,
					customerName: customerName || null,
					contractStartDate: contractStartDate || null,
					contractEndDate: contractEndDate || null,
					memo: memo || null,
				},
				{ transaction }
			);
		}

		// 히스토리 기록
		const historyId = await generateRoomStatusHistoryId(transaction);
		await roomStatusHistory.create(
			{
				esntlId: historyId,
				roomEsntlId: roomEsntlId,
				status: status,
				customerEsntlId: customerEsntlId || null,
				customerName: customerName || null,
				startDate: historyStartDate || new Date(),
				endDate: historyEndDate || null,
				memo: memo || null,
				createdBy: decodedToken?.admin?.id || decodedToken?.id || null,
			},
			{ transaction }
		);

		await transaction.commit();

		errorHandler.successThrow(res, '방 상태 변경 성공', {
			roomEsntlId: roomEsntlId,
			status: status,
			statusName: STATUS_CODES[status],
		});
	} catch (err) {
		await transaction.rollback();
		next(err);
	}
};

// 방 상태 히스토리 목록 조회 (간트 차트용)
exports.getRoomStatusHistory = async (req, res, next) => {
	try {
		verifyAdminToken(req);

		const { roomEsntlId, startDate, endDate } = req.query;

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

		const whereCondition = {
			roomEsntlId: roomEsntlId,
		};

		// 날짜 범위 필터링
		if (startDate || endDate) {
			whereCondition.startDate = {};
			if (startDate) {
				whereCondition.startDate[Op.gte] = new Date(startDate);
			}
			if (endDate) {
				whereCondition.startDate[Op.lte] = new Date(endDate);
			}
		}

		const historyList = await roomStatusHistory.findAll({
			where: whereCondition,
			order: [['startDate', 'ASC']],
			include: [
				{
					model: customer,
					as: 'customer',
					attributes: ['esntlId', 'name', 'phone'],
					required: false,
				},
			],
			raw: false,
		});

		const response = historyList.map((history) => ({
			esntlId: history.esntlId,
			roomEsntlId: history.roomEsntlId,
			status: history.status,
			statusName: STATUS_CODES[history.status] || history.status,
			customerEsntlId: history.customerEsntlId,
			customerName: history.customerName,
			startDate: history.startDate,
			endDate: history.endDate,
			memo: history.memo,
			createdBy: history.createdBy,
			createdAt: history.createdAt,
			customer: history.customer || null,
		}));

		errorHandler.successThrow(res, '방 상태 히스토리 조회 성공', response);
	} catch (err) {
		next(err);
	}
};

// 방 상태 히스토리 등록
exports.createRoomStatusHistory = async (req, res, next) => {
	const transaction = await mariaDBSequelize.transaction();
	try {
		const decodedToken = verifyAdminToken(req);

		const {
			roomEsntlId,
			status,
			customerEsntlId,
			customerName,
			startDate,
			endDate,
			memo,
		} = req.body;

		if (!roomEsntlId) {
			errorHandler.errorThrow(400, 'roomEsntlId를 입력해주세요.');
		}

		if (!status) {
			errorHandler.errorThrow(400, 'status를 입력해주세요.');
		}

		if (!startDate) {
			errorHandler.errorThrow(400, 'startDate를 입력해주세요.');
		}

		// 상태 코드 유효성 검사
		if (!STATUS_CODES[status]) {
			errorHandler.errorThrow(
				400,
				`유효하지 않은 상태 코드입니다. 가능한 값: ${Object.keys(STATUS_CODES).join(', ')}`
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

		const historyId = await generateRoomStatusHistoryId(transaction);

		await roomStatusHistory.create(
			{
				esntlId: historyId,
				roomEsntlId: roomEsntlId,
				status: status,
				customerEsntlId: customerEsntlId || null,
				customerName: customerName || null,
				startDate: new Date(startDate),
				endDate: endDate ? new Date(endDate) : null,
				memo: memo || null,
				createdBy: decodedToken?.admin?.id || decodedToken?.id || null,
			},
			{ transaction }
		);

		await transaction.commit();

		errorHandler.successThrow(res, '방 상태 히스토리 등록 성공', {
			esntlId: historyId,
		});
	} catch (err) {
		await transaction.rollback();
		next(err);
	}
};

// 방 상태 히스토리 수정
exports.updateRoomStatusHistory = async (req, res, next) => {
	const transaction = await mariaDBSequelize.transaction();
	try {
		verifyAdminToken(req);

		const {
			esntlId,
			status,
			customerEsntlId,
			customerName,
			startDate,
			endDate,
			memo,
		} = req.body;

		if (!esntlId) {
			errorHandler.errorThrow(400, 'esntlId를 입력해주세요.');
		}

		const historyInfo = await roomStatusHistory.findByPk(esntlId, {
			transaction,
		});

		if (!historyInfo) {
			errorHandler.errorThrow(404, '방 상태 히스토리를 찾을 수 없습니다.');
		}

		// 상태 코드 유효성 검사
		if (status && !STATUS_CODES[status]) {
			errorHandler.errorThrow(
				400,
				`유효하지 않은 상태 코드입니다. 가능한 값: ${Object.keys(STATUS_CODES).join(', ')}`
			);
		}

		const updateData = {};

		if (status !== undefined) updateData.status = status;
		if (customerEsntlId !== undefined)
			updateData.customerEsntlId = customerEsntlId || null;
		if (customerName !== undefined)
			updateData.customerName = customerName || null;
		if (startDate !== undefined) updateData.startDate = new Date(startDate);
		if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null;
		if (memo !== undefined) updateData.memo = memo || null;

		await roomStatusHistory.update(updateData, {
			where: { esntlId: esntlId },
			transaction,
		});

		await transaction.commit();

		errorHandler.successThrow(res, '방 상태 히스토리 수정 성공');
	} catch (err) {
		await transaction.rollback();
		next(err);
	}
};

// 방 상태 히스토리 삭제
exports.deleteRoomStatusHistory = async (req, res, next) => {
	const transaction = await mariaDBSequelize.transaction();
	try {
		verifyAdminToken(req);

		const { esntlId } = req.query;

		if (!esntlId) {
			errorHandler.errorThrow(400, 'esntlId를 입력해주세요.');
		}

		const historyInfo = await roomStatusHistory.findByPk(esntlId, {
			transaction,
		});

		if (!historyInfo) {
			errorHandler.errorThrow(404, '방 상태 히스토리를 찾을 수 없습니다.');
		}

		await roomStatusHistory.destroy({
			where: {
				esntlId: esntlId,
			},
			transaction,
		});

		await transaction.commit();

		errorHandler.successThrow(res, '방 상태 히스토리 삭제 성공');
	} catch (err) {
		await transaction.rollback();
		next(err);
	}
};

// 여러 방의 상태 히스토리 일괄 조회 (간트 차트용)
exports.getMultipleRoomStatusHistory = async (req, res, next) => {
	try {
		verifyAdminToken(req);

		const { gosiwonEsntlId, startDate, endDate } = req.query;

		if (!gosiwonEsntlId) {
			errorHandler.errorThrow(400, 'gosiwonEsntlId를 입력해주세요.');
		}

		// 해당 고시원의 모든 방 조회
		const rooms = await room.findAll({
			where: {
				gosiwonEsntlId: gosiwonEsntlId,
			},
			attributes: ['esntlId', 'roomNumber'],
			raw: true,
		});

		if (!rooms || rooms.length === 0) {
			return errorHandler.successThrow(res, '방 상태 히스토리 조회 성공', []);
		}

		const roomEsntlIds = rooms.map((r) => r.esntlId);

		const whereCondition = {
			roomEsntlId: {
				[Op.in]: roomEsntlIds,
			},
		};

		// 날짜 범위 필터링
		if (startDate || endDate) {
			whereCondition.startDate = {};
			if (startDate) {
				whereCondition.startDate[Op.gte] = new Date(startDate);
			}
			if (endDate) {
				whereCondition.startDate[Op.lte] = new Date(endDate);
			}
		}

		const historyList = await roomStatusHistory.findAll({
			where: whereCondition,
			order: [
				['roomEsntlId', 'ASC'],
				['startDate', 'ASC'],
			],
			include: [
				{
					model: customer,
					as: 'customer',
					attributes: ['esntlId', 'name', 'phone'],
					required: false,
				},
			],
			raw: false,
		});

		// 방별로 그룹화
		const groupedByRoom = {};
		rooms.forEach((room) => {
			groupedByRoom[room.esntlId] = {
				roomEsntlId: room.esntlId,
				roomNumber: room.roomNumber,
				history: [],
			};
		});

		historyList.forEach((history) => {
			if (groupedByRoom[history.roomEsntlId]) {
				groupedByRoom[history.roomEsntlId].history.push({
					esntlId: history.esntlId,
					status: history.status,
					statusName: STATUS_CODES[history.status] || history.status,
					customerEsntlId: history.customerEsntlId,
					customerName: history.customerName,
					startDate: history.startDate,
					endDate: history.endDate,
					memo: history.memo,
					createdBy: history.createdBy,
					createdAt: history.createdAt,
					customer: history.customer || null,
				});
			}
		});

		const response = Object.values(groupedByRoom);

		errorHandler.successThrow(res, '방 상태 히스토리 조회 성공', response);
	} catch (err) {
		next(err);
	}
};

