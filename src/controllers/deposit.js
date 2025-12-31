const { Op } = require('sequelize');
const {
	deposit,
	depositHistory,
	depositDeduction,
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
			(depositInfo.amount ||
				depositInfo.reservationDepositAmount ||
				depositInfo.depositAmount) -
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
			type, // RESERVATION 또는 DEPOSIT
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

		if (!roomEsntlId || !gosiwonEsntlId) {
			errorHandler.errorThrow(400, 'roomEsntlId와 gosiwonEsntlId는 필수입니다.');
		}

		// type과 amount 검증
		if (!type || !['RESERVATION', 'DEPOSIT'].includes(type)) {
			errorHandler.errorThrow(400, 'type은 RESERVATION 또는 DEPOSIT이어야 합니다.');
		}

		// amount가 없으면 하위 호환성을 위해 기존 필드에서 가져오기
		let finalAmount = amount;
		if (!finalAmount || finalAmount === 0) {
			if (type === 'RESERVATION' && reservationDepositAmount) {
				finalAmount = reservationDepositAmount;
			} else if (type === 'DEPOSIT' && depositAmount) {
				finalAmount = depositAmount;
			} else if (reservationDepositAmount) {
				finalAmount = reservationDepositAmount;
			} else if (depositAmount) {
				finalAmount = depositAmount;
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
		// type이 RESERVATION인 경우는 아직 customer가 등록되지 않았을 수 있으므로 null로 저장
		let finalCustomerEsntlId = null;
		if (customerEsntlId && type !== 'RESERVATION') {
			// DEPOSIT인 경우만 customer 존재 여부 확인
			const customerInfo = await customer.findOne({
				where: { esntlId: customerEsntlId },
				transaction,
			});
			if (!customerInfo) {
				errorHandler.errorThrow(404, '예약자/입실자 정보를 찾을 수 없습니다.');
			}
			finalCustomerEsntlId = customerEsntlId;
		}
		// type이 RESERVATION인 경우는 customerEsntlId를 null로 저장 (외래키 제약조건 회피)
		// 입실예정자 정보는 expectedOccupantName, expectedOccupantPhone에 저장됨

		// contractorEsntlId 존재 여부 확인 (값이 있는 경우만)
		// type이 RESERVATION인 경우는 아직 customer가 등록되지 않았을 수 있으므로 null로 저장
		let finalContractorEsntlId = null;
		if (contractorEsntlId && type !== 'RESERVATION') {
			// DEPOSIT인 경우만 customer 존재 여부 확인
			const contractorInfo = await customer.findOne({
				where: { esntlId: contractorEsntlId },
				transaction,
			});
			if (!contractorInfo) {
				errorHandler.errorThrow(404, '계약자 정보를 찾을 수 없습니다.');
			}
			finalContractorEsntlId = contractorEsntlId;
		}
		// type이 RESERVATION인 경우는 contractorEsntlId를 null로 저장 (외래키 제약조건 회피)

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
				reservationDepositAmount: type === 'RESERVATION' ? finalAmount : (reservationDepositAmount || 0),
				depositAmount: type === 'DEPOSIT' ? finalAmount : (depositAmount || 0),
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
			} else {
				updateData.depositAmount = amount;
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
		if (depositAmount !== undefined && depositAmount !== depositInfo.depositAmount) {
			updateData.depositAmount = depositAmount;
			if (!updateData.amount && depositInfo.type === 'DEPOSIT') {
				updateData.amount = depositAmount;
			}
			changes.push(`보증금: ${depositInfo.depositAmount || 0}원 → ${depositAmount}원`);
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

// 입금 등록
exports.registerDeposit = async (req, res, next) => {
	const transaction = await mariaDBSequelize.transaction();
	try {
		const decodedToken = verifyAdminToken(req);

		// 1. 입금일자, 입금자, 납입금액, 계약서 id를 받는다.
		const { depositDate, depositorName, paidAmount, contractEsntlId } = req.body;

		if (!depositDate || !paidAmount || !contractEsntlId) {
			errorHandler.errorThrow(
				400,
				'depositDate, paidAmount, contractEsntlId는 필수입니다.'
			);
		}

		// 2. 받은 정보중 계약서id로 고시원, 방, id를 확인하다.
		const contractInfo = await mariaDBSequelize.query(
			`
			SELECT 
				RC.esntlId as contractEsntlId,
				RC.gosiwonEsntlId,
				RC.roomEsntlId
			FROM roomContract RC
			WHERE RC.esntlId = ?
			LIMIT 1
			`,
			{
				replacements: [contractEsntlId],
				type: mariaDBSequelize.QueryTypes.SELECT,
				transaction,
			}
		);

		if (!contractInfo || contractInfo.length === 0) {
			errorHandler.errorThrow(404, '계약서 정보를 찾을 수 없습니다.');
		}

		const { gosiwonEsntlId, roomEsntlId } = contractInfo[0];

		// 3. deposit 테이블에 같은 계약서 id로 기존에 등록된 보증금 정보를 조회한다.
		const existingDeposit = await deposit.findOne({
			where: {
				contractEsntlId: contractEsntlId,
				deleteYN: { [Op.or]: [null, 'N'] },
			},
			order: [['createdAt', 'DESC']],
			transaction,
		});

		if (!existingDeposit) {
			errorHandler.errorThrow(404, '해당 계약서에 등록된 보증금 정보를 찾을 수 없습니다.');
		}

		const depositAmount = existingDeposit.depositAmount || existingDeposit.amount || 0;
		const paidAmountInt = parseInt(paidAmount);

		// 같은 계약서 ID의 모든 deposit 레코드에서 paidAmount 합계 계산
		const allDepositsForContract = await deposit.findAll({
			where: {
				contractEsntlId: contractEsntlId,
				deleteYN: { [Op.or]: [null, 'N'] },
			},
			attributes: ['paidAmount'],
			transaction,
		});

		const totalPaidAmount = allDepositsForContract.reduce((sum, d) => {
			return sum + (parseInt(d.paidAmount) || 0);
		}, 0);

		const currentTotalPaid = totalPaidAmount + paidAmountInt;

		// paidAmount의 합계가 depositAmount보다 클 수 없음
		if (currentTotalPaid > depositAmount) {
			errorHandler.errorThrow(
				400,
				`입금액 합계(${currentTotalPaid}원)가 보증금액(${depositAmount}원)을 초과할 수 없습니다.`
			);
		}

		// 5. paidAmount 들의 합과 depositAmount의 차액이 존재한다면 unpaidAmount에 차액을 저장한다.
		const unpaidAmount = depositAmount > currentTotalPaid ? depositAmount - currentTotalPaid : 0;

		// 4, 6. 상태 결정
		// 기존 depositAmount에 비해 납입금액이 작으면 PARTIAL
		// 기존 depositAmount에 비해 납입금액이 같거나, paidAmount 들의 합과 depositAmount의 차액이 없으면 COMPLETED
		let newStatus = 'PARTIAL';
		if (currentTotalPaid >= depositAmount || unpaidAmount === 0) {
			newStatus = 'COMPLETED';
		}

		// 새로운 deposit 레코드 생성 (기존 값을 수정하는게 아니라 추가)
		const newDepositId = await generateDepositId(transaction);
		const newDeposit = await deposit.create(
			{
				esntlId: newDepositId,
				roomEsntlId: roomEsntlId,
				gosiwonEsntlId: gosiwonEsntlId,
				customerEsntlId: existingDeposit.customerEsntlId || null,
				contractorEsntlId: existingDeposit.contractorEsntlId || null,
				contractEsntlId: contractEsntlId,
				amount: depositAmount,
				depositAmount: depositAmount,
				paidAmount: paidAmountInt,
				unpaidAmount: unpaidAmount,
				accountBank: existingDeposit.accountBank || null,
				accountNumber: existingDeposit.accountNumber || null,
				accountHolder: existingDeposit.accountHolder || null,
				status: newStatus,
				depositDate: depositDate,
				depositorName: depositorName || null,
				virtualAccountNumber: existingDeposit.virtualAccountNumber || null,
				virtualAccountExpiryDate: existingDeposit.virtualAccountExpiryDate || null,
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
				roomEsntlId: roomEsntlId,
				contractEsntlId: contractEsntlId,
				type: 'DEPOSIT',
				amount: paidAmountInt,
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
			paidAmount: paidAmountInt,
			unpaidAmount: unpaidAmount,
		});
	} catch (error) {
		await transaction.rollback();
		next(error);
	}
};

// 반환 등록
exports.registerReturn = async (req, res, next) => {
	const transaction = await mariaDBSequelize.transaction();
	try {
		const decodedToken = verifyAdminToken(req);

		const {
			esntlId,
			roomEsntlId,
			contractEsntlId,
			refundDate,
			accountBank,
			accountNumber,
			accountHolder,
			deductions,
			refundAmount,
			manager,
		} = req.body;

		if (!esntlId || !refundDate) {
			errorHandler.errorThrow(400, 'esntlId와 refundDate는 필수입니다.');
		}

		const depositInfo = await deposit.findOne({
			where: { esntlId: esntlId },
			transaction,
		});

		if (!depositInfo) {
			errorHandler.errorThrow(404, '보증금 정보를 찾을 수 없습니다.');
		}

		// roomEsntlId는 요청 본문에서 받거나 depositInfo에서 가져옴
		const finalRoomEsntlId = roomEsntlId || depositInfo.roomEsntlId;
		if (!finalRoomEsntlId) {
			errorHandler.errorThrow(400, 'roomEsntlId는 필수입니다.');
		}
		const finalContractEsntlId = contractEsntlId || depositInfo.contractEsntlId || null;

		// 총 입금액 계산
		const totalDepositAmount = await depositHistory.sum('amount', {
			where: {
				depositEsntlId: esntlId,
				type: 'DEPOSIT',
				status: {
					[Op.in]: ['DEPOSIT_COMPLETED', 'PARTIAL_DEPOSIT'],
				},
			},
			transaction,
		});

		// 차감금액 계산
		const totalDeductionAmount =
			deductions && deductions.length > 0
				? deductions.reduce((sum, item) => sum + (item.deductionAmount || 0), 0)
				: 0;

		// 반환금액 계산 (입금액 - 차감금액)
		const calculatedRefundAmount =
			(totalDepositAmount || 0) - totalDeductionAmount;
		const finalRefundAmount = refundAmount || calculatedRefundAmount;

		// 반환 이력 생성
		const historyId = await generateDepositHistoryId(transaction);
		const returnHistory = await depositHistory.create(
			{
				esntlId: historyId,
				depositEsntlId: esntlId,
				roomEsntlId: finalRoomEsntlId, // 방 고유아이디 저장
				contractEsntlId: finalContractEsntlId,
				type: 'RETURN',
				amount: 0,
				status: 'RETURN_COMPLETED',
				deductionAmount: totalDeductionAmount,
				refundAmount: finalRefundAmount,
				accountBank: accountBank || depositInfo.accountBank || null,
				accountNumber: accountNumber || depositInfo.accountNumber || null,
				accountHolder: accountHolder || depositInfo.accountHolder || null,
				refundDate: refundDate,
				manager: manager || decodedToken.admin?.name || '관리자',
			},
			{ transaction }
		);

		// 차감 항목 등록
		if (deductions && deductions.length > 0) {
			for (const deduction of deductions) {
				const deductionId = await generateDepositDeductionId(transaction);
				await depositDeduction.create(
					{
						esntlId: deductionId,
						depositHistoryEsntlId: historyId,
						deductionName: deduction.deductionName,
						deductionAmount: deduction.deductionAmount,
					},
					{ transaction }
				);
			}
		}

		// 보증금 상태 업데이트
		await deposit.update(
			{
				status: 'RETURN_COMPLETED',
			},
			{
				where: { esntlId: esntlId },
				transaction,
			}
		);

		await transaction.commit();

		return errorHandler.successThrow(res, '반환 등록 성공', {
			historyId: historyId,
			refundAmount: finalRefundAmount,
			deductionAmount: totalDeductionAmount,
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
			roomEsntlId,
			type, // DEPOSIT | RETURN
			page = 1,
			limit = 50,
		} = req.query;

		if (!depositEsntlId && !roomEsntlId) {
			errorHandler.errorThrow(
				400,
				'depositEsntlId 또는 roomEsntlId 중 하나는 필수입니다.'
			);
		}

		const whereCondition = {};
		if (depositEsntlId) {
			whereCondition.depositEsntlId = depositEsntlId;
		}
		if (type) {
			whereCondition.type = type;
		}

		const include = [
			{
				model: deposit,
				as: 'deposit',
				attributes: [
					'esntlId',
					'roomEsntlId',
					'gosiwonEsntlId',
					'customerEsntlId',
					'contractorEsntlId',
				],
				required: !!roomEsntlId,
				where: roomEsntlId ? { roomEsntlId } : undefined,
			},
			{
				model: depositDeduction,
				as: 'deductions',
				attributes: ['esntlId', 'deductionName', 'deductionAmount'],
				required: false,
			},
		];

		const offset = (parseInt(page) - 1) * parseInt(limit);

		const { count, rows } = await depositHistory.findAndCountAll({
			where: whereCondition,
			include,
			order: [['createdAt', 'DESC']],
			limit: parseInt(limit),
			offset: offset,
		});

		return errorHandler.successThrow(res, '입금/반환 이력 조회 성공', {
			total: count,
			page: parseInt(page),
			limit: parseInt(limit),
			data: rows,
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

// 반환 이력 목록 (type 고정: RETURN)
exports.getDepositHistoryReturnList = async (req, res, next) => {
	req.query.type = 'RETURN';
	return exports.getDepositHistory(req, res, next);
};

// 계약서 쿠폰 정보 조회
exports.getContractCouponInfo = async (req, res, next) => {
	try {
		verifyAdminToken(req);

		const { contractEsntlId } = req.query;

		if (!contractEsntlId) {
			errorHandler.errorThrow(400, 'contractEsntlId를 입력해주세요.');
		}

		// roomContract에서 계약 기간 조회
		const contractQuery = `
			SELECT 
				startDate,
				endDate
			FROM roomContract
			WHERE esntlId = ?
			LIMIT 1
		`;

		const [contractResult] = await mariaDBSequelize.query(contractQuery, {
			replacements: [contractEsntlId],
			type: mariaDBSequelize.QueryTypes.SELECT,
		});

		if (!contractResult) {
			errorHandler.errorThrow(404, '계약서 정보를 찾을 수 없습니다.');
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
		};

		return errorHandler.successThrow(res, '계약서 쿠폰 정보 조회 성공', result);
	} catch (error) {
		next(error);
	}
};

// 고시원 목록 조회 (입금대기 건수 포함)
exports.getGosiwonList = async (req, res, next) => {
	try {
		verifyAdminToken(req);

		// status가 'OPERATE'인 고시원 목록과 RESERVATION, DEPOSIT 타입의 DEPOSIT_PENDING 개수를 함께 조회
		// 하나라도 카운트가 있으면 상단으로 정렬
		const gosiwonList = await mariaDBSequelize.query(
			`
			SELECT 
				esntlId,
				name,
				reservePendingCount,
				depositPendingCount
			FROM (
				SELECT 
					g.esntlId,
					g.name,
					COALESCE(SUM(CASE WHEN d.type = 'RESERVATION' AND d.status = 'DEPOSIT_PENDING' AND (d.deleteYN IS NULL OR d.deleteYN = 'N') THEN 1 ELSE 0 END), 0) as reservePendingCount,
					COALESCE(SUM(CASE WHEN d.type = 'DEPOSIT' AND d.status = 'DEPOSIT_PENDING' AND (d.deleteYN IS NULL OR d.deleteYN = 'N') THEN 1 ELSE 0 END), 0) as depositPendingCount
				FROM gosiwon g
				LEFT JOIN deposit d ON g.esntlId = d.gosiwonEsntlId
				WHERE g.status = 'OPERATE'
				GROUP BY g.esntlId, g.name
			) as gosiwonCounts
			ORDER BY (reservePendingCount + depositPendingCount) DESC, name ASC
		`,
			{
				type: mariaDBSequelize.QueryTypes.SELECT,
			}
		);

		// 결과 구성
		const result = gosiwonList.map((row) => {
			const reserveCount = parseInt(row.reservePendingCount) || 0;
			const depositCount = parseInt(row.depositPendingCount) || 0;
			return {
				esntlId: row.esntlId,
				name: row.name,
				reservePendingCount: reserveCount,
				depositPendingCount: depositCount,
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
			searchType, // gosiwonName, gosiwonCode, etc
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

		// searchType에 따른 검색 처리
		if (searchValue) {
			if (searchType === 'gosiwonName') {
				// 고시원명으로 검색
				const gosiwonList = await gosiwon.findAll({
					where: {
						name: { [Op.like]: `%${searchValue}%` },
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
			} else if (searchType === 'gosiwonCode') {
				// 고시원 코드로 검색
				whereConditions.push('R.gosiwonEsntlId = ?');
				replacements.push(searchValue);
			} else if (searchType === 'etc' || !searchType) {
				// etc인 경우: roomName, roomEsntlId, reservationName, contractName을 like 검색
				whereConditions.push(`(
					R.roomNumber LIKE ? OR
					R.esntlId LIKE ? OR
					RS.reservationName LIKE ? OR
					RS.contractorName LIKE ?
				)`);
				replacements.push(`%${searchValue}%`, `%${searchValue}%`, `%${searchValue}%`, `%${searchValue}%`);
			}
		}

		// canCheckin 필터: roomStatus.status가 CAN_CHECKIN이고 subStatus가 END가 아닌 경우
		if (canCheckin === 'true' || canCheckin === true) {
			whereConditions.push(`(
				RS.status = 'CAN_CHECKIN' AND
				(RS.subStatus IS NULL OR RS.subStatus != 'END')
			)`);
		}
		
		// reservationStatus 필터: deposit.status가 PENDING인 경우만 보기
		if (reservationStatus === 'true' || reservationStatus === true) {
			whereConditions.push(`(
				D.status = 'PENDING' AND
				(D.deleteYN IS NULL OR D.deleteYN = 'N')
			)`);
		}

		const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

		// 기본적으로 모든 방이 나와야 하므로 LEFT JOIN 사용
		// 정렬 기준: roomStatus.status가 ON_SALE이고 subStatus가 END가 아닌 경우의 statusStartDate 기준 내림차순
		// 각 방별로 해당 계약서의 마지막 deposit.status를 가져오기 위해 서브쿼리 사용
		// roomStatus가 여러 개일 경우를 처리하기 위해 서브쿼리로 최신 roomStatus만 가져옴
		const query = `
			SELECT
				R.esntlId as roomEsntlId,
				R.roomNumber,
				R.gosiwonEsntlId,
				RS.status as roomStatus,
				RS.reservationName,
				RS.contractorName,
				C.phone as contractorPhone,
				DATE(RS.statusStartDate) as moveInDate,
				DATE(RS.statusEndDate) as moveOutDate,
				CASE WHEN RS.status = 'ON_SALE' AND (RS.subStatus IS NULL OR RS.subStatus != 'END') THEN RS.statusStartDate ELSE NULL END as sortDate,
				(
					SELECT D2.status
					FROM deposit D2
					WHERE D2.contractEsntlId = RS.contractEsntlId
						AND (D2.deleteYN IS NULL OR D2.deleteYN = 'N')
					ORDER BY D2.createdAt DESC
					LIMIT 1
				) as depositStatus
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
			LEFT JOIN customer C ON RS.contractorEsntlId = C.esntlId
			LEFT JOIN deposit D ON R.esntlId = D.roomEsntlId
				AND (D.deleteYN IS NULL OR D.deleteYN = 'N')
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
			LEFT JOIN deposit D ON R.esntlId = D.roomEsntlId
				AND (D.deleteYN IS NULL OR D.deleteYN = 'N')
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
				roomEsntlId: row.roomEsntlId,
				roomNumber: row.roomNumber,
				roomStatus: row.roomStatus || null,
				reservationName: row.reservationName || null,
				contractorName: row.contractorName || null,
				contractorPhone: row.contractorPhone || null,
				moveInDate: row.moveInDate || null,
				moveOutDate: row.moveOutDate || null,
				depositStatus: row.depositStatus || null,
			};
		});

		return errorHandler.successThrow(res, '예약금 예약 목록 조회 성공', {
			total: total,
			page: parseInt(page),
			limit: parseInt(limit),
			data: resultList,
		});
	} catch (error) {
		next(error);
	}
};

