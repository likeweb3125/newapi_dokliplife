const { mariaDBSequelize, room, customer, history, deposit } = require('../models');
const errorHandler = require('../middleware/error');
const { getWriterAdminId } = require('../utils/auth');

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

	const jwt = require('jsonwebtoken');
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

// 계약현황 목록 조회
exports.getContractList = async (req, res, next) => {
	try {
		verifyAdminToken(req);

		const {
			page = 1,
			status,
			startDate,
			endDate,
			searchString,
			order = 'DESC',
			limit = 50,
		} = req.query;

		// WHERE 조건 구성
		const buildWhereConditions = () => {
			const conditions = ['1=1'];
			const values = [];

			if (startDate && endDate) {
				conditions.push('RC.contractDate BETWEEN ? AND ?');
				values.push(startDate, endDate);
			}

			if (searchString) {
				conditions.push(
					'(G.esntlId LIKE ? OR G.name LIKE ? OR C.name LIKE ? OR C.phone LIKE ?)'
				);
				const searchPattern = `%${searchString}%`;
				values.push(searchPattern, searchPattern, searchPattern, searchPattern);
			}

			if (status) {
				conditions.push('RC.status = ?');
				values.push(status);
			}

			return { whereClause: conditions.join(' AND '), values };
		};

		const { whereClause, values: whereValues } = buildWhereConditions();
		const orderDirection = order === 'ASC' ? 'ASC' : 'DESC';
		const pageNum = parseInt(page);
		const limitNum = parseInt(limit);
		const offset = (pageNum - 1) * limitNum;

		// 메인 데이터 조회 쿼리
		const mainQuery = `
			SELECT 
				RC.esntlId,
				SUBSTRING_INDEX(SUBSTRING_INDEX(G.address, ' ', 2), ' ', -2) AS region,
				RC.contractDate,
				COALESCE(PL.pTime, '') AS pTime,
				RC.startDate,
				RC.endDate,
				RC.month,
				RC.gosiwonEsntlId,
				G.name AS gosiwonName,
				G.address AS gosiwonAddress,
				RC.contract,
				RC.spacialContract,
				R.roomNumber,
				R.roomType,
				R.window,
				C.name AS customerName,
				C.phone AS customerPhone,
				RC.customerEsntlId AS customerEsntlId,
				RC.checkinName AS checkinName,
				RC.checkinPhone AS checkinPhone,
				RC.checkinGender AS checkinGender,
				RC.checkinAge AS checkinAge,
				RC.customerName AS contractCustomerName,
				RC.customerPhone AS contractCustomerPhone,
				RC.customerGender AS contractCustomerGender,
				RC.customerAge AS contractCustomerAge,
				COALESCE(PL.pyl_goods_amount, 0) AS pyl_goods_amount,
				FORMAT(COALESCE(PL.paymentAmount, 0), 0) AS paymentAmount,
				COALESCE(PL.paymentAmount, 0) AS payment_amount,
				FORMAT(COALESCE(PL.paymentPoint, 0), 0) AS paymentPoint,
				FORMAT(COALESCE(PL.paymentCoupon, 0), 0) AS paymentCoupon,
				FORMAT(COALESCE(PL.cAmount, 0), 0) AS cAmount,
				FORMAT(COALESCE(PL.cPercent, 0), 0) AS cPercent,
				1 AS paymentCount,
				COUNT(*) OVER() AS totcnt
			FROM roomContract RC
			JOIN gosiwon G ON RC.gosiwonEsntlId = G.esntlId
			JOIN customer C ON RC.customerEsntlId = C.esntlId
			JOIN room R ON RC.roomEsntlId = R.esntlId
			LEFT JOIN (
				SELECT 
					contractEsntlId,
					pTime,
					pyl_goods_amount,
					SUM(paymentAmount) AS paymentAmount,
					SUM(paymentPoint) AS paymentPoint,
					SUM(paymentCoupon) AS paymentCoupon,
					SUM(cAmount) AS cAmount,
					AVG(cPercent) AS cPercent
				FROM paymentLog 
				GROUP BY contractEsntlId
			) PL ON RC.esntlId = PL.contractEsntlId
			WHERE ${whereClause}
			ORDER BY RC.contractDate ${orderDirection}, COALESCE(PL.pTime, '') ${orderDirection}
			LIMIT ? OFFSET ?
		`;

		// 합계 조회 쿼리
		const summaryQuery = `
			SELECT 
				FORMAT(COALESCE(SUM(PL.paymentAmount), 0), 0) AS paymentAmount,
				FORMAT(COALESCE(SUM(PL.paymentPoint), 0), 0) AS paymentPoint,
				FORMAT(COALESCE(SUM(PL.paymentCoupon), 0), 0) AS paymentCoupon,
				FORMAT(COALESCE(SUM(PL.cAmount), 0), 0) AS cAmount,
				FORMAT(COALESCE(AVG(PL.cPercent), 0), 0) AS cPercent
			FROM roomContract RC
			JOIN gosiwon G ON RC.gosiwonEsntlId = G.esntlId
			JOIN customer C ON RC.customerEsntlId = C.esntlId
			LEFT JOIN paymentLog PL ON RC.esntlId = PL.contractEsntlId
			WHERE ${whereClause}
		`;

		// 쿼리 실행
		const mainValues = [...whereValues, limitNum, offset];
		const mainResult = await mariaDBSequelize.query(mainQuery, {
			replacements: mainValues,
			type: mariaDBSequelize.QueryTypes.SELECT,
		});

		const summaryResult = await mariaDBSequelize.query(summaryQuery, {
			replacements: whereValues,
			type: mariaDBSequelize.QueryTypes.SELECT,
		});

		// 전체 개수 조회 (페이징 없이)
		const countQuery = `
			SELECT COUNT(*) AS total
			FROM roomContract RC
			JOIN gosiwon G ON RC.gosiwonEsntlId = G.esntlId
			JOIN customer C ON RC.customerEsntlId = C.esntlId
			WHERE ${whereClause}
		`;

		const countResult = await mariaDBSequelize.query(countQuery, {
			replacements: whereValues,
			type: mariaDBSequelize.QueryTypes.SELECT,
		});

		const totalCount = countResult[0]?.total || 0;
		const resultList = Array.isArray(mainResult) ? mainResult : [];
		const summary = summaryResult[0] || {};

		// 응답 데이터 구성
		const response = {
			resultList: resultList,
			totcnt: totalCount,
			totPaymentAmount: summary.paymentAmount || '0',
			totPaymentPoint: summary.paymentPoint || '0',
			totPaymentCoupon: summary.paymentCoupon || '0',
			totCAmount: summary.cAmount || '0',
			totCPercent: summary.cPercent || '0',
			page: pageNum,
			limit: limitNum,
			totalPages: Math.ceil(totalCount / limitNum),
		};

		errorHandler.successThrow(res, '계약현황 목록 조회 성공', response);
	} catch (err) {
		next(err);
	}
};

// 계약 상세보기 (결제 내역 조회)
exports.getContractDetail = async (req, res, next) => {
	try {
		verifyAdminToken(req);

		const { contractEsntlId } = req.query;

		if (!contractEsntlId) {
			errorHandler.errorThrow(400, 'contractEsntlId를 입력해주세요.');
		}

		// 계약 정보 조회 (roomContract 기준)
		const contractQuery = `
			SELECT 
				RC.esntlId AS contractNumber,
				RC.roomEsntlId AS roomEsntlId,
				RC.gosiwonEsntlId AS gosiwonEsntlId,
				G.name AS gosiwonName,
				G.address AS gosiwonAddress,
				R.roomNumber,
				R.roomType,
				R.window,
				R.monthlyRent * 10000 AS roomMonthlyRent,
				RC.checkInTime AS checkInTime,
				C.name AS customerName,
				C.phone AS customerPhone,
				RC.customerEsntlId AS customerEsntlId,
				C.id AS customerId,
				C.bank AS customerBank,
				C.bankAccount AS customerBankAccount,
				RC.month,
				RC.startDate,
				RC.endDate,
				RC.contractDate,
				RC.status AS contractStatus,
				RC.monthlyRent * 10000 AS contractMonthlyRent,
				RC.memo AS occupantMemo,
				RC.memo2 AS occupantMemo2,
				RC.emergencyContact AS emergencyContact,
				RC.checkinName AS checkinName,
				RC.checkinPhone AS checkinPhone,
				RC.checkinGender AS checkinGender,
				RC.checkinAge AS checkinAge,
				RC.customerName AS contractCustomerName,
				RC.customerPhone AS contractCustomerPhone,
				RC.customerGender AS contractCustomerGender,
				RC.customerAge AS contractCustomerAge,
				R.agreementType AS agreementType,
				R.agreementContent AS agreementContent,
				G.contract AS gsw_contract,
				(SELECT content
				 FROM adminContract
				 ORDER BY numberOrder ASC
				 LIMIT 1) AS gs_contract
			FROM roomContract RC
			JOIN gosiwon G ON RC.gosiwonEsntlId = G.esntlId
			JOIN room R ON RC.roomEsntlId = R.esntlId
			JOIN customer C ON RC.customerEsntlId = C.esntlId
			WHERE RC.esntlId = ?
			LIMIT 1
		`;

		const [contractInfo] = await mariaDBSequelize.query(contractQuery, {
			replacements: [contractEsntlId],
			type: mariaDBSequelize.QueryTypes.SELECT,
		});

		if (!contractInfo) {
			errorHandler.errorThrow(404, '계약 정보를 찾을 수 없습니다.');
		}

		// 결제 내역 조회 (extraPayment만 사용)
		const paymentQuery = `
			SELECT 
				ep.pDate,
				ep.pTime,
				ep.pyl_goods_amount AS pyl_goods_amount,
				FORMAT(IFNULL(ep.paymentAmount, 0), 0) AS paymentAmount,
				'0' AS paymentPoint,
				'0' AS paymentCoupon,
				NULL AS couponName,
				ep.paymentType,
				ep.extraCostName,
				1 AS isExtra,
				ep.extendWithPayment
			FROM extraPayment ep
			WHERE ep.contractEsntlId = ?
				AND ep.deleteYN = 'N'
			ORDER BY ep.pDate DESC, ep.pTime DESC
		`;

		const paymentList = await mariaDBSequelize.query(paymentQuery, {
			replacements: [contractEsntlId],
			type: mariaDBSequelize.QueryTypes.SELECT,
		});

		// 방이동 예정 정보 조회 (roomMoveStatus에서 status가 PENDING인 경우)
		const roomMoveQuery = `
			SELECT 
				esntlId,
				moveDate
			FROM roomMoveStatus
			WHERE contractEsntlId = ?
				AND status = 'PENDING'
				AND deleteYN = 'N'
			ORDER BY moveDate ASC
			LIMIT 1
		`;

		const [roomMoveInfo] = await mariaDBSequelize.query(roomMoveQuery, {
			replacements: [contractEsntlId],
			type: mariaDBSequelize.QueryTypes.SELECT,
		});

		// 방이동 예정 정보를 contractInfo에 추가
		if (roomMoveInfo && roomMoveInfo.moveDate) {
			contractInfo.isRoomMoveScheduled = true;
			contractInfo.roomMoveDate = roomMoveInfo.moveDate;
			contractInfo.roomMoveEsntlId = roomMoveInfo.esntlId;
		} else {
			contractInfo.isRoomMoveScheduled = false;
			contractInfo.roomMoveDate = null;
			contractInfo.roomMoveEsntlId = null;
		}

		errorHandler.successThrow(res, '계약 상세보기 조회 성공', {
			contractInfo: contractInfo,
			paymentList: paymentList || [],
		});
	} catch (err) {
		next(err);
	}
};

// 계약 정보 수정
exports.updateContract = async (req, res, next) => {
	const transaction = await mariaDBSequelize.transaction();
	try {
		const decodedToken = verifyAdminToken(req);
		const writerAdminId = getWriterAdminId(decodedToken);

		const { contractEsntlId } = req.body;

		if (!contractEsntlId) {
			errorHandler.errorThrow(400, 'contractEsntlId를 입력해주세요.');
		}

		// 계약 정보 조회
		const contractInfo = await mariaDBSequelize.query(
			`
			SELECT 
				RC.*,
				C.birth AS customerBirth,
				D.contractorEsntlId,
				D.accountHolder AS depositAccountHolder
			FROM roomContract RC
			JOIN room R ON RC.roomEsntlId = R.esntlId
			JOIN customer C ON RC.customerEsntlId = C.esntlId
			LEFT JOIN deposit D ON D.contractEsntlId = RC.esntlId AND D.deleteYN = 'N'
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
			errorHandler.errorThrow(404, '계약 정보를 찾을 수 없습니다.');
		}

		const contract = contractInfo[0];
		const changes = [];

		// roomContract 테이블 업데이트
		const contractUpdateData = {};
		const {
			month,
			startDate,
			endDate,
			checkinTime,
			occupantMemo,
			occupantMemo2,
			emergencyContact,
			checkinName,
			checkinPhone,
			checkinGender,
			checkinAge,
			contractCustomerName,
			contractCustomerPhone,
			contractCustomerGender,
			contractCustomerAge,
		} = req.body;

		if (month !== undefined && month !== contract.month) {
			contractUpdateData.month = month;
			changes.push(`계약 기간: ${contract.month || '없음'} → ${month}`);
		}
		if (startDate !== undefined && startDate !== contract.startDate) {
			contractUpdateData.startDate = startDate;
			changes.push(`계약 시작일: ${contract.startDate || '없음'} → ${startDate}`);
		}
		if (endDate !== undefined && endDate !== contract.endDate) {
			contractUpdateData.endDate = endDate;
			changes.push(`계약 종료일: ${contract.endDate || '없음'} → ${endDate}`);
		}
		if (checkinTime !== undefined && checkinTime !== contract.checkinTime) {
			contractUpdateData.checkinTime = checkinTime;
			changes.push(
				`입실시간: ${contract.checkinTime || '없음'} → ${checkinTime || '없음'}`
			);
		}
		if (occupantMemo !== undefined && occupantMemo !== contract.memo) {
			contractUpdateData.memo = occupantMemo;
			changes.push(`입실자 메모: ${contract.memo || '없음'} → ${occupantMemo || '없음'}`);
		}
		if (occupantMemo2 !== undefined && occupantMemo2 !== contract.memo2) {
			contractUpdateData.memo2 = occupantMemo2;
			changes.push(
				`입실자 메모2: ${contract.memo2 || '없음'} → ${occupantMemo2 || '없음'}`
			);
		}
		if (
			emergencyContact !== undefined &&
			emergencyContact !== contract.emergencyContact
		) {
			contractUpdateData.emergencyContact = emergencyContact;
			changes.push(
				`비상연락망/관계: ${contract.emergencyContact || '없음'} → ${emergencyContact || '없음'}`
			);
		}
		if (checkinName !== undefined && checkinName !== contract.checkinName) {
			contractUpdateData.checkinName = checkinName;
			changes.push(
				`체크인한 사람 이름: ${contract.checkinName || '없음'} → ${checkinName || '없음'}`
			);
		}
		if (checkinPhone !== undefined && checkinPhone !== contract.checkinPhone) {
			contractUpdateData.checkinPhone = checkinPhone;
			changes.push(
				`체크인한 사람 연락처: ${contract.checkinPhone || '없음'} → ${checkinPhone || '없음'}`
			);
		}
		if (checkinGender !== undefined && checkinGender !== contract.checkinGender) {
			contractUpdateData.checkinGender = checkinGender;
			changes.push(
				`체크인한 사람 성별: ${contract.checkinGender || '없음'} → ${checkinGender || '없음'}`
			);
		}
		if (checkinAge !== undefined && checkinAge !== contract.checkinAge) {
			contractUpdateData.checkinAge = checkinAge;
			changes.push(
				`체크인한 사람 나이: ${contract.checkinAge || '없음'} → ${checkinAge || '없음'}`
			);
		}
		if (contractCustomerName !== undefined && contractCustomerName !== contract.customerName) {
			contractUpdateData.customerName = contractCustomerName;
			changes.push(
				`고객 이름: ${contract.customerName || '없음'} → ${contractCustomerName || '없음'}`
			);
		}
		if (contractCustomerPhone !== undefined && contractCustomerPhone !== contract.customerPhone) {
			contractUpdateData.customerPhone = contractCustomerPhone;
			changes.push(
				`고객 연락처: ${contract.customerPhone || '없음'} → ${contractCustomerPhone || '없음'}`
			);
		}
		if (contractCustomerGender !== undefined && contractCustomerGender !== contract.customerGender) {
			contractUpdateData.customerGender = contractCustomerGender;
			changes.push(
				`고객 성별: ${contract.customerGender || '없음'} → ${contractCustomerGender || '없음'}`
			);
		}
		if (contractCustomerAge !== undefined && contractCustomerAge !== contract.customerAge) {
			contractUpdateData.customerAge = contractCustomerAge;
			changes.push(
				`고객 나이: ${contract.customerAge || '없음'} → ${contractCustomerAge || '없음'}`
			);
		}

		// customer 테이블 업데이트 (입주자)
		const customerUpdateData = {};
		const {
			customerName,
			customerPhone,
			customerGender,
			customerBirth,
			customerBank,
			customerBankAccount,
		} = req.body;

		const customerInfo = await customer.findByPk(contract.customerEsntlId, {
			transaction,
		});
		if (!customerInfo) {
			errorHandler.errorThrow(404, '고객 정보를 찾을 수 없습니다.');
		}

		if (customerName !== undefined && customerName !== customerInfo.name) {
			customerUpdateData.name = customerName;
			changes.push(`입주자명: ${customerInfo.name || '없음'} → ${customerName}`);
		}
		if (customerPhone !== undefined && customerPhone !== customerInfo.phone) {
			customerUpdateData.phone = customerPhone;
			changes.push(
				`입주자 연락처: ${customerInfo.phone || '없음'} → ${customerPhone}`
			);
		}
		if (customerGender !== undefined && customerGender !== customerInfo.gender) {
			customerUpdateData.gender = customerGender;
			changes.push(
				`입주자 성별: ${customerInfo.gender || '없음'} → ${customerGender}`
			);
		}
		if (customerBirth !== undefined && customerBirth !== customerInfo.birth) {
			customerUpdateData.birth = customerBirth;
			changes.push(`입주자 생년월일: ${customerInfo.birth || '없음'} → ${customerBirth}`);
		}
		if (customerBank !== undefined && customerBank !== customerInfo.bank) {
			customerUpdateData.bank = customerBank;
			changes.push(`입주자 은행: ${customerInfo.bank || '없음'} → ${customerBank}`);
		}
		if (
			customerBankAccount !== undefined &&
			customerBankAccount !== customerInfo.bankAccount
		) {
			customerUpdateData.bankAccount = customerBankAccount;
			changes.push(
				`입주자 계좌: ${customerInfo.bankAccount || '없음'} → ${customerBankAccount}`
			);
		}

		// customer 테이블 업데이트 (계약자)
		const contractorUpdateData = {};
		const { contractorName, contractorPhone } = req.body;

		if (contract.contractorEsntlId) {
			const contractorInfo = await customer.findByPk(contract.contractorEsntlId, {
				transaction,
			});

			if (contractorInfo) {
				if (
					contractorName !== undefined &&
					contractorName !== contractorInfo.name
				) {
					contractorUpdateData.name = contractorName;
					changes.push(
						`계약자명: ${contractorInfo.name || '없음'} → ${contractorName}`
					);
				}
				if (
					contractorPhone !== undefined &&
					contractorPhone !== contractorInfo.phone
				) {
					contractorUpdateData.phone = contractorPhone;
					changes.push(
						`계약자 연락처: ${contractorInfo.phone || '없음'} → ${contractorPhone}`
					);
				}
			}
		}

		// deposit 테이블 업데이트 (예금주)
		const depositUpdateData = {};
		const { accountHolder } = req.body;

		if (contract.contractorEsntlId) {
			const depositInfo = await deposit.findOne({
				where: {
					contractEsntlId: contractEsntlId,
					deleteYN: 'N',
				},
				transaction,
			});

			if (depositInfo) {
				if (
					accountHolder !== undefined &&
					accountHolder !== depositInfo.accountHolder
				) {
					depositUpdateData.accountHolder = accountHolder;
					changes.push(
						`예금주: ${depositInfo.accountHolder || '없음'} → ${accountHolder}`
					);
				}
			}
		}

		// 업데이트 실행
		if (Object.keys(contractUpdateData).length > 0) {
			const setClause = Object.keys(contractUpdateData)
				.map((key) => `${key} = ?`)
				.join(', ');
			const values = Object.values(contractUpdateData);
			values.push(contractEsntlId);

			await mariaDBSequelize.query(
				`UPDATE roomContract SET ${setClause} WHERE esntlId = ?`,
				{
					replacements: values,
					type: mariaDBSequelize.QueryTypes.UPDATE,
					transaction,
				}
			);
		}

		if (Object.keys(customerUpdateData).length > 0) {
			await customer.update(customerUpdateData, {
				where: { esntlId: contract.customerEsntlId },
				transaction,
			});
		}

		if (
			Object.keys(contractorUpdateData).length > 0 &&
			contract.contractorEsntlId
		) {
			await customer.update(contractorUpdateData, {
				where: { esntlId: contract.contractorEsntlId },
				transaction,
			});
		}

		if (Object.keys(depositUpdateData).length > 0) {
			await deposit.update(depositUpdateData, {
				where: {
					contractEsntlId: contractEsntlId,
					deleteYN: 'N',
				},
				transaction,
			});
		}

		// 히스토리 생성
		if (changes.length > 0) {
			try {
				const historyId = await generateHistoryId(transaction);
				const historyContent = `계약 정보 수정: ${changes.join(', ')}`;

				await history.create(
					{
						esntlId: historyId,
						gosiwonEsntlId: contract.gosiwonEsntlId,
						roomEsntlId: contract.roomEsntlId,
						contractEsntlId: contractEsntlId,
						content: historyContent,
						category: 'CONTRACT',
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
			}
		}

		await transaction.commit();

		errorHandler.successThrow(res, '계약 정보 수정 성공', {
			contractEsntlId: contractEsntlId,
			changes: changes,
		});
	} catch (err) {
		await transaction.rollback();
		next(err);
	}
};

