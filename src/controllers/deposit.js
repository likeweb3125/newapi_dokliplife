const { Op } = require('sequelize');
const {
	ilRoomDeposit,
	ilRoomDepositHistory,
	depositDeduction,
	depositRefund,
	room,
	gosiwon,
	customer,
	mariaDBSequelize,
} = require('../models');
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

const DEPOSITDEDUCTION_PREFIX = 'DEDU';
const DEPOSITDEDUCTION_PADDING = 10;
const DEPOSITREFUND_PREFIX = 'DERF';
const DEPOSITREFUND_PADDING = 10;

// ID 생성: IDS 테이블 사용 (il_room_deposit prefix RDP, il_room_deposit_history prefix RDPH)
const generateIlRoomDepositId = (transaction) =>
	idsNext('il_room_deposit', 'RDP', transaction);
const generateIlRoomDepositHistoryId = (transaction) =>
	idsNext('il_room_deposit_history', 'RDPH', transaction);

/**
 * 계약서(방) 보증금 대비 납입 합계로 입금 상태 판단
 * - PENDING: 입금대기, PARTIAL: 부분입금, COMPLETED: 입금완료, RETURN_COMPLETED: 반환완료, DELETED: 삭제됨
 * @param {string} roomEsntlId - 방 고유아이디
 * @param {string|null} contractEsntlId - 계약서 고유아이디 (있으면 계약서 기준 합산)
 * @param {number} newAmount - 이번에 등록할 금액
 * @param {object} [transaction] - Sequelize 트랜잭션
 * @returns {Promise<{ depositStatus: 'PARTIAL'|'COMPLETED', contractDepositAmount: number, totalPaidAfter: number, unpaidAmount: number }>}
 */
const resolveDepositHistoryStatus = async (roomEsntlId, contractEsntlId, newAmount, transaction) => {
	const roomInfo = await room.findOne({
		where: { esntlId: roomEsntlId },
		attributes: ['deposit'],
		transaction,
	});
	const contractDepositAmount = Number(roomInfo?.deposit) || 0;

	const whereHistory = {
		type: 'DEPOSIT',
		status: { [Op.in]: ['COMPLETED', 'PARTIAL'] },
	};
	if (contractEsntlId) {
		whereHistory.contractEsntlId = contractEsntlId;
	} else {
		whereHistory.roomEsntlId = roomEsntlId;
	}

	const existingSum =
		(await ilRoomDepositHistory.sum('amount', { where: whereHistory, transaction })) || 0;
	const totalPaidAfter = existingSum + Number(newAmount) || 0;

	const depositStatus =
		contractDepositAmount <= 0 || totalPaidAfter >= contractDepositAmount
			? 'COMPLETED'
			: 'PARTIAL';

	// 미납액 = 계약 보증금 - 그동안 입금 합계(이번 포함), 0 미만이면 0
	const unpaidAmount = Math.max(0, contractDepositAmount - totalPaidAfter);

	return { depositStatus, contractDepositAmount, totalPaidAfter, unpaidAmount };
};

const generateDepositDeductionId = async (transaction) => {
	const latest = await depositDeduction.findOne({
		attributes: ['esntlId'],
		order: [['esntlId', 'DESC']],
		transaction,
		lock: transaction ? transaction.LOCK.UPDATE : undefined,
	});

	if (!latest || !latest.esntlId) {
		return `${DEPOSITDEDUCTION_PREFIX}${String(1).padStart(
			DEPOSITDEDUCTION_PADDING,
			'0'
		)}`;
	}

	const numberPart = parseInt(
		latest.esntlId.replace(DEPOSITDEDUCTION_PREFIX, ''),
		10
	);
	const nextNumber = Number.isNaN(numberPart) ? 1 : numberPart + 1;
	return `${DEPOSITDEDUCTION_PREFIX}${String(nextNumber).padStart(
		DEPOSITDEDUCTION_PADDING,
		'0'
	)}`;
};

const generateDepositRefundId = async (transaction) => {
	const latest = await depositRefund.findOne({
		attributes: ['esntlId'],
		order: [['esntlId', 'DESC']],
		transaction,
		lock: transaction ? transaction.LOCK.UPDATE : undefined,
	});

	if (!latest || !latest.esntlId) {
		return `${DEPOSITREFUND_PREFIX}${String(1).padStart(
			DEPOSITREFUND_PADDING,
			'0'
		)}`;
	}

	const numberPart = parseInt(
		latest.esntlId.replace(DEPOSITREFUND_PREFIX, ''),
		10
	);
	const nextNumber = Number.isNaN(numberPart) ? 1 : numberPart + 1;
	return `${DEPOSITREFUND_PREFIX}${String(nextNumber).padStart(
		DEPOSITREFUND_PADDING,
		'0'
	)}`;
};

// 보증금 상세 정보 조회
exports.getDepositInfo = async (req, res, next) => {
	try {
		verifyAdminToken(req);

		const { esntlId } = req.query;

		if (!esntlId) {
			errorHandler.errorThrow(400, 'esntlId를 입력해주세요.');
		}

		// ilRoomDeposit에는 customer/contractor association 없음 (rdp_customer_name, rdp_customer_phone만 있음)
		const depositInfo = await ilRoomDeposit.findOne({
			where: {
				esntlId: esntlId,
			},
			include: [
				{
					model: room,
					as: 'room',
					attributes: ['esntlId', 'roomNumber', 'roomType', 'status'],
					required: false,
				},
				{
					model: gosiwon,
					as: 'gosiwon',
					attributes: ['esntlId', 'name'],
					required: false,
				},
			],
		});

		if (!depositInfo) {
			errorHandler.errorThrow(404, '보증금 정보를 찾을 수 없습니다.');
		}

		// 입금/반환 이력 조회 (il_room_deposit_history)
		const histories = await ilRoomDepositHistory.findAll({
			where: {
				depositEsntlId: esntlId,
			},
			order: [['createdAt', 'DESC']],
		});

		const depositData = depositInfo.toJSON();
		depositData.histories = histories;

		// 총 입금액 계산 (il_room_deposit_history) - 입금완료/부분입금만 합산
		const totalDepositAmount = await ilRoomDepositHistory.sum('amount', {
			where: {
				depositEsntlId: esntlId,
				type: 'DEPOSIT',
				status: { [Op.in]: ['COMPLETED', 'PARTIAL'] },
			},
		});

		depositData.totalDepositAmount = totalDepositAmount || 0;
		depositData.unpaidAmount = Math.max(
			0,
			(depositInfo.amount || 0) - (totalDepositAmount || 0)
		);

		return errorHandler.successThrow(res, '보증금 정보 조회 성공', depositData);
	} catch (error) {
		next(error);
	}
};

// il_room_deposit 메모 조회 (Read)
exports.getDepositMemo = async (req, res, next) => {
	try {
		verifyAdminToken(req);
		const { depositEsntlId } = req.query;
		if (!depositEsntlId) {
			errorHandler.errorThrow(400, 'depositEsntlId를 입력해주세요.');
		}
		const row = await ilRoomDeposit.findOne({
			where: { esntlId: depositEsntlId, deleteDtm: null },
			attributes: ['esntlId', 'memo'],
		});
		if (!row) {
			errorHandler.errorThrow(404, '보증금 정보를 찾을 수 없습니다.');
		}
		return errorHandler.successThrow(res, '보증금 메모 조회 성공', {
			depositEsntlId: row.esntlId,
			memo: row.memo ?? null,
		});
	} catch (error) {
		next(error);
	}
};

// il_room_deposit 메모 등록 (Create)
exports.createDepositMemo = async (req, res, next) => {
	const transaction = await mariaDBSequelize.transaction();
	try {
		const decodedToken = verifyAdminToken(req);
		const { depositEsntlId, memo } = req.body;
		if (!depositEsntlId) {
			errorHandler.errorThrow(400, 'depositEsntlId는 필수입니다.');
		}
		const deposit = await ilRoomDeposit.findOne({
			where: { esntlId: depositEsntlId, deleteDtm: null },
			transaction,
		});
		if (!deposit) {
			errorHandler.errorThrow(404, '보증금 정보를 찾을 수 없습니다.');
		}
		const memoVal = memo != null ? String(memo).trim() || null : null;
		await ilRoomDeposit.update(
			{
				memo: memoVal,
				updateDtm: mariaDBSequelize.literal('CURRENT_TIMESTAMP'),
				updaterId: getWriterAdminId(decodedToken),
			},
			{ where: { esntlId: depositEsntlId }, transaction }
		);
		await transaction.commit();
		return errorHandler.successThrow(res, '보증금 메모 등록 성공', {
			depositEsntlId,
			memo: memoVal,
		});
	} catch (error) {
		await transaction.rollback();
		next(error);
	}
};

// il_room_deposit 메모 수정 (Update)
exports.updateDepositMemo = async (req, res, next) => {
	const transaction = await mariaDBSequelize.transaction();
	try {
		const decodedToken = verifyAdminToken(req);
		const { depositEsntlId, memo } = req.body;
		if (!depositEsntlId) {
			errorHandler.errorThrow(400, 'depositEsntlId는 필수입니다.');
		}
		const deposit = await ilRoomDeposit.findOne({
			where: { esntlId: depositEsntlId, deleteDtm: null },
			transaction,
		});
		if (!deposit) {
			errorHandler.errorThrow(404, '보증금 정보를 찾을 수 없습니다.');
		}
		const memoVal = memo != null ? String(memo).trim() || null : null;
		await ilRoomDeposit.update(
			{
				memo: memoVal,
				updateDtm: mariaDBSequelize.literal('CURRENT_TIMESTAMP'),
				updaterId: getWriterAdminId(decodedToken),
			},
			{ where: { esntlId: depositEsntlId }, transaction }
		);
		await transaction.commit();
		return errorHandler.successThrow(res, '보증금 메모 수정 성공', {
			depositEsntlId,
			memo: memoVal,
		});
	} catch (error) {
		await transaction.rollback();
		next(error);
	}
};

// il_room_deposit 메모 삭제 (Delete - 메모 내용만 비움)
exports.deleteDepositMemo = async (req, res, next) => {
	const transaction = await mariaDBSequelize.transaction();
	try {
		const decodedToken = verifyAdminToken(req);
		const { depositEsntlId } = req.query;
		if (!depositEsntlId) {
			errorHandler.errorThrow(400, 'depositEsntlId를 입력해주세요.');
		}
		const deposit = await ilRoomDeposit.findOne({
			where: { esntlId: depositEsntlId, deleteDtm: null },
			transaction,
		});
		if (!deposit) {
			errorHandler.errorThrow(404, '보증금 정보를 찾을 수 없습니다.');
		}
		await ilRoomDeposit.update(
			{
				memo: null,
				updateDtm: mariaDBSequelize.literal('CURRENT_TIMESTAMP'),
				updaterId: getWriterAdminId(decodedToken),
			},
			{ where: { esntlId: depositEsntlId }, transaction }
		);
		await transaction.commit();
		return errorHandler.successThrow(res, '보증금 메모 삭제 성공', { depositEsntlId });
	} catch (error) {
		await transaction.rollback();
		next(error);
	}
};

// 보증금 추가 입금 등록 (depositCreate) - il_room_deposit 생성 없음, il_room_deposit_history만 INSERT. reservationRegist로 최초 등록된 보증금에 추가 입금 시 사용. 합계가 목표 금액 도달 시 rdp_completed_dtm 업데이트
exports.createDeposit = async (req, res, next) => {
	const transaction = await mariaDBSequelize.transaction();
	try {
		const decodedToken = verifyAdminToken(req);
		const registrantId = decodedToken.admin || decodedToken.partner;

		const {
			depositEsntlId,
			roomEsntlId,
			gosiwonEsntlId,
			contractEsntlId,
			amount,
			reservationDepositAmount,
			depositAmount,
			depositDate,
			depositorName,
			depositorPhone,
		} = req.body;

		const paidAmount = amount ?? depositAmount ?? reservationDepositAmount ?? 0;
		const finalAmount = parseInt(paidAmount, 10) || 0;
		if (finalAmount <= 0) {
			errorHandler.errorThrow(400, 'amount는 0보다 큰 값이어야 합니다.');
		}

		// 기존 il_room_deposit 조회 (depositEsntlId = rdp_eid). 없으면 404 (reservationRegist로 최초 등록된 건만 추가 입금 가능)
		const depositEsntlIdVal = depositEsntlId || null;
		if (!depositEsntlIdVal) {
			errorHandler.errorThrow(400, 'depositEsntlId(il_room_deposit.rdp_eid)는 필수입니다.');
		}

		const existingDeposit = await ilRoomDeposit.findOne({
			where: { esntlId: depositEsntlIdVal, deleteDtm: null },
			transaction,
		});
		if (!existingDeposit) {
			errorHandler.errorThrow(404, '보증금 정보를 찾을 수 없습니다. reservationRegist로 최초 등록 후 추가 입금해 주세요.');
		}

		const targetAmount = Number(existingDeposit.amount) || 0;
		const existingSum =
			(await ilRoomDepositHistory.sum('amount', {
				where: {
					depositEsntlId: depositEsntlIdVal,
					type: 'DEPOSIT',
					status: { [Op.in]: ['COMPLETED', 'PARTIAL'] },
				},
				transaction,
			})) || 0;
		const totalPaidAfter = existingSum + finalAmount;
		const depositStatus =
			targetAmount <= 0 || totalPaidAfter >= targetAmount ? 'COMPLETED' : 'PARTIAL';
		const unpaidAmount = Math.max(0, targetAmount - totalPaidAfter);

		// il_room_deposit_history에만 INSERT (예전 방식대로 이력 쌓기)
		const historyId = await generateIlRoomDepositHistoryId(transaction);
		await ilRoomDepositHistory.create(
			{
				esntlId: historyId,
				depositEsntlId: depositEsntlIdVal,
				roomEsntlId: existingDeposit.roomEsntlId,
				contractEsntlId: contractEsntlId || null,
				type: 'DEPOSIT',
				amount: finalAmount,
				status: depositStatus,
				unpaidAmount,
				depositorName: (depositorName != null && String(depositorName).trim()) ? String(depositorName).trim() : null,
				depositDate: depositDate || null,
				manager: decodedToken.admin?.name || '관리자',
			},
			{ transaction }
		);

		// 입금 합계가 보증금 목표 금액에 도달하면 il_room_deposit.rdp_completed_dtm 업데이트
		if (totalPaidAfter >= targetAmount && targetAmount > 0) {
			await ilRoomDeposit.update(
				{
					completedDtm: mariaDBSequelize.literal('CURRENT_TIMESTAMP'),
					updateDtm: mariaDBSequelize.literal('CURRENT_TIMESTAMP'),
					updaterId: registrantId,
				},
				{
					where: { esntlId: depositEsntlIdVal },
					transaction,
				}
			);
		}

		await transaction.commit();

		return errorHandler.successThrow(res, '보증금 등록 성공', {
			depositEsntlId: depositEsntlIdVal,
			historyId,
			amount: finalAmount,
			status: depositStatus,
			unpaidAmount,
		});
	} catch (error) {
		await transaction.rollback();
		next(error);
	}
};

// 보증금 수정
exports.updateDeposit = async (req, res, next) => {
	const transaction = await mariaDBSequelize.transaction();
	try {
		const decodedToken = verifyAdminToken(req);

		const {
			esntlId,
			customerEsntlId,
			contractorEsntlId,
			contractEsntlId,
			type,
			amount,
			reservationDepositAmount, // 하위 호환성
			depositAmount, // 하위 호환성
			accountBank,
			accountNumber,
			accountHolder,
			expectedOccupantName, // 입실예정자명 (type이 RESERVATION일 때)
			expectedOccupantPhone, // 입실예정자연락처 (type이 RESERVATION일 때)
			moveInDate,
			moveOutDate,
			contractStatus,
			virtualAccountNumber,
			virtualAccountExpiryDate,
		} = req.body;

		if (!esntlId) {
			errorHandler.errorThrow(400, 'esntlId를 입력해주세요.');
		}

		const depositInfo = await ilRoomDeposit.findOne({
			where: { esntlId: esntlId },
			transaction,
		});

		if (!depositInfo) {
			errorHandler.errorThrow(404, '보증금 정보를 찾을 수 없습니다.');
		}

		const updateData = {};
		const changes = []; // 변경된 항목 추적

		if (customerEsntlId !== undefined && customerEsntlId !== depositInfo.customerEsntlId) {
			if (customerEsntlId) {
				const customerInfo = await customer.findOne({
					where: { esntlId: customerEsntlId },
					transaction,
				});
				if (!customerInfo) {
					errorHandler.errorThrow(404, '예약자/입실자 정보를 찾을 수 없습니다.');
				}
				updateData.customerEsntlId = customerEsntlId;
				changes.push(`예약자/입실자: ${depositInfo.customerEsntlId || '없음'} → ${customerEsntlId}`);
			} else {
				updateData.customerEsntlId = null;
				changes.push(`예약자/입실자: ${depositInfo.customerEsntlId || '없음'} → 없음`);
			}
		}
		if (contractorEsntlId !== undefined && contractorEsntlId !== depositInfo.contractorEsntlId) {
			if (contractorEsntlId) {
				const contractorInfo = await customer.findOne({
					where: { esntlId: contractorEsntlId },
					transaction,
				});
				if (!contractorInfo) {
					errorHandler.errorThrow(404, '계약자 정보를 찾을 수 없습니다.');
				}
				updateData.contractorEsntlId = contractorEsntlId;
				changes.push(`계약자: ${depositInfo.contractorEsntlId || '없음'} → ${contractorEsntlId}`);
			} else {
				updateData.contractorEsntlId = null;
				changes.push(`계약자: ${depositInfo.contractorEsntlId || '없음'} → 없음`);
			}
		}
		if (contractEsntlId !== undefined && contractEsntlId !== depositInfo.contractEsntlId) {
			updateData.contractEsntlId = contractEsntlId;
			changes.push(`계약서ID: ${depositInfo.contractEsntlId || '없음'} → ${contractEsntlId || '없음'}`);
		}
		if (amount !== undefined && amount !== depositInfo.amount) {
			if (amount <= 0) {
				errorHandler.errorThrow(400, 'amount는 0보다 큰 값이어야 합니다.');
			}
			updateData.amount = amount;
			changes.push(`금액: ${depositInfo.amount || 0}원 → ${amount}원`);
		}
		if (depositAmount !== undefined && depositAmount !== depositInfo.amount) {
			updateData.amount = depositAmount;
			changes.push(`보증금: ${depositInfo.amount || 0}원 → ${depositAmount}원`);
		}
		if (reservationDepositAmount !== undefined && reservationDepositAmount !== depositInfo.amount) {
			updateData.amount = reservationDepositAmount;
			changes.push(`예약금: ${depositInfo.amount || 0}원 → ${reservationDepositAmount}원`);
		}
		if (accountBank !== undefined && accountBank !== depositInfo.accountBank) {
			updateData.accountBank = accountBank;
			changes.push(`은행: ${depositInfo.accountBank || '없음'} → ${accountBank || '없음'}`);
		}
		if (accountNumber !== undefined && accountNumber !== depositInfo.accountNumber) {
			updateData.accountNumber = accountNumber;
			changes.push(`계좌번호: ${depositInfo.accountNumber || '없음'} → ${accountNumber || '없음'}`);
		}
		if (accountHolder !== undefined && accountHolder !== depositInfo.accountHolder) {
			updateData.accountHolder = accountHolder;
			changes.push(`예금주: ${depositInfo.accountHolder || '없음'} → ${accountHolder || '없음'}`);
		}
		if (virtualAccountNumber !== undefined && virtualAccountNumber !== depositInfo.virtualAccountNumber) {
			updateData.virtualAccountNumber = virtualAccountNumber;
			changes.push(`가상계좌번호: ${depositInfo.virtualAccountNumber || '없음'} → ${virtualAccountNumber || '없음'}`);
		}
		if (virtualAccountExpiryDate !== undefined && virtualAccountExpiryDate !== depositInfo.virtualAccountExpiryDate) {
			updateData.virtualAccountExpiryDate = virtualAccountExpiryDate;
			changes.push(`가상계좌만료일: ${depositInfo.virtualAccountExpiryDate || '없음'} → ${virtualAccountExpiryDate || '없음'}`);
		}

		// 변경사항이 있는 경우에만 업데이트 및 이력 생성
		if (Object.keys(updateData).length > 0) {
			await ilRoomDeposit.update(updateData, {
				where: { esntlId: esntlId },
				transaction,
			});

			// 수정 이력 생성 (il_room_deposit_history)
			const historyId = await generateIlRoomDepositHistoryId(transaction);
			await ilRoomDepositHistory.create(
				{
					esntlId: historyId,
					depositEsntlId: esntlId,
					roomEsntlId: depositInfo.roomEsntlId,
					contractEsntlId: contractEsntlId !== undefined ? contractEsntlId : depositInfo.contractEsntlId,
					type: 'DEPOSIT',
					amount: 0,
					status: depositInfo.status,
					manager: decodedToken.admin?.name || '관리자',
					memo: `보증금 정보 수정: ${changes.join(', ')}`,
				},
				{ transaction }
			);
		}

		await transaction.commit();

		return errorHandler.successThrow(res, '보증금 수정 성공');
	} catch (error) {
		await transaction.rollback();
		next(error);
	}
};

// 예약금/보증금 삭제 (reservationDelete): depositEsntlId로 il_room_deposit만 soft delete (rdp_delete_dtm, rdp_deleter_id 업데이트). il_room_deposit_history는 삭제하지 않음
exports.deleteDeposit = async (req, res, next) => {
	const transaction = await mariaDBSequelize.transaction();
	try {
		const decodedToken = verifyAdminToken(req);

		const depositEsntlId = req.query.depositEsntlId ?? req.query.esntlId;

		if (!depositEsntlId) {
			errorHandler.errorThrow(400, 'depositEsntlId(또는 esntlId)를 입력해주세요.');
		}

		const depositInfo = await ilRoomDeposit.findOne({
			where: { esntlId: depositEsntlId },
			transaction,
		});

		if (!depositInfo) {
			errorHandler.errorThrow(404, '보증금 정보를 찾을 수 없습니다.');
		}

		// il_room_deposit만 soft delete: rdp_delete_dtm, rdp_deleter_id 업데이트 (il_room_deposit_history는 삭제하지 않음)
		const deleterId = (decodedToken.admin != null && typeof decodedToken.admin === 'string')
			? decodedToken.admin
			: (decodedToken.admin?.esntlId || decodedToken.partner || 'ADMN0000000001');

		await ilRoomDeposit.update(
			{
				deleteDtm: mariaDBSequelize.literal('CURRENT_TIMESTAMP'),
				deleterId,
			},
			{
				where: { esntlId: depositEsntlId },
				transaction,
			}
		);

		await transaction.commit();

		return errorHandler.successThrow(res, '보증금 삭제 성공', { depositEsntlId });
	} catch (error) {
		await transaction.rollback();
		next(error);
	}
};

// 보증금 삭제 (il_room_deposit 단일 개념이므로 type 구분 없음)
exports.deleteDepositOnly = async (req, res, next) => {
	const transaction = await mariaDBSequelize.transaction();
	try {
		const decodedToken = verifyAdminToken(req);

		const { esntlId } = req.query;

		if (!esntlId) {
			errorHandler.errorThrow(400, 'esntlId를 입력해주세요.');
		}

		const depositInfo = await ilRoomDeposit.findOne({
			where: { esntlId: esntlId },
			transaction,
		});

		if (!depositInfo) {
			errorHandler.errorThrow(404, '보증금 정보를 찾을 수 없습니다.');
		}

		// 보증금 삭제 처리 (il_room_deposit)
		await ilRoomDeposit.update(
			{
				deleteYN: 'Y',
				status: 'DELETED',
			},
			{
				where: { esntlId: esntlId },
				transaction,
			}
		);

		// 삭제 이력 생성 (il_room_deposit_history)
		const historyId = await generateIlRoomDepositHistoryId(transaction);
		await ilRoomDepositHistory.create(
			{
				esntlId: historyId,
				depositEsntlId: esntlId,
				roomEsntlId: depositInfo.roomEsntlId,
				contractEsntlId: depositInfo.contractEsntlId || null,
				type: 'DEPOSIT',
				amount: 0,
				status: 'DELETED',
				manager: decodedToken.admin?.name || '관리자',
				memo: '보증금 정보 삭제',
			},
			{ transaction }
		);

		await transaction.commit();

		return errorHandler.successThrow(res, '보증금 삭제 성공');
	} catch (error) {
		await transaction.rollback();
		next(error);
	}
};

// 입금 등록
exports.registerDeposit = async (req, res, next) => {
	const transaction = await mariaDBSequelize.transaction();
	try {
		const decodedToken = verifyAdminToken(req);

		// 1. 입금일자, 입금자, 전화번호, 입실예정일, 납입금액, 메모 등 (il_room_deposit + il_room_deposit_history)
		const {
			depositDate,
			depositorName,
			depositorPhone,
			checkInDate,
			memo,
			paidAmount,
			amount,
			roomEsntlId,
			gosiwonEsntlId,
			contractEsntlId,
		} = req.body;

		// amount 또는 paidAmount 둘 중 하나를 받음 (Swagger 문서는 amount 사용)
		const inputPaidAmount = paidAmount !== undefined && paidAmount !== null ? paidAmount : amount;

		if (!depositDate || depositDate === '' || inputPaidAmount === undefined || inputPaidAmount === null || inputPaidAmount === '') {
			errorHandler.errorThrow(
				400,
				'depositDate, paidAmount(또는 amount)는 필수입니다.'
			);
		}

		// 2. roomEsntlId는 필수
		if (!roomEsntlId) {
			errorHandler.errorThrow(400, 'roomEsntlId는 필수입니다.');
		}

		// 3. roomEsntlId로 room 정보 조회하여 gosiwonEsntlId 자동 가져오기
		const roomInfo = await room.findOne({
			where: { esntlId: roomEsntlId },
			attributes: ['gosiwonEsntlId'],
			transaction,
		});

		if (!roomInfo) {
			errorHandler.errorThrow(404, '방 정보를 찾을 수 없습니다.');
		}

		// gosiwonEsntlId는 room에서 가져오거나 입력값 사용 (입력값이 있으면 우선)
		const finalGosiwonEsntlId = gosiwonEsntlId || roomInfo.gosiwonEsntlId;
		
		if (!finalGosiwonEsntlId) {
			errorHandler.errorThrow(400, '고시원 정보를 찾을 수 없습니다.');
		}

		// 4. contractEsntlId는 선택값 (예약금 등록을 특정 계약서와 연결하고 싶을 때 사용)
		const finalContractEsntlId = contractEsntlId || null;
		const finalRoomEsntlId = roomEsntlId;
		const customerEsntlId = null;
		const contractorEsntlId = null;

		const paidAmountInt = parseInt(inputPaidAmount, 10) || 0;
		const depositAmountValue = paidAmountInt;

		const managerId = getWriterAdminId(decodedToken);
		const newDepositId = await generateIlRoomDepositId(transaction);

		const finalAmount = depositAmountValue;

		// il_room_deposit 메인 레코드 생성 (예약금 입력 = 보증금으로 등록). 컬럼: rdp_customer_name, rdp_customer_phone, rdp_check_in_date
		const customerNameVal = (depositorName != null && String(depositorName).trim()) ? String(depositorName).trim() : null;
		const customerPhoneVal = (depositorPhone != null && String(depositorPhone).trim()) ? String(depositorPhone).trim() : null;
		const checkInDateVal = checkInDate ? (typeof checkInDate === 'string' ? checkInDate.split('T')[0] : null) : null;

		// il_room_deposit 등록 시 rdp_completed_dtm(completedDtm)은 입력하지 않음
		await ilRoomDeposit.create(
			{
				esntlId: newDepositId,
				roomEsntlId: finalRoomEsntlId,
				gosiwonEsntlId: finalGosiwonEsntlId,
				customerName: customerNameVal,
				customerPhone: customerPhoneVal,
				amount: finalAmount,
				checkInDate: checkInDateVal,
				registrantId: managerId,
				updaterId: managerId,
			},
			{ transaction }
		);

		// il_room_deposit_history에 PENDING 상태로 1건 등록 (type DEPOSIT, unpaidAmount = 요청 보증금, memo 포함)
		const historyId = await generateIlRoomDepositHistoryId(transaction);
		await ilRoomDepositHistory.create(
			{
				esntlId: historyId,
				depositEsntlId: newDepositId,
				roomEsntlId: finalRoomEsntlId,
				contractEsntlId: finalContractEsntlId,
				type: 'DEPOSIT',
				amount: 0,
				status: 'PENDING',
				unpaidAmount: finalAmount,
				depositorName: customerNameVal,
				memo: (memo != null && String(memo).trim()) ? String(memo).trim() : null,
				manager: decodedToken.admin?.name || '관리자',
			},
			{ transaction }
		);

		await transaction.commit();

		return errorHandler.successThrow(res, '입금 등록 성공', {
			depositEsntlId: newDepositId,
			historyId,
			amount: finalAmount,
		});
	} catch (error) {
		await transaction.rollback();
		next(error);
	}
};

// 입금/반환 이력 조회
exports.getDepositHistory = async (req, res, next) => {
	try {
		verifyAdminToken(req);

		const {
			depositEsntlId,
			contractEsntlId,
			roomEsntlId,
			type, // DEPOSIT | RETURN
			page = 1,
			limit = 50,
		} = req.query;

		if (!depositEsntlId && !contractEsntlId && !roomEsntlId) {
			errorHandler.errorThrow(
				400,
				'depositEsntlId, contractEsntlId 또는 roomEsntlId 중 하나는 필수입니다.'
			);
		}

		const whereCondition = {};
		if (depositEsntlId) {
			whereCondition.depositEsntlId = depositEsntlId;
		}
		if (contractEsntlId) {
			whereCondition.contractEsntlId = contractEsntlId;
		}
		if (roomEsntlId) {
			whereCondition.roomEsntlId = roomEsntlId;
		}
		if (type) {
			whereCondition.type = type;
		}

		const offset = (parseInt(page) - 1) * parseInt(limit);

		const { count, rows } = await ilRoomDepositHistory.findAndCountAll({
			where: whereCondition,
			order: [['createdAt', 'DESC']],
			limit: parseInt(limit),
			offset: offset,
		});

		// roomStatus에서 status가 CONTRACT인 contractEsntlId 조회
		const roomEsntlIds = rows.map((row) => row.roomEsntlId).filter((id) => id);
		let roomStatusMap = {};
		if (roomEsntlIds.length > 0) {
			const roomStatusQuery = `
				SELECT roomEsntlId, contractEsntlId
				FROM roomStatus
				WHERE roomEsntlId IN (:roomEsntlIds)
					AND status = 'CONTRACT'
			`;
			const roomStatusRows = await mariaDBSequelize.query(roomStatusQuery, {
				replacements: { roomEsntlIds: roomEsntlIds },
				type: mariaDBSequelize.QueryTypes.SELECT,
			});
			roomStatusMap = roomStatusRows.reduce((acc, row) => {
				acc[row.roomEsntlId] = row.contractEsntlId;
				return acc;
			}, {});
		}

		// 날짜·시간은 DB/로컬 기준 그대로 표시 (UTC 변환·+9 적용 금지, cursorrules 준수)
		const formatDateTimeLocal = (dateValue) => {
			if (!dateValue) return null;
			const d = new Date(dateValue);
			const year = d.getFullYear();
			const month = String(d.getMonth() + 1).padStart(2, '0');
			const day = String(d.getDate()).padStart(2, '0');
			const hours = String(d.getHours()).padStart(2, '0');
			const minutes = String(d.getMinutes()).padStart(2, '0');
			return `${year}-${month}-${day} ${hours}:${minutes}`;
		};

		// contractEsntlId 교체 및 날짜는 로컬 포맷으로만 표시
		const formattedRows = rows.map((row) => {
			const rowData = row.toJSON();
			if (rowData.createdAt) {
				rowData.createdAt = formatDateTimeLocal(rowData.createdAt);
			}
			if (rowData.updatedAt) {
				rowData.updatedAt = formatDateTimeLocal(rowData.updatedAt);
			}
			if (rowData.depositDate) {
				rowData.depositDate = formatDateTimeLocal(rowData.depositDate);
			}
			if (rowData.refundDate) {
				rowData.refundDate = formatDateTimeLocal(rowData.refundDate);
			}
			// roomStatus에서 status가 CONTRACT인 contractEsntlId로 교체 (없으면 null)
			if (rowData.roomEsntlId && roomStatusMap[rowData.roomEsntlId]) {
				rowData.contractEsntlId = roomStatusMap[rowData.roomEsntlId];
			} else {
				rowData.contractEsntlId = null;
			}
			return rowData;
		});

		return errorHandler.successThrow(res, '입금/반환 이력 조회 성공', {
			total: count,
			page: parseInt(page),
			limit: parseInt(limit),
			data: formattedRows,
		});
	} catch (error) {
		next(error);
	}
};

// 방의 예약금 내역 조회
exports.getDepositGroupByDepositor = async (req, res, next) => {
	try {
		verifyAdminToken(req);

		const { roomEsntlId } = req.query;

		if (!roomEsntlId) {
			errorHandler.errorThrow(400, 'roomEsntlId를 입력해주세요.');
		}

		// 해당 방의 보증금 내역 조회 (il_room_deposit 실제 컬럼: rdp_*, rom_eid, gsw_eid)
		const query = `
			SELECT 
				D.rom_eid as roomEsntlId,
				D.gsw_eid as gosiwonEsntlId,
				CASE WHEN D.rdp_completed_dtm IS NULL THEN 'PENDING' ELSE 'COMPLETED' END as status,
				D.rdp_price as amount,
				DATE(RC.startDate) as checkInDate,
				D.rdp_customer_name as checkinName,
				D.rdp_customer_phone as checkinPhone,
				NULL as manager,
				DATE(D.rdp_regist_dtm) as recordDate,
				DATE_FORMAT(D.rdp_regist_dtm, '%H:%i') as recordTime
			FROM il_room_deposit D
			LEFT JOIN (
				SELECT RC1.* FROM roomContract RC1
				INNER JOIN (SELECT roomEsntlId, MAX(contractDate) as maxContractDate FROM roomContract WHERE status = 'CONTRACT' GROUP BY roomEsntlId) RC2
				ON RC1.roomEsntlId = RC2.roomEsntlId AND RC1.contractDate = RC2.maxContractDate AND RC1.status = 'CONTRACT'
			) RC ON RC.roomEsntlId = D.rom_eid
			WHERE D.rom_eid = ?
				AND D.rdp_delete_dtm IS NULL
			ORDER BY D.rdp_regist_dtm DESC
			LIMIT 30
		`;

		const rows = await mariaDBSequelize.query(query, {
			replacements: [roomEsntlId],
			type: mariaDBSequelize.QueryTypes.SELECT,
		});

		// 결과 포맷팅
		const resultList = rows.map((row) => {
			return {
				roomEsntlId: row.roomEsntlId,
				gosiwonEsntlId: row.gosiwonEsntlId,
				content: {
					status: row.status,
					amount: row.amount,
					checkInDate: row.checkInDate || null,
					checkinName: row.checkinName || null,
					checkinPhone: row.checkinPhone || null,
				},
				manager: row.manager || null,
				recordDate: row.recordDate || null,
				recordTime: row.recordTime || null,
			};
		});

		return errorHandler.successThrow(res, '방의 예약금 내역 조회 성공', {
			data: resultList,
		});
	} catch (error) {
		next(error);
	}
};

// 입금 이력 목록 (type 고정: DEPOSIT)
exports.getDepositHistoryDepositList = async (req, res, next) => {
	req.query.type = 'DEPOSIT';
	return exports.getDepositHistory(req, res, next);
};

// 반환 이력 목록 (depositRefund 테이블 사용)
exports.getDepositHistoryReturnList = async (req, res, next) => {
	try {
		verifyAdminToken(req);

		const { contractEsntlId, roomEsntlId, page = 1, limit = 50 } = req.query;

		if (!contractEsntlId && !roomEsntlId) {
			errorHandler.errorThrow(400, 'contractEsntlId 또는 roomEsntlId 중 하나는 필수입니다.');
		}

		const whereCondition = {
			deleteYN: 'N',
		};

		if (contractEsntlId) {
			whereCondition.contractEsntlId = contractEsntlId;
		}

		if (roomEsntlId) {
			whereCondition.roomEsntlId = roomEsntlId;
		}

		const offset = (parseInt(page) - 1) * parseInt(limit);

		const { count, rows } = await depositRefund.findAndCountAll({
			where: whereCondition,
			order: [['createdAt', 'DESC']],
			limit: parseInt(limit),
			offset: offset,
		});

		// 날짜·시간은 DB/로컬 기준 그대로 표시 (UTC 변환·+9 적용 금지, cursorrules 준수)
		const formatDateTimeLocal = (dateValue) => {
			if (!dateValue) return null;
			const d = new Date(dateValue);
			const year = d.getFullYear();
			const month = String(d.getMonth() + 1).padStart(2, '0');
			const day = String(d.getDate()).padStart(2, '0');
			const hours = String(d.getHours()).padStart(2, '0');
			const minutes = String(d.getMinutes()).padStart(2, '0');
			return `${year}-${month}-${day} ${hours}:${minutes}`;
		};

		const formattedRows = rows.map((row) => {
			const rowData = row.toJSON();
			if (rowData.createdAt) {
				rowData.createdAt = formatDateTimeLocal(rowData.createdAt);
			}
			if (rowData.updatedAt) {
				rowData.updatedAt = formatDateTimeLocal(rowData.updatedAt);
			}
			if (rowData.deletedAt) {
				rowData.deletedAt = formatDateTimeLocal(rowData.deletedAt);
			}
			return rowData;
		});

		return errorHandler.successThrow(res, '반환 이력 목록 조회 성공', {
			total: count,
			page: parseInt(page),
			limit: parseInt(limit),
			data: formattedRows,
		});
	} catch (error) {
		next(error);
	}
};

// 방 고유 아이디 기준 il_room_deposit_history 이력 조회 (입금 등록 화면용)
// type: DEPOSIT(보증금 입금), RETURN(환불) 필터 지원
exports.getRoomDepositList = async (req, res, next) => {
	try {
		verifyAdminToken(req);

		const { roomEsntlId, type } = req.query;

		if (!roomEsntlId) {
			errorHandler.errorThrow(400, 'roomEsntlId는 필수입니다.');
		}

		const where = { roomEsntlId };
		// 조회 타입: DEPOSIT(보증금), RETURN(환불)
		if (type === 'DEPOSIT' || type === 'RETURN') {
			where.type = type;
		}

		const rows = await ilRoomDepositHistory.findAll({
			where,
			attributes: [
				'esntlId',
				'depositEsntlId',
				'roomEsntlId',
				'contractEsntlId',
				'type',
				'amount',
				'status',
				'unpaidAmount',
				'depositDate',
				'depositorName',
				'manager',
				'createdAt',
			],
			order: [['depositDate', 'DESC'], ['createdAt', 'DESC']],
			raw: true,
		});

		// unpaidAmount는 DB에 저장된 값 사용 (계약 보증금 - 그동안 입금 합계)
		const result = (rows || []).map((r) => ({
			esntlId: r.esntlId || null,
			depositEsntlId: r.depositEsntlId || null,
			contractEsntlId: r.contractEsntlId || null,
			type: r.type || null,
			status: r.status || null,
			date: r.depositDate || r.createdAt || null,
			amount: r.amount ?? null,
			paidAmount: (r.status === 'COMPLETED' || r.status === 'PARTIAL') ? (r.amount ?? 0) : 0,
			unpaidAmount: r.unpaidAmount != null && r.unpaidAmount !== '' ? Number(r.unpaidAmount) : 0,
			manager: r.manager || null,
			depositorName: r.depositorName || null,
		}));

		return errorHandler.successThrow(res, '방 보증금/예약금 이력 조회 성공', result);
	} catch (error) {
		next(error);
	}
};

// 보증금 ID(il_room_deposit.rdp_eid) 기준 il_room_deposit_history 이력 조회 (리턴값은 getRoomDepositList와 동일)
// type 필수: DEPOSIT(보증금 입금), RETURN(환불)
exports.getRoomDepositListById = async (req, res, next) => {
	try {
		verifyAdminToken(req);

		const { depositEsntlId, type } = req.query;

		if (!depositEsntlId) {
			errorHandler.errorThrow(400, 'depositEsntlId(il_room_deposit.rdp_eid)를 입력해주세요.');
		}
		if (type !== 'DEPOSIT' && type !== 'RETURN') {
			errorHandler.errorThrow(400, 'type은 DEPOSIT 또는 RETURN 중 하나 필수입니다.');
		}

		const where = { depositEsntlId, type };

		const rows = await ilRoomDepositHistory.findAll({
			where,
			attributes: [
				'esntlId',
				'depositEsntlId',
				'roomEsntlId',
				'contractEsntlId',
				'type',
				'amount',
				'status',
				'unpaidAmount',
				'depositDate',
				'refundDate',
				'depositorName',
				'manager',
				'memo',
				'deductionAmount',
				'refundAmount',
				'accountBank',
				'accountNumber',
				'accountHolder',
				'createdAt',
			],
			order: [[type === 'RETURN' ? 'refundDate' : 'depositDate', 'DESC'], ['createdAt', 'DESC']],
			raw: true,
		});

		const result = (rows || []).map((r) => {
			const base = {
				esntlId: r.esntlId || null,
				depositEsntlId: r.depositEsntlId || null,
				contractEsntlId: r.contractEsntlId || null,
				type: r.type || null,
				status: r.status || null,
				date: r.depositDate || r.refundDate || r.createdAt || null,
				amount: r.amount ?? null,
				paidAmount: (r.status === 'COMPLETED' || r.status === 'PARTIAL') ? (r.amount ?? 0) : 0,
				unpaidAmount: r.unpaidAmount != null && r.unpaidAmount !== '' ? Number(r.unpaidAmount) : 0,
				manager: r.manager || null,
				depositorName: r.depositorName || null,
			};
			if (r.type === 'RETURN') {
				let deductionItems = [];
				if (r.memo && typeof r.memo === 'string') {
					try {
						const parsed = JSON.parse(r.memo);
						deductionItems = Array.isArray(parsed) ? parsed : [];
					} catch (_) {
						deductionItems = [];
					}
				}
				return {
					...base,
					date: r.refundDate || r.createdAt || null,
					amount: r.amount ?? null,
					deductionAmount: r.deductionAmount != null ? Number(r.deductionAmount) : 0,
					refundAmount: r.refundAmount != null ? Number(r.refundAmount) : (r.amount ?? 0),
					refundDate: r.refundDate || null,
					deductionItems,
					accountBank: r.accountBank || null,
					accountNumber: r.accountNumber || null,
					accountHolder: r.accountHolder || null,
				};
			}
			return base;
		});

		return errorHandler.successThrow(res, '방 보증금/예약금 이력 조회 성공', result);
	} catch (error) {
		next(error);
	}
};

// 계약서 쿠폰 정보 조회
exports.getContractCouponInfo = async (req, res, next) => {
	try {
		verifyAdminToken(req);

		const { contractEsntlId } = req.query;

		if (!contractEsntlId) {
			errorHandler.errorThrow(400, 'contractEsntlId를 입력해주세요.');
		}

		// roomContract에서 계약 기간 및 customerEsntlId 조회
		const contractQuery = `
			SELECT 
				RC.startDate,
				RC.endDate,
				RC.customerEsntlId
			FROM roomContract RC
			WHERE RC.esntlId = ?
			LIMIT 1
		`;

		const [contractResult] = await mariaDBSequelize.query(contractQuery, {
			replacements: [contractEsntlId],
			type: mariaDBSequelize.QueryTypes.SELECT,
		});

		if (!contractResult) {
			errorHandler.errorThrow(404, '계약서 정보를 찾을 수 없습니다.');
		}

		// customer 테이블에서 name, bank, bankAccount 조회
		let customerName = null;
		let customerBank = null;
		let customerBankAccount = null;
		if (contractResult.customerEsntlId) {
			const customerQuery = `
				SELECT 
					name,
					bank,
					bankAccount
				FROM customer
				WHERE esntlId = ?
				LIMIT 1
			`;

			const [customerResult] = await mariaDBSequelize.query(customerQuery, {
				replacements: [contractResult.customerEsntlId],
				type: mariaDBSequelize.QueryTypes.SELECT,
			});

			if (customerResult) {
				customerName = customerResult.name || null;
				customerBank = customerResult.bank || null;
				customerBankAccount = customerResult.bankAccount || null;
			}
		}

		// paymentLog에서 쿠폰 사용 정보 조회 (ucp_eid가 NULL이 아닌 경우만)
		const paymentQuery = `
			SELECT DISTINCT
				ucp_eid
			FROM paymentLog
			WHERE contractEsntlId = ?
				AND ucp_eid IS NOT NULL
				AND ucp_eid != ''
			LIMIT 1
		`;

		const [paymentResult] = await mariaDBSequelize.query(paymentQuery, {
			replacements: [contractEsntlId],
			type: mariaDBSequelize.QueryTypes.SELECT,
		});

		const hasCoupon = !!paymentResult && !!paymentResult.ucp_eid;
		let couponInfo = null;

		// 쿠폰을 사용한 경우 userCoupon을 통해 coupon 테이블에서 쿠폰 정보 조회
		if (hasCoupon) {
			const couponQuery = `
				SELECT 
					C.esntlId,
					C.name,
					C.description,
					C.value
				FROM userCoupon UC
				JOIN coupon C ON UC.couponEsntlId = C.esntlId
				WHERE UC.esntlId = ?
				LIMIT 1
			`;

			const [couponResult] = await mariaDBSequelize.query(couponQuery, {
				replacements: [paymentResult.ucp_eid],
				type: mariaDBSequelize.QueryTypes.SELECT,
			});

			if (couponResult) {
				couponInfo = {
					esntId: couponResult.esntlId,
					name: couponResult.name,
					description: couponResult.description,
					value: couponResult.value,
				};
			}
		}

		// depositRefund 테이블에서 제일 최근 값 조회 후, status가 PARTIAL이면 remainAmount 반환
		const depositRefundQuery = `
			SELECT remainAmount, status
			FROM depositRefund
			WHERE contractEsntlId = ?
				AND (deleteYN IS NULL OR deleteYN = 'N')
			ORDER BY createdAt DESC
			LIMIT 1
		`;

		const [depositRefundResult] = await mariaDBSequelize.query(depositRefundQuery, {
			replacements: [contractEsntlId],
			type: mariaDBSequelize.QueryTypes.SELECT,
		});

		// 최신 값이 있고 status가 PARTIAL이면 remainAmount 반환, 아니면 0
		const remainAmount = depositRefundResult && depositRefundResult.status === 'PARTIAL' && depositRefundResult.remainAmount !== null && depositRefundResult.remainAmount !== undefined
			? parseInt(depositRefundResult.remainAmount) || 0
			: 0;

		const result = {
			contractEsntlId: contractEsntlId,
			period: {
				startDate: contractResult.startDate,
				endDate: contractResult.endDate,
			},
			hasCoupon: hasCoupon,
			coupon: couponInfo,
			customerName: customerName,
			bank: customerBank,
			bankAccount: customerBankAccount,
			remainAmount: remainAmount,
		};

		return errorHandler.successThrow(res, '사용쿠폰, 계좌정보 확인 성공', result);
	} catch (error) {
		next(error);
	}
};

// 고시원 목록 조회 (입금대기 건수 포함)
exports.getGosiwonList = async (req, res, next) => {
	try {
		verifyAdminToken(req);

		// status가 'OPERATE'인 고시원 목록과 COMPLETED 상태가 없는 계약서 개수를 함께 조회
		// 하나라도 카운트가 있으면 상단으로 정렬
		const gosiwonList = await mariaDBSequelize.query(
			`
			SELECT 
				esntlId,
				name,
				pendingCount
			FROM (
			SELECT 
				g.esntlId,
				g.name,
					COUNT(DISTINCT CASE 
						WHEN d.rom_eid IS NOT NULL 
						AND d.rdp_completed_dtm IS NULL
						AND d.rdp_delete_dtm IS NULL
						THEN d.rom_eid 
					END) as pendingCount
			FROM gosiwon g
			LEFT JOIN il_room_deposit d ON g.esntlId = d.gsw_eid 
			WHERE g.status = 'OPERATE'
			GROUP BY g.esntlId, g.name
			) as gosiwonCounts
			ORDER BY pendingCount DESC, name ASC
		`,
			{
				type: mariaDBSequelize.QueryTypes.SELECT,
			}
		);

		// 결과 구성
		const result = gosiwonList.map((row) => {
			return {
				esntlId: row.esntlId,
				name: row.name,
				pendingCount: parseInt(row.pendingCount) || 0,
			};
		});

		return errorHandler.successThrow(res, '고시원 목록 조회 성공', result);
	} catch (error) {
		next(error);
	}
};

// 예약금 예약 목록 조회 (속도 개선: gosiwonName 서브쿼리 1회화, reservationStatus 상관 서브쿼리 제거 → D_latest 활용)
exports.getReservationList = async (req, res, next) => {
	try {
		verifyAdminToken(req);

		const {
			gosiwonName, // 고시원명 필터
			gosiwonCode, // 고시원코드 필터
			searchString, // 검색어
			canCheckin, // 입실가능한 방만 보기 (checkbox)
			reservationStatus, // 예약금요청상태만보기 (checkbox)
			page = 1,
			limit = 50,
		} = req.query;

		const searchValue = searchString ? String(searchString).trim() : '';

		// 검색 조건 구성
		const whereConditions = [];
		const replacements = [];

		// 삭제되지 않은 방만 조회
		whereConditions.push("R.deleteYN = 'N'");

		// gosiwonName 필터: 서브쿼리로 한 번에 처리 (별도 findAll 제거 → 왕복 1회 감소)
		if (gosiwonName) {
			const gosiwonNameValue = String(gosiwonName).trim();
			if (gosiwonNameValue) {
				whereConditions.push('R.gosiwonEsntlId IN (SELECT esntlId FROM gosiwon WHERE name LIKE ?)');
				replacements.push(`%${gosiwonNameValue}%`);
			}
		}

		// gosiwonCode 필터 처리 (값이 있으면 WHERE 절에 추가)
		if (gosiwonCode) {
			const gosiwonCodeValue = String(gosiwonCode).trim();
			if (gosiwonCodeValue) {
				whereConditions.push('R.gosiwonEsntlId = ?');
				replacements.push(gosiwonCodeValue);
			}
		}

		// searchString 검색 처리 (roomName, roomEsntlId, checkinName, customerName을 like 검색)
		if (searchValue) {
			whereConditions.push(`(
				R.roomNumber LIKE ? OR
				R.esntlId LIKE ? OR
				RCW.checkinName LIKE ? OR
				RCW.customerName LIKE ?
			)`);
			replacements.push(`%${searchValue}%`, `%${searchValue}%`, `%${searchValue}%`, `%${searchValue}%`);
		}

		// canCheckin 필터: roomStatus.status가 CAN_CHECKIN이고 subStatus가 END가 아닌 경우
		if (canCheckin === 'true' || canCheckin === true) {
			whereConditions.push(`(
				RS.status = 'CAN_CHECKIN' AND
				(RS.subStatus IS NULL OR RS.subStatus != 'END')
			)`);
		}
		
		// reservationStatus 필터: D_latest(이미 조인된 방별 최신 예약금) 사용으로 상관 서브쿼리 제거
		const useReservationStatusFilter = reservationStatus === 'true' || reservationStatus === true;
		if (useReservationStatusFilter) {
			whereConditions.push('D_latest.rdp_completed_dtm IS NULL');
		}

		const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
		const countWhereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

		// 방별 il_room_deposit 최신 1건만 조인. roomStatus는 room 테이블 상태(R.status) 사용. reservationName/contractorName 등은 room.customerEsntlId+방id로 roomContract·roomContractWho 참고
		const query = `
			SELECT
				CASE 
					WHEN D_latest.rom_eid IS NULL THEN NULL
					WHEN D_latest.rdp_completed_dtm IS NULL THEN D_latest.rdp_eid
					ELSE D_latest.rdp_eid
				END as depositEsntlId,
				R.esntlId as roomEsntlId,
				R.roomNumber,
				R.gosiwonEsntlId,
				G.name as gosiwonName,
				COALESCE(RS.contractEsntlId, RC.esntlId) as contractEsntlId,
				R.status as roomStatus,
				COALESCE(RCW.checkinName, RCW_RS.checkinName) as reservationName,
				COALESCE(RCW.checkinPhone, RCW_RS.checkinPhone) as reservationPhone,
				COALESCE(RCW.customerName, RCW_RS.customerName) as contractorName,
				COALESCE(RCW.customerPhone, RCW_RS.customerPhone) as contractorPhone,
				DATE(COALESCE(RC.startDate, RC_RS.startDate)) as checkInDate,
				DATE(COALESCE(RC.endDate, RC_RS.endDate)) as checkOutDate,
				CASE WHEN RS.status = 'ON_SALE' AND (RS.subStatus IS NULL OR RS.subStatus != 'END') THEN RS.statusStartDate ELSE NULL END as sortDate,
				CASE 
					WHEN D_latest.rom_eid IS NULL THEN NULL
					WHEN D_latest.rdp_completed_dtm IS NULL THEN 'PENDING'
					ELSE 'COMPLETED'
				END as depositStatus
			FROM room R
			LEFT JOIN gosiwon G ON R.gosiwonEsntlId = G.esntlId
			LEFT JOIN (
				SELECT RS1.*
				FROM roomStatus RS1
				INNER JOIN (
					SELECT roomEsntlId, MAX(updatedAt) as maxUpdatedAt
					FROM roomStatus
					GROUP BY roomEsntlId
				) RS2 ON RS1.roomEsntlId = RS2.roomEsntlId AND RS1.updatedAt = RS2.maxUpdatedAt
			) RS ON R.esntlId = RS.roomEsntlId
			LEFT JOIN (
				SELECT RC1.*
				FROM roomContract RC1
				INNER JOIN (
					SELECT gosiwonEsntlId, roomEsntlId, customerEsntlId, MAX(contractDate) as maxContractDate
					FROM roomContract
					WHERE status = 'CONTRACT'
					GROUP BY gosiwonEsntlId, roomEsntlId, customerEsntlId
				) RC2 ON RC1.gosiwonEsntlId = RC2.gosiwonEsntlId AND RC1.roomEsntlId = RC2.roomEsntlId AND RC1.customerEsntlId = RC2.customerEsntlId AND RC1.contractDate = RC2.maxContractDate AND RC1.status = 'CONTRACT'
			) RC ON R.gosiwonEsntlId = RC.gosiwonEsntlId AND R.esntlId = RC.roomEsntlId AND R.customerEsntlId = RC.customerEsntlId
			LEFT JOIN roomContract RC_RS ON RS.contractEsntlId = RC_RS.esntlId AND RS.status = 'CONTRACT'
			LEFT JOIN roomContractWho RCW ON RC.esntlId = RCW.contractEsntlId
			LEFT JOIN roomContractWho RCW_RS ON RS.contractEsntlId = RCW_RS.contractEsntlId AND RS.status = 'CONTRACT'
			LEFT JOIN (
				SELECT D_inner.rom_eid, D_inner.rdp_eid, D_inner.rdp_completed_dtm
				FROM il_room_deposit D_inner
				INNER JOIN (
					SELECT rom_eid, MAX(rdp_regist_dtm) as max_regist
					FROM il_room_deposit
					WHERE rdp_delete_dtm IS NULL
					GROUP BY rom_eid
				) T ON D_inner.rom_eid = T.rom_eid AND D_inner.rdp_regist_dtm = T.max_regist
				WHERE D_inner.rdp_delete_dtm IS NULL
			) D_latest ON R.esntlId = D_latest.rom_eid
			${whereClause}
			ORDER BY 
				CASE WHEN RS.status = 'ON_SALE' AND (RS.subStatus IS NULL OR RS.subStatus != 'END') THEN 0 ELSE 1 END,
				sortDate DESC, 
				R.roomNumber ASC
			LIMIT ? OFFSET ?
		`;

		const countQuery = `
			SELECT COUNT(DISTINCT R.esntlId) as total
			FROM room R
			LEFT JOIN (
				SELECT RS1.*
				FROM roomStatus RS1
				INNER JOIN (
					SELECT roomEsntlId, MAX(updatedAt) as maxUpdatedAt
					FROM roomStatus
					GROUP BY roomEsntlId
				) RS2 ON RS1.roomEsntlId = RS2.roomEsntlId AND RS1.updatedAt = RS2.maxUpdatedAt
			) RS ON R.esntlId = RS.roomEsntlId
			LEFT JOIN (
				SELECT RC1.*
				FROM roomContract RC1
				INNER JOIN (
					SELECT gosiwonEsntlId, roomEsntlId, customerEsntlId, MAX(contractDate) as maxContractDate
					FROM roomContract
					WHERE status = 'CONTRACT'
					GROUP BY gosiwonEsntlId, roomEsntlId, customerEsntlId
				) RC2 ON RC1.gosiwonEsntlId = RC2.gosiwonEsntlId AND RC1.roomEsntlId = RC2.roomEsntlId AND RC1.customerEsntlId = RC2.customerEsntlId AND RC1.contractDate = RC2.maxContractDate AND RC1.status = 'CONTRACT'
			) RC ON R.gosiwonEsntlId = RC.gosiwonEsntlId AND R.esntlId = RC.roomEsntlId AND R.customerEsntlId = RC.customerEsntlId
			LEFT JOIN roomContractWho RCW ON RC.esntlId = RCW.contractEsntlId
			LEFT JOIN (
				SELECT D_inner.rom_eid, D_inner.rdp_eid, D_inner.rdp_completed_dtm
				FROM il_room_deposit D_inner
				INNER JOIN (
					SELECT rom_eid, MAX(rdp_regist_dtm) as max_regist
					FROM il_room_deposit
					WHERE rdp_delete_dtm IS NULL
					GROUP BY rom_eid
				) T ON D_inner.rom_eid = T.rom_eid AND D_inner.rdp_regist_dtm = T.max_regist
				WHERE D_inner.rdp_delete_dtm IS NULL
			) D_latest ON R.esntlId = D_latest.rom_eid
			${countWhereClause}
		`;

		const offset = (parseInt(page) - 1) * parseInt(limit);
		const queryReplacements = [...replacements, parseInt(limit), offset];
		const countReplacements = [...replacements];

		// count 쿼리와 메인 쿼리 병렬 실행
		const [rows, countResult] = await Promise.all([
			mariaDBSequelize.query(query, {
				replacements: queryReplacements,
				type: mariaDBSequelize.QueryTypes.SELECT,
			}),
			mariaDBSequelize.query(countQuery, {
				replacements: countReplacements,
				type: mariaDBSequelize.QueryTypes.SELECT,
			}),
		]);

		const total = countResult && countResult[0] ? parseInt(countResult[0].total) : 0;

		// 결과 포맷팅
		const resultList = (rows || []).map((row) => {
			return {
				depositEsntlId: row.depositEsntlId || null,
				roomEsntlId: row.roomEsntlId,
				contractEsntlId: row.contractEsntlId || null,
				roomNumber: row.roomNumber,
				gosiwonEsntlId: row.gosiwonEsntlId || null,
				gosiwonName: row.gosiwonName || null,
				roomStatus: row.roomStatus || null,
				reservationName: row.reservationName || null,
				reservationPhone: row.reservationPhone || null,
				contractorName: row.contractorName || null,
				contractorPhone: row.contractorPhone || null,
				checkInDate: row.checkInDate || null,
				checkOutDate: row.checkOutDate || null,
				depositStatus: row.depositStatus || null,
			};
		});

		// 각 방의 보증금 내역 1회 배치 조회 (N+1 제거: 방 수만큼 쿼리 → 1회 IN 조회 후 그룹핑)
		const roomEsntlIds = resultList.map((r) => r.roomEsntlId).filter(Boolean);
		let depositByRoom = {};
		if (roomEsntlIds.length > 0) {
			const depositRows = await mariaDBSequelize.query(
				`
				SELECT 
					D.rom_eid as roomEsntlId,
					D.gsw_eid as gosiwonEsntlId,
					CASE WHEN D.rdp_completed_dtm IS NULL THEN 'PENDING' ELSE 'COMPLETED' END as status,
					D.rdp_price as amount,
					D.rdp_check_in_date as checkInDate,
					D.rdp_customer_name as checkinName,
					D.rdp_customer_phone as checkinPhone,
					DATE(D.rdp_regist_dtm) as recordDate,
					DATE_FORMAT(D.rdp_regist_dtm, '%H:%i') as recordTime
				FROM il_room_deposit D
				WHERE D.rom_eid IN (${roomEsntlIds.map(() => '?').join(',')})
					AND D.rdp_delete_dtm IS NULL
				ORDER BY D.rom_eid, D.rdp_regist_dtm DESC
				`,
				{
					replacements: roomEsntlIds,
					type: mariaDBSequelize.QueryTypes.SELECT,
				}
			);
			// 방별 최대 30건만 유지
			const DEPOSIT_HISTORY_PER_ROOM = 30;
			for (const row of depositRows || []) {
				const id = row.roomEsntlId;
				if (!depositByRoom[id]) depositByRoom[id] = [];
				if (depositByRoom[id].length < DEPOSIT_HISTORY_PER_ROOM) {
					depositByRoom[id].push({
						roomEsntlId: row.roomEsntlId,
						gosiwonEsntlId: row.gosiwonEsntlId,
						content: {
							status: row.status,
							amount: row.amount,
							checkInDate: row.checkInDate || null,
							checkinName: row.checkinName || null,
							checkinPhone: row.checkinPhone || null,
						},
						manager: null,
						recordDate: row.recordDate || null,
						recordTime: row.recordTime || null,
					});
				}
			}
		}

		const resultListWithHistory = resultList.map((room) => ({
			...room,
			depositHistory: depositByRoom[room.roomEsntlId] || [],
		}));

		return errorHandler.successThrow(res, '예약금 예약 목록 조회 성공', {
			total: total,
			page: parseInt(page),
			limit: parseInt(limit),
			data: resultListWithHistory,
		});
	} catch (error) {
		next(error);
	}
};

// 보증금 목록 조회
exports.getDepositList = async (req, res, next) => {
	try {
		verifyAdminToken(req);

		const {
			gosiwonName, // 고시원명 필터
			gosiwonCode, // 고시원코드 필터
			contractEsntlId, // 계약서 아이디 필터
			searchString, // 검색어
			disableDeleted, // 삭제된 항목 숨기기 (checkbox)
			disableCompleted, // 입금완료된 항목 숨기기 (checkbox)
			page = 1,
			limit = 50,
		} = req.query;

		const searchValue = searchString ? String(searchString).trim() : '';

		// 검색 조건 구성
		const whereConditions = [];
		const replacements = [];

		// gosiwonName 필터 처리 (값이 있으면 WHERE 절에 추가)
		if (gosiwonName) {
			const gosiwonNameValue = String(gosiwonName).trim();
			if (gosiwonNameValue) {
				const gosiwonList = await gosiwon.findAll({
					where: {
						name: { [Op.like]: `%${gosiwonNameValue}%` },
					},
					attributes: ['esntlId'],
				});
				const gosiwonIds = gosiwonList.map((g) => g.esntlId);
				if (gosiwonIds.length > 0) {
					whereConditions.push('R.gosiwonEsntlId IN (' + gosiwonIds.map(() => '?').join(',') + ')');
					replacements.push(...gosiwonIds);
				} else {
					// 검색 결과가 없으면 빈 결과 반환
					return errorHandler.successThrow(res, '보증금 목록 조회 성공', {
						total: 0,
						page: parseInt(page),
						limit: parseInt(limit),
						data: [],
					});
				}
			}
		}

		// gosiwonCode 필터 처리 (값이 있으면 WHERE 절에 추가)
		if (gosiwonCode) {
			const gosiwonCodeValue = String(gosiwonCode).trim();
			if (gosiwonCodeValue) {
				whereConditions.push('R.gosiwonEsntlId = ?');
				replacements.push(gosiwonCodeValue);
			}
		}

		// contractEsntlId 필터 처리 (값이 있으면 WHERE 절에 추가, RS.contractEsntlId 또는 RC.esntlId)
		if (contractEsntlId) {
			const contractEsntlIdValue = String(contractEsntlId).trim();
			if (contractEsntlIdValue) {
				whereConditions.push('COALESCE(RS.contractEsntlId, RC.esntlId) = ?');
				replacements.push(contractEsntlIdValue);
			}
		}

		// searchString 검색 처리 (roomName, roomEsntlId, checkinName, customerName을 like 검색)
		if (searchValue) {
			whereConditions.push(`(
				R.roomNumber LIKE ? OR
				R.esntlId LIKE ? OR
				RCW.checkinName LIKE ? OR
				RCW.customerName LIKE ?
			)`);
			replacements.push(`%${searchValue}%`, `%${searchValue}%`, `%${searchValue}%`, `%${searchValue}%`);
		}

		// disableDeleted 필터: il_room_deposit 미삭제(rdp_delete_dtm IS NULL)만 보기
		if (disableDeleted === 'true' || disableDeleted === true) {
			whereConditions.push('D.rdp_delete_dtm IS NULL');
		}

		// disableCompleted 필터: il_room_deposit 미완료(rdp_completed_dtm IS NULL)만 보기
		if (disableCompleted === 'true' || disableCompleted === true) {
			whereConditions.push('D.rdp_completed_dtm IS NULL');
		}

		const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

		// il_room_deposit 주테이블. R.customerEsntlId + 방id(D.rom_eid)로 roomContract.esntlId 확정 후 roomContractWho에서 checkinName/checkinPhone/contractorName/contractorPhone 표시
		const query = `
			SELECT
				D.rdp_eid as depositEsntlId,
				R.esntlId as roomEsntlId,
				R.roomNumber,
				R.gosiwonEsntlId,
				G.name as gosiwonName,
				C.name as currentOccupantName,
				R.customerEsntlId as currentOccupantID,
				ICR.cre_bank_name as customerBank,
				ICR.cre_account_number as customerBankAccount,
				TRIM(CONCAT(IFNULL(ICR.cre_bank_name,''), ' ', IFNULL(ICR.cre_account_number,''))) as refundBankAccount,
				COALESCE(RCW.checkinName, RCW_RS.checkinName) AS checkinName,
				COALESCE(RCW.checkinPhone, RCW_RS.checkinPhone) AS checkinPhone,
				COALESCE(RCW.customerName, RCW_RS.customerName) as contractorName,
				COALESCE(RCW.customerPhone, RCW_RS.customerPhone) as contractorPhone,
				D.rdp_price as depositAmount,
				COALESCE(RS.contractEsntlId, RC.esntlId) as contractEsntlId,
				DATE(COALESCE(RC_RS.startDate, RC.startDate)) as moveInDate,
				DATE(COALESCE(RC_RS.endDate, RC.endDate)) as moveOutDate,
				COALESCE(RC_RS.status, RC.status) as contractStatus,
				CASE
					WHEN DH.status IS NULL THEN NULL
					WHEN DH.status = 'PENDING' THEN 'PENDING'
					WHEN DH.status = 'PARTIAL' THEN 'PARTIAL'
					WHEN DH.status = 'DELETED' THEN 'DELETED'
					WHEN DH.status IN ('COMPLETED', 'RETURN_COMPLETED') THEN 'COMPLETE'
					ELSE DH.status
				END as depositStatus,
				(SELECT COALESCE(SUM(H_sum.amount), 0) FROM il_room_deposit_history H_sum WHERE H_sum.depositEsntlId = D.rdp_eid) as depositLastestAmount,
				DATE_FORMAT(D.rdp_regist_dtm, '%Y-%m-%d %H:%i') as depositLastestTime,
				D.rdp_regist_dtm as depositCreatedAt,
				(
					SELECT DR.status
					FROM depositRefund DR
					WHERE DR.contractEsntlId = COALESCE(RS.contractEsntlId, RC.esntlId)
						AND (DR.deleteYN IS NULL OR DR.deleteYN = 'N')
					ORDER BY DR.createdAt DESC
					LIMIT 1
				) as refundStatus,
				(
					SELECT DATE_FORMAT(DR.createdAt, '%Y-%m-%d %H:%i')
					FROM depositRefund DR
					WHERE DR.contractEsntlId = COALESCE(RS.contractEsntlId, RC.esntlId)
						AND (DR.deleteYN IS NULL OR DR.deleteYN = 'N')
					ORDER BY DR.createdAt DESC
					LIMIT 1
				) as refundCreatedAt,
				(
					SELECT H_ret.status
					FROM il_room_deposit_history H_ret
					WHERE H_ret.depositEsntlId = D.rdp_eid AND H_ret.type = 'RETURN'
					ORDER BY COALESCE(H_ret.refundDate, H_ret.createdAt) DESC, H_ret.createdAt DESC
					LIMIT 1
				) as returnStatus,
				(
					SELECT COALESCE(SUM(H_ret.amount + COALESCE(H_ret.deductionAmount, 0)), 0)
					FROM il_room_deposit_history H_ret
					WHERE H_ret.depositEsntlId = D.rdp_eid AND H_ret.type = 'RETURN'
						AND H_ret.status IN ('COMPLETED', 'PARTIAL', 'RETURN_COMPLETED')
				) as returnLastestAmount,
				(
					SELECT DATE_FORMAT(MAX(COALESCE(H_ret.refundDate, H_ret.createdAt)), '%Y-%m-%d %H:%i')
					FROM il_room_deposit_history H_ret
					WHERE H_ret.depositEsntlId = D.rdp_eid AND H_ret.type = 'RETURN'
				) as returnLastestTime
			FROM il_room_deposit D
			LEFT JOIN room R ON R.esntlId = D.rom_eid AND R.gosiwonEsntlId = D.gsw_eid
			LEFT JOIN gosiwon G ON R.gosiwonEsntlId = G.esntlId
			LEFT JOIN customer C ON R.customerEsntlId = C.esntlId
			LEFT JOIN (
				SELECT RS1.*
				FROM roomStatus RS1
				INNER JOIN (
					SELECT roomEsntlId, MAX(updatedAt) as maxUpdatedAt
					FROM roomStatus
					GROUP BY roomEsntlId
				) RS2 ON RS1.roomEsntlId = RS2.roomEsntlId AND RS1.updatedAt = RS2.maxUpdatedAt
			) RS ON R.esntlId = RS.roomEsntlId
			LEFT JOIN (
				SELECT RC1.*
				FROM roomContract RC1
				INNER JOIN (
					SELECT gosiwonEsntlId, roomEsntlId, customerEsntlId, MAX(contractDate) as maxContractDate
					FROM roomContract
					WHERE status = 'CONTRACT'
					GROUP BY gosiwonEsntlId, roomEsntlId, customerEsntlId
				) RC2 ON RC1.gosiwonEsntlId = RC2.gosiwonEsntlId AND RC1.roomEsntlId = RC2.roomEsntlId AND RC1.customerEsntlId = RC2.customerEsntlId AND RC1.contractDate = RC2.maxContractDate AND RC1.status = 'CONTRACT'
			) RC ON D.gsw_eid = RC.gosiwonEsntlId AND D.rom_eid = RC.roomEsntlId AND R.customerEsntlId = RC.customerEsntlId
			LEFT JOIN il_customer_refund ICR ON ICR.cus_eid = COALESCE(RC.customerEsntlId, C.esntlId) AND ICR.cre_delete_dtm IS NULL
				AND ICR.cre_regist_dtm = (SELECT MAX(cre_regist_dtm) FROM il_customer_refund i2 WHERE i2.cus_eid = COALESCE(RC.customerEsntlId, C.esntlId) AND i2.cre_delete_dtm IS NULL)
			LEFT JOIN roomContract RC_RS ON RS.contractEsntlId = RC_RS.esntlId AND RS.status = 'CONTRACT'
			LEFT JOIN roomContractWho RCW ON RC.esntlId = RCW.contractEsntlId
			LEFT JOIN roomContractWho RCW_RS ON RS.contractEsntlId = RCW_RS.contractEsntlId AND RS.status = 'CONTRACT'
			LEFT JOIN (
				SELECT H1.depositEsntlId, H1.status
				FROM il_room_deposit_history H1
				INNER JOIN (
					SELECT depositEsntlId, MAX(createdAt) as maxCreatedAt
					FROM il_room_deposit_history
					GROUP BY depositEsntlId
				) H2 ON H1.depositEsntlId = H2.depositEsntlId AND H1.createdAt = H2.maxCreatedAt
			) DH ON D.rdp_eid = DH.depositEsntlId
			${whereClause}
			ORDER BY 
				COALESCE(D.rdp_regist_dtm, '1970-01-01') DESC,
				R.roomNumber ASC
			LIMIT ? OFFSET ?
		`;

		// 전체 개수 조회 (메인 쿼리와 동일한 조건으로 필터링, il_room_deposit 전체 기준)
		const countWhereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

		const countQuery = `
			SELECT COUNT(*) as total
			FROM il_room_deposit D
			LEFT JOIN room R ON R.esntlId = D.rom_eid AND R.gosiwonEsntlId = D.gsw_eid
			LEFT JOIN (
				SELECT RS1.*
				FROM roomStatus RS1
				INNER JOIN (
					SELECT roomEsntlId, MAX(updatedAt) as maxUpdatedAt
					FROM roomStatus
					GROUP BY roomEsntlId
				) RS2 ON RS1.roomEsntlId = RS2.roomEsntlId AND RS1.updatedAt = RS2.maxUpdatedAt
			) RS ON R.esntlId = RS.roomEsntlId
			LEFT JOIN (
				SELECT RC1.*
				FROM roomContract RC1
				INNER JOIN (
					SELECT gosiwonEsntlId, roomEsntlId, customerEsntlId, MAX(contractDate) as maxContractDate
					FROM roomContract
					WHERE status = 'CONTRACT'
					GROUP BY gosiwonEsntlId, roomEsntlId, customerEsntlId
				) RC2 ON RC1.gosiwonEsntlId = RC2.gosiwonEsntlId AND RC1.roomEsntlId = RC2.roomEsntlId AND RC1.customerEsntlId = RC2.customerEsntlId AND RC1.contractDate = RC2.maxContractDate AND RC1.status = 'CONTRACT'
			) RC ON D.gsw_eid = RC.gosiwonEsntlId AND D.rom_eid = RC.roomEsntlId AND R.customerEsntlId = RC.customerEsntlId
			LEFT JOIN roomContractWho RCW ON RC.esntlId = RCW.contractEsntlId
			${countWhereClause}
		`;

		const offset = (parseInt(page) - 1) * parseInt(limit);
		const queryReplacements = [...replacements, parseInt(limit), offset];
		const countReplacements = [...replacements];

		const rows = await mariaDBSequelize.query(query, {
			replacements: queryReplacements,
			type: mariaDBSequelize.QueryTypes.SELECT,
		});

		const countResult = await mariaDBSequelize.query(countQuery, {
			replacements: countReplacements,
			type: mariaDBSequelize.QueryTypes.SELECT,
		});

		const total = countResult && countResult[0] ? parseInt(countResult[0].total) : 0;

		// 결과 포맷팅
		const resultList = (rows || []).map((row) => {
			return {
				depositEsntlId: row.depositEsntlId || null,
				roomEsntlId: row.roomEsntlId,
				gosiwonEsntlId: row.gosiwonEsntlId || null,
				gosiwonName: row.gosiwonName || null,
				roomNumber: row.roomNumber,
				currentOccupantName: row.currentOccupantName || null,
				currentOccupantID: row.currentOccupantID || null,
				customerBank: row.customerBank || null,
				customerBankAccount: row.customerBankAccount || null,
				refundBankAccount: (row.refundBankAccount && String(row.refundBankAccount).trim()) || null,
				checkinName: row.checkinName || null,
				checkinPhone: row.checkinPhone || null,
				contractorName: row.contractorName || null,
				contractorPhone: row.contractorPhone || null,
				depositAmount: row.depositAmount || null,
				contractEsntlId: row.contractEsntlId || null,
				moveInDate: row.moveInDate || null,
				moveOutDate: row.moveOutDate || null,
				contractStatus: row.contractStatus || null,
				depositStatus: row.depositStatus || null,
				depositLastestAmount: row.depositLastestAmount != null ? Number(row.depositLastestAmount) : null,
				depositLastestTime: row.depositLastestTime || null,
				refundStatus: row.refundStatus || null,
				refundCreatedAt: row.refundCreatedAt || null,
				returnStatus: row.returnStatus || null,
				returnLastestAmount: row.returnLastestAmount != null ? Number(row.returnLastestAmount) : null,
				returnLastestTime: row.returnLastestTime || null,
			};
		});

		return errorHandler.successThrow(res, '보증금 목록 조회 성공', {
			total: total,
			page: parseInt(page),
			limit: parseInt(limit),
			data: resultList,
		});
	} catch (error) {
		next(error);
	}
};

// 보증금 환불 등록 (depositRefundRegist) - depositEsntlId 기준 il_room_deposit_history에 type=RETURN 이력만 INSERT. depositRefund 테이블 미사용
exports.createDepositRefund = async (req, res, next) => {
	const transaction = await mariaDBSequelize.transaction();
	try {
		const decodedToken = verifyAdminToken(req);

		const {
			depositEsntlId,
			amount: refundAmountBody,
			deductionAmount: deductionAmountBody,
			deductionItems,
			contractEsntlId,
			refundDate,
			accountBank,
			accountNumber,
			accountHolder,
		} = req.body;

		// 필수: depositEsntlId(il_room_deposit.rdp_eid), amount(환불 금액), deductionAmount(차감 금액, 0 가능)
		if (!depositEsntlId) {
			errorHandler.errorThrow(400, 'depositEsntlId는 필수입니다.');
		}
		const refundAmount = parseInt(refundAmountBody, 10) || 0;
		const deductionAmount = parseInt(deductionAmountBody, 10) || 0;
		if (refundAmount < 0 || deductionAmount < 0) {
			errorHandler.errorThrow(400, 'amount(환불 금액)와 deductionAmount(차감 금액)는 0 이상이어야 합니다.');
		}
		if (refundAmount === 0 && deductionAmount === 0) {
			errorHandler.errorThrow(400, 'amount(환불 금액)와 deductionAmount(차감 금액) 중 하나는 0보다 커야 합니다.');
		}

		// 차감내용: memo에 JSON 배열로 저장. deductionItems가 있으면 합계가 deductionAmount와 일치하는지 검증
		let memoJson = null;
		if (deductionItems && Array.isArray(deductionItems) && deductionItems.length > 0) {
			const validated = deductionItems.map((item) => {
				const content = item.content != null ? String(item.content).trim() : '';
				const amt = parseInt(item.amount, 10) || 0;
				return { content, amount: amt };
			});
			const sumDeduction = validated.reduce((s, i) => s + i.amount, 0);
			if (deductionAmount > 0 && sumDeduction !== deductionAmount) {
				errorHandler.errorThrow(
					400,
					`deductionItems의 amount 합계(${sumDeduction})와 deductionAmount(${deductionAmount})가 일치해야 합니다.`
				);
			}
			memoJson = JSON.stringify(validated);
		}

		// il_room_deposit 조회 (목표 금액 = 보증금 금액)
		const deposit = await ilRoomDeposit.findOne({
			where: { esntlId: depositEsntlId, deleteDtm: null },
			transaction,
		});
		if (!deposit) {
			errorHandler.errorThrow(404, '보증금 정보를 찾을 수 없습니다.');
		}
		if (!deposit.roomEsntlId) {
			errorHandler.errorThrow(400, '보증금에 방 정보가 없어 환불 이력을 등록할 수 없습니다.');
		}
		const targetAmount = Number(deposit.amount) || 0;

		// 기존 RETURN 이력의 (amount + deductionAmount) 합계
		const [sumResult] = await mariaDBSequelize.query(
			`SELECT COALESCE(SUM(amount + COALESCE(deductionAmount, 0)), 0) AS total
			 FROM il_room_deposit_history
			 WHERE depositEsntlId = ? AND type = 'RETURN' AND status IN ('COMPLETED', 'PARTIAL', 'RETURN_COMPLETED')`,
			{
				replacements: [depositEsntlId],
				type: mariaDBSequelize.QueryTypes.SELECT,
				transaction,
			}
		);
		const existingReturnSum = parseInt(sumResult?.total || 0, 10);
		const thisReturnTotal = refundAmount + deductionAmount;
		const totalAfter = existingReturnSum + thisReturnTotal;

		if (targetAmount > 0 && totalAfter > targetAmount) {
			errorHandler.errorThrow(
				400,
				`환불+차감 합계가 보증금 금액을 초과합니다. (보증금: ${targetAmount.toLocaleString()}, 기존 반환 합계: ${existingReturnSum.toLocaleString()}, 이번 환불+차감: ${thisReturnTotal.toLocaleString()}, 최대 가능: ${(targetAmount - existingReturnSum).toLocaleString()})`
			);
		}

		// status: 환불+차감 합계가 il_room_deposit 금액과 동일하면 COMPLETED, 아니면 PARTIAL (보증금 등록과 동일)
		const status =
			targetAmount <= 0 || totalAfter >= targetAmount ? 'COMPLETED' : 'PARTIAL';

		const historyId = await generateIlRoomDepositHistoryId(transaction);
		await ilRoomDepositHistory.create(
			{
				esntlId: historyId,
				depositEsntlId,
				roomEsntlId: deposit.roomEsntlId,
				contractEsntlId: contractEsntlId || null,
				type: 'RETURN',
				amount: refundAmount,
				deductionAmount,
				refundAmount: refundAmount,
				status,
				memo: memoJson,
				refundDate: refundDate || mariaDBSequelize.literal('CURRENT_TIMESTAMP'),
				accountBank: accountBank || null,
				accountNumber: accountNumber || null,
				accountHolder: accountHolder || null,
				manager: decodedToken.admin?.name || '관리자',
			},
			{ transaction }
		);

		// 전액 반환 완료 시 il_room_deposit.rdp_return_dtm 갱신
		if (status === 'COMPLETED' && targetAmount > 0) {
			await ilRoomDeposit.update(
				{
					returnDtm: mariaDBSequelize.literal('CURRENT_TIMESTAMP'),
					updateDtm: mariaDBSequelize.literal('CURRENT_TIMESTAMP'),
					updaterId: getWriterAdminId(decodedToken),
				},
				{ where: { esntlId: depositEsntlId }, transaction }
			);
		}

		await transaction.commit();

		return errorHandler.successThrow(res, '보증금 환불 등록 성공', {
			depositEsntlId,
			historyId,
			amount: refundAmount,
			deductionAmount,
			status,
			totalReturnedAfter: totalAfter,
		});
	} catch (error) {
		await transaction.rollback();
		next(error);
	}
};

