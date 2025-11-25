const { Op } = require('sequelize');
const { room } = require('../models');
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

// 방 목록 조회
exports.getRoomList = async (req, res, next) => {
	try {
		verifyAdminToken(req);

		const { esntlID, roomName } = req.body;

		if (!esntlID) {
			errorHandler.errorThrow(400, 'esntlID를 입력해주세요.');
		}

		// 기본 검색 조건: esntlID
		const whereCondition = {
			gosiwonEsntlId: esntlID,
		};

		// roomName이 있으면 추가 검색 조건
		if (roomName) {
			whereCondition.roomNumber = {
				[Op.like]: `%${roomName}%`,
			};
		}

		const roomList = await room.findAll({
			where: whereCondition,
			raw: true,
			// attributes를 지정하지 않아 모든 컬럼 반환
		});

		errorHandler.successThrow(res, '방 목록 조회 성공', roomList);
	} catch (err) {
		next(err);
	}
};

