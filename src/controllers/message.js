const axios = require('axios');
const { mariaDBSequelize } = require('../models');
const errorHandler = require('../middleware/error');
const { getWriterAdminId } = require('../utils/auth');
const { next: idsNext } = require('../utils/idsNext');

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

		// 발송 이력 저장 (esntlId: IDS 테이블 테이블명으로 조회, userEsntlId: 전화번호로 customer 중 최신 활성 사용자)
		const firstReceiver = receiver.split(',')[0]?.trim() || receiver;
		const historyEsntlId = await idsNext('messageSmsHistory');

		// 전화번호로 customer 테이블에서 최신 활성 사용자(roomContract.status = 'USED') esntlId 조회
		const userEsntlIdQuery = `
			SELECT C.esntlId
			FROM customer C
			INNER JOIN roomContract RC ON RC.customerEsntlId = C.esntlId AND RC.status = 'USED'
			WHERE C.phone = :receiverPhone
			ORDER BY RC.contractDate DESC
			LIMIT 1
		`;
		const userRows = await mariaDBSequelize.query(userEsntlIdQuery, {
			replacements: { receiverPhone: firstReceiver },
			type: mariaDBSequelize.QueryTypes.SELECT,
		});
		const resolvedUserEsntlId = Array.isArray(userRows) && userRows.length > 0
			? userRows[0].esntlId
			: (userEsntlId || null);

		await mariaDBSequelize.query(
			`
			INSERT INTO messageSmsHistory (
				esntlId,
				title,
				content,
				gosiwonEsntlId,
				userEsntlId,
				receiverPhone,
				createdBy
			) VALUES (?, ?, ?, ?, ?, ?, ?)
		`,
			{
				replacements: [
					historyEsntlId,
					title || '문자 발송',
					message,
					gosiwonEsntlId || null,
					resolvedUserEsntlId,
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

// 발송 메시지 리스트 (messageSmsHistory) - 페이징
exports.getMessageHistory = async (req, res, next) => {
	try {
		verifyAdminToken(req);

		const page = Math.max(parseInt(req.query.page) || 1, 1);
		const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 500);
		const offset = (page - 1) * limit;

		const countQuery = `SELECT COUNT(*) AS total FROM messageSmsHistory`;
		const countResult = await mariaDBSequelize.query(countQuery, {
			type: mariaDBSequelize.QueryTypes.SELECT,
		});
		const total = Number(countResult[0]?.total ?? 0);

		const listQuery = `
			SELECT
				DATE_FORMAT(M.createdAt, '%y-%m-%d') AS sentDate,
				M.createdBy AS sentById,
				M.title,
				M.content,
				G.name AS gosiwonName,
				C.name AS userName
			FROM messageSmsHistory M
			LEFT JOIN gosiwon G ON G.esntlId = M.gosiwonEsntlId
			LEFT JOIN customer C ON C.esntlId = M.userEsntlId
			ORDER BY M.createdAt DESC
			LIMIT ? OFFSET ?
		`;
		const rows = await mariaDBSequelize.query(listQuery, {
			replacements: [limit, offset],
			type: mariaDBSequelize.QueryTypes.SELECT,
		});

		const list = (Array.isArray(rows) ? rows : []).map((row) => ({
			sentDate: row.sentDate || '',
			sentById: row.sentById || '',
			title: row.title || '',
			content: row.content || '',
			gosiwonName: row.gosiwonName || '',
			userName: row.userName || '',
		}));

		errorHandler.successThrow(res, '조회 성공', {
			list,
			total,
			page,
			limit,
			totalPages: Math.ceil(total / limit) || 0,
		});
	} catch (err) {
		next(err);
	}
};
