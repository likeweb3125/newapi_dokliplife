const { roomMemo, room, mariaDBSequelize } = require('../models');
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

const ROOMMEMO_PREFIX = 'RMEM';
const ROOMMEMO_PADDING = 9;

const generateRoomMemoId = async (transaction) => {
	const latest = await roomMemo.findOne({
		attributes: ['esntlId'],
		order: [['esntlId', 'DESC']],
		transaction,
		lock: transaction ? transaction.LOCK.UPDATE : undefined,
	});

	if (!latest || !latest.esntlId) {
		return `${ROOMMEMO_PREFIX}${String(1).padStart(ROOMMEMO_PADDING, '0')}`;
	}

	const numberPart = parseInt(
		latest.esntlId.replace(ROOMMEMO_PREFIX, ''),
		10
	);
	const nextNumber = Number.isNaN(numberPart) ? 1 : numberPart + 1;
	return `${ROOMMEMO_PREFIX}${String(nextNumber).padStart(
		ROOMMEMO_PADDING,
		'0'
	)}`;
};

// 방 메모 목록 조회 (GET)
exports.getRoomMemoList = async (req, res, next) => {
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

		const memoList = await roomMemo.findAll({
			where: {
				roomEsntlId: roomEsntlId,
			},
			order: [['created_at', 'DESC']],
			raw: true,
		});

		const response = memoList.map((memo) => ({
			memoID: memo.esntlId,
			roomEsntlId: memo.roomEsntlId,
			memo: memo.memo || '',
			publicRange: memo.publicRange || 0,
			createdAt: memo.created_at,
		}));

		errorHandler.successThrow(res, '방 메모 목록 조회 성공', response);
	} catch (err) {
		next(err);
	}
};

// 방 메모 상세 조회 (GET)
exports.getRoomMemoInfo = async (req, res, next) => {
	try {
		verifyAdminToken(req);

		const { memoID } = req.query;

		if (!memoID) {
			errorHandler.errorThrow(400, 'memoID를 입력해주세요.');
		}

		const memoInfo = await roomMemo.findOne({
			where: {
				esntlId: memoID,
			},
			raw: true,
		});

		if (!memoInfo) {
			errorHandler.errorThrow(404, '방 메모 정보를 찾을 수 없습니다.');
		}

		const response = {
			memoID: memoInfo.esntlId,
			roomEsntlId: memoInfo.roomEsntlId,
			memo: memoInfo.memo || '',
			publicRange: memoInfo.publicRange || 0,
			createdAt: memoInfo.created_at,
		};

		errorHandler.successThrow(res, '방 메모 정보 조회 성공', response);
	} catch (err) {
		next(err);
	}
};

// 방 메모 등록 (POST)
exports.createRoomMemo = async (req, res, next) => {
	const transaction = await mariaDBSequelize.transaction();
	try {
		verifyAdminToken(req);

		const { roomEsntlId, memo, publicRange } = req.body;

		if (!roomEsntlId) {
			errorHandler.errorThrow(400, 'roomEsntlId를 입력해주세요.');
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

		const memoId = await generateRoomMemoId(transaction);

		await roomMemo.create(
			{
				esntlId: memoId,
				roomEsntlId: roomEsntlId,
				memo: memo || null,
				publicRange:
					publicRange !== undefined
						? parseInt(publicRange, 10)
						: 0,
			},
			{ transaction }
		);

		await transaction.commit();

		errorHandler.successThrow(res, '방 메모 등록 성공', {
			memoID: memoId,
		});
	} catch (err) {
		await transaction.rollback();
		next(err);
	}
};

// 방 메모 수정 (PUT)
exports.updateRoomMemo = async (req, res, next) => {
	const transaction = await mariaDBSequelize.transaction();
	try {
		verifyAdminToken(req);

		const { memoID, memo, publicRange } = req.body;

		if (!memoID) {
			errorHandler.errorThrow(400, 'memoID를 입력해주세요.');
		}

		const memoInfo = await roomMemo.findByPk(memoID);
		if (!memoInfo) {
			errorHandler.errorThrow(404, '방 메모 정보를 찾을 수 없습니다.');
		}

		await roomMemo.update(
			{
				memo: memo !== undefined ? memo : memoInfo.memo,
				publicRange:
					publicRange !== undefined
						? parseInt(publicRange, 10)
						: memoInfo.publicRange,
			},
			{
				where: { esntlId: memoID },
				transaction,
			}
		);

		await transaction.commit();

		errorHandler.successThrow(res, '방 메모 수정 성공');
	} catch (err) {
		await transaction.rollback();
		next(err);
	}
};

// 방 메모 삭제 (DELETE)
exports.deleteRoomMemo = async (req, res, next) => {
	const transaction = await mariaDBSequelize.transaction();
	try {
		verifyAdminToken(req);

		const { memoID } = req.query;

		if (!memoID) {
			errorHandler.errorThrow(400, 'memoID를 입력해주세요.');
		}

		const memoInfo = await roomMemo.findByPk(memoID);
		if (!memoInfo) {
			errorHandler.errorThrow(404, '방 메모 정보를 찾을 수 없습니다.');
		}

		await roomMemo.destroy({
			where: {
				esntlId: memoID,
			},
			transaction,
		});

		await transaction.commit();

		errorHandler.successThrow(res, '방 메모 삭제 성공');
	} catch (err) {
		await transaction.rollback();
		next(err);
	}
};

