const { Op } = require('sequelize');
const { parkStatus, mariaDBSequelize } = require('../models');
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

const PARKSTATUS_PREFIX = 'PKST';
const PARKSTATUS_PADDING = 10;

// 주차 상태 ID 생성 함수
const generateParkStatusId = async (transaction) => {
	const latest = await parkStatus.findOne({
		attributes: ['esntlId'],
		order: [['esntlId', 'DESC']],
		transaction,
		lock: transaction ? transaction.LOCK.UPDATE : undefined,
	});

	if (!latest || !latest.esntlId) {
		return `${PARKSTATUS_PREFIX}${String(1).padStart(PARKSTATUS_PADDING, '0')}`;
	}

	const numberPart = parseInt(
		latest.esntlId.replace(PARKSTATUS_PREFIX, ''),
		10
	);
	const nextNumber = Number.isNaN(numberPart) ? 1 : numberPart + 1;
	return `${PARKSTATUS_PREFIX}${String(nextNumber).padStart(
		PARKSTATUS_PADDING,
		'0'
	)}`;
};

// 주차 상태 목록 조회
exports.getParkStatusList = async (req, res, next) => {
	try {
		verifyAdminToken(req);

		const {
			gosiwonEsntlId,
			contractEsntlId,
			customerEsntlId,
			status,
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
		if (contractEsntlId) {
			whereCondition.contractEsntlId = contractEsntlId;
		}
		if (customerEsntlId) {
			whereCondition.customerEsntlId = customerEsntlId;
		}

		// 상태 필터
		if (status) {
			whereCondition.status = status;
		}

		// 삭제 여부 필터
		if (hideDeleted === 'true' || hideDeleted === true) {
			whereCondition.deleteYN = 'N';
		}

		const offset = (parseInt(page) - 1) * parseInt(limit);

		// 정렬 기준
		const orderBy = [[sortBy, sortOrder.toUpperCase()]];

		const { count, rows } = await parkStatus.findAndCountAll({
			where: whereCondition,
			order: orderBy,
			limit: parseInt(limit),
			offset: offset,
		});

		res.status(200).json({
			success: true,
			data: {
				list: rows,
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

// 주차 상태 상세 조회
exports.getParkStatusDetail = async (req, res, next) => {
	try {
		verifyAdminToken(req);

		const { parkStatusId } = req.params;

		if (!parkStatusId) {
			errorHandler.errorThrow(400, '주차 상태 ID를 입력해주세요.');
		}

		const parkStatusData = await parkStatus.findOne({
			where: {
				esntlId: parkStatusId,
				deleteYN: 'N',
			},
		});

		if (!parkStatusData) {
			errorHandler.errorThrow(404, '주차 상태를 찾을 수 없습니다.');
		}

		res.status(200).json({
			success: true,
			data: parkStatusData,
		});
	} catch (error) {
		next(error);
	}
};

// 주차 상태 생성
exports.createParkStatus = async (req, res, next) => {
	const transaction = await mariaDBSequelize.transaction();
	try {
		verifyAdminToken(req);

		const {
			gosiwonEsntlId,
			contractEsntlId,
			customerEsntlId,
			status = 'AVAILABLE',
			useStartDate,
			useEndDate,
		} = req.body;

		// 필수 필드 검증
		if (!gosiwonEsntlId) {
			errorHandler.errorThrow(400, 'gosiwonEsntlId를 입력해주세요.');
		}

		// 주차 상태 ID 생성
		const parkStatusId = await generateParkStatusId(transaction);

		// 주차 상태 생성
		const newParkStatus = await parkStatus.create(
			{
				esntlId: parkStatusId,
				gosiwonEsntlId: gosiwonEsntlId,
				contractEsntlId: contractEsntlId || null,
				customerEsntlId: customerEsntlId || null,
				status: status,
				useStartDate: useStartDate || null,
				useEndDate: useEndDate || null,
				deleteYN: 'N',
			},
			{ transaction }
		);

		await transaction.commit();

		res.status(201).json({
			success: true,
			message: '주차 상태가 생성되었습니다.',
			data: newParkStatus,
		});
	} catch (error) {
		await transaction.rollback();
		next(error);
	}
};

// 주차 상태 수정
exports.updateParkStatus = async (req, res, next) => {
	const transaction = await mariaDBSequelize.transaction();
	try {
		verifyAdminToken(req);

		const { parkStatusId } = req.params;
		const {
			gosiwonEsntlId,
			contractEsntlId,
			customerEsntlId,
			status,
			useStartDate,
			useEndDate,
		} = req.body;

		if (!parkStatusId) {
			errorHandler.errorThrow(400, '주차 상태 ID를 입력해주세요.');
		}

		// 주차 상태 존재 확인
		const existingParkStatus = await parkStatus.findOne({
			where: {
				esntlId: parkStatusId,
				deleteYN: 'N',
			},
			transaction,
		});

		if (!existingParkStatus) {
			errorHandler.errorThrow(404, '주차 상태를 찾을 수 없습니다.');
		}

		// 업데이트할 필드 구성
		const updateData = {};

		if (gosiwonEsntlId !== undefined) {
			updateData.gosiwonEsntlId = gosiwonEsntlId;
		}
		if (contractEsntlId !== undefined) {
			updateData.contractEsntlId = contractEsntlId || null;
		}
		if (customerEsntlId !== undefined) {
			updateData.customerEsntlId = customerEsntlId || null;
		}
		if (status !== undefined) {
			updateData.status = status;
		}
		if (useStartDate !== undefined) {
			updateData.useStartDate = useStartDate || null;
		}
		if (useEndDate !== undefined) {
			updateData.useEndDate = useEndDate || null;
		}

		// 주차 상태 업데이트
		await parkStatus.update(updateData, {
			where: {
				esntlId: parkStatusId,
			},
			transaction,
		});

		// 업데이트된 주차 상태 조회
		const updatedParkStatus = await parkStatus.findOne({
			where: {
				esntlId: parkStatusId,
			},
			transaction,
		});

		await transaction.commit();

		res.status(200).json({
			success: true,
			message: '주차 상태가 수정되었습니다.',
			data: updatedParkStatus,
		});
	} catch (error) {
		await transaction.rollback();
		next(error);
	}
};

// 주차 상태 삭제 (소프트 삭제)
exports.deleteParkStatus = async (req, res, next) => {
	const transaction = await mariaDBSequelize.transaction();
	try {
		verifyAdminToken(req);

		const { parkStatusId } = req.params;

		if (!parkStatusId) {
			errorHandler.errorThrow(400, '주차 상태 ID를 입력해주세요.');
		}

		// 주차 상태 존재 확인
		const existingParkStatus = await parkStatus.findOne({
			where: {
				esntlId: parkStatusId,
				deleteYN: 'N',
			},
			transaction,
		});

		if (!existingParkStatus) {
			errorHandler.errorThrow(404, '주차 상태를 찾을 수 없습니다.');
		}

		// 소프트 삭제
		await parkStatus.update(
			{
				deleteYN: 'Y',
			},
			{
				where: {
					esntlId: parkStatusId,
				},
				transaction,
			}
		);

		await transaction.commit();

		res.status(200).json({
			success: true,
			message: '주차 상태가 삭제되었습니다.',
		});
	} catch (error) {
		await transaction.rollback();
		next(error);
	}
};
