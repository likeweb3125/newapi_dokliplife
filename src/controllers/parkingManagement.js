const {
	mariaDBSequelize,
	extraPayment,
	roomContract,
	parking,
	parkStatus,
	history,
} = require('../models');
const errorHandler = require('../middleware/error');
const { getWriterAdminId } = require('../utils/auth');

const EXTR_PREFIX = 'EXTR';
const EXTR_PADDING = 10;
const PARKSTATUS_PREFIX = 'PKST';
const PARKSTATUS_PADDING = 10;
const HISTORY_PREFIX = 'HISTORY';
const HISTORY_PADDING = 10;

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

	if (!decodedToken || (!decodedToken.admin && !decodedToken.partner)) {
		errorHandler.errorThrow(401, '관리자 정보가 없습니다.');
	}
	return decodedToken;
};

// extraPayment ID 생성 함수
const generateExtraPaymentId = async (transaction) => {
	const idQuery = `
		SELECT CONCAT('EXTR', LPAD(COALESCE(MAX(CAST(SUBSTRING(esntlId, 5) AS UNSIGNED)), 0) + 1, 10, '0')) AS nextId
		FROM extraPayment
		WHERE esntlId LIKE 'EXTR%'
	`;
	const [idResult] = await mariaDBSequelize.query(idQuery, {
		type: mariaDBSequelize.QueryTypes.SELECT,
		transaction,
	});
	return idResult?.nextId || 'EXTR0000000001';
};

// parkStatus ID 생성 함수
const generateParkStatusId = async (transaction) => {
	const idQuery = `
		SELECT CONCAT('PKST', LPAD(COALESCE(MAX(CAST(SUBSTRING(esntlId, 5) AS UNSIGNED)), 0) + 1, 10, '0')) AS nextId
		FROM parkStatus
		WHERE esntlId LIKE 'PKST%'
	`;
	const [idResult] = await mariaDBSequelize.query(idQuery, {
		type: mariaDBSequelize.QueryTypes.SELECT,
		transaction,
	});
	return idResult?.nextId || 'PKST0000000001';
};

// history ID 생성 함수
const generateHistoryId = async (transaction) => {
	const idQuery = `
		SELECT CONCAT('HISTORY', LPAD(COALESCE(MAX(CAST(SUBSTRING(esntlId, 8) AS UNSIGNED)), 0) + 1, 10, '0')) AS nextId
		FROM history
	`;
	const [idResult] = await mariaDBSequelize.query(idQuery, {
		type: mariaDBSequelize.QueryTypes.SELECT,
		transaction,
	});
	return idResult?.nextId || 'HISTORY0000000001';
};

// 현재 날짜/시간 (YYYY-MM-DD, HH:MM:SS 형식)
const getCurrentDateTime = () => {
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, '0');
	const day = String(now.getDate()).padStart(2, '0');
	const hours = String(now.getHours()).padStart(2, '0');
	const minutes = String(now.getMinutes()).padStart(2, '0');
	const seconds = String(now.getSeconds()).padStart(2, '0');
	return {
		pDate: `${year}-${month}-${day}`,
		pTime: `${hours}:${minutes}:${seconds}`,
	};
};

// 주차 등록 (Create)
exports.createParking = async (req, res, next) => {
	const transaction = await mariaDBSequelize.transaction();
	try {
		const decodedToken = verifyAdminToken(req);
		const writerAdminId = getWriterAdminId(decodedToken);

		const {
			contractEsntlId,
			optionName, // '자동차' 또는 '오토바이'
			optionInfo, // 차량번호
			useStartDate,
			useEndDate,
			cost = 0, // 주차비 (0원 가능)
			extend, // 연장시 함께 연장 여부
			memo, // 메모
		} = req.body;

		// extend가 true이면 1로 설정
		const extendValue = extend === true;

		// 필수 필드 검증
		if (!contractEsntlId) {
			errorHandler.errorThrow(400, 'contractEsntlId를 입력해주세요.');
		}
		if (!optionName || (optionName !== '자동차' && optionName !== '오토바이')) {
			errorHandler.errorThrow(400, 'optionName은 "자동차" 또는 "오토바이"여야 합니다.');
		}

		// 계약 정보 조회
		const contractInfo = await mariaDBSequelize.query(
			`
			SELECT 
				RC.*
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
			errorHandler.errorThrow(404, '계약 정보를 찾을 수 없습니다.');
		}

		const contract = contractInfo[0];

		// 현재 날짜/시간
		const { pDate, pTime } = getCurrentDateTime();

		// extraPayment 생성 (0원이어도 기록)
		const paymentId = await generateExtraPaymentId(transaction);
		await extraPayment.create(
			{
				esntlId: paymentId,
				contractEsntlId: contractEsntlId,
				gosiwonEsntlId: contract.gosiwonEsntlId,
				roomEsntlId: contract.roomEsntlId,
				customerEsntlId: contract.customerEsntlId || '',
				extraCostName: '주차비',
				memo: null,
				optionInfo: optionInfo || null,
				useStartDate: useStartDate || null,
				optionName: optionName,
				extendWithPayment: extendValue ? 1 : 0,
				pDate: pDate,
				pTime: pTime,
				paymentAmount: String(Math.abs(parseInt(cost, 10))),
				pyl_goods_amount: Math.abs(parseInt(cost, 10)),
				imp_uid: cost > 0 ? '' : '', // 0원이면 빈 문자열
				paymentStatus: 'PENDING', // 결제 상태: PENDING(결제대기), COMPLETED(결제완료), CANCELLED(결제취소), FAILED(결제실패)
				paymentType: cost > 0 ? null : null, // 0원이면 null
				withdrawalStatus: null,
				deleteYN: 'N',
			},
			{ transaction }
		);

		// gosiwonParking 조회 및 사용 대수 증가
		const parkingInfo = await parking.findOne({
			where: { gosiwonEsntlId: contract.gosiwonEsntlId },
			transaction,
		});

		if (parkingInfo) {
			// 사용 대수 증가
			if (optionName === '자동차') {
				await parking.update(
					{ autoUse: (parkingInfo.autoUse || 0) + 1 },
					{
						where: { esntlId: parkingInfo.esntlId },
						transaction,
					}
				);
			} else if (optionName === '오토바이') {
				await parking.update(
					{ bikeUse: (parkingInfo.bikeUse || 0) + 1 },
					{
						where: { esntlId: parkingInfo.esntlId },
						transaction,
					}
				);
			}
		}

		// parkStatus 생성
		const parkStatusId = await generateParkStatusId(transaction);
		const parkNumber = optionInfo && optionInfo.trim() !== '' ? optionInfo.trim() : null;
		const parkStatusMemo = memo && memo.trim() !== '' ? memo.trim() : null;
		const parkStatusCost = Math.abs(parseInt(cost, 10)) || 0;
		await parkStatus.create(
			{
				esntlId: parkStatusId,
				gosiwonEsntlId: contract.gosiwonEsntlId,
				contractEsntlId: contractEsntlId,
				customerEsntlId: contract.customerEsntlId || null,
				status: 'IN_USE',
				useStartDate: useStartDate || pDate,
				useEndDate: useEndDate || contract.endDate || null,
				parkType: optionName,
				parkNumber: parkNumber,
				cost: parkStatusCost,
				memo: parkStatusMemo,
				deleteYN: 'N',
			},
			{ transaction }
		);

		// History 기록 생성
		const historyId = await generateHistoryId(transaction);
		const costText = cost > 0 ? `${cost.toLocaleString()}원` : '입실료 포함';
		const historyContent = `주차 등록: ${optionName}${parkNumber ? ` (${parkNumber})` : ''}, 주차비: ${costText}`;

		await history.create(
			{
				esntlId: historyId,
				gosiwonEsntlId: contract.gosiwonEsntlId,
				roomEsntlId: contract.roomEsntlId,
				contractEsntlId: contractEsntlId,
				content: historyContent,
				category: 'PARKING',
				priority: 'NORMAL',
				publicRange: 0,
				writerAdminId: writerAdminId,
				writerType: 'ADMIN',
				deleteYN: 'N',
			},
			{ transaction }
		);

		await transaction.commit();

		errorHandler.successThrow(res, '주차 등록이 완료되었습니다.', {
			contractEsntlId: contractEsntlId,
			paymentLogId: paymentId, // 기존 키 유지
			parkStatusId: parkStatusId,
			historyId: historyId,
		});
	} catch (err) {
		await transaction.rollback();
		next(err);
	}
};

// 주차 목록 조회 (Read)
exports.getParkingList = async (req, res, next) => {
	try {
		verifyAdminToken(req);

		const { contractEsntlId } = req.query;

		if (!contractEsntlId) {
			errorHandler.errorThrow(400, 'contractEsntlId를 입력해주세요.');
		}

		// extraPayment와 parkStatus 조인하여 주차 정보 조회
		const query = `
			SELECT 
				EP.esntlId AS paymentLogId,
				PS.esntlId AS parkStatusId,
				EP.optionName,
				EP.optionInfo,
				PS.parkType,
				PS.parkNumber,
				PS.useStartDate,
				PS.useEndDate,
				EP.pyl_goods_amount AS cost,
				PS.cost AS parkStatusCost,
				EP.paymentAmount,
				EP.paymentType,
				EP.extendWithPayment,
				EP.pDate,
				EP.pTime,
				PS.status,
				PS.memo,
				CASE 
					WHEN EP.pyl_goods_amount = 0 THEN '입실료 포함'
					ELSE '별도 결제'
				END AS paymentStatus
			FROM extraPayment EP
			LEFT JOIN parkStatus PS ON EP.contractEsntlId = PS.contractEsntlId 
				AND PS.deleteYN = 'N'
				AND PS.status = 'IN_USE'
			WHERE EP.contractEsntlId = ?
				AND EP.deleteYN = 'N'
				AND EP.extraCostName = '주차비'
				AND (EP.optionName = '자동차' OR EP.optionName = '오토바이')
			ORDER BY EP.pDate DESC, EP.pTime DESC
		`;

		const result = await mariaDBSequelize.query(query, {
			replacements: [contractEsntlId],
			type: mariaDBSequelize.QueryTypes.SELECT,
		});

		errorHandler.successThrow(res, '주차 목록 조회 성공', {
			list: result || [],
		});
	} catch (err) {
		next(err);
	}
};

// 주차 사용 현황 리스트 조회 (고시원별)
exports.getParkingNowList = async (req, res, next) => {
	try {
		verifyAdminToken(req);

		const { gosiwonEsntlId } = req.query;

		if (!gosiwonEsntlId) {
			errorHandler.errorThrow(400, 'gosiwonEsntlId를 입력해주세요.');
		}

		// parkStatus와 roomContract, customer, room 조인하여 주차 사용 현황 조회
		const query = `
			SELECT 
				PS.esntlId AS parkStatusId,
				PS.gosiwonEsntlId AS gosiwonEsntlId,
				PS.contractEsntlId AS contractEsntlId,
				RC.roomEsntlId AS roomEsntlId,
				R.roomNumber AS roomNumber,
				COALESCE(RC.customerName, C.name) AS customerName,
				COALESCE(RC.customerGender, C.gender) AS customerGender,
				COALESCE(RC.customerAge, 
					CASE 
						WHEN C.birth IS NOT NULL AND C.birth != '' 
						THEN ROUND((TO_DAYS(NOW()) - TO_DAYS(C.birth)) / 365)
						ELSE NULL
					END
				) AS customerAge,
				PS.parkType AS parkType,
				PS.parkNumber AS parkNumber,
				PS.status AS status,
				PS.useStartDate AS useStartDate,
				PS.useEndDate AS useEndDate,
				COALESCE(PS.cost, 0) AS cost
			FROM parkStatus PS
			LEFT JOIN roomContract RC ON PS.contractEsntlId = RC.esntlId
			LEFT JOIN room R ON RC.roomEsntlId = R.esntlId
			LEFT JOIN customer C ON PS.customerEsntlId = C.esntlId
			WHERE PS.gosiwonEsntlId = ?
				AND PS.status IN ('IN_USE', 'RESERVED')
				AND PS.deleteYN = 'N'
			ORDER BY PS.useStartDate DESC, PS.createdAt DESC
		`;

		const result = await mariaDBSequelize.query(query, {
			replacements: [gosiwonEsntlId],
			type: mariaDBSequelize.QueryTypes.SELECT,
		});

		errorHandler.successThrow(res, '주차 사용 현황 리스트 조회 성공', {
			list: result || [],
		});
	} catch (err) {
		next(err);
	}
};

// 주차 정보 수정 (Update)
exports.updateParking = async (req, res, next) => {
	const transaction = await mariaDBSequelize.transaction();
	try {
		const decodedToken = verifyAdminToken(req);
		const writerAdminId = getWriterAdminId(decodedToken);

		const { parkingId } = req.params; // extraPayment의 esntlId
		const {
			optionName,
			optionInfo,
			useStartDate,
			useEndDate,
			extend, // 연장시 함께 연장 여부
			memo, // 메모
			cost, // 주차비
		} = req.body;

		// extend가 true이면 1로 설정
		const extendValue = extend === true;

		if (!parkingId) {
			errorHandler.errorThrow(400, 'parkingId를 입력해주세요.');
		}

		// extraPayment 조회
		const paymentLogInfo = await extraPayment.findOne({
			where: {
				esntlId: parkingId,
				extraCostName: '주차비',
				deleteYN: 'N',
			},
			transaction,
		});

		if (!paymentLogInfo) {
			errorHandler.errorThrow(404, '주차 정보를 찾을 수 없습니다.');
		}

		// 업데이트할 필드 구성
		const updateData = {};
		if (optionName !== undefined) {
			if (optionName !== '자동차' && optionName !== '오토바이') {
				errorHandler.errorThrow(400, 'optionName은 "자동차" 또는 "오토바이"여야 합니다.');
			}
			updateData.optionName = optionName;
		}
		if (optionInfo !== undefined) {
			updateData.optionInfo = optionInfo || null;
		}
		if (useStartDate !== undefined) {
			updateData.useStartDate = useStartDate || null;
		}
		if (extend !== undefined) {
			updateData.extendWithPayment = extendValue ? 1 : 0;
		}

		// extraPayment 업데이트
		if (Object.keys(updateData).length > 0) {
			await extraPayment.update(updateData, {
				where: { esntlId: parkingId },
				transaction,
			});
		}

		// parkStatus 조회 및 업데이트
		const parkStatusInfo = await parkStatus.findOne({
			where: {
				contractEsntlId: paymentLogInfo.contractEsntlId,
				deleteYN: 'N',
			},
			order: [['createdAt', 'DESC']],
			transaction,
		});

		if (parkStatusInfo) {
			const parkStatusUpdateData = {};
			if (useStartDate !== undefined) {
				parkStatusUpdateData.useStartDate = useStartDate || null;
			}
			if (useEndDate !== undefined) {
				parkStatusUpdateData.useEndDate = useEndDate || null;
			}
			if (optionName !== undefined) {
				if (optionName !== '자동차' && optionName !== '오토바이') {
					errorHandler.errorThrow(400, 'optionName은 "자동차" 또는 "오토바이"여야 합니다.');
				}
				parkStatusUpdateData.parkType = optionName;
			}
			if (optionInfo !== undefined) {
				const parkNumber = optionInfo && optionInfo.trim() !== '' ? optionInfo.trim() : null;
				parkStatusUpdateData.parkNumber = parkNumber;
			}
			if (memo !== undefined) {
				parkStatusUpdateData.memo = memo && memo.trim() !== '' ? memo.trim() : null;
			}
			if (cost !== undefined) {
				parkStatusUpdateData.cost = Math.abs(parseInt(cost, 10)) || 0;
			}

			if (Object.keys(parkStatusUpdateData).length > 0) {
				await parkStatus.update(parkStatusUpdateData, {
					where: { esntlId: parkStatusInfo.esntlId },
					transaction,
				});
			}
		}

		// History 기록 생성
		const historyId = await generateHistoryId(transaction);
		const historyContent = `주차 정보 수정: ${parkingId}`;

		await history.create(
			{
				esntlId: historyId,
				gosiwonEsntlId: paymentLogInfo.gosiwonEsntlId,
				roomEsntlId: paymentLogInfo.roomEsntlId,
				contractEsntlId: paymentLogInfo.contractEsntlId,
				content: historyContent,
				category: 'PARKING',
				priority: 'NORMAL',
				publicRange: 0,
				writerAdminId: writerAdminId,
				writerType: 'ADMIN',
				deleteYN: 'N',
			},
			{ transaction }
		);

		await transaction.commit();

		errorHandler.successThrow(res, '주차 정보 수정이 완료되었습니다.', {
			paymentLogId: parkingId,
			historyId: historyId,
		});
	} catch (err) {
		await transaction.rollback();
		next(err);
	}
};

// 주차 삭제 (Delete)
exports.deleteParking = async (req, res, next) => {
	const transaction = await mariaDBSequelize.transaction();
	try {
		const decodedToken = verifyAdminToken(req);
		const writerAdminId = getWriterAdminId(decodedToken);

		const { parkingId } = req.params; // extraPayment의 esntlId

		if (!parkingId) {
			errorHandler.errorThrow(400, 'parkingId를 입력해주세요.');
		}

		// extraPayment 조회
		const paymentLogInfo = await extraPayment.findOne({
			attributes: [
				'esntlId',
				'contractEsntlId',
				'gosiwonEsntlId',
				'roomEsntlId',
				'customerEsntlId',
				'optionName',
			],
			where: {
				esntlId: parkingId,
				extraCostName: '주차비',
				deleteYN: 'N',
			},
			transaction,
		});

		if (!paymentLogInfo) {
			errorHandler.errorThrow(404, '주차 정보를 찾을 수 없습니다.');
		}

		// gosiwonParking 사용 대수 감소
		const parkingInfo = await parking.findOne({
			where: { gosiwonEsntlId: paymentLogInfo.gosiwonEsntlId },
			transaction,
		});

		if (parkingInfo && paymentLogInfo.optionName) {
			if (paymentLogInfo.optionName === '자동차') {
				const newAutoUse = Math.max(0, (parkingInfo.autoUse || 0) - 1);
				await parking.update(
					{ autoUse: newAutoUse },
					{
						where: { esntlId: parkingInfo.esntlId },
						transaction,
					}
				);
			} else if (paymentLogInfo.optionName === '오토바이') {
				const newBikeUse = Math.max(0, (parkingInfo.bikeUse || 0) - 1);
				await parking.update(
					{ bikeUse: newBikeUse },
					{
						where: { esntlId: parkingInfo.esntlId },
						transaction,
					}
				);
			}
		}

		// parkStatus 소프트 삭제
		const parkStatusInfo = await parkStatus.findOne({
			where: {
				contractEsntlId: paymentLogInfo.contractEsntlId,
				deleteYN: 'N',
			},
			order: [['createdAt', 'DESC']],
			transaction,
		});

		if (parkStatusInfo) {
			await parkStatus.update(
				{ 
					deleteYN: 'Y',
					deletedBy: writerAdminId,
					deletedAt: new Date(),
				},
				{
					where: { esntlId: parkStatusInfo.esntlId },
					transaction,
				}
			);
		}

		// paymentLog는 삭제하지 않고 유지 (결제 내역 보존)

		// History 기록 생성
		const historyId = await generateHistoryId(transaction);
		const historyContent = `주차 삭제: ${parkingId} (${paymentLogInfo.optionName || ''})`;

		await history.create(
			{
				esntlId: historyId,
				gosiwonEsntlId: paymentLogInfo.gosiwonEsntlId,
				roomEsntlId: paymentLogInfo.roomEsntlId,
				contractEsntlId: paymentLogInfo.contractEsntlId,
				content: historyContent,
				category: 'PARKING',
				priority: 'NORMAL',
				publicRange: 0,
				writerAdminId: writerAdminId,
				writerType: 'ADMIN',
				deleteYN: 'N',
			},
			{ transaction }
		);

		await transaction.commit();

		errorHandler.successThrow(res, '주차 삭제가 완료되었습니다.', {
			paymentLogId: parkingId,
			historyId: historyId,
		});
	} catch (err) {
		await transaction.rollback();
		next(err);
	}
};
