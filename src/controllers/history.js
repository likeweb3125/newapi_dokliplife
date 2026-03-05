const { Op } = require('sequelize');
const { history, mariaDBSequelize } = require('../models');
const { dateToYmdHms } = require('../utils/dateHelper');
const jwt = require('jsonwebtoken');
const errorHandler = require('../middleware/error');
const { getWriterAdminId } = require('../utils/auth');
const { next: idsNext } = require('../utils/idsNext');

// 필수 연관 ID 검증
const validateHistoryLinkage = ({
	gosiwonEsntlId,
	roomEsntlId,
	contractEsntlId,
	depositEsntlId,
}) => {
	// roomEsntlId가 있으면 gosiwonEsntlId 필수
	if (roomEsntlId && !gosiwonEsntlId) {
		errorHandler.errorThrow(
			400,
			'roomEsntlId가 있으면 gosiwonEsntlId는 필수입니다.'
		);
	}

	// contractEsntlId가 있으면 gosiwonEsntlId, roomEsntlId 필수
	if (contractEsntlId) {
		if (!gosiwonEsntlId || !roomEsntlId) {
			errorHandler.errorThrow(
				400,
				'contractEsntlId가 있으면 gosiwonEsntlId, roomEsntlId는 필수입니다.'
			);
		}
	}

	// depositEsntlId가 있으면 gosiwonEsntlId, roomEsntlId, contractEsntlId 필수
	if (depositEsntlId) {
		if (!gosiwonEsntlId || !roomEsntlId || !contractEsntlId) {
			errorHandler.errorThrow(
				400,
				'depositEsntlId가 있으면 gosiwonEsntlId, roomEsntlId, contractEsntlId는 필수입니다.'
			);
		}
	}
};

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

	if (!decodedToken || (!decodedToken.admin && !decodedToken.partner)) {
		errorHandler.errorThrow(401, '관리자 정보가 없습니다.');
	}
	return decodedToken;
};

// 히스토리 ID 생성 (IDS 테이블 기반, 접두어 HIST)
const generateHistoryId = async (transaction) => {
	return await idsNext('history', 'HIST', transaction);
};

// content 콜론 앞쪽 → STATUS_MAP 색상 매핑용 (mngChart STATUS_MAP과 동일 hex 사용)
const STATUS_MAP = {
	'BEFORE_SALES': { color: '#9B9B9B' },
	'ON_SALE': { color: '#27A644' },
	'VBANK_PENDING': { color: '#FFB800' },
	'RESERVE_PENDING': { color: '#FFB800' },
	'RESERVED': { color: '#F5CB40' },
	'CONTRACT': { color: '#FFA5C1' },
	'OVERDUE': { color: '#F41E27' },
	'CHECKOUT_REQUESTED': { color: '#A04083' },
	'CHECKOUT_CONFIRMED': { color: '#A04083' },
	'CHECKOUT_ONSALE': { color: '#A04083' },
	'END_DEPOSIT': { color: '#A04083' },
	'END': { color: '#A04083' },
	'ROOM_MOVE': { color: '#F78627' },
	'ROOM_MOVE_IN': { color: '#F78627' },
	'ROOM_MOVE_OUT': { color: '#F78627' },
	'ETC': { color: '#9B9B9B' },
	'disabled': { color: '#9B9B9B' },
	'in-progress': { color: '#FF8A00' },
	'leave': { color: '#9B9B9B' },
};

// content 첫 콜론 앞 문자열(행위 유형) → STATUS_MAP 키. 긴 문구를 앞에 두어 '방이동 취소'가 '방이동'보다 먼저 매칭되도록 함.
const CONTENT_PREFIX_TO_STATUS = [
	{ prefix: '방이동 취소', statusKey: 'ROOM_MOVE' },
	{ prefix: '방이동', statusKey: 'ROOM_MOVE' },
	{ prefix: '환불 및 퇴실처리', statusKey: 'END' },
	{ prefix: '방 예약 생성', statusKey: 'RESERVED' },
	{ prefix: '결제완료(입실료)', statusKey: 'CONTRACT' },
	{ prefix: '결제 요청 취소', statusKey: 'VBANK_PENDING' },
	{ prefix: '보증금/예약금 등록', statusKey: 'RESERVED' },
	{ prefix: '예약금/보증금 삭제', statusKey: 'END_DEPOSIT' },
	{ prefix: '보증금 추가 입금', statusKey: 'END_DEPOSIT' },
	{ prefix: '보증금 환불 등록', statusKey: 'END_DEPOSIT' },
	{ prefix: '보증금 정보 수정', statusKey: 'END_DEPOSIT' },
	{ prefix: '보증금 정보 삭제', statusKey: 'END_DEPOSIT' },
	{ prefix: '추가 결제 요청', statusKey: 'CONTRACT' },
	{ prefix: '주차 등록', statusKey: 'ETC' },
	{ prefix: '주차 삭제', statusKey: 'ETC' },
	{ prefix: '주차 정보 수정', statusKey: 'ETC' },
	{ prefix: '고시원 정보 수정', statusKey: 'ETC' },
	{ prefix: '고시원 생성', statusKey: 'ETC' },
	{ prefix: '고시원 삭제', statusKey: 'ETC' },
	{ prefix: '고시원 즐겨찾기', statusKey: 'ETC' },
	{ prefix: '운영환경설정 저장', statusKey: 'ETC' },
	{ prefix: '방 판매 시작(수정)', statusKey: 'ON_SALE' },
	{ prefix: '방 판매 시작(신규)', statusKey: 'ON_SALE' },
	{ prefix: '방 상태 추가', statusKey: 'ON_SALE' },
	{ prefix: '방 상태 취소', statusKey: 'ON_SALE' },
	{ prefix: '방 상태 수정', statusKey: 'ON_SALE' },
	{ prefix: '계약 정보 수정', statusKey: 'CONTRACT' },
	{ prefix: '방 정보가 등록', statusKey: 'ON_SALE' },
	{ prefix: '방 정보가 삭제', statusKey: 'ON_SALE' },
	{ prefix: '카테고리 변경', statusKey: 'ETC' },
	{ prefix: '문자 발송', statusKey: 'ETC' },
];

/** content에서 첫 번째 콜론 앞 문자열 추출 후 불필요 문자 제거 (예: "**방이동**: ..." → "방이동") */
function getContentPrefix(content) {
	if (!content || typeof content !== 'string') return '';
	const beforeColon = content.split(':')[0] || '';
	return beforeColon.replace(/\*/g, '').trim();
}

/** content prefix에 해당하는 STATUS_MAP 키 조회 (긴 문구 우선 매칭) */
function getStatusKeyFromContentPrefix(prefix) {
	if (!prefix) return 'ETC';
	const normalized = prefix.trim();
	for (const { prefix: p, statusKey } of CONTENT_PREFIX_TO_STATUS) {
		if (normalized === p || normalized.startsWith(p)) return statusKey;
	}
	return 'ETC';
}

/** content 문자열로 STATUS_MAP 기반 색상 객체 반환 (sidebar, statusBorder, statusText 동일 hex) */
function getColorForHistoryContent(content) {
	const prefix = getContentPrefix(content);
	const statusKey = getStatusKeyFromContentPrefix(prefix);
	const info = STATUS_MAP[statusKey] || STATUS_MAP['ETC'];
	const hex = info?.color || '#9B9B9B';
	return { sidebar: hex, statusBorder: hex, statusText: hex };
}

// 히스토리 목록 조회
exports.getHistoryList = async (req, res, next) => {
	try {
		verifyAdminToken(req);

		const {
			gosiwonEsntlId,
			roomEsntlId,
			contractEsntlId,
			depositEsntlId,
			etcEsntlId,
			category,
			priority,
			writerType,
			writerAdminId,
			writerCustomerId,
			writerName,
			isPinned,
			search,
			hideDeleted = true,
			page = 1,
			limit = 50,
			sortBy = 'createdAt',
			sortOrder = 'DESC',
		} = req.query;

		const whereCondition = {};

		// ID 필터
		if (gosiwonEsntlId) {
			whereCondition.gosiwonEsntlId = gosiwonEsntlId;
		}
		if (roomEsntlId) {
			whereCondition.roomEsntlId = roomEsntlId;
		}
		if (contractEsntlId) {
			whereCondition.contractEsntlId = contractEsntlId;
		}
		if (depositEsntlId) {
			whereCondition.depositEsntlId = depositEsntlId;
		}
		if (etcEsntlId) {
			whereCondition.etcEsntlId = etcEsntlId;
		}

		// 카테고리 필터
		if (category) {
			whereCondition.category = category;
		}

		// 중요도 필터
		if (priority) {
			whereCondition.priority = priority;
		}

		// 작성자 타입 필터
		if (writerType) {
			whereCondition.writerType = writerType;
		}

		// 작성자 ID 필터
		if (writerAdminId) {
			whereCondition.writerAdminId = writerAdminId;
		}
		if (writerCustomerId) {
			whereCondition.writerCustomerId = writerCustomerId;
		}
		if (writerName) {
			whereCondition.writerName = writerName;
		}

		// 고정 여부 필터
		if (isPinned !== undefined && isPinned !== null && isPinned !== '') {
			whereCondition.isPinned = isPinned === 'true' || isPinned === true ? 1 : 0;
		}

		// 삭제 여부 필터
		if (hideDeleted === 'true' || hideDeleted === true) {
			whereCondition.deleteYN = 'N';
		}

		// 검색어 필터 (히스토리 내용, 태그)
		if (search) {
			whereCondition[Op.or] = [
				{ content: { [Op.like]: `%${search}%` } },
				{ tags: { [Op.like]: `%${search}%` } },
			];
		}

		const offset = (parseInt(page) - 1) * parseInt(limit);

		// 정렬 기준
		const orderBy = [];
		if (isPinned !== undefined && isPinned !== null && isPinned !== '') {
			// 고정 히스토리 우선 정렬
			orderBy.push(['isPinned', 'DESC']);
		}
		orderBy.push([sortBy, sortOrder.toUpperCase()]);

		const { count, rows } = await history.findAndCountAll({
			where: whereCondition,
			order: orderBy,
			limit: parseInt(limit),
			offset: offset,
		});

		// TINYINT(1) 필드 boolean 변환 + Date 필드는 로컬(KST) 문자열로 변환 (UTC 직렬화 방지) + content 콜론 앞쪽 기준 STATUS_MAP 색상 부여
		const convertHistoryItem = (item) => {
			const converted = item.toJSON ? item.toJSON() : { ...item };
			if (converted.publicRange !== undefined && converted.publicRange !== null) {
				converted.publicRange = converted.publicRange === 1 || converted.publicRange === true || converted.publicRange === '1';
			}
			if (converted.isPinned !== undefined && converted.isPinned !== null) {
				converted.isPinned = converted.isPinned === 1 || converted.isPinned === true || converted.isPinned === '1';
			}
			// createdAt, updatedAt: Date → 로컬 기준 YYYY-MM-DD HH:mm:ss 문자열
			if (converted.createdAt) converted.createdAt = dateToYmdHms(converted.createdAt);
			if (converted.updatedAt) converted.updatedAt = dateToYmdHms(converted.updatedAt);
			// content 첫 콜론 앞(행위 유형)에 따라 STATUS_MAP 색상 적용
			converted.color = getColorForHistoryContent(converted.content);
			return converted;
		};

		const convertedRows = rows.map(convertHistoryItem);

		res.status(200).json({
			success: true,
			data: {
				list: convertedRows,
				total: count,
				page: parseInt(page),
				limit: parseInt(limit),
				totalPages: Math.ceil(count / parseInt(limit)),
			},
		});
	} catch (error) {
		next(error);
	}
};

// 히스토리 상세 조회
exports.getHistoryDetail = async (req, res, next) => {
	try {
		verifyAdminToken(req);

		const { historyId } = req.params;

		if (!historyId) {
			errorHandler.errorThrow(400, '히스토리 ID를 입력해주세요.');
		}

		const historyData = await history.findOne({
			where: {
				esntlId: historyId,
				deleteYN: 'N',
			},
		});

		if (!historyData) {
			errorHandler.errorThrow(404, '히스토리를 찾을 수 없습니다.');
		}

		// TINYINT(1) 필드 boolean 변환 + Date 필드 로컬 문자열 변환 + content 기준 STATUS_MAP 색상
		const data = historyData.toJSON ? historyData.toJSON() : { ...historyData };
		if (data.publicRange !== undefined && data.publicRange !== null) {
			data.publicRange = data.publicRange === 1 || data.publicRange === true || data.publicRange === '1';
		}
		if (data.isPinned !== undefined && data.isPinned !== null) {
			data.isPinned = data.isPinned === 1 || data.isPinned === true || data.isPinned === '1';
		}
		if (data.createdAt) data.createdAt = dateToYmdHms(data.createdAt);
		if (data.updatedAt) data.updatedAt = dateToYmdHms(data.updatedAt);
		data.color = getColorForHistoryContent(data.content);

		res.status(200).json({
			success: true,
			data,
		});
	} catch (error) {
		next(error);
	}
};

// 히스토리 생성
exports.createHistory = async (req, res, next) => {
	const transaction = await mariaDBSequelize.transaction();
	try {
		const decodedToken = verifyAdminToken(req);

		const {
			gosiwonEsntlId,
			roomEsntlId,
			contractEsntlId,
			depositEsntlId,
			etcEsntlId,
			content,
			category,
			priority = 'NORMAL',
			publicRange = 0,
			writerCustomerId,
			writerType = 'ADMIN',
			writerName,
			tags,
			isPinned = 0,
		} = req.body;

		// 필수 필드 검증
		if (!content) {
			errorHandler.errorThrow(400, '히스토리 내용을 입력해주세요.');
		}

		// 최소 하나의 ID는 필요
		if (
			!gosiwonEsntlId &&
			!roomEsntlId &&
			!contractEsntlId &&
			!depositEsntlId &&
			!etcEsntlId
		) {
			errorHandler.errorThrow(
				400,
				'최소 하나의 ID(gosiwonEsntlId, roomEsntlId, contractEsntlId, depositEsntlId, etcEsntlId)를 입력해주세요.'
			);
		}

		// 연관 ID 규칙 검증
		validateHistoryLinkage({
			gosiwonEsntlId,
			roomEsntlId,
			contractEsntlId,
			depositEsntlId,
		});

		// 히스토리 ID 생성
		const historyId = await generateHistoryId(transaction);

		// 작성자 정보 설정
		const writerAdminId = getWriterAdminId(decodedToken);

		// 히스토리 생성
		const newHistory = await history.create(
			{
				esntlId: historyId,
				gosiwonEsntlId: gosiwonEsntlId || null,
				roomEsntlId: roomEsntlId || null,
				contractEsntlId: contractEsntlId || null,
				depositEsntlId: depositEsntlId || null,
				etcEsntlId: etcEsntlId || null,
				content: content,
				category: category || null,
				priority: priority,
				publicRange: publicRange === 1 || publicRange === '1' ? 1 : 0,
				writerAdminId: writerAdminId,
				writerCustomerId: writerCustomerId || null,
				writerType: writerType,
				writerName: writerName || null,
				tags: tags || null,
				isPinned: isPinned === 1 || isPinned === '1' ? 1 : 0,
				deleteYN: 'N',
			},
			{ transaction }
		);

		await transaction.commit();

		res.status(201).json({
			success: true,
			message: '히스토리가 생성되었습니다.',
			data: newHistory,
		});
	} catch (error) {
		await transaction.rollback();
		next(error);
	}
};

/**
 * 다른 컨트롤러에서 호출하는 히스토리 저장 함수 (API 요청 없이 레코드만 생성)
 * @param {Object} options - gosiwonEsntlId, roomEsntlId, contractEsntlId, content, category, writerAdminId, writerCustomerId 등
 * @param {Object} [transaction] - Sequelize transaction (선택)
 * @returns {Promise<Object>} 생성된 history
 */
exports.createHistoryRecord = async (options, transaction = null) => {
	const historyId = await generateHistoryId(transaction);
	const newHistory = await history.create(
		{
			esntlId: historyId,
			gosiwonEsntlId: options.gosiwonEsntlId ?? null,
			roomEsntlId: options.roomEsntlId ?? null,
			contractEsntlId: options.contractEsntlId ?? null,
			depositEsntlId: options.depositEsntlId ?? null,
			etcEsntlId: options.etcEsntlId ?? null,
			content: options.content ?? '',
			category: options.category ?? null,
			priority: options.priority ?? 'NORMAL',
			publicRange: options.publicRange === 1 || options.publicRange === '1' ? 1 : 0,
			writerAdminId: options.writerAdminId ?? null,
			writerCustomerId: options.writerCustomerId ?? null,
			writerType: options.writerType ?? 'ADMIN',
			writerName: options.writerName ?? null,
			tags: options.tags ?? null,
			isPinned: options.isPinned === 1 || options.isPinned === '1' ? 1 : 0,
			deleteYN: 'N',
		},
		transaction ? { transaction } : {}
	);
	return newHistory;
};

// 히스토리 수정
exports.updateHistory = async (req, res, next) => {
	const transaction = await mariaDBSequelize.transaction();
	try {
		verifyAdminToken(req);

		const { historyId } = req.params;
		const {
			content,
			category,
			priority,
			publicRange,
			tags,
			isPinned,
			gosiwonEsntlId,
			roomEsntlId,
			contractEsntlId,
			depositEsntlId,
			etcEsntlId,
		} = req.body;

		if (!historyId) {
			errorHandler.errorThrow(400, '히스토리 ID를 입력해주세요.');
		}

		// 히스토리 존재 확인
		const existingHistory = await history.findOne({
			where: {
				esntlId: historyId,
				deleteYN: 'N',
			},
			transaction,
		});

		if (!existingHistory) {
			errorHandler.errorThrow(404, '히스토리를 찾을 수 없습니다.');
		}

		// 업데이트할 필드 구성
		const updateData = {};
		const mergedLinkage = {
			gosiwonEsntlId:
				gosiwonEsntlId !== undefined
					? gosiwonEsntlId
					: existingHistory.gosiwonEsntlId,
			roomEsntlId:
				roomEsntlId !== undefined ? roomEsntlId : existingHistory.roomEsntlId,
			contractEsntlId:
				contractEsntlId !== undefined
					? contractEsntlId
					: existingHistory.contractEsntlId,
			depositEsntlId:
				depositEsntlId !== undefined
					? depositEsntlId
					: existingHistory.depositEsntlId,
		};

		// 연관 ID 규칙 검증
		validateHistoryLinkage(mergedLinkage);

		if (content !== undefined) {
			updateData.content = content;
		}
		if (category !== undefined) {
			updateData.category = category;
		}
		if (priority !== undefined) {
			updateData.priority = priority;
		}
		if (publicRange !== undefined) {
			updateData.publicRange =
				publicRange === 1 || publicRange === '1' ? 1 : 0;
		}
		if (tags !== undefined) {
			updateData.tags = tags;
		}
		if (isPinned !== undefined) {
			updateData.isPinned = isPinned === 1 || isPinned === '1' ? 1 : 0;
		}
		if (gosiwonEsntlId !== undefined) {
			updateData.gosiwonEsntlId = gosiwonEsntlId || null;
		}
		if (roomEsntlId !== undefined) {
			updateData.roomEsntlId = roomEsntlId || null;
		}
		if (contractEsntlId !== undefined) {
			updateData.contractEsntlId = contractEsntlId || null;
		}
		if (depositEsntlId !== undefined) {
			updateData.depositEsntlId = depositEsntlId || null;
		}
		if (etcEsntlId !== undefined) {
			updateData.etcEsntlId = etcEsntlId || null;
		}

		// 히스토리 업데이트
		await history.update(updateData, {
			where: {
				esntlId: historyId,
			},
			transaction,
		});

		// 업데이트된 히스토리 조회
		const updatedHistory = await history.findOne({
			where: {
				esntlId: historyId,
			},
			transaction,
		});

		await transaction.commit();

		res.status(200).json({
			success: true,
			message: '히스토리가 수정되었습니다.',
			data: updatedHistory,
		});
	} catch (error) {
		await transaction.rollback();
		next(error);
	}
};

// 히스토리 삭제 (소프트 삭제)
exports.deleteHistory = async (req, res, next) => {
	const transaction = await mariaDBSequelize.transaction();
	try {
		const decodedToken = verifyAdminToken(req);
		const writerAdminId = getWriterAdminId(decodedToken);

		const { historyId } = req.params;

		if (!historyId) {
			errorHandler.errorThrow(400, '히스토리 ID를 입력해주세요.');
		}

		// 히스토리 존재 확인
		const existingHistory = await history.findOne({
			where: {
				esntlId: historyId,
				deleteYN: 'N',
			},
			transaction,
		});

		if (!existingHistory) {
			errorHandler.errorThrow(404, '히스토리를 찾을 수 없습니다.');
		}

		// 소프트 삭제
		await history.update(
			{
				deleteYN: 'Y',
				deletedBy: writerAdminId,
				deletedAt: mariaDBSequelize.literal('NOW()'),
			},
			{
				where: {
					esntlId: historyId,
				},
				transaction,
			}
		);

		await transaction.commit();

		res.status(200).json({
			success: true,
			message: '히스토리가 삭제되었습니다.',
		});
	} catch (error) {
		await transaction.rollback();
		next(error);
	}
};
