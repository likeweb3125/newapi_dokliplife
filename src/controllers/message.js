const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { mariaDBSequelize } = require('../models');
const errorHandler = require('../middleware/error');
const { getWriterAdminId } = require('../utils/auth');
const { next: idsNext } = require('../utils/idsNext');
const historyController = require('./history');
const { phoneToRaw } = require('../utils/phoneHelper');
const { dateToYmd } = require('../utils/dateHelper');
const multerMiddleware = require('../middleware/multer');

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

		const { receiver, message, title, gosiwonEsntlId = null, userEsntlId = null, roomEsntlId: bodyRoomEsntlId = null } = req.body;

		if (!receiver) {
			errorHandler.errorThrow(400, 'receiver(수신번호)를 입력해주세요.');
		}
		if (!message) {
			errorHandler.errorThrow(400, 'message(메시지 내용)를 입력해주세요.');
		}

		const firstReceiver = receiver.split(',')[0]?.trim() || receiver;
		const receiverForAligo = receiver.split(',').map((r) => phoneToRaw(r.trim()) ?? r.trim()).filter(Boolean).join(',');
		// 이미지 업로드 시 MMS로 발송 (req.file은 multipart/form-data로 image 필드 전송 시 존재)
		const imagePath = req.file ? path.join(process.cwd(), req.file.path) : undefined;
		const result = await aligoSMS.send({ receiver: receiverForAligo || receiver, message, title, imagePath });

		// 발송 이력 저장 (esntlId: IDS 테이블 테이블명으로 조회, userEsntlId: 전화번호로 customer 중 최신 활성 사용자)
		const firstReceiverRaw = phoneToRaw(firstReceiver) ?? firstReceiver;
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
			replacements: { receiverPhone: firstReceiverRaw },
			type: mariaDBSequelize.QueryTypes.SELECT,
		});
		const resolvedUserEsntlId = Array.isArray(userRows) && userRows.length > 0
			? userRows[0].esntlId
			: (userEsntlId || null);

		// history 저장용: 방·계약 정보 (body에 없으면 사용자 기준 USED 계약에서 조회)
		let resolvedRoomEsntlId = bodyRoomEsntlId || null;
		let resolvedContractEsntlId = null;
		if (resolvedUserEsntlId && !resolvedRoomEsntlId) {
			const [contractRow] = await mariaDBSequelize.query(
				`SELECT esntlId, roomEsntlId FROM roomContract WHERE customerEsntlId = ? AND status = 'USED' ORDER BY contractDate DESC LIMIT 1`,
				{
					replacements: [resolvedUserEsntlId],
					type: mariaDBSequelize.QueryTypes.SELECT,
				}
			);
			if (contractRow) {
				resolvedContractEsntlId = contractRow.esntlId;
				resolvedRoomEsntlId = contractRow.roomEsntlId;
			}
		}

		// MMS 발송 시 이미지를 upload/message/{고시원ID}/{날짜}/파일명 구조로 이동 후 경로 저장
		let savedImagePath = null;
		if (req.file && req.file.path) {
			const gosiwonId = gosiwonEsntlId || 'common';
			const dateStr = dateToYmd(new Date()) || 'unknown';
			const baseDir = path.join(process.cwd(), 'upload', 'message', gosiwonId, dateStr);
			if (!fs.existsSync(baseDir)) {
				fs.mkdirSync(baseDir, { recursive: true });
			}
			const filename = path.basename(req.file.path);
			const targetPath = path.join(baseDir, filename);
			try {
				fs.renameSync(path.join(process.cwd(), req.file.path), targetPath);
			} catch (renameErr) {
				// 다른 드라이브 등으로 rename 실패 시 복사 후 삭제
				fs.copyFileSync(path.join(process.cwd(), req.file.path), targetPath);
				fs.unlinkSync(path.join(process.cwd(), req.file.path));
			}
			savedImagePath = ['upload', 'message', gosiwonId, dateStr, filename].join('/');
		}

		await mariaDBSequelize.query(
			`
			INSERT INTO messageSmsHistory (
				esntlId,
				title,
				content,
				imagePath,
				gosiwonEsntlId,
				userEsntlId,
				receiverPhone,
				createdBy,
				createdAt,
				updatedAt
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
		`,
			{
				replacements: [
					historyEsntlId,
					title || '문자 발송',
					message,
					savedImagePath,
					gosiwonEsntlId || null,
					resolvedUserEsntlId,
					firstReceiverRaw,
					writerAdminId || null,
				],
				type: mariaDBSequelize.QueryTypes.INSERT,
			}
		);

		// history 테이블에 방·고시원·사용자 기준 기록 (공통 저장 함수 사용)
		try {
			const historyContent = `문자 발송: ${title || '문자 발송'} - 수신 ${firstReceiver}${message ? ` (${String(message).slice(0, 50)}${message.length > 50 ? '…' : ''})` : ''}`;
			await historyController.createHistoryRecord({
				gosiwonEsntlId: gosiwonEsntlId || null,
				roomEsntlId: resolvedRoomEsntlId,
				contractEsntlId: resolvedContractEsntlId,
				content: historyContent,
				category: 'ETC',
				priority: 'NORMAL',
				publicRange: 0,
				writerAdminId: writerAdminId || null,
				writerCustomerId: resolvedUserEsntlId,
				writerType: 'ADMIN',
			});
		} catch (historyErr) {
			console.error('문자 발송 history 생성 실패:', historyErr);
			// history 실패해도 문자 발송 성공 응답 유지
		}

		// MMS 이미지는 이력 조회용으로 보존 (삭제하지 않음)
		errorHandler.successThrow(res, '문자 발송 성공', {
			result,
		});
	} catch (err) {
		// 에러 시에만 업로드된 이미지 임시 파일 삭제
		if (req.file && req.file.path) {
			try {
				multerMiddleware.clearFile(req.file.path);
			} catch (e) {
				console.error('문자 발송 이미지 임시 파일 삭제 실패:', e);
			}
		}
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
				M.imagePath,
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
			imagePath: row.imagePath || null,
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
