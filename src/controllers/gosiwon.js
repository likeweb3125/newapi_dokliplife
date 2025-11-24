const { Op } = require('sequelize');
const { gosiwon } = require('../models');
const jwt = require('jsonwebtoken');
const errorHandler = require('../middleware/error');
const enumConfig = require('../middleware/enum');

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

	console.log('👤 관리자 ID:', decodedToken.admin);
	return decodedToken;
};

// 고시원 정보 조회
// 토큰에서 관리자 아이디 확인 후, 검색 종류와 검색어로 고시원 정보 조회
exports.getGosiwonInfo = async (req, res, next) => {
	try {
		// 토큰 검증
		verifyAdminToken(req);

		// 요청 파라미터 확인
		const { searchType, searchValue } = req.body;

		if (!searchType || !searchValue) {
			errorHandler.errorThrow(400, '검색 종류와 검색어를 입력해주세요.');
		}

		// 검색 종류 검증 (esntID 또는 name만 허용)
		if (searchType !== 'esntID' && searchType !== 'name') {
			errorHandler.errorThrow(400, '검색 종류는 esntID 또는 name만 가능합니다.');
		}

		// 검색 조건 설정
		let whereCondition = {};

		if (searchType === 'esntID') {
			whereCondition.esntlId = searchValue;
		} else if (searchType === 'name') {
			whereCondition.name = {
				[Op.like]: `%${searchValue}%`,
			};
		}

		// 고시원 정보 조회
		// 실제 테이블의 컬럼명을 확인하기 위해 attributes를 사용하지 않고 조회
		const gosiwonInfo = await gosiwon.findOne({
			where: whereCondition,
			raw: true,
		});

		if (!gosiwonInfo) {
			errorHandler.errorThrow(404, '고시원 정보를 찾을 수 없습니다.');
		}

		// 결과 반환
		errorHandler.successThrow(res, '고시원 정보 조회 성공', gosiwonInfo);
	} catch (err) {
		next(err);
	}
};

// 고시원 이름 목록 조회
exports.getGosiwonNames = async (req, res, next) => {
	try {
		verifyAdminToken(req);

		const { searchValue, limit } = req.body;

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
			attributes: ['name'],
			limit: take,
			order: [['name', 'ASC']],
			raw: true,
		});

		const names = gosiwonNames.map((item) => item.name);

		errorHandler.successThrow(res, '고시원 이름 목록 조회 성공', names);
	} catch (err) {
		next(err);
	}
};

