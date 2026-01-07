const { Op } = require('sequelize');
const {
	deposit,
	depositHistory,
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

const DEPOSIT_PREFIX = 'DEPO';
const DEPOSIT_PADDING = 10;
const DEPOSITHISTORY_PREFIX = 'DEHI';
const DEPOSITHISTORY_PADDING = 10;
const DEPOSITDEDUCTION_PREFIX = 'DEDU';
const DEPOSITDEDUCTION_PADDING = 10;
const DEPOSITREFUND_PREFIX = 'DERF';
const DEPOSITREFUND_PADDING = 10;

// ID 생성 함수
const generateDepositId = async (transaction) => {
	const latest = await deposit.findOne({
		attributes: ['esntlId'],
		order: [['esntlId', 'DESC']],
		transaction,
		lock: transaction ? transaction.LOCK.UPDATE : undefined,
	});

	if (!latest || !latest.esntlId) {
		return `${DEPOSIT_PREFIX}${String(1).padStart(DEPOSIT_PADDING, '0')}`;
	}

	const numberPart = parseInt(
		latest.esntlId.replace(DEPOSIT_PREFIX, ''),
		10
	);
	const nextNumber = Number.isNaN(numberPart) ? 1 : numberPart + 1;
	return `${DEPOSIT_PREFIX}${String(nextNumber).padStart(
		DEPOSIT_PADDING,
		'0'
	)}`;
};

const generateDepositHistoryId = async (transaction) => {
	const latest = await depositHistory.findOne({
		attributes: ['esntlId'],
		order: [['esntlId', 'DESC']],
		transaction,
		lock: transaction ? transaction.LOCK.UPDATE : undefined,
	});

	if (!latest || !latest.esntlId) {
		return `${DEPOSITHISTORY_PREFIX}${String(1).padStart(
			DEPOSITHISTORY_PADDING,
			'0'
		)}`;
	}

	const numberPart = parseInt(
		latest.esntlId.replace(DEPOSITHISTORY_PREFIX, ''),
		10
	);
	const nextNumber = Number.isNaN(numberPart) ? 1 : numberPart + 1;
	return `${DEPOSITHISTORY_PREFIX}${String(nextNumber).padStart(
		DEPOSITHISTORY_PADDING,
		'0'
	)}`;
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

		const depositInfo = await deposit.findOne({
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

		// 입금/반환 이력 조회
		const histories = await depositHistory.findAll({
			where: {
				depositEsntlId: esntlId,
			},
			include: [
				{
					model: depositDeduction,
					as: 'deductions',
					attributes: ['esntlId', 'deductionName', 'deductionAmount'],
					required: false,
				},
			],
			order: [['createdAt', 'DESC']],
		});

		const depositData = depositInfo.toJSON();
		depositData.histories = histories;

		// 총 입금액 계산
		const totalDepositAmount = await depositHistory.sum('amount', {
			where: {
				depositEsntlId: esntlId,
				type: 'DEPOSIT',
				status: {
					[Op.in]: ['DEPOSIT_COMPLETED', 'PARTIAL_DEPOSIT'],
				},
			},
		});

		depositData.totalDepositAmount = totalDepositAmount || 0;
		depositData.unpaidAmount = Math.max(
			0,
			(depositInfo.amount || depositInfo.depositAmount || depositInfo.reservationDepositAmount) -
				(totalDepositAmount || 0)
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
		verifyAdminToken(req);

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

		const esntlId = await generateDepositId(transaction);

		const newDeposit = await deposit.create(
			{
				esntlId,
				roomEsntlId,
				gosiwonEsntlId,
				customerEsntlId: finalCustomerEsntlId,
				contractorEsntlId: finalContractorEsntlId,
				contractEsntlId: contractEsntlId || null,
				type: type,
				amount: finalAmount,
				// 하위 호환성을 위해 기존 필드도 저장
				reservationDepositAmount: reservationDepositAmount || 0,
				accountBank: accountBank || null,
				accountNumber: accountNumber || null,
				accountHolder: accountHolder || null,
				expectedOccupantName: expectedOccupantName || null,
				expectedOccupantPhone: expectedOccupantPhone || null,
				moveInDate: moveInDate || null,
				moveOutDate: moveOutDate || null,
				contractStatus: contractStatus || null,
				status: 'DEPOSIT_PENDING',
				virtualAccountNumber: virtualAccountNumber || null,
				virtualAccountExpiryDate: virtualAccountExpiryDate || null,
				deleteYN: 'N',
			},
			{ transaction }
		);

		// 입금대기 이력 생성
		const historyId = await generateDepositHistoryId(transaction);
		await depositHistory.create(
			{
				esntlId: historyId,
				depositEsntlId: esntlId,
				roomEsntlId: roomEsntlId, // 방 고유아이디 저장
					contractEsntlId: contractEsntlId || null,
				type: 'DEPOSIT',
				amount: 0,
				status: 'DEPOSIT_PENDING',
				depositorName: null,
				manager: '시스템',
			},
			{ transaction }
		);

		await transaction.commit();

		return errorHandler.successThrow(res, '보증금 등록 성공', {
			esntlId: newDeposit.esntlId,
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

		const depositInfo = await deposit.findOne({
			where: { esntlId: esntlId },
			transaction,
		});

		if (!depositInfo) {
			errorHandler.errorThrow(404, '보증금 정보를 찾을 수 없습니다.');
		}

		const updateData = {};
		const changes = []; // 변경된 항목 추적

		if (customerEsntlId !== undefined && customerEsntlId !== depositInfo.customerEsntlId) {
			// customerEsntlId 존재 여부 확인 (값이 있는 경우만)
			// type이 RESERVATION이거나 변경하려는 type이 RESERVATION인 경우는 null로 저장
			const currentType = type !== undefined ? type : depositInfo.type;
			if (currentType === 'RESERVATION') {
				// RESERVATION인 경우 외래키 제약조건 회피를 위해 null로 저장
				updateData.customerEsntlId = null;
				changes.push(`예약자/입실자: ${depositInfo.customerEsntlId || '없음'} → 없음 (예약금은 입실예정자 정보로 관리)`);
			} else if (customerEsntlId) {
				// DEPOSIT인 경우만 customer 존재 여부 확인
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
			// contractorEsntlId 존재 여부 확인 (값이 있는 경우만)
			// type이 RESERVATION이거나 변경하려는 type이 RESERVATION인 경우는 null로 저장
			const currentType = type !== undefined ? type : depositInfo.type;
			if (currentType === 'RESERVATION') {
				// RESERVATION인 경우 외래키 제약조건 회피를 위해 null로 저장
				updateData.contractorEsntlId = null;
				changes.push(`계약자: ${depositInfo.contractorEsntlId || '없음'} → 없음 (예약금은 입실예정자 정보로 관리)`);
			} else if (contractorEsntlId) {
				// DEPOSIT인 경우만 customer 존재 여부 확인
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
		if (type !== undefined && type !== depositInfo.type) {
			if (!['RESERVATION', 'DEPOSIT'].includes(type)) {
				errorHandler.errorThrow(400, 'type은 RESERVATION 또는 DEPOSIT이어야 합니다.');
			}
			updateData.type = type;
			changes.push(`타입: ${depositInfo.type || '없음'} → ${type}`);
		}
		if (amount !== undefined && amount !== depositInfo.amount) {
			if (amount <= 0) {
				errorHandler.errorThrow(400, 'amount는 0보다 큰 값이어야 합니다.');
			}
			updateData.amount = amount;
			changes.push(`금액: ${depositInfo.amount || 0}원 → ${amount}원`);
			// 하위 호환성을 위해 기존 필드도 업데이트
			const currentType = type !== undefined ? type : depositInfo.type;
			if (currentType === 'RESERVATION') {
				updateData.reservationDepositAmount = amount;
			}
		}
		// 하위 호환성: 기존 필드로부터 업데이트
		if (reservationDepositAmount !== undefined && reservationDepositAmount !== depositInfo.reservationDepositAmount) {
			updateData.reservationDepositAmount = reservationDepositAmount;
			if (!updateData.amount && depositInfo.type === 'RESERVATION') {
				updateData.amount = reservationDepositAmount;
			}
			changes.push(`예약금: ${depositInfo.reservationDepositAmount || 0}원 → ${reservationDepositAmount}원`);
		}
		if (depositAmount !== undefined && depositAmount !== depositInfo.amount) {
				updateData.amount = depositAmount;
			changes.push(`보증금: ${depositInfo.amount || depositInfo.depositAmount || 0}원 → ${depositAmount}원`);
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
		if (expectedOccupantName !== undefined && expectedOccupantName !== depositInfo.expectedOccupantName) {
			updateData.expectedOccupantName = expectedOccupantName;
			changes.push(`입실예정자명: ${depositInfo.expectedOccupantName || '없음'} → ${expectedOccupantName || '없음'}`);
		}
		if (expectedOccupantPhone !== undefined && expectedOccupantPhone !== depositInfo.expectedOccupantPhone) {
			updateData.expectedOccupantPhone = expectedOccupantPhone;
			changes.push(`입실예정자연락처: ${depositInfo.expectedOccupantPhone || '없음'} → ${expectedOccupantPhone || '없음'}`);
		}
		if (moveInDate !== undefined && moveInDate !== depositInfo.moveInDate) {
			updateData.moveInDate = moveInDate;
			changes.push(`입실일: ${depositInfo.moveInDate || '없음'} → ${moveInDate || '없음'}`);
		}
		if (moveOutDate !== undefined && moveOutDate !== depositInfo.moveOutDate) {
			updateData.moveOutDate = moveOutDate;
			changes.push(`퇴실일: ${depositInfo.moveOutDate || '없음'} → ${moveOutDate || '없음'}`);
		}
		if (contractStatus !== undefined && contractStatus !== depositInfo.contractStatus) {
			updateData.contractStatus = contractStatus;
			changes.push(`계약상태: ${depositInfo.contractStatus || '없음'} → ${contractStatus || '없음'}`);
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
			await deposit.update(updateData, {
				where: { esntlId: esntlId },
				transaction,
			});

			// 수정 이력 생성 (메모에 변경 내용 기록)
			const historyId = await generateDepositHistoryId(transaction);
			await depositHistory.create(
				{
					esntlId: historyId,
					depositEsntlId: esntlId,
					roomEsntlId: depositInfo.roomEsntlId, // 방 고유아이디 저장
					contractEsntlId: contractEsntlId !== undefined ? contractEsntlId : depositInfo.contractEsntlId,
					type: 'DEPOSIT', // 수정은 DEPOSIT 타입으로 기록 (또는 별도 타입 추가 가능)
					amount: 0,
					status: depositInfo.status, // 현재 상태 유지
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

		const depositInfo = await deposit.findOne({
			where: { esntlId: esntlId },
			transaction,
		});

		if (!depositInfo) {
			errorHandler.errorThrow(404, '보증금 정보를 찾을 수 없습니다.');
		}

		// 보증금 삭제 처리
		const writerAdminId = getWriterAdminId(decodedToken);
		await deposit.update(
			{ 
				deleteYN: 'Y', 
				status: 'DELETED',
				deletedBy: writerAdminId,
				deletedAt: new Date(),
			},
			{
				where: { esntlId: esntlId },
				transaction,
			}
		);

		// 삭제 이력 생성
		const historyId = await generateDepositHistoryId(transaction);
		await depositHistory.create(
			{
				esntlId: historyId,
				depositEsntlId: esntlId,
				roomEsntlId: depositInfo.roomEsntlId, // 방 고유아이디 저장
					contractEsntlId: depositInfo.contractEsntlId || null,
				type: 'DEPOSIT', // 삭제는 DEPOSIT 타입으로 기록
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

// 보증금 삭제 (type=DEPOSIT만)
exports.deleteDepositOnly = async (req, res, next) => {
	const transaction = await mariaDBSequelize.transaction();
	try {
		const decodedToken = verifyAdminToken(req);

		const { esntlId } = req.query;

		if (!esntlId) {
			errorHandler.errorThrow(400, 'esntlId를 입력해주세요.');
		}

		const depositInfo = await deposit.findOne({
			where: { esntlId: esntlId },
			transaction,
		});

		if (!depositInfo) {
			errorHandler.errorThrow(404, '보증금 정보를 찾을 수 없습니다.');
		}

		// type이 DEPOSIT이 아닌 경우 오류
		if (depositInfo.type !== 'DEPOSIT') {
			errorHandler.errorThrow(400, 'type이 DEPOSIT인 보증금만 삭제할 수 있습니다.');
		}

		// 보증금 삭제 처리
		const writerAdminId = getWriterAdminId(decodedToken);
		await deposit.update(
			{ 
				deleteYN: 'Y', 
				status: 'DELETED',
				deletedBy: writerAdminId,
				deletedAt: new Date(),
			},
			{
				where: { esntlId: esntlId },
				transaction,
			}
		);

		// 삭제 이력 생성
		const historyId = await generateDepositHistoryId(transaction);
		await depositHistory.create(
			{
				esntlId: historyId,
				depositEsntlId: esntlId,
				roomEsntlId: depositInfo.roomEsntlId, // 방 고유아이디 저장
					contractEsntlId: depositInfo.contractEsntlId || null,
				type: 'DEPOSIT', // 삭제는 DEPOSIT 타입으로 기록
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

		// 1. 입금일자, 입금자, 납입금액을 받는다. (contractEsntlId는 받지 않음, type은 RESERVATION 고정)
		const { depositDate, depositorName, paidAmount, amount, roomEsntlId, gosiwonEsntlId } = req.body;

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

		// 4. contractEsntlId는 받지 않음 (예약금 등록은 계약서 없이 가능)
		const finalContractEsntlId = null;
		const finalRoomEsntlId = roomEsntlId;
		const customerEsntlId = null;
		const contractorEsntlId = null;
		const isContractEsntlIdProvided = false;

		const paidAmountInt = parseInt(inputPaidAmount);
		// contractEsntlId가 없으므로 항상 새로운 예약금으로 등록 (type: RESERVATION 고정)
		const isNewDeposit = true;
		const depositAmountValue = paidAmountInt; // depositAmountValue에 paidAmount 값 저장
		const unpaidAmount = 0; // 예약금 등록은 미납금액 없음
		const totalPaidAmount = 0;
		const currentTotalPaid = 0;
		const newStatus = 'PENDING';

		// 새로운 예약금 레코드 생성 (type: RESERVATION 고정)
		const managerId = getWriterAdminId(decodedToken);
		const newDepositId = await generateDepositId(transaction);
		
		// 예약금 등록은 depositAmountValue에만 금액 등록 (paidAmount, unpaidAmount는 모두 0)
		const finalAmount = depositAmountValue;
		const finalPaidAmount = 0;
		const finalUnpaidAmount = 0;
		
		const newDeposit = await deposit.create(
			{
				esntlId: newDepositId,
				roomEsntlId: finalRoomEsntlId,
				gosiwonEsntlId: finalGosiwonEsntlId,
				customerEsntlId: customerEsntlId,
				contractorEsntlId: contractorEsntlId,
				contractEsntlId: finalContractEsntlId,
				type: 'RESERVATION', // 고정
				amount: finalAmount,
				paidAmount: finalPaidAmount,
				unpaidAmount: finalUnpaidAmount,
				accountBank: null,
				accountNumber: null,
				accountHolder: null,
				status: newStatus,
				manager: managerId,
				depositDate: depositDate,
				depositorName: depositorName || null,
				virtualAccountNumber: null,
				virtualAccountExpiryDate: null,
				deleteYN: 'N',
			},
			{ transaction }
		);

		// 입금 이력 생성
		const historyId = await generateDepositHistoryId(transaction);
		await depositHistory.create(
			{
				esntlId: historyId,
				depositEsntlId: newDepositId,
				roomEsntlId: finalRoomEsntlId,
				contractEsntlId: finalContractEsntlId,
				type: 'DEPOSIT',
				amount: finalPaidAmount,
				status: newStatus,
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
			status: newStatus,
			paidAmount: finalPaidAmount,
			unpaidAmount: finalUnpaidAmount,
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

		const { count, rows } = await depositHistory.findAndCountAll({
			where: whereCondition,
			order: [['createdAt', 'DESC']],
			limit: parseInt(limit),
			offset: offset,
		});

		// roomStatus에서 status가 IN_USE인 contractEsntlId 조회
		const roomEsntlIds = rows.map((row) => row.roomEsntlId).filter((id) => id);
		let roomStatusMap = {};
		if (roomEsntlIds.length > 0) {
			const roomStatusQuery = `
				SELECT roomEsntlId, contractEsntlId
				FROM roomStatus
				WHERE roomEsntlId IN (:roomEsntlIds)
					AND status = 'IN_USE'
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
			// roomStatus에서 status가 IN_USE인 contractEsntlId로 교체 (없으면 null)
			if (rowData.roomEsntlId && roomStatusMap[rowData.roomEsntlId]) {
				rowData.contractEsntlId = roomStatusMap[rowData.roomEsntlId];
			} else {
				rowData.contractEsntlId = null;
			}
			return rowData;
		});

		return 		errorHandler.successThrow(res, '입금/반환 이력 조회 성공', {
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

		// 해당 방의 예약금 내역 조회 (입실일, 입실자 정보 포함, 최대 30개)
		const query = `
			SELECT 
				D.roomEsntlId,
				D.gosiwonEsntlId,
				D.status,
				D.amount,
				DATE(RC.startDate) as checkInDate,
				D.depositorName as checkinName,
				D.depositorPhone as checkinPhone,
				D.manager,
				DATE(DATE_ADD(D.createdAt, INTERVAL 9 HOUR)) as recordDate,
				DATE_FORMAT(DATE_ADD(D.createdAt, INTERVAL 9 HOUR), '%H:%i') as recordTime
			FROM deposit D
			LEFT JOIN roomContract RC ON D.contractEsntlId = RC.esntlId
			WHERE D.roomEsntlId = ?
				AND (D.deleteYN IS NULL OR D.deleteYN = 'N')
				AND D.type = 'RESERVATION'
			ORDER BY D.createdAt DESC
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
						WHEN d.contractEsntlId IS NOT NULL 
						AND NOT EXISTS (
							SELECT 1 
							FROM deposit d2 
							WHERE d2.contractEsntlId = d.contractEsntlId 
							AND d2.status = 'COMPLETED' 
							AND (d2.deleteYN IS NULL OR d2.deleteYN = 'N')
						)
						AND (d.deleteYN IS NULL OR d.deleteYN = 'N')
						THEN d.contractEsntlId 
					END) as pendingCount
			FROM gosiwon g
			LEFT JOIN deposit d ON g.esntlId = d.gosiwonEsntlId 
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

// 예약금 예약 목록 조회
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
					return errorHandler.successThrow(res, '예약금 예약 목록 조회 성공', {
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

		// searchString 검색 처리 (roomName, roomEsntlId, checkinName, customerName을 like 검색)
		if (searchValue) {
			whereConditions.push(`(
				R.roomNumber LIKE ? OR
				R.esntlId LIKE ? OR
				RC.checkinName LIKE ? OR
				RC.customerName LIKE ?
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
		
		// reservationStatus 필터: 해당 방의 가장 최근 deposit의 status가 COMPLETED가 아닌 경우만 보기
		if (reservationStatus === 'true' || reservationStatus === true) {
			whereConditions.push(`(
				(
					SELECT D4.status
					FROM deposit D4
					WHERE D4.roomEsntlId = R.esntlId
						AND (D4.deleteYN IS NULL OR D4.deleteYN = 'N')
						AND D4.type = 'RESERVATION'
					ORDER BY D4.createdAt DESC
					LIMIT 1
				) IS NOT NULL
				AND (
					SELECT D4.status
					FROM deposit D4
					WHERE D4.roomEsntlId = R.esntlId
						AND (D4.deleteYN IS NULL OR D4.deleteYN = 'N')
						AND D4.type = 'RESERVATION'
					ORDER BY D4.createdAt DESC
					LIMIT 1
				) != 'COMPLETED'
			)`);
		}

		const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

		// 기본적으로 모든 방이 나와야 하므로 LEFT JOIN 사용
		// 정렬 기준: roomStatus.status가 ON_SALE이고 subStatus가 END가 아닌 경우의 statusStartDate 기준 내림차순
		// 각 방별로 해당 계약서의 마지막 deposit.status를 가져오기 위해 서브쿼리 사용
		// roomStatus가 여러 개일 경우를 처리하기 위해 서브쿼리로 최신 roomStatus만 가져옴
		const query = `
			SELECT
				(
					SELECT CASE 
						WHEN D3.status = 'PENDING' THEN D3.esntlId
						ELSE NULL
					END
					FROM deposit D3
					WHERE D3.roomEsntlId = R.esntlId
						AND (D3.deleteYN IS NULL OR D3.deleteYN = 'N')
						AND D3.type = 'RESERVATION'
					ORDER BY D3.createdAt DESC
					LIMIT 1
				) as depositEsntlId,
				R.esntlId as roomEsntlId,
				R.roomNumber,
				R.gosiwonEsntlId,
				G.name as gosiwonName,
				RS.status as roomStatus,
				RC.checkinName as reservationName,
				RC.checkinPhone as reservationPhone,
				RC.customerName as contractorName,
				RC.customerPhone as contractorPhone,
				DATE(RC.startDate) as checkInDate,
				DATE(RC.endDate) as checkOutDate,
				CASE WHEN RS.status = 'ON_SALE' AND (RS.subStatus IS NULL OR RS.subStatus != 'END') THEN RS.statusStartDate ELSE NULL END as sortDate,
				(
					SELECT D2.status
					FROM deposit D2
					WHERE D2.roomEsntlId = R.esntlId
						AND (D2.deleteYN IS NULL OR D2.deleteYN = 'N')
						AND D2.type = 'RESERVATION'
					ORDER BY D2.createdAt DESC
					LIMIT 1
				) as depositStatus
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
			LEFT JOIN deposit D ON R.esntlId = D.roomEsntlId
				AND (D.deleteYN IS NULL OR D.deleteYN = 'N')
				AND D.type = 'RESERVATION'
			${whereClause}
			ORDER BY 
				CASE WHEN RS.status = 'ON_SALE' AND (RS.subStatus IS NULL OR RS.subStatus != 'END') THEN 0 ELSE 1 END,
				sortDate DESC, 
				R.roomNumber ASC
			LIMIT ? OFFSET ?
		`;

		// 전체 개수 조회 (메인 쿼리와 동일한 조건으로 필터링)
		const countWhereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

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
			LEFT JOIN deposit D ON R.esntlId = D.roomEsntlId
				AND (D.deleteYN IS NULL OR D.deleteYN = 'N')
				AND D.type = 'RESERVATION'
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

		// 각 방의 예약금 내역 조회 (depositor-group 데이터)
		const depositHistoryList = await Promise.all(
			resultList.map(async (room) => {
				const depositQuery = `
					SELECT 
						D.roomEsntlId,
						D.gosiwonEsntlId,
						D.status,
						D.amount,
						DATE(RC.startDate) as checkInDate,
						D.depositorName as checkinName,
						D.depositorPhone as checkinPhone,
						D.manager,
						DATE(DATE_ADD(D.createdAt, INTERVAL 9 HOUR)) as recordDate,
						DATE_FORMAT(DATE_ADD(D.createdAt, INTERVAL 9 HOUR), '%H:%i') as recordTime
					FROM deposit D
					LEFT JOIN roomContract RC ON D.contractEsntlId = RC.esntlId
					WHERE D.roomEsntlId = ?
						AND (D.deleteYN IS NULL OR D.deleteYN = 'N')
						AND D.type = 'RESERVATION'
					ORDER BY D.createdAt DESC
					LIMIT 30
				`;

				const depositRows = await mariaDBSequelize.query(depositQuery, {
					replacements: [room.roomEsntlId],
					type: mariaDBSequelize.QueryTypes.SELECT,
				});

				return depositRows.map((depositRow) => {
					return {
						roomEsntlId: depositRow.roomEsntlId,
						gosiwonEsntlId: depositRow.gosiwonEsntlId,
						content: {
							status: depositRow.status,
							amount: depositRow.amount,
							checkInDate: depositRow.checkInDate || null,
							checkinName: depositRow.checkinName || null,
							checkinPhone: depositRow.checkinPhone || null,
						},
						manager: depositRow.manager || null,
						recordDate: depositRow.recordDate || null,
						recordTime: depositRow.recordTime || null,
					};
				});
			})
		);

		// 각 방에 예약금 내역 추가
		const resultListWithHistory = resultList.map((room, index) => {
			return {
				...room,
				depositHistory: depositHistoryList[index] || [],
			};
		});

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

		// searchString 검색 처리 (roomName, roomEsntlId, checkinName, customerName을 like 검색)
		if (searchValue) {
			whereConditions.push(`(
				R.roomNumber LIKE ? OR
				R.esntlId LIKE ? OR
				RC.checkinName LIKE ? OR
				RC.customerName LIKE ?
			)`);
			replacements.push(`%${searchValue}%`, `%${searchValue}%`, `%${searchValue}%`, `%${searchValue}%`);
		}

		// disableDeleted 필터: deposit.deleteYN이 N인 경우만 보기
		if (disableDeleted === 'true' || disableDeleted === true) {
			whereConditions.push('(D.deleteYN IS NULL OR D.deleteYN = \'N\')');
		}

		// disableCompleted 필터: deposit.status가 COMPLETED인 경우 안보이게
		if (disableCompleted === 'true' || disableCompleted === true) {
			whereConditions.push('(D.status IS NULL OR D.status != \'COMPLETED\')');
		}

		const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

		// 기본적으로 모든 방이 나와야 하므로 LEFT JOIN 사용
		// 정렬: deposit.createdAt 기준 신규일자순 (DESC)
		// roomStatus는 최신 상태만 가져옴
		// deposit도 최신 것만 가져옴
		const query = `
			SELECT
				D.esntlId as depositEsntlId,
				R.esntlId as roomEsntlId,
				R.roomNumber,
				R.gosiwonEsntlId,
				C.name as currentOccupantName,
				R.customerEsntlId as currentOccupantID,
				C.bank as customerBank,
				C.bankAccount as customerBankAccount,
				RC.checkinName,
				RC.checkinPhone,
				RC.customerName as contractorName,
				RC.customerPhone as contractorPhone,
				D.amount as depositAmount,
				RC.esntlId as contractEsntlId,
				DATE(RC.startDate) as moveInDate,
				DATE(RC.endDate) as moveOutDate,
				RC.status as contractStatus,
				(
					SELECT D2.status
					FROM deposit D2
					WHERE D2.contractEsntlId = D.contractEsntlId
						AND (D2.deleteYN IS NULL OR D2.deleteYN = 'N')
						AND D2.type = 'DEPOSIT'
					ORDER BY D2.createdAt DESC
					LIMIT 1
				) as depositStatus,
				(
					SELECT D4.paidAmount
					FROM deposit D4
					WHERE D4.contractEsntlId = D.contractEsntlId
						AND (D4.deleteYN IS NULL OR D4.deleteYN = 'N')
						AND D4.type = 'DEPOSIT'
					ORDER BY D4.createdAt DESC
					LIMIT 1
				) as depositLastestAmount,
				(
					SELECT DATE_FORMAT(DATE_ADD(D5.createdAt, INTERVAL 9 HOUR), '%Y-%m-%d %H:%i')
					FROM deposit D5
					WHERE D5.contractEsntlId = D.contractEsntlId
						AND (D5.deleteYN IS NULL OR D5.deleteYN = 'N')
						AND D5.type = 'DEPOSIT'
					ORDER BY D5.createdAt DESC
					LIMIT 1
				) as depositLastestTime,
				D.createdAt as depositCreatedAt,
				(
					SELECT DR.status
					FROM depositRefund DR
					WHERE DR.contractEsntlId = D.contractEsntlId
						AND (DR.deleteYN IS NULL OR DR.deleteYN = 'N')
					ORDER BY DR.createdAt DESC
					LIMIT 1
				) as refundStatus,
				(
					SELECT DATE_FORMAT(DATE_ADD(DR.createdAt, INTERVAL 9 HOUR), '%Y-%m-%d %H:%i')
					FROM depositRefund DR
					WHERE DR.contractEsntlId = D.contractEsntlId
						AND (DR.deleteYN IS NULL OR DR.deleteYN = 'N')
					ORDER BY DR.createdAt DESC
					LIMIT 1
				) as refundCreatedAt
			FROM room R
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
				SELECT D1.*
				FROM deposit D1
				INNER JOIN (
					SELECT roomEsntlId, MAX(createdAt) as maxCreatedAt
					FROM deposit
					WHERE (deleteYN IS NULL OR deleteYN = 'N')
						AND type = 'DEPOSIT'
					GROUP BY roomEsntlId
				) D2 ON D1.roomEsntlId = D2.roomEsntlId 
					AND D1.createdAt = D2.maxCreatedAt
					AND (D1.deleteYN IS NULL OR D1.deleteYN = 'N')
					AND D1.type = 'DEPOSIT'
			) D ON R.esntlId = D.roomEsntlId
			LEFT JOIN roomContract RC ON D.contractEsntlId = RC.esntlId
			${whereClause}
			ORDER BY 
				COALESCE(D.createdAt, '1970-01-01') DESC,
				R.roomNumber ASC
			LIMIT ? OFFSET ?
		`;

		// 전체 개수 조회 (메인 쿼리와 동일한 조건으로 필터링)
		const countWhereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

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
				SELECT D1.*
				FROM deposit D1
				INNER JOIN (
					SELECT roomEsntlId, MAX(createdAt) as maxCreatedAt
					FROM deposit
					WHERE (deleteYN IS NULL OR deleteYN = 'N')
						AND type = 'DEPOSIT'
					GROUP BY roomEsntlId
				) D2 ON D1.roomEsntlId = D2.roomEsntlId 
					AND D1.createdAt = D2.maxCreatedAt
					AND (D1.deleteYN IS NULL OR D1.deleteYN = 'N')
					AND D1.type = 'DEPOSIT'
			) D ON R.esntlId = D.roomEsntlId
			LEFT JOIN roomContract RC ON D.contractEsntlId = RC.esntlId
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

