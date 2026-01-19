const { Op } = require('sequelize');
const { history, mariaDBSequelize } = require('../models');
const jwt = require('jsonwebtoken');
const errorHandler = require('../middleware/error');
const { getWriterAdminId } = require('../utils/auth');

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

const HISTORY_PREFIX = 'HISTORY';
const HISTORY_PADDING = 10;

// 히스토리 ID 생성 함수
const generateHistoryId = async (transaction) => {
	const latest = await history.findOne({
		attributes: ['esntlId'],
		order: [['esntlId', 'DESC']],
		transaction,
		lock: transaction ? transaction.LOCK.UPDATE : undefined,
	});

	if (!latest || !latest.esntlId) {
		return `${HISTORY_PREFIX}${String(1).padStart(HISTORY_PADDING, '0')}`;
	}

	const numberPart = parseInt(
		latest.esntlId.replace(HISTORY_PREFIX, ''),
		10
	);
	const nextNumber = Number.isNaN(numberPart) ? 1 : numberPart + 1;
	return `${HISTORY_PREFIX}${String(nextNumber).padStart(
		HISTORY_PADDING,
		'0'
	)}`;
};

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

		// TINYINT(1) 필드를 boolean으로 변환
		const convertHistoryBoolean = (item) => {
			if (item.publicRange !== undefined && item.publicRange !== null) {
				item.publicRange = item.publicRange === 1 || item.publicRange === true || item.publicRange === '1';
			}
			if (item.isPinned !== undefined && item.isPinned !== null) {
				item.isPinned = item.isPinned === 1 || item.isPinned === true || item.isPinned === '1';
			}
			return item;
		};

		const convertedRows = rows.map(convertHistoryBoolean);

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

		// TINYINT(1) 필드를 boolean으로 변환
		if (historyData.publicRange !== undefined && historyData.publicRange !== null) {
			historyData.publicRange = historyData.publicRange === 1 || historyData.publicRange === true || historyData.publicRange === '1';
		}
		if (historyData.isPinned !== undefined && historyData.isPinned !== null) {
			historyData.isPinned = historyData.isPinned === 1 || historyData.isPinned === true || historyData.isPinned === '1';
		}

		res.status(200).json({
			success: true,
			data: historyData,
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
				deletedAt: new Date(),
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
