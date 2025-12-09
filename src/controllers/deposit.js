const { Op } = require('sequelize');
const {
	deposit,
	depositHistory,
	depositDeduction,
	room,
	gosiwon,
	customer,
	roomStatus,
	mariaDBSequelize,
} = require('../models');
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

// 보증금 현황 목록 조회 (고시원별)
exports.getDepositList = async (req, res, next) => {
	try {
		verifyAdminToken(req);

		const {
			gosiwonEsntlId,
			searchType, // gosiwonName | gosiwonCode | roomName | roomEsntlId | reservationName | contractName
			amount,
			status,
			contractStatus,
			hideDeleted,
			hideCompleted,
			search,
			page = 1,
			limit = 50,
		} = req.query;

		const searchValue = search ? String(search).trim() : '';

		const allowedSearchTypes = [
			'gosiwonName',
			'gosiwonCode',
			'roomName',
			'roomEsntlId',
			'reservationName',
			'contractName',
			'constractName', // 오타 대응
		];

		if (searchType && !allowedSearchTypes.includes(searchType)) {
			errorHandler.errorThrow(
				400,
				"searchType은 'gosiwonName', 'gosiwonCode', 'roomName', 'reservationName', 'contractName' 중 하나여야 합니다."
			);
		}
		if (searchType && !searchValue) {
			errorHandler.errorThrow(400, 'searchType 사용 시 search 값은 필수입니다.');
		}

		// 1. 먼저 고시원의 방 목록을 조회
		const roomWhereCondition = {};

		if (gosiwonEsntlId) {
			roomWhereCondition.gosiwonEsntlId = gosiwonEsntlId;
		}

		// 삭제 숨기기 옵션이 있을 때만 deleteYN 적용
		if (hideDeleted === 'true' || hideDeleted === true) {
			roomWhereCondition.deleteYN = 'N';
		}

		let searchMatchedGosiwon = false;

		// searchType에 따른 고시원 검색 처리
		if (
			searchValue &&
			(searchType === 'gosiwonCode' || (!searchType && /^GOSI[0-9]+$/i.test(searchValue)))
		) {
			roomWhereCondition.gosiwonEsntlId = searchValue;
			searchMatchedGosiwon = true;
		} else if (
			searchValue &&
			(searchType === 'gosiwonName' || (!searchType && !searchMatchedGosiwon))
		) {
			// 고시원명을 LIKE로 검색하여 ID 목록을 얻고 필터
			const gosiwonList = await gosiwon.findAll({
				where: {
					[Op.or]: [
						{ name: { [Op.like]: `%${searchValue}%` } },
						{ esntlId: { [Op.like]: `%${searchValue}%` } },
					],
				},
				attributes: ['esntlId'],
			});

			const gosiwonIds = gosiwonList.map((item) => item.esntlId);
			if (gosiwonIds.length > 0) {
				roomWhereCondition.gosiwonEsntlId = { [Op.in]: gosiwonIds };
				searchMatchedGosiwon = true;
			}
		}

		// roomEsntlId 직접 검색
		if (searchValue && searchType === 'roomEsntlId') {
			roomWhereCondition.esntlId = searchValue;
		}

		// 검색 조건 (방번호)
		if (
			searchValue &&
			!searchMatchedGosiwon &&
			(searchType === 'roomName' || !searchType)
		) {
			roomWhereCondition.roomNumber = {
				[Op.like]: `%${searchValue}%`,
			};
		}

		const offset = (parseInt(page) - 1) * parseInt(limit);

		// 방 목록 조회 (방 상태 포함)
		const { count: roomCount, rows: roomRows } = await room.findAndCountAll({
			where: roomWhereCondition,
			include: [
				{
					model: roomStatus,
					as: 'currentStatus',
					attributes: [
						'esntlId',
						'status',
						'customerEsntlId',
						'customerName',
						'reservationEsntlId',
						'reservationName',
						'contractorEsntlId',
						'contractorName',
						'contractStartDate',
						'contractEndDate',
					],
					required: false,
				},
			],
			order: [['orderNo', 'ASC'], ['roomNumber', 'ASC']],
			limit: parseInt(limit),
			offset: offset,
		});

		// 2. 각 방에 대한 deposit 정보 조회 및 조합
		const resultList = await Promise.all(
			roomRows.map(async (roomItem) => {
				const roomData = roomItem.toJSON();

				// deposit 조회 조건 - 기본적으로 해당 방의 모든 deposit 조회
				const depositWhereCondition = {
					roomEsntlId: roomItem.esntlId,
				};

				// hideDeleted가 true일 때만 삭제된 항목 제외
				if (hideDeleted === 'true' || hideDeleted === true) {
					depositWhereCondition.deleteYN = 'N';
				}

				// 해당 방의 deposit 정보 조회 (필터 없이 먼저 조회)
				let depositInfo = await deposit.findOne({
					where: depositWhereCondition,
					include: [
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
					order: [['createdAt', 'DESC']],
				});

				// deposit이 있고, 필터 조건이 있는 경우에만 필터링
				if (depositInfo) {
					const depositData = depositInfo.toJSON();

					// 금액 필터 체크
					if (amount !== undefined && amount !== null && amount !== '') {
						const matchesAmount =
							depositData.reservationDepositAmount == amount ||
							depositData.depositAmount == amount;
						if (!matchesAmount) {
							depositInfo = null; // 조건에 맞지 않으면 null
						}
					}

					// status 필터 체크
					if (depositInfo && status) {
						if (depositData.status !== status) {
							depositInfo = null;
						}
					}

					// contractStatus 필터 체크
					if (depositInfo && contractStatus) {
						if (depositData.contractStatus !== contractStatus) {
							depositInfo = null;
						}
					}

					// hideCompleted 필터 체크
					if (
						depositInfo &&
						(hideCompleted === 'true' || hideCompleted === true)
					) {
						if (depositData.status === 'RETURN_COMPLETED') {
							depositInfo = null;
						}
					}

				}

				// 결과 객체 구성
				const resultItem = {
					room: {
						esntlId: roomData.esntlId,
						roomNumber: roomData.roomNumber,
						roomType: roomData.roomType,
						status: roomData.status,
						currentStatus: roomData.currentStatus,
					},
					deposit: null,
					latestDepositHistory: null,
					latestReturnHistory: null,
					totalDepositAmount: 0,
					unpaidAmount: 0,
				};

				// deposit 정보가 있는 경우
				if (depositInfo) {
					const depositData = depositInfo.toJSON();
					resultItem.deposit = {
						esntlId: depositData.esntlId,
						reservationDepositAmount: depositData.reservationDepositAmount,
						depositAmount: depositData.depositAmount,
						accountBank: depositData.accountBank,
						accountNumber: depositData.accountNumber,
						accountHolder: depositData.accountHolder,
						moveInDate: depositData.moveInDate,
						moveOutDate: depositData.moveOutDate,
						contractStatus: depositData.contractStatus,
						status: depositData.status,
						virtualAccountNumber: depositData.virtualAccountNumber,
						virtualAccountExpiryDate: depositData.virtualAccountExpiryDate,
						customer: depositData.customer,
						contractor: depositData.contractor,
					};

					// 최신 입금 이력 조회
					const latestDepositHistory = await depositHistory.findOne({
						where: {
							depositEsntlId: depositData.esntlId,
							type: 'DEPOSIT',
						},
						order: [['createdAt', 'DESC']],
						attributes: [
							'status',
							'amount',
							'depositorName',
							'depositDate',
							'createdAt',
							'manager',
						],
					});

					// 최신 반환 이력 조회
					const latestReturnHistory = await depositHistory.findOne({
						where: {
							depositEsntlId: depositData.esntlId,
							type: 'RETURN',
						},
						order: [['createdAt', 'DESC']],
						attributes: [
							'status',
							'refundAmount',
							'deductionAmount',
							'refundDate',
							'createdAt',
							'manager',
						],
					});

					// 총 입금액 계산
					const totalDepositAmount = await depositHistory.sum('amount', {
						where: {
							depositEsntlId: depositData.esntlId,
							type: 'DEPOSIT',
							status: {
								[Op.in]: ['DEPOSIT_COMPLETED', 'PARTIAL_DEPOSIT'],
							},
						},
					});

					resultItem.latestDepositHistory = latestDepositHistory;
					resultItem.latestReturnHistory = latestReturnHistory;
					resultItem.totalDepositAmount = totalDepositAmount || 0;
					resultItem.unpaidAmount = Math.max(
						0,
						(depositData.reservationDepositAmount ||
							depositData.depositAmount) -
							(totalDepositAmount || 0)
					);
				}

				return resultItem;
			})
		);

		// 검색 조건에 맞는 항목만 필터링 (deposit이 없거나 조건에 맞지 않는 경우 제외)
		const filteredList = resultList.filter((item) => {
			// deposit이 없으면 포함 (방 목록은 항상 보여줌)
			if (!item.deposit) {
				return true;
			}

			// 금액 필터 체크 (예약금 또는 보증금 중 하나라도 일치)
			if (
				amount !== undefined &&
				item.deposit.reservationDepositAmount != amount &&
				item.deposit.depositAmount != amount
			) {
				return false;
			}

			return true;
		});

		// roomStatus 기반 검색 필터 (reservationName / contractName)
		const searchTypeNormalized =
			searchType === 'constractName' ? 'contractName' : searchType;
		const finalList =
			searchValue && searchTypeNormalized === 'reservationName'
				? filteredList.filter((item) => {
						const name = item.room.currentStatus?.reservationName || '';
						return name.toLowerCase().includes(searchValue.toLowerCase());
				  })
				: searchValue && searchTypeNormalized === 'contractName'
				? filteredList.filter((item) => {
						const name = item.room.currentStatus?.contractorName || '';
						return name.toLowerCase().includes(searchValue.toLowerCase());
				  })
				: filteredList;

		// searchType에 따라 메시지 변경
		const message =
			searchType === 'reservation'
				? '예약금 현황 목록 조회 성공'
				: '보증금 현황 목록 조회 성공';

		return errorHandler.successThrow(res, message, {
			total: finalList.length,
			page: parseInt(page),
			limit: parseInt(limit),
			data: finalList.slice((parseInt(page) - 1) * parseInt(limit), parseInt(page) * parseInt(limit)),
		});
	} catch (error) {
		next(error);
	}
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
					include: [
						{
							model: roomStatus,
							as: 'currentStatus',
							attributes: [
								'esntlId',
								'status',
								'customerEsntlId',
								'customerName',
								'contractStartDate',
								'contractEndDate',
							],
							required: false,
						},
					],
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
			(depositInfo.reservationDepositAmount ||
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
			reservationDepositAmount,
			depositAmount,
			accountBank,
			accountNumber,
			accountHolder,
			moveInDate,
			moveOutDate,
			contractStatus,
			virtualAccountNumber,
			virtualAccountExpiryDate,
		} = req.body;

		if (!roomEsntlId || !gosiwonEsntlId) {
			errorHandler.errorThrow(400, 'roomEsntlId와 gosiwonEsntlId는 필수입니다.');
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

		const esntlId = await generateDepositId(transaction);

		const newDeposit = await deposit.create(
			{
				esntlId,
				roomEsntlId,
				gosiwonEsntlId,
				customerEsntlId: customerEsntlId || null,
				contractorEsntlId: contractorEsntlId || null,
				reservationDepositAmount: reservationDepositAmount || 0,
				depositAmount: depositAmount || 0,
				accountBank: accountBank || null,
				accountNumber: accountNumber || null,
				accountHolder: accountHolder || null,
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
			reservationDepositAmount,
			depositAmount,
			accountBank,
			accountNumber,
			accountHolder,
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
			updateData.customerEsntlId = customerEsntlId;
			changes.push(`예약자/입실자: ${depositInfo.customerEsntlId || '없음'} → ${customerEsntlId || '없음'}`);
		}
		if (contractorEsntlId !== undefined && contractorEsntlId !== depositInfo.contractorEsntlId) {
			updateData.contractorEsntlId = contractorEsntlId;
			changes.push(`계약자: ${depositInfo.contractorEsntlId || '없음'} → ${contractorEsntlId || '없음'}`);
		}
		if (reservationDepositAmount !== undefined && reservationDepositAmount !== depositInfo.reservationDepositAmount) {
			updateData.reservationDepositAmount = reservationDepositAmount;
			changes.push(`예약금: ${depositInfo.reservationDepositAmount || 0}원 → ${reservationDepositAmount}원`);
		}
		if (depositAmount !== undefined && depositAmount !== depositInfo.depositAmount) {
			updateData.depositAmount = depositAmount;
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
		await deposit.update(
			{ deleteYN: 'Y', status: 'DELETED' },
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

		const { esntlId, roomEsntlId, depositDate, depositorName, amount, manager } = req.body;

		if (!esntlId || !depositDate || !amount) {
			errorHandler.errorThrow(
				400,
				'esntlId, depositDate, amount는 필수입니다.'
			);
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

		const targetAmount =
			depositInfo.reservationDepositAmount || depositInfo.depositAmount;

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

		const currentTotal = (totalDepositAmount || 0) + parseInt(amount);
		let newStatus = 'PARTIAL_DEPOSIT';

		if (currentTotal >= targetAmount) {
			newStatus = 'DEPOSIT_COMPLETED';
		}

		// 입금 이력 생성
		const historyId = await generateDepositHistoryId(transaction);
		await depositHistory.create(
			{
				esntlId: historyId,
				depositEsntlId: esntlId,
				roomEsntlId: finalRoomEsntlId, // 방 고유아이디 저장
				type: 'DEPOSIT',
				amount: parseInt(amount),
				status: newStatus,
				depositorName: depositorName || null,
				depositDate: depositDate,
				manager: manager || decodedToken.admin?.name || '관리자',
			},
			{ transaction }
		);

		// 보증금 상태 업데이트
		await deposit.update(
			{
				status: newStatus,
			},
			{
				where: { esntlId: esntlId },
				transaction,
			}
		);

		await transaction.commit();

		return errorHandler.successThrow(res, '입금 등록 성공', {
			historyId: historyId,
			status: newStatus,
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

