const { accessVerify } = require('../middleware/jwt');
const errorHandler = require('../middleware/error');
const enumConfig = require('../middleware/enum');
const boardAuth = require('../middleware/boardAuth');
const jwt = require('jsonwebtoken');

// 회원 인증 함수
const authenticate = (req, level = null) => {
	const authHeader = req.get('Authorization');
	console.log(authHeader);
	if (!authHeader) {
		req.user = '';
		req.level = 0;
		return;
		// errorHandler.errorThrow(
		//    enumConfig.statusErrorCode._401_ERROR[0],
		//    'No token in header.'
		// );
	}

	const token = authHeader.split(' ')[1];
	let decodedToken = null;

	decodedToken = accessVerify(token);
	
	// accessVerify가 실패한 경우 (관리자 토큰일 수 있음), jwt.decode 시도
	if (!decodedToken.decoded) {
		try {
			const decoded = jwt.decode(token);
			if (decoded && decoded.admin) {
				// 관리자 토큰인 경우
				req.user = decoded.admin;
				req.level = enumConfig.userLevel.USER_LV9;
				decodedToken = { decoded: decoded };
			} else {
				// 일반 토큰도 아니고 관리자 토큰도 아닌 경우
				if (decodedToken.err && decodedToken.err.name === 'TokenExpiredError') {
					errorHandler.errorThrow(
						enumConfig.statusErrorCode._401_ERROR[0],
						'Access token authentication expiration.'
					);
				} else {
					errorHandler.errorThrow(
						enumConfig.statusErrorCode._401_ERROR[0],
						'Access token authentication failed.'
					);
				}
			}
		} catch (err) {
			errorHandler.errorThrow(
				enumConfig.statusErrorCode._401_ERROR[0],
				'Access token authentication failed.'
			);
		}
	} else {
		// accessVerify가 성공한 경우
		if (decodedToken.decoded.admin) {
			// 관리자 토큰인 경우
			req.user = decodedToken.decoded.admin;
			req.level = enumConfig.userLevel.USER_LV9;
		} else {
			// 일반 회원 토큰인 경우
			req.user = decodedToken.decoded.user;
			req.level = decodedToken.decoded.level;
		}
	}

	if (level && parseInt(req.level) !== level) {
		errorHandler.errorThrow(
			enumConfig.statusErrorCode._401_ERROR[0],
			'관리자 권한이 없습니다.'
		);
	}
};

// 회원인증
exports.isAuth = async (req, res, next) => {
	try {
		authenticate(req);
		next();
	} catch (err) {
		next(err);
	}
};

// 관리자 인증
exports.isAuthAdmin = async (req, res, next) => {
	try {
		authenticate(req, enumConfig.userLevel.USER_LV9);
		next();
	} catch (err) {
		next(err);
	}
};

// 게시판 인증
exports.isAuthBoard = async (req, res, next) => {
	let category = req.body.category || req.params.category;
	let boardAuthType = req.body.boardAuthType;
	let idx = req.query.idx;
	console.log(boardAuthType);
	try {
		// 조회일 경우
		if (!idx && boardAuthType === undefined) {
			boardAuthType = enumConfig.boardAuthType.READ;
		}

		if (boardAuthType === undefined) {
			errorHandler.errorThrow(
				enumConfig.statusErrorCode._404_ERROR[0],
				'게시판 인증 정보가 없습니다.'
			);
		}

		// 회원인증
		authenticate(req);

		const authorizationResult = await boardAuth.authorizeUser(
			category,
			boardAuthType,
			req.level
		);

		if (authorizationResult) {
			errorHandler.errorThrow(
				authorizationResult.statusCode,
				authorizationResult.message
			);
		}

		next();
	} catch (err) {
		next(err);
	}
};
