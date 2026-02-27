const { mariaDBSequelize, room, customer, extraPayment, paymentLog } = require('../models');
const errorHandler = require('../middleware/error');
const { getWriterAdminId } = require('../utils/auth');
const historyController = require('./history');
const { next: idsNext } = require('../utils/idsNext');
const formatAge = require('../utils/formatAge');
const { phoneToRaw, phoneToDisplay } = require('../utils/phoneHelper');

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

// 계약현황 목록 조회
exports.getContractList = async (req, res, next) => {
	try {
		verifyAdminToken(req);

		const {
			page = 1,
			status,
			roomStatus,
			startDate,
			endDate,
			searchString,
			roomEsntlId,
			gosiwonEsntlId,
			depositSearchString,
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

			if (roomEsntlId) {
				conditions.push('RC.roomEsntlId = ?');
				values.push(roomEsntlId);
			}

			if (gosiwonEsntlId) {
				conditions.push('RC.gosiwonEsntlId = ?');
				values.push(gosiwonEsntlId);
			}

			// il_room_deposit에서 입실자명/계약자명(rdp_customer_name)으로 검색
			if (depositSearchString && String(depositSearchString).trim()) {
				const depositPattern = `%${String(depositSearchString).trim()}%`;
				conditions.push(
					'EXISTS (SELECT 1 FROM il_room_deposit D2 WHERE D2.rom_eid = RC.roomEsntlId AND D2.gsw_eid = RC.gosiwonEsntlId AND D2.rdp_delete_dtm IS NULL AND D2.rdp_customer_name LIKE ?)'
				);
				values.push(depositPattern);
			}

			if (status) {
				conditions.push('RC.status = ?');
				values.push(status);
			}

			if (roomStatus) {
				conditions.push(
					'EXISTS (SELECT 1 FROM roomStatus RS2 WHERE RS2.contractEsntlId = RC.esntlId AND (RS2.deleteYN IS NULL OR RS2.deleteYN = \'N\') AND RS2.status = ?)'
				);
				values.push(roomStatus);
			}

			return { whereClause: conditions.join(' AND '), values };
		};

		const { whereClause, values: whereValues } = buildWhereConditions();
		const orderDirection = order === 'ASC' ? 'ASC' : 'DESC';
		const pageNum = parseInt(page);
		const limitNum = parseInt(limit);
		const offset = (pageNum - 1) * limitNum;

		// 메인 데이터 조회 쿼리 (roomStatus는 JOIN 대신 EXISTS로 필터해 계약당 1행만 반환)
		const mainQuery = `
			SELECT 
				RC.esntlId,
				RC.roomEsntlId,
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
				R.deposit AS gosiwonDeposit,
				R.roomType,
				R.window,
				C.name AS customerName,
				C.phone AS customerPhone,
				RC.customerEsntlId AS customerEsntlId,
				RCW.checkinName AS checkinName,
				RCW.checkinPhone AS checkinPhone,
				RCW.checkinGender AS checkinGender,
				RCW.checkinAge AS checkinAge,
				RCW.customerName AS contractCustomerName,
				RCW.customerPhone AS contractCustomerPhone,
				RCW.customerGender AS contractCustomerGender,
				RCW.customerAge AS contractCustomerAge,
				COALESCE(PL.pyl_goods_amount, 0) AS pyl_goods_amount,
				R.monthlyRent AS roomInfoAmount,
				FORMAT(COALESCE(PL.paymentPoint, 0), 0) AS paymentPoint,
				FORMAT(COALESCE(PL.paymentCoupon, 0), 0) AS paymentCoupon,
				FORMAT(COALESCE(PL.cAmount, 0), 0) AS cAmount,
				FORMAT(COALESCE(PL.cPercent, 0), 0) AS cPercent,
				1 AS paymentCount,
				COUNT(*) OVER() AS totcnt,
				R.status AS status,
				CASE
					WHEN RC.contractDay IS NOT NULL AND RC.contractDay > 0 THEN 'part'
					WHEN RC.month = 1 THEN 'month'
					WHEN DATE_ADD(RC.startDate, INTERVAL 1 MONTH) = RC.endDate THEN 'month'
					ELSE 'part'
				END AS contractType,
				CASE
					WHEN RC.checkInTime LIKE 'RCTT%' THEN 'extend'
					ELSE 'new'
				END AS contractCategory,
				CASE
					WHEN RC.status = 'CANCEL' THEN 'refund'
					ELSE 'pay'
				END AS paymentCategory,
				COALESCE((
					SELECT CASE
						WHEN DH.status IS NULL THEN NULL
						WHEN DH.status = 'PENDING' THEN 'PENDING'
						WHEN DH.status = 'PARTIAL' THEN 'PARTIAL'
						WHEN DH.status = 'DELETED' THEN 'DELETED'
						WHEN DH.status IN ('COMPLETED', 'RETURN_COMPLETED') THEN 'COMPLETE'
						ELSE DH.status
					END
					FROM il_room_deposit D
					LEFT JOIN (
						SELECT H1.depositEsntlId, H1.status
						FROM il_room_deposit_history H1
						INNER JOIN (
							SELECT depositEsntlId, MAX(createdAt) AS maxCreatedAt
							FROM il_room_deposit_history
							GROUP BY depositEsntlId
						) H2 ON H1.depositEsntlId = H2.depositEsntlId AND H1.createdAt = H2.maxCreatedAt
					) DH ON D.rdp_eid = DH.depositEsntlId
					WHERE D.rom_eid = RC.roomEsntlId
					  AND D.gsw_eid = RC.gosiwonEsntlId
					  AND D.rdp_delete_dtm IS NULL
					ORDER BY D.rdp_regist_dtm DESC
					LIMIT 1
				), 'PENDING') AS depositStatus
			FROM roomContract RC
			JOIN gosiwon G ON RC.gosiwonEsntlId = G.esntlId
			JOIN customer C ON RC.customerEsntlId = C.esntlId
			JOIN room R ON RC.roomEsntlId = R.esntlId
			LEFT JOIN roomContractWho RCW ON RC.esntlId = RCW.contractEsntlId
			LEFT JOIN (
				SELECT 
					contractEsntlId,
					pTime,
					SUM(CASE WHEN (extrapayEsntlId IS NULL OR extrapayEsntlId = '') AND calculateStatus = 'SUCCESS' THEN CAST(paymentAmount AS DECIMAL(20,0)) ELSE 0 END) AS pyl_goods_amount,
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

		// 쿼리 실행
		const mainValues = [...whereValues, limitNum, offset];
		const mainResult = await mariaDBSequelize.query(mainQuery, {
			replacements: mainValues,
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
		const resultList = (Array.isArray(mainResult) ? mainResult : []).map((row) => ({
			...row,
			customerPhone: phoneToDisplay(row.customerPhone) ?? row.customerPhone,
			checkinPhone: phoneToDisplay(row.checkinPhone) ?? row.checkinPhone,
			contractCustomerPhone: phoneToDisplay(row.contractCustomerPhone) ?? row.contractCustomerPhone,
		}));

		// 응답 데이터 구성
		const response = {
			resultList: resultList,
			totcnt: totalCount,
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

		// 계약 정보 조회 (roomContract 기준). 고객 계좌는 il_customer_refund에서 조회
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
				R.deposit AS roomDeposit,
				R.monthlyRent AS roomMonthlyRent,
				RC.checkInTime AS checkInTime,
				C.name AS customerName,
				C.phone AS customerPhone,
				C.birth AS customerBirth,
				RC.customerEsntlId AS customerEsntlId,
				C.id AS customerId,
				ICR.cre_bank_name AS customerBank,
				ICR.cre_account_number AS customerBankAccount,
				ICR.cre_account_holder AS customerAccountHolder,
				RC.month,
				RC.startDate,
				RC.endDate,
				RC.contractDate,
				RC.status AS contractStatus,
				RC.monthlyRent AS contractMonthlyRent,
				RC.memo AS occupantMemo,
				RC.memo2 AS occupantMemo2,
				RCW.emergencyContact AS emergencyContact,
				RCW.checkinName AS checkinName,
				RCW.checkinPhone AS checkinPhone,
				RCW.checkinGender AS checkinGender,
				RCW.checkinAge AS checkinAge,
				RCW.customerName AS contractCustomerName,
				RCW.customerPhone AS contractCustomerPhone,
				RCW.customerGender AS contractCustomerGender,
				RCW.customerAge AS contractCustomerAge,
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
			LEFT JOIN roomContractWho RCW ON RC.esntlId = RCW.contractEsntlId
			LEFT JOIN il_customer_refund ICR ON ICR.cus_eid = C.esntlId AND ICR.cre_delete_dtm IS NULL
				AND ICR.cre_regist_dtm = (SELECT MAX(cre_regist_dtm) FROM il_customer_refund i2 WHERE i2.cus_eid = C.esntlId AND i2.cre_delete_dtm IS NULL)
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

		// 나이: 생년월일 기준 계산 (formatAge), 없으면 RCW 저장값 사용
		contractInfo.contractCustomerAge = formatAge(contractInfo.customerBirth) ?? contractInfo.contractCustomerAge ?? null;
		// 전화번호 포맷팅 (반환 시 " - " 구분자)
		contractInfo.customerPhone = phoneToDisplay(contractInfo.customerPhone) ?? contractInfo.customerPhone;
		contractInfo.checkinPhone = phoneToDisplay(contractInfo.checkinPhone) ?? contractInfo.checkinPhone;
		contractInfo.contractCustomerPhone = phoneToDisplay(contractInfo.contractCustomerPhone) ?? contractInfo.contractCustomerPhone;

		// 연동 결제 내역 조회 (paymentLog, extrapayEsntlId 값 없음 = 일반 연장 결제)
		const paymentLogQuery = `
			SELECT 
				PL.esntlId,
				PL.pDate,
				PL.pTime,
				PL.pyl_goods_amount,
				PL.paymentAmount AS rawPaymentAmount,
				FORMAT(IFNULL(PL.paymentAmount, 0), 0) AS paymentAmount,
				PL.paymentPoint,
				PL.paymentCoupon,
				PL.paymentType,
				PL.calculateStatus,
				PL.code,
				PL.reason,
				PL.withdrawalStatus,
				PL.extrapayEsntlId AS extrapayEsntlId
			FROM paymentLog PL
			WHERE PL.contractEsntlId = ?
				AND (PL.extrapayEsntlId IS NULL OR PL.extrapayEsntlId = '')
			ORDER BY PL.pDate DESC, PL.pTime DESC
		`;

		const paymentLogList = await mariaDBSequelize.query(paymentLogQuery, {
			replacements: [contractEsntlId],
			type: mariaDBSequelize.QueryTypes.SELECT,
		});

		// 메인 결제 상태 (extrapayEsntlId 값 없는 paymentLog 기준, 최신 건의 calculateStatus)
		contractInfo.paymentStatus =
			paymentLogList && paymentLogList.length > 0
				? (paymentLogList[0].calculateStatus ?? paymentLogList[0].calculatestatus ?? null)
				: null;

		// 메인 결제 금액 (refund dataWithDetail의 paymentAmount와 동일하게, 최신 일반 결제 1건의 원본 paymentAmount)
		contractInfo.paymentAmount =
			paymentLogList && paymentLogList.length > 0
				? (paymentLogList[0].rawPaymentAmount ?? paymentLogList[0].paymentAmount ?? null)
				: null;
		// 입실료(상품금액), 포인트·쿠폰 (최신 일반 결제 1건 기준)
		contractInfo.entryFee =
			paymentLogList && paymentLogList.length > 0
				? (paymentLogList[0].pyl_goods_amount ?? null)
				: null;
		contractInfo.paymentPoint =
			paymentLogList && paymentLogList.length > 0
				? (parseInt(paymentLogList[0].paymentPoint, 10) || 0)
				: 0;
		contractInfo.paymentCoupon =
			paymentLogList && paymentLogList.length > 0
				? (parseInt(paymentLogList[0].paymentCoupon, 10) || 0)
				: 0;
		// 메인 결제와 같은 행의 결제일·결제시간 (pDate, pTime)
		contractInfo.pDate =
			paymentLogList && paymentLogList.length > 0 ? (paymentLogList[0].pDate ?? null) : null;
		contractInfo.pTime =
			paymentLogList && paymentLogList.length > 0 ? (paymentLogList[0].pTime ?? null) : null;

		// 추가 결제 내역 조회 (extraPayment, extrapayEsntlId로 extraPayment.esntlId 반환)
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
				ep.esntlId AS extrapayEsntlId,
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
		// moveDate는 DATE_FORMAT으로 문자열 반환 (Date 객체가 되면 JSON 직렬화 시 UTC로 나가서 -9시간 되어 보이는 문제 방지)
		const roomMoveQuery = `
			SELECT 
				esntlId,
				DATE_FORMAT(moveDate, '%Y-%m-%d %H:%i:%s') AS moveDate
			FROM roomMoveStatus
			WHERE contractEsntlId = ?
				AND status = 'PENDING'
				AND deleteYN = 'N'
			ORDER BY moveDate DESC
			LIMIT 1
		`;

		const [roomMoveInfo] = await mariaDBSequelize.query(roomMoveQuery, {
			replacements: [contractEsntlId],
			type: mariaDBSequelize.QueryTypes.SELECT,
		});

		// 방이동 예정 정보를 contractInfo에 추가
		if (roomMoveInfo && roomMoveInfo.moveDate) {
			contractInfo.isRoomMoveScheduled = true;
			contractInfo.roomMoveDate = roomMoveInfo.moveDate; // DB 저장값 그대로 문자열로 반환
			contractInfo.roomMoveEsntlId = roomMoveInfo.esntlId;
		} else {
			contractInfo.isRoomMoveScheduled = false;
			contractInfo.roomMoveDate = null;
			contractInfo.roomMoveEsntlId = null;
		}

		// 계약 상태(contractStatus) 응답에 포함 (드라이버별 컬럼명 차이 대응)
		contractInfo.contractStatus =
			contractInfo.contractStatus ?? contractInfo.contractstatus ?? null;

		// il_room_deposit: 고시원id·방id·rdp_customer_name 일치 시 rdp_price를 deposit으로 반환
		const customerNameForDeposit =
			contractInfo.customerName ||
			contractInfo.checkinName ||
			contractInfo.contractCustomerName ||
			null;
		let deposit = null;
		if (contractInfo.gosiwonEsntlId && contractInfo.roomEsntlId && customerNameForDeposit) {
			console.log('[roomContract/detail] il_room_deposit 조회 조건:', {
				gosiwonEsntlId: contractInfo.gosiwonEsntlId,
				roomEsntlId: contractInfo.roomEsntlId,
				rdp_customer_name: customerNameForDeposit,
			});
			const depositQuery = `
				SELECT rdp_price
				FROM il_room_deposit
				WHERE gsw_eid = ?
					AND rom_eid = ?
					AND rdp_customer_name = ?
					AND (rdp_delete_dtm IS NULL)
				ORDER BY rdp_regist_dtm DESC
				LIMIT 1
			`;
			const [depositRow] = await mariaDBSequelize.query(depositQuery, {
				replacements: [
					contractInfo.gosiwonEsntlId,
					contractInfo.roomEsntlId,
					customerNameForDeposit,
				],
				type: mariaDBSequelize.QueryTypes.SELECT,
			});
			// console.log('[roomContract/detail] il_room_deposit 조회 결과:', { depositRow: depositRow || null });
			if (depositRow && depositRow.rdp_price != null) {
				deposit = parseInt(depositRow.rdp_price, 10) || depositRow.rdp_price;
			}
			// console.log('[roomContract/detail] deposit 반환값:', deposit);
		} else {
			console.log('[roomContract/detail] il_room_deposit 조회 생략 (조건 부족):', {
				gosiwonEsntlId: contractInfo.gosiwonEsntlId,
				roomEsntlId: contractInfo.roomEsntlId,
				customerNameForDeposit: customerNameForDeposit,
			});
		}
		// il_room_deposit 없으면 room.deposit 사용 (우선순위: il_room_deposit > room.deposit)
		if (deposit == null && contractInfo.roomDeposit != null) {
			deposit = parseInt(contractInfo.roomDeposit, 10) || contractInfo.roomDeposit;
		}
		contractInfo.deposit = deposit;

		// il_room_refund_request: 해당 계약의 환불 요청 정보 1건 조회 (최신)
		const refundRequestQuery = `
			SELECT 
				RRR.rrr_process_status_cd AS refundStatus,
				DATE_FORMAT(RRR.rrr_regist_dtm, '%Y-%m-%d %H:%i:%s') AS refundRequestDate,
				RRR.rrr_leave_date AS refundCheckOutDate,
				RRR.rrr_leave_type_cd AS refundLeaveType,
				RRR.rrr_leave_reason AS refundLeaveReason,
				RRR.rrr_registrant_id AS refundRegistrantId,
				RRR.rrr_contacted_owner AS refundContactedOwner,
				RRR.rrr_refund_total_amt AS refundTotalAmount
			FROM il_room_refund_request RRR
			WHERE RRR.ctt_eid = ?
			ORDER BY RRR.rrr_sno DESC
			LIMIT 1
		`;
		const [refundRequestRow] = await mariaDBSequelize.query(refundRequestQuery, {
			replacements: [contractEsntlId],
			type: mariaDBSequelize.QueryTypes.SELECT,
		});
		if (refundRequestRow) {
			contractInfo.refundStatus = refundRequestRow.refundStatus;
			contractInfo.refundRequestDate = refundRequestRow.refundRequestDate;
			contractInfo.refundCheckOutDate = refundRequestRow.refundCheckOutDate;
			contractInfo.refundLeaveType = refundRequestRow.refundLeaveType;
			contractInfo.refundLeaveReason = refundRequestRow.refundLeaveReason;
			contractInfo.refundRegistrantId = refundRequestRow.refundRegistrantId;
			contractInfo.refundContactedOwner = refundRequestRow.refundContactedOwner != null ? Number(refundRequestRow.refundContactedOwner) : null;
			contractInfo.refundTotalAmount = refundRequestRow.refundTotalAmount != null ? Number(refundRequestRow.refundTotalAmount) : null;
		} else {
			contractInfo.refundStatus = null;
			contractInfo.refundRequestDate = null;
			contractInfo.refundCheckOutDate = null;
			contractInfo.refundLeaveType = null;
			contractInfo.refundLeaveReason = null;
			contractInfo.refundRegistrantId = null;
			contractInfo.refundContactedOwner = null;
			contractInfo.refundTotalAmount = null;
		}

		errorHandler.successThrow(res, '계약 상세보기 조회 성공', {
			contractInfo: contractInfo,
			paymentLogList: paymentLogList || [],
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

		// 계약 정보 조회 (roomContractWho 포함, deposit 테이블 제거)
		const contractInfo = await mariaDBSequelize.query(
			`
			SELECT 
				RC.*,
				RCW.checkinName AS checkinName,
				RCW.checkinPhone AS checkinPhone,
				RCW.checkinGender AS checkinGender,
				RCW.checkinAge AS checkinAge,
				RCW.customerName AS customerName,
				RCW.customerPhone AS customerPhone,
				RCW.customerGender AS customerGender,
				RCW.customerAge AS customerAge,
				RCW.emergencyContact AS emergencyContact,
				C.birth AS customerBirth,
				RC.customerEsntlId AS contractorEsntlId,
				(SELECT ICR.cre_account_holder FROM il_customer_refund ICR
				 WHERE ICR.cus_eid = RC.customerEsntlId AND ICR.cre_delete_dtm IS NULL
				 ORDER BY ICR.cre_regist_dtm DESC LIMIT 1) AS depositAccountHolder
			FROM roomContract RC
			JOIN room R ON RC.roomEsntlId = R.esntlId
			JOIN customer C ON RC.customerEsntlId = C.esntlId
			LEFT JOIN roomContractWho RCW ON RC.esntlId = RCW.contractEsntlId
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
		// roomContractWho 테이블 업데이트 대상 (입실자/계약고객/비상연락망)
		const whoUpdateData = {};
		if (
			emergencyContact !== undefined &&
			emergencyContact !== contract.emergencyContact
		) {
			whoUpdateData.emergencyContact = emergencyContact;
			changes.push(
				`비상연락망/관계: ${contract.emergencyContact || '없음'} → ${emergencyContact || '없음'}`
			);
		}
		if (checkinName !== undefined && checkinName !== contract.checkinName) {
			whoUpdateData.checkinName = checkinName;
			changes.push(
				`체크인한 사람 이름: ${contract.checkinName || '없음'} → ${checkinName || '없음'}`
			);
		}
		if (checkinPhone !== undefined && checkinPhone !== contract.checkinPhone) {
			whoUpdateData.checkinPhone = phoneToRaw(checkinPhone) ?? checkinPhone;
			changes.push(
				`체크인한 사람 연락처: ${contract.checkinPhone || '없음'} → ${checkinPhone || '없음'}`
			);
		}
		if (checkinGender !== undefined && checkinGender !== contract.checkinGender) {
			whoUpdateData.checkinGender = checkinGender;
			changes.push(
				`체크인한 사람 성별: ${contract.checkinGender || '없음'} → ${checkinGender || '없음'}`
			);
		}
		if (checkinAge !== undefined && checkinAge !== contract.checkinAge) {
			whoUpdateData.checkinAge = checkinAge;
			changes.push(
				`체크인한 사람 나이: ${contract.checkinAge || '없음'} → ${checkinAge || '없음'}`
			);
		}
		if (contractCustomerName !== undefined && contractCustomerName !== contract.customerName) {
			whoUpdateData.customerName = contractCustomerName;
			changes.push(
				`고객 이름: ${contract.customerName || '없음'} → ${contractCustomerName || '없음'}`
			);
		}
		if (contractCustomerPhone !== undefined && contractCustomerPhone !== contract.customerPhone) {
			whoUpdateData.customerPhone = phoneToRaw(contractCustomerPhone) ?? contractCustomerPhone;
			changes.push(
				`고객 연락처: ${contract.customerPhone || '없음'} → ${contractCustomerPhone || '없음'}`
			);
		}
		if (contractCustomerGender !== undefined && contractCustomerGender !== contract.customerGender) {
			whoUpdateData.customerGender = contractCustomerGender;
			changes.push(
				`고객 성별: ${contract.customerGender || '없음'} → ${contractCustomerGender || '없음'}`
			);
		}
		if (contractCustomerAge !== undefined && contractCustomerAge !== contract.customerAge) {
			whoUpdateData.customerAge = contractCustomerAge;
			changes.push(
				`고객 나이: ${contract.customerAge || '없음'} → ${contractCustomerAge || '없음'}`
			);
		}

		// customer 테이블 업데이트 (입주자) - 이름, 연락처, 성별, 생년월일만. 계좌는 il_customer_refund 사용
		const customerUpdateData = {};
		const {
			customerName,
			customerPhone,
			customerGender,
			customerBirth,
			customerBank,
			customerBankAccount,
			customerAccountHolder,
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
			customerUpdateData.phone = phoneToRaw(customerPhone) ?? customerPhone;
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

		// 고객 계좌: il_customer_refund 테이블에 저장 (cre_bank_name, cre_account_number, cre_account_holder)
		if (
			customerBank !== undefined ||
			customerBankAccount !== undefined ||
			customerAccountHolder !== undefined
		) {
			const [existingRefund] = await mariaDBSequelize.query(
				`SELECT cre_eid, cre_bank_name, cre_account_number, cre_account_holder
				 FROM il_customer_refund
				 WHERE cus_eid = ? AND cre_delete_dtm IS NULL
				 ORDER BY cre_regist_dtm DESC LIMIT 1`,
				{
					replacements: [contract.customerEsntlId],
					type: mariaDBSequelize.QueryTypes.SELECT,
					transaction,
				}
			);

			const newBank = customerBank !== undefined ? customerBank : (existingRefund?.cre_bank_name ?? null);
			const newAccountNumber = customerBankAccount !== undefined ? customerBankAccount : (existingRefund?.cre_account_number ?? null);
			const newAccountHolder = customerAccountHolder !== undefined ? customerAccountHolder : (existingRefund?.cre_account_holder ?? null);

			if (existingRefund && existingRefund.cre_eid) {
				await mariaDBSequelize.query(
					`UPDATE il_customer_refund
					 SET cre_bank_name = ?, cre_account_number = ?, cre_account_holder = ?,
					     cre_update_dtm = NOW(), cre_updater_id = ?
					 WHERE cre_eid = ?`,
					{
						replacements: [newBank, newAccountNumber, newAccountHolder, writerAdminId, existingRefund.cre_eid],
						type: mariaDBSequelize.QueryTypes.UPDATE,
						transaction,
					}
				);
				changes.push(`입주자 계좌(은행/계좌번호/예금주): il_customer_refund 업데이트`);
			} else {
				const creEid = await idsNext('il_customer_refund', 'CRE', transaction);
				await mariaDBSequelize.query(
					`INSERT INTO il_customer_refund (cre_eid, cus_eid, cre_bank_name, cre_account_number, cre_account_holder, cre_registrant_id, cre_updater_id, cre_regist_dtm, cre_update_dtm)
					 VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
					{
						replacements: [creEid, contract.customerEsntlId, newBank, newAccountNumber, newAccountHolder, writerAdminId, writerAdminId],
						type: mariaDBSequelize.QueryTypes.INSERT,
						transaction,
					}
				);
				changes.push(`입주자 계좌(은행/계좌번호/예금주): il_customer_refund 신규 등록`);
			}
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
					contractorUpdateData.phone = phoneToRaw(contractorPhone) ?? contractorPhone;
					changes.push(
						`계약자 연락처: ${contractorInfo.phone || '없음'} → ${contractorPhone}`
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

		// roomContractWho upsert (입실자/계약고객/비상연락망)
		if (Object.keys(whoUpdateData).length > 0) {
			const whoKeys = ['checkinName', 'checkinPhone', 'checkinGender', 'checkinAge', 'customerName', 'customerPhone', 'customerGender', 'customerAge', 'emergencyContact'];
			const whoValues = [
				contractEsntlId,
				...(whoKeys.map((k) => (whoUpdateData[k] !== undefined ? whoUpdateData[k] : (contract[k] ?? null)))),
			];
			const placeholders = ['?', ...whoKeys.map(() => '?')].join(', ');
			const updateClause = whoKeys.map((c) => `${c} = VALUES(${c})`).join(', ');
			await mariaDBSequelize.query(
				`INSERT INTO roomContractWho (contractEsntlId, ${whoKeys.join(', ')}, updatedAt) VALUES (${placeholders}, NOW())
				 ON DUPLICATE KEY UPDATE ${updateClause}, updatedAt = NOW()`,
				{
					replacements: whoValues,
					type: mariaDBSequelize.QueryTypes.INSERT,
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

		// 히스토리 생성
		if (changes.length > 0) {
			try {
				const historyContent = `계약 정보 수정: ${changes.join(', ')}`;

				await historyController.createHistoryRecord(
					{
						gosiwonEsntlId: contract.gosiwonEsntlId,
						roomEsntlId: contract.roomEsntlId,
						contractEsntlId: contractEsntlId,
						content: historyContent,
						category: 'CONTRACT',
						priority: 'NORMAL',
						publicRange: 0,
						writerAdminId: writerAdminId,
						writerType: 'ADMIN',
					},
					transaction
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

// 보증금 및 추가 결제 정보 조회
exports.getDepositAndExtra = async (req, res, next) => {
	try {
		verifyAdminToken(req);

		const { contractEsntlId } = req.query;

		if (!contractEsntlId) {
			errorHandler.errorThrow(400, 'contractEsntlId를 입력해주세요.');
		}

		// 계약 기본 정보 조회 (고시원id, 방id, 계약서id, monthlyRent, 입실자/계약자, depositList용 필드)
		const contractQuery = `
			SELECT 
				RC.esntlId AS contractEsntlId,
				RC.gosiwonEsntlId,
				RC.roomEsntlId,
				RC.customerEsntlId,
				RC.monthlyRent AS monthlyRent,
				RC.startDate,
				RC.endDate,
				RC.status AS contractStatus,
				RCW.checkinName,
				RCW.checkinPhone,
				RCW.customerName AS contractorName,
				RCW.customerPhone AS contractorPhone,
				R.roomNumber,
				G.name AS gosiwonName,
				C.name AS currentOccupantName,
				R.customerEsntlId AS currentOccupantID,
				ICR.cre_bank_name AS customerBank,
				ICR.cre_account_number AS customerBankAccount,
				TRIM(CONCAT(IFNULL(ICR.cre_bank_name,''), ' ', IFNULL(ICR.cre_account_number,''))) AS refundBankAccount
			FROM roomContract RC
			LEFT JOIN room R ON RC.roomEsntlId = R.esntlId AND RC.gosiwonEsntlId = R.gosiwonEsntlId
			LEFT JOIN gosiwon G ON RC.gosiwonEsntlId = G.esntlId
			LEFT JOIN customer C ON R.customerEsntlId = C.esntlId
			LEFT JOIN roomContractWho RCW ON RC.esntlId = RCW.contractEsntlId
			LEFT JOIN il_customer_refund ICR ON ICR.cus_eid = RC.customerEsntlId AND ICR.cre_delete_dtm IS NULL
				AND ICR.cre_regist_dtm = (SELECT MAX(cre_regist_dtm) FROM il_customer_refund i2 WHERE i2.cus_eid = RC.customerEsntlId AND i2.cre_delete_dtm IS NULL)
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

		// extraPayment 테이블에서 계약서 id를 기준으로 결제 내역 조회
		const extraPaymentList = await extraPayment.findAll({
			where: {
				contractEsntlId: contractEsntlId,
				deleteYN: 'N',
			},
			order: [['createdAt', 'DESC']],
			raw: true,
		});

		// extraData에 monthlyRent·정산상태(settlementStatus) 추가
		const extraEsntlIds = extraPaymentList.map((ep) => ep.esntlId);
		let paymentLogByExtra = [];
		if (extraEsntlIds.length > 0) {
			paymentLogByExtra = await paymentLog.findAll({
				where: {
					extrapayEsntlId: extraEsntlIds,
				},
				attributes: ['extrapayEsntlId', 'pyl_expected_settlement_date'],
				raw: true,
			});
		}
		const paymentLogMap = paymentLogByExtra.reduce((acc, row) => {
			if (row.extrapayEsntlId) {
				acc[row.extrapayEsntlId] = row;
			}
			return acc;
		}, {});

		// 오늘 날짜 (YYYY-MM-DD, 서버 로컬 기준)
		const now = new Date();
		const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

		// 정산예정일이 지난 건에 대해 해당 고시원의 il_daily_selling_closing 정산 완료 여부 1회 조회
		let closingComplete = false;
		const hasSettlementDatePassed = paymentLogByExtra.some(
			(row) => row.pyl_expected_settlement_date && row.pyl_expected_settlement_date <= todayStr
		);
		if (hasSettlementDatePassed && contractInfo.gosiwonEsntlId) {
			const closingCheckSql = `
				SELECT 1 AS ok
				FROM il_daily_selling_closing
				WHERE gsw_eid = ?
					AND dsc_complete_dtm IS NOT NULL
					AND dsc_complete_dtm <= NOW()
				LIMIT 1
			`;
			const [closingRow] = await mariaDBSequelize.query(closingCheckSql, {
				replacements: [contractInfo.gosiwonEsntlId],
				type: mariaDBSequelize.QueryTypes.SELECT,
			});
			closingComplete = !!closingRow;
		}
		const extraData = extraPaymentList.map((item) => {
			const pl = paymentLogMap[item.esntlId];
			const expectedDate = pl?.pyl_expected_settlement_date || null;
			let settlementStatus = 'PENDING';
			if (expectedDate) {
				if (todayStr < expectedDate) {
					settlementStatus = 'PENDING';
				} else {
					settlementStatus = closingComplete ? 'COMPLETE' : 'PENDING';
				}
			}
			return {
				...item,
				monthlyRent: contractInfo.monthlyRent ?? null,
				settlementStatus,
			};
		});

		// il_room_deposit에서 계약서 입실자/계약자/방id로 매칭하여 보증금 정보 조회 (구 deposit 응답 포맷 유지)
		const checkinName = (contractInfo.checkinName && String(contractInfo.checkinName).trim()) || '';
		const checkinPhone = (contractInfo.checkinPhone && String(contractInfo.checkinPhone).trim()) || '';
		const contractorName = (contractInfo.contractorName && String(contractInfo.contractorName).trim()) || '';
		const contractorPhone = (contractInfo.contractorPhone && String(contractInfo.contractorPhone).trim()) || '';
		// 입실자/계약자 정보로 il_room_deposit 매칭 시 전화번호 필수
		const hasCheckin = !!checkinPhone;
		const hasContractor = !!contractorPhone;

		// [depositAndExtra] 디버그 로그
		console.log('[depositAndExtra] contractEsntlId:', contractEsntlId);
		console.log('[depositAndExtra] contractInfo(원본):', {
			gosiwonEsntlId: contractInfo.gosiwonEsntlId,
			roomEsntlId: contractInfo.roomEsntlId,
			checkinName: contractInfo.checkinName,
			checkinPhone: contractInfo.checkinPhone,
			contractorName: contractInfo.contractorName,
			contractorPhone: contractInfo.contractorPhone,
		});
		console.log('[depositAndExtra] 매칭용(trim):', {
			checkinName,
			checkinPhone,
			contractorName,
			contractorPhone,
			hasCheckin,
			hasContractor,
		});

		let depositList = [];
		if (hasCheckin || hasContractor) {
			// depositList와 동일한 구조로 조회
			const depositQuery = `
			SELECT
				D.rdp_eid AS depositEsntlId,
				D.rom_eid AS roomEsntlId,
				D.gsw_eid AS gosiwonEsntlId,
				D.rdp_price AS depositAmount,
				CASE
					WHEN D.rdp_delete_dtm IS NOT NULL THEN 'DELETED'
					WHEN (SELECT H_s.status FROM il_room_deposit_history H_s WHERE H_s.depositEsntlId = D.rdp_eid AND H_s.type = 'DEPOSIT' ORDER BY H_s.createdAt DESC LIMIT 1) IS NULL THEN NULL
					WHEN (SELECT H_s.status FROM il_room_deposit_history H_s WHERE H_s.depositEsntlId = D.rdp_eid AND H_s.type = 'DEPOSIT' ORDER BY H_s.createdAt DESC LIMIT 1) = 'PENDING' THEN 'PENDING'
					WHEN (SELECT H_s.status FROM il_room_deposit_history H_s WHERE H_s.depositEsntlId = D.rdp_eid AND H_s.type = 'DEPOSIT' ORDER BY H_s.createdAt DESC LIMIT 1) = 'PARTIAL' THEN 'PARTIAL'
					WHEN (SELECT H_s.status FROM il_room_deposit_history H_s WHERE H_s.depositEsntlId = D.rdp_eid AND H_s.type = 'DEPOSIT' ORDER BY H_s.createdAt DESC LIMIT 1) = 'DELETED' THEN 'DELETED'
					WHEN (SELECT H_s.status FROM il_room_deposit_history H_s WHERE H_s.depositEsntlId = D.rdp_eid AND H_s.type = 'DEPOSIT' ORDER BY H_s.createdAt DESC LIMIT 1) IN ('COMPLETED', 'RETURN_COMPLETED') THEN 'COMPLETE'
					WHEN D.rdp_completed_dtm IS NOT NULL THEN 'COMPLETE'
					ELSE (SELECT H_s.status FROM il_room_deposit_history H_s WHERE H_s.depositEsntlId = D.rdp_eid AND H_s.type = 'DEPOSIT' ORDER BY H_s.createdAt DESC LIMIT 1)
				END AS depositStatus,
				(SELECT COALESCE(SUM(H.amount), 0) FROM il_room_deposit_history H WHERE H.depositEsntlId = D.rdp_eid AND H.type = 'DEPOSIT') AS depositLastestAmount,
				(SELECT DATE_FORMAT(MAX(H.createdAt), '%Y-%m-%d %H:%i') FROM il_room_deposit_history H WHERE H.depositEsntlId = D.rdp_eid AND H.type = 'DEPOSIT') AS depositLastestTime,
				(SELECT H_ret.status FROM il_room_deposit_history H_ret WHERE H_ret.depositEsntlId = D.rdp_eid AND H_ret.type = 'RETURN' ORDER BY COALESCE(H_ret.refundDate, H_ret.createdAt) DESC, H_ret.createdAt DESC LIMIT 1) AS refundStatus,
				(SELECT DATE_FORMAT(MAX(COALESCE(H_ret.refundDate, H_ret.createdAt)), '%Y-%m-%d %H:%i') FROM il_room_deposit_history H_ret WHERE H_ret.depositEsntlId = D.rdp_eid AND H_ret.type = 'RETURN') AS refundCreatedAt,
				(SELECT H_ret.status FROM il_room_deposit_history H_ret WHERE H_ret.depositEsntlId = D.rdp_eid AND H_ret.type = 'RETURN' ORDER BY COALESCE(H_ret.refundDate, H_ret.createdAt) DESC, H_ret.createdAt DESC LIMIT 1) AS returnStatus,
				(SELECT COALESCE(SUM(H_ret.amount + COALESCE(H_ret.deductionAmount, 0)), 0) FROM il_room_deposit_history H_ret WHERE H_ret.depositEsntlId = D.rdp_eid AND H_ret.type = 'RETURN' AND H_ret.status IN ('COMPLETED', 'PARTIAL', 'RETURN_COMPLETED')) AS returnLastestAmount,
				(SELECT DATE_FORMAT(MAX(COALESCE(H_ret.refundDate, H_ret.createdAt)), '%Y-%m-%d %H:%i') FROM il_room_deposit_history H_ret WHERE H_ret.depositEsntlId = D.rdp_eid AND H_ret.type = 'RETURN') AS returnLastestTime
			FROM il_room_deposit D
			WHERE D.gsw_eid = ?
				AND D.rdp_delete_dtm IS NULL
				AND (
					(TRIM(IFNULL(D.rdp_customer_name, '')) = ? AND (TRIM(IFNULL(D.rdp_customer_phone, '')) = '' OR REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(IFNULL(D.rdp_customer_phone, '')), '-', ''), ' ', ''), '.', ''), '(', ''), ')', '') = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(IFNULL(?, '')), '-', ''), ' ', ''), '.', ''), '(', ''), ')', '')))
					OR (TRIM(IFNULL(D.rdp_customer_name, '')) = ? AND (TRIM(IFNULL(D.rdp_customer_phone, '')) = '' OR REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(IFNULL(D.rdp_customer_phone, '')), '-', ''), ' ', ''), '.', ''), '(', ''), ')', '') = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(IFNULL(?, '')), '-', ''), ' ', ''), '.', ''), '(', ''), ')', '')))
				)
			ORDER BY D.rdp_regist_dtm DESC
		`;

			const replacements = [
				contractInfo.gosiwonEsntlId,
				checkinName,
				checkinPhone,
				contractorName,
				contractorPhone,
			];
			console.log('[depositAndExtra] deposit 쿼리 replacements:', replacements);

			const depositRows = await mariaDBSequelize.query(depositQuery, {
				replacements,
				type: mariaDBSequelize.QueryTypes.SELECT,
			});

			console.log('[depositAndExtra] deposit 매칭 결과 건수:', depositRows?.length ?? 0);
			if (depositRows?.length > 0) {
				console.log('[depositAndExtra] deposit 첫 건:', depositRows[0]);
			} else {
				// 해당 방·고시원의 il_room_deposit 목록(이름 조건 없이) 조회해 비교용 로그
				const debugRows = await mariaDBSequelize.query(
					`SELECT rdp_eid, rom_eid, gsw_eid, rdp_customer_name, rdp_customer_phone, rdp_price, rdp_delete_dtm
					 FROM il_room_deposit
					 WHERE gsw_eid = ? AND rdp_delete_dtm IS NULL
					 ORDER BY rdp_regist_dtm DESC
					 LIMIT 10`,
					{
						replacements: [contractInfo.gosiwonEsntlId],
						type: mariaDBSequelize.QueryTypes.SELECT,
					}
				);
				console.log('[depositAndExtra] 해당 고시원 il_room_deposit (이름·전화번호 조건 제외) 건수:', debugRows?.length ?? 0);
				console.log('[depositAndExtra] 해당 고시원 il_room_deposit 샘플:', debugRows?.slice(0, 3) ?? []);
			}

			// depositList와 동일한 구조로 매핑 (전화번호 반환 시 " - " 포맷)
			depositList = (depositRows || []).map((row) => ({
				depositEsntlId: row.depositEsntlId || null,
				roomEsntlId: row.roomEsntlId,
				gosiwonEsntlId: row.gosiwonEsntlId || null,
				gosiwonName: contractInfo.gosiwonName || null,
				roomNumber: contractInfo.roomNumber,
				currentOccupantName: contractInfo.currentOccupantName || null,
				currentOccupantID: contractInfo.currentOccupantID || null,
				customerBank: contractInfo.customerBank || null,
				customerBankAccount: contractInfo.customerBankAccount || null,
				refundBankAccount: (contractInfo.refundBankAccount && String(contractInfo.refundBankAccount).trim()) || null,
				checkinName: contractInfo.checkinName || null,
				checkinPhone: phoneToDisplay(contractInfo.checkinPhone) ?? contractInfo.checkinPhone ?? null,
				contractorName: contractInfo.contractorName || null,
				contractorPhone: phoneToDisplay(contractInfo.contractorPhone) ?? contractInfo.contractorPhone ?? null,
				depositAmount: row.depositAmount || null,
				contractEsntlId: contractInfo.contractEsntlId || null,
				moveInDate: contractInfo.startDate ? String(contractInfo.startDate).slice(0, 10) : null,
				moveOutDate: contractInfo.endDate ? String(contractInfo.endDate).slice(0, 10) : null,
				contractStatus: contractInfo.contractStatus || null,
				depositStatus: row.depositStatus || null,
				depositLastestAmount: row.depositLastestAmount != null ? Number(row.depositLastestAmount) : null,
				depositLastestTime: row.depositLastestTime || null,
				refundStatus: row.refundStatus || null,
				refundCreatedAt: row.refundCreatedAt || null,
				returnStatus: row.returnStatus || null,
				returnLastestAmount: row.returnLastestAmount != null ? Number(row.returnLastestAmount) : null,
				returnLastestTime: row.returnLastestTime || null,
			}));
		} else {
			console.log('[depositAndExtra] 입실자/계약자 정보 없음 - deposit 조회 생략');
		}

		errorHandler.successThrow(res, '보증금 및 추가 결제 정보 조회 성공', {
			contractEsntlId: contractInfo.contractEsntlId,
			gosiwonEsntlId: contractInfo.gosiwonEsntlId,
			roomEsntlId: contractInfo.roomEsntlId,
			extraData,
			depositData: depositList,
		});
	} catch (err) {
		next(err);
	}
};

