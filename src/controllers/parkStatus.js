const { Op } = require('sequelize');
const { parkStatus, history, mariaDBSequelize } = require('../models');
const jwt = require('jsonwebtoken');
const errorHandler = require('../middleware/error');
const { getWriterAdminId } = require('../utils/auth');
const { next: idsNext } = require('../utils/idsNext');

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
		const decodedToken = verifyAdminToken(req);
		const writerAdminId = getWriterAdminId(decodedToken);

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

		// contractEsntlId 유효성 검증 (빈 문자열이거나 유효하지 않으면 null)
		let validContractEsntlId = null;
		if (contractEsntlId && contractEsntlId.trim() !== '') {
			// roomContract 테이블에 존재하는지 확인
			try {
				const contractExists = await mariaDBSequelize.query(
					'SELECT esntlId FROM roomContract WHERE esntlId = ? LIMIT 1',
					{
						replacements: [contractEsntlId],
						type: mariaDBSequelize.QueryTypes.SELECT,
						transaction,
					}
				);
				if (contractExists && contractExists.length > 0) {
					validContractEsntlId = contractEsntlId;
				} else {
					// 존재하지 않으면 null로 설정 (외래키 제약조건 오류 방지)
					validContractEsntlId = null;
				}
			} catch (err) {
				// 쿼리 오류 시 null로 설정
				validContractEsntlId = null;
			}
		}

		// 주차 상태 ID 생성 (IDS 테이블 parkStatus PKST)
		const parkStatusId = await idsNext('parkStatus', undefined, transaction);

		// 주차 상태 생성
		const newParkStatus = await parkStatus.create(
			{
				esntlId: parkStatusId,
				gosiwonEsntlId: gosiwonEsntlId,
				contractEsntlId: validContractEsntlId,
				customerEsntlId: customerEsntlId || null,
				status: status,
				useStartDate: useStartDate || null,
				useEndDate: useEndDate || null,
				deleteYN: 'N',
			},
			{ transaction }
		);

		// 히스토리 생성
		const historyId = await generateHistoryId(transaction);
		const statusText = {
			AVAILABLE: '사용가능',
			IN_USE: '사용중',
			RESERVED: '예약됨',
			EXPIRED: '만료됨',
		}[status] || status;
		
		const dateRange = useStartDate && useEndDate 
			? `${useStartDate} ~ ${useEndDate}`
			: useStartDate 
			? `${useStartDate}부터`
			: useEndDate
			? `${useEndDate}까지`
			: '';

		const historyContent = `주차 상태가 생성되었습니다. 상태: ${statusText}${dateRange ? `, 사용기간: ${dateRange}` : ''}`;

		// 히스토리 생성
		try {
			await history.create(
				{
					esntlId: historyId,
					gosiwonEsntlId: gosiwonEsntlId,
					contractEsntlId: validContractEsntlId,
					etcEsntlId: parkStatusId,
					content: historyContent,
					category: 'PARK_STATUS',
					priority: 'NORMAL',
					publicRange: 0,
					writerAdminId: writerAdminId,
					writerType: 'ADMIN',
					deleteYN: 'N',
				},
				{ transaction }
			);
		} catch (historyError) {
			console.error('히스토리 생성 실패:', historyError);
			// 히스토리 생성 실패해도 주차 상태는 저장되도록 함
		}

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
		const decodedToken = verifyAdminToken(req);
		const writerAdminId = getWriterAdminId(decodedToken);

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
		const changes = [];

		if (gosiwonEsntlId !== undefined && gosiwonEsntlId !== existingParkStatus.gosiwonEsntlId) {
			updateData.gosiwonEsntlId = gosiwonEsntlId;
			changes.push(`고시원: ${existingParkStatus.gosiwonEsntlId} → ${gosiwonEsntlId}`);
		}
		if (contractEsntlId !== undefined) {
			// contractEsntlId 유효성 검증
			let validContractEsntlId = null;
			if (contractEsntlId && contractEsntlId.trim() !== '') {
				try {
					const contractExists = await mariaDBSequelize.query(
						'SELECT esntlId FROM roomContract WHERE esntlId = ? LIMIT 1',
						{
							replacements: [contractEsntlId],
							type: mariaDBSequelize.QueryTypes.SELECT,
							transaction,
						}
					);
					if (contractExists && contractExists.length > 0) {
						validContractEsntlId = contractEsntlId;
					}
				} catch (err) {
					// 쿼리 오류 시 null로 설정
					validContractEsntlId = null;
				}
			}
			
			if (validContractEsntlId !== existingParkStatus.contractEsntlId) {
				updateData.contractEsntlId = validContractEsntlId;
				changes.push(`계약: ${existingParkStatus.contractEsntlId || '없음'} → ${validContractEsntlId || '없음'}`);
			}
		}
		if (customerEsntlId !== undefined && customerEsntlId !== existingParkStatus.customerEsntlId) {
			updateData.customerEsntlId = customerEsntlId || null;
			changes.push(`고객: ${existingParkStatus.customerEsntlId || '없음'} → ${customerEsntlId || '없음'}`);
		}
		if (status !== undefined && status !== existingParkStatus.status) {
			updateData.status = status;
			const statusText = {
				AVAILABLE: '사용가능',
				IN_USE: '사용중',
				RESERVED: '예약됨',
				EXPIRED: '만료됨',
			};
			const oldStatusText = statusText[existingParkStatus.status] || existingParkStatus.status;
			const newStatusText = statusText[status] || status;
			changes.push(`상태: ${oldStatusText} → ${newStatusText}`);
		}
		if (useStartDate !== undefined && useStartDate !== existingParkStatus.useStartDate) {
			updateData.useStartDate = useStartDate || null;
			changes.push(`시작일: ${existingParkStatus.useStartDate || '없음'} → ${useStartDate || '없음'}`);
		}
		if (useEndDate !== undefined && useEndDate !== existingParkStatus.useEndDate) {
			updateData.useEndDate = useEndDate || null;
			changes.push(`종료일: ${existingParkStatus.useEndDate || '없음'} → ${useEndDate || '없음'}`);
		}

		// 변경사항이 있는 경우에만 업데이트 및 히스토리 생성
		if (Object.keys(updateData).length > 0) {
			// 주차 상태 업데이트
			await parkStatus.update(updateData, {
				where: {
					esntlId: parkStatusId,
				},
				transaction,
			});

			// 히스토리 생성
			try {
				const historyId = await generateHistoryId(transaction);
				const historyContent = `주차 상태가 수정되었습니다. 변경사항: ${changes.join(', ')}`;

				// 업데이트된 contractEsntlId 사용 (없으면 기존 값)
				const finalContractEsntlId = updateData.contractEsntlId !== undefined 
					? updateData.contractEsntlId 
					: existingParkStatus.contractEsntlId;

				await history.create(
					{
						esntlId: historyId,
						gosiwonEsntlId: updateData.gosiwonEsntlId || existingParkStatus.gosiwonEsntlId,
						contractEsntlId: finalContractEsntlId,
						etcEsntlId: parkStatusId,
						content: historyContent,
						category: 'PARK_STATUS',
						priority: 'NORMAL',
						publicRange: 0,
						writerAdminId: writerAdminId,
						writerType: 'ADMIN',
						deleteYN: 'N',
					},
					{ transaction }
				);
			} catch (historyError) {
				console.error('히스토리 생성 실패:', historyError);
				// 히스토리 생성 실패해도 주차 상태 수정은 완료되도록 함
			}
		}

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
		const decodedToken = verifyAdminToken(req);
		const writerAdminId = getWriterAdminId(decodedToken);

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
				deletedBy: writerAdminId,
				deletedAt: mariaDBSequelize.literal('NOW()'),
			},
			{
				where: {
					esntlId: parkStatusId,
				},
				transaction,
			}
		);

		// 히스토리 생성
		const historyId = await generateHistoryId(transaction);
		const statusText = {
			AVAILABLE: '사용가능',
			IN_USE: '사용중',
			RESERVED: '예약됨',
			EXPIRED: '만료됨',
		}[existingParkStatus.status] || existingParkStatus.status;

		const historyContent = `주차 상태가 삭제되었습니다. (상태: ${statusText})`;

		// 히스토리 생성
		try {
			await history.create(
				{
					esntlId: historyId,
					gosiwonEsntlId: existingParkStatus.gosiwonEsntlId,
					contractEsntlId: existingParkStatus.contractEsntlId || null,
					etcEsntlId: parkStatusId,
					content: historyContent,
					category: 'PARK_STATUS',
					priority: 'NORMAL',
					publicRange: 0,
					writerAdminId: writerAdminId,
					writerType: 'ADMIN',
					deleteYN: 'N',
				},
				{ transaction }
			);
		} catch (historyError) {
			console.error('히스토리 생성 실패:', historyError);
			// 히스토리 생성 실패해도 주차 상태 삭제는 완료되도록 함
		}

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
