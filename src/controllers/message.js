const axios = require('axios');
const { mariaDBSequelize } = require('../models');
const errorHandler = require('../middleware/error');
const { getWriterAdminId } = require('../utils/auth');

// 공통 토큰 검증 함수 (관리자/파트너)
const verifyAdminToken = (req) => {
	const authHeader = req.get('Authorization');
	if (!authHeader) {
		errorHandler.errorThrow(401, '토큰이 없습니다.');
	}

	const token = authHeader.split(' ')[1];
	if (!token) {
		errorHandler.errorThrow(401, '토큰 형식이 올바르지 않습니다.');
	}

	const jwt = require('jsonwebtoken');
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

const aligoSMS = require('../module/aligo/sms');

// 문자 전송
exports.sendSMS = async (req, res, next) => {
	try {
		const decodedToken = verifyAdminToken(req);
		const writerAdminId = getWriterAdminId(decodedToken);

		const { receiver, message, title, gosiwonEsntlId = null, userEsntlId = null } = req.body;

		if (!receiver) {
			errorHandler.errorThrow(400, 'receiver(수신번호)를 입력해주세요.');
		}
		if (!message) {
			errorHandler.errorThrow(400, 'message(메시지 내용)를 입력해주세요.');
		}

		const result = await aligoSMS.send({ receiver, message, title });

		// 발송 이력 저장
		const firstReceiver = receiver.split(',')[0]?.trim() || receiver;
		await mariaDBSequelize.query(
			`
			INSERT INTO messageSmsHistory (
				title,
				content,
				gosiwonEsntlId,
				userEsntlId,
				receiverPhone,
				createdBy
			) VALUES (?, ?, ?, ?, ?, ?)
		`,
			{
				replacements: [
					title || '문자 발송',
					message,
					gosiwonEsntlId || null,
					userEsntlId || null,
					firstReceiver,
					writerAdminId || null,
				],
				type: mariaDBSequelize.QueryTypes.INSERT,
			}
		);

		errorHandler.successThrow(res, '문자 발송 성공', {
			result,
		});
	} catch (err) {
		next(err);
	}
};
