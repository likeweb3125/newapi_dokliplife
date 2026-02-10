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
				{
					model: customer,
					as: 'customer',
					attributes: ['esntlId', 'name', 'phone'],
					required: false,
				},
				{
					model: customer,
					as: 'contractor',
					attributes: ['esntlId', 'name', 'phone'],
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

// 보증금 등록
exports.createDeposit = async (req, res, next) => {
	const transaction = await mariaDBSequelize.transaction();
	try {
		const decodedToken = verifyAdminToken(req);
		const registrantId = decodedToken.admin || decodedToken.partner;

		const {
			roomEsntlId,
			gosiwonEsntlId,
			customerEsntlId,
			contractorEsntlId,
			contractEsntlId,
			amount,
			reservationDepositAmount, // 하위 호환성
			depositAmount, // 하위 호환성
			accountBank,
			accountNumber,
			accountHolder,
			expectedOccupantName,
			expectedOccupantPhone,
			moveInDate,
			moveOutDate,
			contractStatus,
			virtualAccountNumber,
			virtualAccountExpiryDate,
			depositDate,
			depositorName,
			depositorPhone,
		} = req.body;

		// type은 DEPOSIT으로 고정
		const type = 'DEPOSIT';

		if (!roomEsntlId || !gosiwonEsntlId) {
			errorHandler.errorThrow(400, 'roomEsntlId와 gosiwonEsntlId는 필수입니다.');
		}

		// amount가 없으면 하위 호환성을 위해 기존 필드에서 가져오기
		let finalAmount = amount;
		if (!finalAmount || finalAmount === 0) {
			if (depositAmount) {
				finalAmount = depositAmount;
			} else if (reservationDepositAmount) {
				finalAmount = reservationDepositAmount;
			} else {
				finalAmount = 0;
			}
		}

		if (!finalAmount || finalAmount <= 0) {
			errorHandler.errorThrow(400, 'amount는 0보다 큰 값이어야 합니다.');
		}

		// il_room_deposit에 저장할 이름/전화번호 (rdp_customer_name, rdp_customer_phone)
		const customerNameForDeposit = (depositorName || expectedOccupantName || '').trim() || null;
		const customerPhoneForDeposit = (depositorPhone || expectedOccupantPhone || '').trim() || null;

		// 같은 고시원·방·이름·전화번호로 이미 미삭제 레코드가 있으면 금액(rdp_price)만 업데이트
		const existingDeposit = await ilRoomDeposit.findOne({
			where: {
				gosiwonEsntlId,
				roomEsntlId,
				customerName: customerNameForDeposit,
				customerPhone: customerPhoneForDeposit,
				deleteDtm: null,
			},
			transaction,
		});

		if (existingDeposit) {
			await ilRoomDeposit.update(
				{
					amount: finalAmount,
					updateDtm: mariaDBSequelize.literal('NOW()'),
					updaterId: registrantId,
				},
				{
					where: { esntlId: existingDeposit.esntlId },
					transaction,
				}
			);
			await transaction.commit();
			return errorHandler.successThrow(res, '보증금 등록 성공', {
				esntlId: existingDeposit.esntlId,
				updated: true,
				receiver: customerPhoneForDeposit || undefined,
			});
		}

		// 방 존재 여부 확인
		const roomInfo = await room.findOne({
			where: { esntlId: roomEsntlId },
			transaction,
		});

		if (!roomInfo) {
			errorHandler.errorThrow(404, '방 정보를 찾을 수 없습니다.');
		}

		// 고시원 존재 여부 확인
		const gosiwonInfo = await gosiwon.findOne({
			where: { esntlId: gosiwonEsntlId },
			transaction,
		});

		if (!gosiwonInfo) {
			errorHandler.errorThrow(404, '고시원 정보를 찾을 수 없습니다.');
		}

		// customerEsntlId 존재 여부 확인 (값이 있는 경우만)
		let finalCustomerEsntlId = null;
		if (customerEsntlId) {
			const customerInfo = await customer.findOne({
				where: { esntlId: customerEsntlId },
				transaction,
			});
			if (!customerInfo) {
				errorHandler.errorThrow(404, '예약자/입실자 정보를 찾을 수 없습니다.');
			}
			finalCustomerEsntlId = customerEsntlId;
		}

		// contractorEsntlId 존재 여부 확인 (값이 있는 경우만)
		let finalContractorEsntlId = null;
		if (contractorEsntlId) {
			const contractorInfo = await customer.findOne({
				where: { esntlId: contractorEsntlId },
				transaction,
			});
			if (!contractorInfo) {
				errorHandler.errorThrow(404, '계약자 정보를 찾을 수 없습니다.');
			}
			finalContractorEsntlId = contractorEsntlId;
		}

		const esntlId = await generateIlRoomDepositId(transaction);

		// 돈이 들어온 뒤 확정 입력이므로 COMPLETED로 등록 (completedDtm: 한국 시간 NOW() 또는 입금일)
		const completedDtm = depositDate ? new Date(depositDate) : mariaDBSequelize.literal('NOW()');

		const newDeposit = await ilRoomDeposit.create(
			{
				esntlId,
				roomEsntlId,
				gosiwonEsntlId,
				customerName: customerNameForDeposit,
				customerPhone: customerPhoneForDeposit,
				customerEsntlId: finalCustomerEsntlId,
				contractorEsntlId: finalContractorEsntlId,
				contractEsntlId: contractEsntlId || null,
				amount: finalAmount,
				paidAmount: 0,
				unpaidAmount: finalAmount,
				accountBank: accountBank || null,
				accountNumber: accountNumber || null,
				accountHolder: accountHolder || null,
				status: 'PENDING',
				depositDate: depositDate || null,
				depositorName: depositorName || null,
				depositorPhone: depositorPhone || null,
				virtualAccountNumber: virtualAccountNumber || null,
				virtualAccountExpiryDate: virtualAccountExpiryDate || null,
				deleteYN: 'N',
				registrantId,
				updaterId: registrantId,
				completedDtm,
			},
			{ transaction }
		);

		// 계약서 보증금 대비 납입 합계로 PARTIAL/COMPLETED 및 미납액 결정
		const { depositStatus, unpaidAmount } = await resolveDepositHistoryStatus(
			roomEsntlId,
			contractEsntlId || null,
			finalAmount,
			transaction
		);

		// 입금 확정 이력 생성 (il_room_deposit_history) - RDPH prefix, unpaidAmount = 계약 보증금 - 입금 합계
		const historyId = await generateIlRoomDepositHistoryId(transaction);
		await ilRoomDepositHistory.create(
			{
				esntlId: historyId,
				depositEsntlId: esntlId,
				roomEsntlId: roomEsntlId,
				contractEsntlId: contractEsntlId || null,
				type: 'DEPOSIT',
				amount: finalAmount,
				status: depositStatus,
				unpaidAmount,
				depositorName: depositorName || null,
				depositDate: depositDate || null,
				manager: '시스템',
			},
			{ transaction }
		);

		await transaction.commit();

		return errorHandler.successThrow(res, '보증금 등록 성공', {
			esntlId: newDeposit.esntlId,
			receiver: customerPhoneForDeposit || undefined,
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

// 보증금 삭제
exports.deleteDeposit = async (req, res, next) => {
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

		// 1. 입금일자, 입금자, 납입금액을 받는다. (type은 RESERVATION 고정, contractEsntlId는 선택)
		const {
			depositDate,
			depositorName,
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

		// 계약서(방) 보증금 대비 납입 합계로 PARTIAL/COMPLETED 및 미납액 결정
		const { depositStatus, unpaidAmount } = await resolveDepositHistoryStatus(
			finalRoomEsntlId,
			finalContractEsntlId,
			paidAmountInt,
			transaction
		);

		const managerId = getWriterAdminId(decodedToken);
		const newDepositId = await generateIlRoomDepositId(transaction);

		const finalAmount = depositAmountValue;

		// il_room_deposit 메인 레코드 생성 (예약금 입력 = 보증금으로 등록)
		await ilRoomDeposit.create(
			{
				esntlId: newDepositId,
				roomEsntlId: finalRoomEsntlId,
				gosiwonEsntlId: finalGosiwonEsntlId,
				customerEsntlId: customerEsntlId,
				contractorEsntlId: contractorEsntlId,
				contractEsntlId: finalContractEsntlId,
				amount: finalAmount,
				paidAmount: 0,
				unpaidAmount: 0,
				accountBank: null,
				accountNumber: null,
				accountHolder: null,
				status: depositStatus,
				manager: managerId,
				depositDate: depositDate,
				depositorName: depositorName || null,
				depositorPhone: null,
				virtualAccountNumber: null,
				virtualAccountExpiryDate: null,
				deleteYN: 'N',
			},
			{ transaction }
		);

		// 입금 이력 생성 (il_room_deposit_history) - unpaidAmount = 계약 보증금 - 입금 합계
		const historyId = await generateIlRoomDepositHistoryId(transaction);
		await ilRoomDepositHistory.create(
			{
				esntlId: historyId,
				depositEsntlId: newDepositId,
				roomEsntlId: finalRoomEsntlId,
				contractEsntlId: finalContractEsntlId,
				type: 'DEPOSIT',
				amount: paidAmountInt,
				status: depositStatus,
				unpaidAmount,
				depositorName: depositorName || null,
				depositDate: depositDate,
				manager: decodedToken.admin?.name || '관리자',
			},
			{ transaction }
		);

		await transaction.commit();

		return errorHandler.successThrow(res, '입금 등록 성공', {
			depositEsntlId: newDepositId,
			historyId: historyId,
			status: depositStatus,
			paidAmount: paidAmountInt,
			unpaidAmount: 0,
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

		// 시간 형식을 서울 시간(+9) 기준으로 변환하는 헬퍼 함수
		const formatToSeoulTime = (dateValue) => {
			if (!dateValue) return null;
			const date = new Date(dateValue);
			// UTC 시간에 9시간 추가 (서울 시간)
			const seoulTime = new Date(date.getTime() + 9 * 60 * 60 * 1000);
			const year = seoulTime.getUTCFullYear();
			const month = String(seoulTime.getUTCMonth() + 1).padStart(2, '0');
			const day = String(seoulTime.getUTCDate()).padStart(2, '0');
			const hours = String(seoulTime.getUTCHours()).padStart(2, '0');
			const minutes = String(seoulTime.getUTCMinutes()).padStart(2, '0');
			return `${year}-${month}-${day} ${hours}:${minutes}`;
		};

		// 시간 형식을 서울 시간(+9) 기준으로 변환 및 contractEsntlId 교체
		const formattedRows = rows.map((row) => {
			const rowData = row.toJSON();
			if (rowData.createdAt) {
				rowData.createdAt = formatToSeoulTime(rowData.createdAt);
			}
			if (rowData.updatedAt) {
				rowData.updatedAt = formatToSeoulTime(rowData.updatedAt);
			}
			if (rowData.depositDate) {
				rowData.depositDate = formatToSeoulTime(rowData.depositDate);
			}
			if (rowData.refundDate) {
				rowData.refundDate = formatToSeoulTime(rowData.refundDate);
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
				DATE(DATE_ADD(D.rdp_regist_dtm, INTERVAL 9 HOUR)) as recordDate,
				DATE_FORMAT(DATE_ADD(D.rdp_regist_dtm, INTERVAL 9 HOUR), '%H:%i') as recordTime
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

		// 시간 형식을 서울 시간(+9) 기준으로 변환하는 헬퍼 함수
		const formatToSeoulTime = (dateValue) => {
			if (!dateValue) return null;
			const date = new Date(dateValue);
			// UTC 시간에 9시간 추가 (서울 시간)
			const seoulTime = new Date(date.getTime() + 9 * 60 * 60 * 1000);
			const year = seoulTime.getUTCFullYear();
			const month = String(seoulTime.getUTCMonth() + 1).padStart(2, '0');
			const day = String(seoulTime.getUTCDate()).padStart(2, '0');
			const hours = String(seoulTime.getUTCHours()).padStart(2, '0');
			const minutes = String(seoulTime.getUTCMinutes()).padStart(2, '0');
			return `${year}-${month}-${day} ${hours}:${minutes}`;
		};

		// 시간 형식을 서울 시간(+9) 기준으로 변환
		const formattedRows = rows.map((row) => {
			const rowData = row.toJSON();
			if (rowData.createdAt) {
				rowData.createdAt = formatToSeoulTime(rowData.createdAt);
			}
			if (rowData.updatedAt) {
				rowData.updatedAt = formatToSeoulTime(rowData.updatedAt);
			}
			if (rowData.deletedAt) {
				rowData.deletedAt = formatToSeoulTime(rowData.deletedAt);
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

		// 방별 il_room_deposit 최신 1건만 조인 (상관 서브쿼리 2개 제거 → 1회 조인으로 대체)
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
				RC.esntlId as contractEsntlId,
				RS.status as roomStatus,
				RCW.checkinName as reservationName,
				RCW.checkinPhone as reservationPhone,
				RCW.customerName as contractorName,
				RCW.customerPhone as contractorPhone,
				DATE(RC.startDate) as checkInDate,
				DATE(RC.endDate) as checkOutDate,
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
					SELECT roomEsntlId, MAX(contractDate) as maxContractDate
					FROM roomContract
					WHERE status = 'CONTRACT'
					GROUP BY roomEsntlId
				) RC2 ON RC1.roomEsntlId = RC2.roomEsntlId 
					AND RC1.contractDate = RC2.maxContractDate
					AND RC1.status = 'CONTRACT'
			) RC ON R.esntlId = RC.roomEsntlId
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
					SELECT roomEsntlId, MAX(contractDate) as maxContractDate
					FROM roomContract
					WHERE status = 'CONTRACT'
					GROUP BY roomEsntlId
				) RC2 ON RC1.roomEsntlId = RC2.roomEsntlId 
					AND RC1.contractDate = RC2.maxContractDate
					AND RC1.status = 'CONTRACT'
			) RC ON R.esntlId = RC.roomEsntlId
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
					DATE(DATE_ADD(D.rdp_regist_dtm, INTERVAL 9 HOUR)) as recordDate,
					DATE_FORMAT(DATE_ADD(D.rdp_regist_dtm, INTERVAL 9 HOUR), '%H:%i') as recordTime
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

		// contractEsntlId 필터 처리 (값이 있으면 WHERE 절에 추가)
		if (contractEsntlId) {
			const contractEsntlIdValue = String(contractEsntlId).trim();
			if (contractEsntlIdValue) {
				whereConditions.push('RC.esntlId = ?');
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

		// il_room_deposit 주테이블 (모든 보증금 행 기준, 최신순 정렬)
		const query = `
			SELECT
				D.rdp_eid as depositEsntlId,
				R.esntlId as roomEsntlId,
				R.roomNumber,
				R.gosiwonEsntlId,
				G.name as gosiwonName,
				C.name as currentOccupantName,
				R.customerEsntlId as currentOccupantID,
				C.bank as customerBank,
				C.bankAccount as customerBankAccount,
				RCW.checkinName AS checkinName,
				RCW.checkinPhone AS checkinPhone,
				RCW.customerName as contractorName,
				RCW.customerPhone as contractorPhone,
				D.rdp_price as depositAmount,
				RC.esntlId as contractEsntlId,
				DATE(RC.startDate) as moveInDate,
				DATE(RC.endDate) as moveOutDate,
				RC.status as contractStatus,
				CASE WHEN D.rdp_completed_dtm IS NULL THEN 'PENDING' ELSE 'COMPLETED' END as depositStatus,
				D.rdp_price as depositLastestAmount,
				DATE_FORMAT(DATE_ADD(D.rdp_regist_dtm, INTERVAL 9 HOUR), '%Y-%m-%d %H:%i') as depositLastestTime,
				D.rdp_regist_dtm as depositCreatedAt,
				(
					SELECT DR.status
					FROM depositRefund DR
					WHERE DR.contractEsntlId = RC.esntlId
						AND (DR.deleteYN IS NULL OR DR.deleteYN = 'N')
					ORDER BY DR.createdAt DESC
					LIMIT 1
				) as refundStatus,
				(
					SELECT DATE_FORMAT(DATE_ADD(DR.createdAt, INTERVAL 9 HOUR), '%Y-%m-%d %H:%i')
					FROM depositRefund DR
					WHERE DR.contractEsntlId = RC.esntlId
						AND (DR.deleteYN IS NULL OR DR.deleteYN = 'N')
					ORDER BY DR.createdAt DESC
					LIMIT 1
				) as refundCreatedAt
			FROM il_room_deposit D
			LEFT JOIN room R ON R.esntlId = D.rom_eid
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
					SELECT roomEsntlId, MAX(contractDate) as maxContractDate
					FROM roomContract
					WHERE status = 'CONTRACT'
					GROUP BY roomEsntlId
				) RC2 ON RC1.roomEsntlId = RC2.roomEsntlId AND RC1.contractDate = RC2.maxContractDate AND RC1.status = 'CONTRACT'
			) RC ON R.esntlId = RC.roomEsntlId
			LEFT JOIN roomContractWho RCW ON RC.esntlId = RCW.contractEsntlId
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
			LEFT JOIN room R ON R.esntlId = D.rom_eid
			LEFT JOIN (
				SELECT RC1.*
				FROM roomContract RC1
				INNER JOIN (
					SELECT roomEsntlId, MAX(contractDate) as maxContractDate
					FROM roomContract
					WHERE status = 'CONTRACT'
					GROUP BY roomEsntlId
				) RC2 ON RC1.roomEsntlId = RC2.roomEsntlId AND RC1.contractDate = RC2.maxContractDate AND RC1.status = 'CONTRACT'
			) RC ON R.esntlId = RC.roomEsntlId
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
				depositLastestAmount: row.depositLastestAmount || null,
				depositLastestTime: row.depositLastestTime || null,
				refundStatus: row.refundStatus || null,
				refundCreatedAt: row.refundCreatedAt || null,
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

// 보증금 환불 등록
exports.createDepositRefund = async (req, res, next) => {
	const transaction = await mariaDBSequelize.transaction();
	try {
		const decodedToken = verifyAdminToken(req);

		const {
			contractEsntlId,
			bank,
			bankAccount,
			accountHolder,
			refundItems,
			totalDepositAmount,
			refundAmount,
		} = req.body;

		// 필수 항목 검증
		if (!contractEsntlId) {
			errorHandler.errorThrow(400, 'contractEsntlId는 필수입니다.');
		}

		if (!refundItems || !Array.isArray(refundItems) || refundItems.length === 0) {
			errorHandler.errorThrow(400, 'refundItems는 배열 형식이며 필수입니다.');
		}

		if (totalDepositAmount === undefined || totalDepositAmount === null) {
			errorHandler.errorThrow(400, 'totalDepositAmount는 필수입니다.');
		}

		if (refundAmount === undefined || refundAmount === null) {
			errorHandler.errorThrow(400, 'refundAmount는 필수입니다.');
		}

		// 계약서 존재 확인 및 roomEsntlId 조회
		const contractQuery = `
			SELECT esntlId, roomEsntlId
			FROM roomContract
			WHERE esntlId = ?
			LIMIT 1
		`;

		const [contractResult] = await mariaDBSequelize.query(contractQuery, {
			replacements: [contractEsntlId],
			type: mariaDBSequelize.QueryTypes.SELECT,
			transaction,
		});

		if (!contractResult) {
			errorHandler.errorThrow(404, '계약서 정보를 찾을 수 없습니다.');
		}

		const roomEsntlId = contractResult.roomEsntlId || null;

		// 기존 refundAmount 합계 및 COMPLETED 상태 확인 (같은 contractEsntlId의 모든 depositRefund 레코드)
		const existingRefundQuery = `
			SELECT 
				COALESCE(SUM(refundAmount), 0) as totalRefundSum,
				COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completedCount
			FROM depositRefund
			WHERE contractEsntlId = ?
				AND (deleteYN IS NULL OR deleteYN = 'N')
		`;

		const [existingRefundResult] = await mariaDBSequelize.query(existingRefundQuery, {
			replacements: [contractEsntlId],
			type: mariaDBSequelize.QueryTypes.SELECT,
			transaction,
		});

		const existingRefundSum = parseInt(existingRefundResult?.totalRefundSum || 0);
		const completedCount = parseInt(existingRefundResult?.completedCount || 0);
		const newRefundAmount = parseInt(refundAmount);
		const totalDepositAmountInt = parseInt(totalDepositAmount);

		// 기존 레코드 중 status가 COMPLETED인 것이 있으면 에러
		if (completedCount > 0) {
			errorHandler.errorThrow(400, '이미 완료된 환불이 존재합니다. (status: COMPLETED)');
		}

		// 새 레코드의 remainAmount 계산: totalDepositAmount - (기존 refundAmount 합계 + 새로 입력한 refundAmount)
		const remainAmount = totalDepositAmountInt - existingRefundSum - newRefundAmount;

		// remainAmount가 0보다 작으면 (refundAmount가 remainAmount보다 크면) 에러
		if (remainAmount < 0) {
			errorHandler.errorThrow(
				400,
				`환불 금액이 잔여 금액을 초과합니다. (전체 예약금: ${totalDepositAmountInt.toLocaleString()}, 기존 환불액 합계: ${existingRefundSum.toLocaleString()}, 최대 가능 환불액: ${(totalDepositAmountInt - existingRefundSum).toLocaleString()})`
			);
		}

		// remainAmount가 0 이하면 0으로 설정 (음수 방지)
		const finalRemainAmount = Math.max(0, remainAmount);

		// status 자동 계산: remainAmount가 0이면 COMPLETED, 그 외에는 PARTIAL
		const status = finalRemainAmount === 0 ? 'COMPLETED' : 'PARTIAL';

		// 환불 항목 검증 (JSON 형식으로 저장할 데이터)
		const validatedRefundItems = refundItems.map((item) => {
			if (!item.content || item.amount === undefined || item.amount === null) {
				errorHandler.errorThrow(400, 'refundItems의 각 항목은 content와 amount가 필수입니다.');
			}
			return {
				content: item.content,
				amount: parseInt(item.amount),
			};
		});

		// refundItems의 amount 합계 계산
		const refundItemsSum = validatedRefundItems.reduce((sum, item) => sum + item.amount, 0);

		// refundItems의 amount 합계가 refundAmount와 같지 않으면 에러
		if (refundItemsSum !== newRefundAmount) {
			errorHandler.errorThrow(
				400,
				`refundItems의 amount 합계(${refundItemsSum.toLocaleString()})와 refundAmount(${newRefundAmount.toLocaleString()})가 일치하지 않습니다.`
			);
		}

		// 작성자 ID 자동 저장
		const managerId = getWriterAdminId(decodedToken);

		// ID 생성
		const esntlId = await generateDepositRefundId(transaction);

		// depositRefund 레코드 생성 (새 레코드의 remainAmount만 계산하여 저장)
		const newDepositRefund = await depositRefund.create(
			{
				esntlId,
				contractEsntlId,
				roomEsntlId: roomEsntlId || null,
				bank: bank || null,
				bankAccount: bankAccount || null,
				accountHolder: accountHolder || null,
				refundItems: JSON.stringify(validatedRefundItems),
				totalDepositAmount: totalDepositAmountInt,
				refundAmount: newRefundAmount,
				remainAmount: finalRemainAmount,
				status,
				manager: managerId,
				deleteYN: 'N',
			},
			{ transaction }
		);

		await transaction.commit();

		return errorHandler.successThrow(res, '보증금 환불 등록 성공', {
			depositRefundEsntlId: esntlId,
			contractEsntlId,
			status,
			totalDepositAmount: totalDepositAmountInt,
			refundAmount: newRefundAmount,
			remainAmount: finalRemainAmount,
		});
	} catch (error) {
		await transaction.rollback();
		next(error);
	}
};

