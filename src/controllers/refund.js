const {
	mariaDBSequelize,
	refund,
	room,
	customer,
	history,
	ilRoomRefundRequest,
} = require('../models');
const errorHandler = require('../middleware/error');
const { getWriterAdminId } = require('../utils/auth');
const { next: idsNext } = require('../utils/idsNext');
const formatAge = require('../utils/formatAge');

const HISTORY_PREFIX = 'HISTORY';
const HISTORY_PADDING = 10;
const REFUND_PREFIX = 'RFND';
const REFUND_PADDING = 10;

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

// 환불 ID 생성 함수
const generateRefundId = async (transaction) => {
	const latest = await refund.findOne({
		attributes: ['esntlId'],
		order: [['esntlId', 'DESC']],
		transaction,
		lock: transaction ? transaction.LOCK.UPDATE : undefined,
	});

	if (!latest || !latest.esntlId) {
		return `${REFUND_PREFIX}${String(1).padStart(REFUND_PADDING, '0')}`;
	}

	const numberPart = parseInt(
		latest.esntlId.replace(REFUND_PREFIX, ''),
		10
	);
	const nextNumber = Number.isNaN(numberPart) ? 1 : numberPart + 1;
	return `${REFUND_PREFIX}${String(nextNumber).padStart(
		REFUND_PADDING,
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

	if (!decodedToken || (!decodedToken.admin && !decodedToken.partner)) {
		errorHandler.errorThrow(401, '관리자 정보가 없습니다.');
	}
	return decodedToken;
};

// 방 사용 후 상태 설정 함수
// 반환값: 생성된 roomStatus ID 배열
const roomAfterUse = async (
	{
		gosiwonEsntlId,
		roomEsntlId,
		check_basic_sell,
		unableCheckInReason,
		check_room_only_config,
		sell_able_start_date,
		sell_able_end_date,
		can_checkin_start_date,
		can_checkin_end_date,
		baseDate, // 기준 날짜 (방이동의 경우 moveDate, 퇴실의 경우 현재 날짜)
	},
	transaction
) => {
	const createdStatusIds = []; // 생성된 상태 ID들을 저장
	// check_room_only_config가 true이면 전달된 날짜를 그대로 사용
	if (check_room_only_config === true) {
		// unableCheckInReason이 없고 check_room_only_config가 true인 경우: ON_SALE과 CAN_CHECKIN 상태 생성
		if (!sell_able_start_date || !sell_able_end_date) {
			errorHandler.errorThrow(
				400,
				'check_room_only_config가 true일 경우 sell_able_start_date와 sell_able_end_date가 필요합니다.'
			);
		}
		if (!can_checkin_start_date || !can_checkin_end_date) {
			errorHandler.errorThrow(
				400,
				'check_room_only_config가 true일 경우 can_checkin_start_date와 can_checkin_end_date가 필요합니다.'
			);
		}

		// ON_SALE 상태 레코드 생성
		const onSaleId = await idsNext('roomStatus', undefined, transaction);
		createdStatusIds.push(onSaleId);
		const onSaleStartDate = new Date(sell_able_start_date);
		const onSaleEndDate = new Date(sell_able_end_date);
		await mariaDBSequelize.query(
			`
			INSERT INTO roomStatus (
				esntlId,
				roomEsntlId,
				gosiwonEsntlId,
				status,
				statusStartDate,
				statusEndDate,
				etcStartDate,
				etcEndDate,
				createdAt,
				updatedAt
			) VALUES (?, ?, ?, 'ON_SALE', ?, ?, ?, ?, NOW(), NOW())
			`,
			{
				replacements: [
					onSaleId,
					roomEsntlId,
					gosiwonEsntlId,
					onSaleStartDate,
					onSaleEndDate,
					onSaleStartDate, // etcStartDate: statusStartDate와 동일
					onSaleEndDate, // etcEndDate: statusEndDate와 동일
				],
				type: mariaDBSequelize.QueryTypes.INSERT,
				transaction,
			}
		);

		// CAN_CHECKIN 상태 레코드 생성
		const canCheckinId = await idsNext('roomStatus', undefined, transaction);
		createdStatusIds.push(canCheckinId);
		const canCheckinStartDate = new Date(can_checkin_start_date);
		const canCheckinEndDate = new Date(can_checkin_end_date);
		await mariaDBSequelize.query(
			`
			INSERT INTO roomStatus (
				esntlId,
				roomEsntlId,
				gosiwonEsntlId,
				status,
				statusStartDate,
				statusEndDate,
				etcStartDate,
				etcEndDate,
				createdAt,
				updatedAt
			) VALUES (?, ?, ?, 'CAN_CHECKIN', ?, ?, ?, ?, NOW(), NOW())
			`,
			{
				replacements: [
					canCheckinId,
					roomEsntlId,
					gosiwonEsntlId,
					canCheckinStartDate,
					canCheckinEndDate,
					canCheckinStartDate, // etcStartDate: statusStartDate와 동일
					canCheckinEndDate, // etcEndDate: statusEndDate와 동일
				],
				type: mariaDBSequelize.QueryTypes.INSERT,
				transaction,
			}
		);
	} else if (check_basic_sell === true) {
		// il_gosiwon_config에서 설정값 조회
		const [config] = await mariaDBSequelize.query(
			`
			SELECT gsc_checkin_able_date, gsc_sell_able_period
			FROM il_gosiwon_config
			WHERE gsw_eid = ?
			LIMIT 1
			`,
			{
				replacements: [gosiwonEsntlId],
				type: mariaDBSequelize.QueryTypes.SELECT,
				transaction,
			}
		);

		if (!config) {
			errorHandler.errorThrow(404, '고시원 설정 정보를 찾을 수 없습니다.');
		}

		const checkinAbleDate = config.gsc_checkin_able_date || 0; // 일수
		const sellAblePeriod = config.gsc_sell_able_period || 0; // 일수

		// 기준 날짜 계산 (baseDate가 있으면 사용, 없으면 현재 날짜)
		const base = baseDate ? new Date(baseDate) : new Date();
		const checkinStartDate = new Date(base);
		checkinStartDate.setDate(checkinStartDate.getDate() + checkinAbleDate);

		const sellStartDate = new Date(checkinStartDate);
		const sellEndDate = new Date(sellStartDate);
		sellEndDate.setDate(sellEndDate.getDate() + sellAblePeriod);

		// CAN_CHECKIN 종료일: baseDate + checkin_able 일수 + sell_able 일수 (입실가능 종료 = 판매가능 종료와 동일)
		const canCheckinEndDate = new Date(sellEndDate);

		// CAN_CHECKIN 상태 레코드 생성
		const canCheckinId = await idsNext('roomStatus', undefined, transaction);
		createdStatusIds.push(canCheckinId);
		await mariaDBSequelize.query(
			`
			INSERT INTO roomStatus (
				esntlId,
				roomEsntlId,
				gosiwonEsntlId,
				status,
				statusStartDate,
				statusEndDate,
				etcStartDate,
				etcEndDate,
				createdAt,
				updatedAt
			) VALUES (?, ?, ?, 'CAN_CHECKIN', ?, ?, ?, ?, NOW(), NOW())
			`,
			{
				replacements: [
					canCheckinId,
					roomEsntlId,
					gosiwonEsntlId,
					checkinStartDate,
					canCheckinEndDate,
					checkinStartDate, // etcStartDate: statusStartDate와 동일
					canCheckinEndDate, // etcEndDate: statusEndDate와 동일
				],
				type: mariaDBSequelize.QueryTypes.INSERT,
				transaction,
			}
		);

		// ON_SALE 상태 레코드 생성
		const onSaleId = await idsNext('roomStatus', undefined, transaction);
		createdStatusIds.push(onSaleId);
		await mariaDBSequelize.query(
			`
			INSERT INTO roomStatus (
				esntlId,
				roomEsntlId,
				gosiwonEsntlId,
				status,
				statusStartDate,
				statusEndDate,
				etcStartDate,
				etcEndDate,
				createdAt,
				updatedAt
			) VALUES (?, ?, ?, 'ON_SALE', ?, ?, ?, ?, NOW(), NOW())
			`,
			{
				replacements: [
					onSaleId,
					roomEsntlId,
					gosiwonEsntlId,
					sellStartDate,
					sellEndDate,
					sellStartDate, // etcStartDate: statusStartDate와 동일
					sellEndDate, // etcEndDate: statusEndDate와 동일
				],
				type: mariaDBSequelize.QueryTypes.INSERT,
				transaction,
			}
		);
	} else if (check_basic_sell === false) {
		if (unableCheckInReason) {
			// unableCheckInReason이 있는 경우: BEFORE_SALES 상태 생성
			const beforeSalesId = await idsNext('roomStatus', undefined, transaction);
			createdStatusIds.push(beforeSalesId);
			const now = new Date();
			const infiniteDate = new Date('9999-12-31 23:59:59');

			await mariaDBSequelize.query(
				`
				INSERT INTO roomStatus (
					esntlId,
					roomEsntlId,
					gosiwonEsntlId,
					status,
					subStatus,
					statusStartDate,
					statusEndDate,
					etcStartDate,
					etcEndDate,
					statusMemo,
					createdAt,
					updatedAt
				) VALUES (?, ?, ?, 'BEFORE_SALES', ?, ?, ?, ?, ?, ?, NOW(), NOW())
				`,
				{
					replacements: [
						beforeSalesId,
						roomEsntlId,
						gosiwonEsntlId,
						unableCheckInReason,
						now,
						infiniteDate,
						now, // etcStartDate: statusStartDate와 동일
						infiniteDate, // etcEndDate: statusEndDate와 동일
						unableCheckInReason,
					],
					type: mariaDBSequelize.QueryTypes.INSERT,
					transaction,
				}
			);
		}
	}
	
	return createdStatusIds; // 생성된 상태 ID 배열 반환
};

// roomAfterUse 함수를 다른 곳에서도 사용할 수 있도록 export
exports.roomAfterUse = roomAfterUse;

// 환불 및 퇴실처리
exports.processRefundAndCheckout = async (req, res, next) => {
	const transaction = await mariaDBSequelize.transaction();
	try {
		const decodedToken = verifyAdminToken(req);
		const writerAdminId = getWriterAdminId(decodedToken);

		const {
			contractEsntlId,
			cancelReason, // FULL, INTERIM, CANCEL, ETC
			cancelDate,
			cancelMemo,
			liabilityReason, // OWNER, OCCUPANT
			contactedOwner, // 0 or 1
			refundMethod,
			paymentAmount,
			proratedRent,
			penalty,
			totalRefundAmount,
			check_basic_sell,
			unableCheckInReason,
			check_room_only_config,
			sell_able_start_date,
			sell_able_end_date,
			can_checkin_start_date,
			can_checkin_end_date,
		} = req.body;

		// 필수 필드 검증
		if (!contractEsntlId) {
			errorHandler.errorThrow(400, 'contractEsntlId를 입력해주세요.');
		}
		if (!cancelReason) {
			errorHandler.errorThrow(400, 'cancelReason를 입력해주세요.');
		}
		if (!cancelDate) {
			errorHandler.errorThrow(400, 'cancelDate를 입력해주세요.');
		}

		// 취소사유 유효성 검증 및 매핑
		const cancelReasonMap = {
			FULL: 'FULL',
			INTERIM: 'INTERIM',
			CANCEL: 'CANCEL',
			ETC: 'ETC',
		};
		const validCancelReasons = Object.keys(cancelReasonMap);
		if (!validCancelReasons.includes(cancelReason)) {
			errorHandler.errorThrow(
				400,
				`cancelReason는 ${validCancelReasons.join(', ')} 중 하나여야 합니다.`
			);
		}
		const rrr_leave_type_cd = cancelReasonMap[cancelReason];

		// 계약 정보 조회
		const contractInfo = await mariaDBSequelize.query(
			`
			SELECT 
				RC.*,
				RCW.checkinName AS checkinName,
				RCW.checkinPhone AS checkinPhone,
				RCW.customerName AS customerName,
				RCW.customerPhone AS customerPhone,
				C.name AS customerNameFromCustomer,
				D.contractorEsntlId,
				CT.name AS contractorName
			FROM roomContract RC
			JOIN room R ON RC.roomEsntlId = R.esntlId
			JOIN customer C ON RC.customerEsntlId = C.esntlId
			LEFT JOIN roomContractWho RCW ON RC.esntlId = RCW.contractEsntlId
			LEFT JOIN deposit D ON D.contractEsntlId = RC.esntlId AND D.deleteYN = 'N'
			LEFT JOIN customer CT ON D.contractorEsntlId = CT.esntlId
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

		// customerName, reservationEsntlId, reservationName, contractorEsntlId, contractorName 설정
		// 정보가 없다면 모두 customerEsntlId를 기준으로 공통으로 값을 넣어줌
		const customerName =
			contract.customerName || contract.customerNameFromCustomer || null;
		const reservationEsntlId = contract.customerEsntlId || null; // 예약자 정보가 없으면 입실자와 동일
		const reservationName =
			contract.customerName || contract.customerNameFromCustomer || null; // 예약자 이름이 없으면 입실자 이름과 동일
		const contractorEsntlId = contract.contractorEsntlId || contract.customerEsntlId || null; // 계약자 정보가 없으면 입실자와 동일
		const contractorName = contract.contractorName || contract.customerName || null; // 계약자 이름이 없으면 입실자 이름과 동일
		// 입실 시작일과 현재일 차이(일수) 계산
		let usePeriodDays = null;
		if (contract.startDate) {
			const start = new Date(contract.startDate);
			const now = new Date();
			const diffMs = now.getTime() - start.getTime();
			const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
			usePeriodDays = diffDays < 0 ? 0 : diffDays;
		}

		// il_room_refund_request 테이블에 환불 정보 저장 (refund 테이블 사용 안 함)
		const leaveReason =
			cancelMemo ||
			(cancelReasonMap[cancelReason]
				? `${cancelReasonMap[cancelReason]} 퇴실`
				: '퇴실 처리');
		const [refundInsertResult] = await mariaDBSequelize.query(
			`
			INSERT INTO il_room_refund_request (
				gsw_eid,
				rom_eid,
				mbr_eid,
				ctt_eid,
				rrr_leave_type_cd,
				rrr_leave_date,
				rrr_leave_reason,
				rrr_liability_reason,
				rrr_payment_amt,
				rrr_use_period,
				rrr_use_amt,
				rrr_penalty_amt,
				rrr_refund_total_amt,
				rrr_registrant_id,
				rrr_update_dtm,
				rrr_updater_id
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)
			`,
			{
				replacements: [
					contract.gosiwonEsntlId,
					contract.roomEsntlId,
					contract.customerEsntlId,
					contractEsntlId,
					rrr_leave_type_cd,
					cancelDate,
					leaveReason,
					liabilityReason || null,
					paymentAmount || 0,
					usePeriodDays, // rrr_use_period: 입실 시작일부터 현재일까지 일수
					proratedRent || 0,
					penalty || 0,
					totalRefundAmount || 0,
					writerAdminId,
					writerAdminId,
				],
				type: mariaDBSequelize.QueryTypes.INSERT,
				transaction,
			}
		);
		const rrrSno = refundInsertResult?.insertId || refundInsertResult;

		// roomStatus를 CHECKOUT_CONFIRMED로 업데이트 (contractEsntlId 기준), statusEndDate는 당일로 설정
		await mariaDBSequelize.query(
			`
			UPDATE roomStatus 
			SET status = 'CHECKOUT_CONFIRMED',
				statusEndDate = CURDATE(),
				updatedAt = NOW()
			WHERE contractEsntlId = ?
		`,
			{
				replacements: [contractEsntlId],
				type: mariaDBSequelize.QueryTypes.UPDATE,
				transaction,
			}
		);

		// 해당 방(room) 테이블: status=EMPTY, startDate/endDate/customerEsntlId 빈값
		await mariaDBSequelize.query(
			`
			UPDATE room 
			SET status = 'EMPTY',
				startDate = NULL,
				endDate = NULL,
				customerEsntlId = NULL
			WHERE esntlId = ?
		`,
			{
				replacements: [contract.roomEsntlId],
				type: mariaDBSequelize.QueryTypes.UPDATE,
				transaction,
			}
		);

		// roomContract 테이블의 status 업데이트
		// cancelReason이 CONTRACT_CANCEL이면 CANCEL, 그 외에는 FIN
		const contractStatus = cancelReason === 'CANCEL' ? 'CANCEL' : 'FIN';
		await mariaDBSequelize.query(
			`
			UPDATE roomContract 
			SET status = ?
			WHERE esntlId = ?
		`,
			{
				replacements: [contractStatus, contractEsntlId],
				type: mariaDBSequelize.QueryTypes.UPDATE,
				transaction,
			}
		);

		// roomAfterUse 함수 호출
		if (
			check_basic_sell !== undefined ||
			unableCheckInReason ||
			check_room_only_config !== undefined ||
			sell_able_start_date ||
			can_checkin_start_date
		) {
			await roomAfterUse(
				{
					gosiwonEsntlId: contract.gosiwonEsntlId,
					roomEsntlId: contract.roomEsntlId,
					check_basic_sell,
					unableCheckInReason,
					check_room_only_config,
					sell_able_start_date,
					sell_able_end_date,
					can_checkin_start_date,
					can_checkin_end_date,
				},
				transaction
			);
		}

		// History 기록 생성
		const historyId = await generateHistoryId(transaction);
		const cancelReasonText = {
			FULL: '만기퇴실',
			INTERIM: '중도퇴실',
			CANCEL: '계약취소',
			ETC: '기타',
		};
		const liabilityReasonText = {
			OWNER: '사장님',
			OCCUPANT: '입실자',
		};

		const historyContent = `환불 및 퇴실처리: ${cancelReasonText[cancelReason] || cancelReason}${
			liabilityReason
				? `, 귀책사유: ${liabilityReasonText[liabilityReason] || liabilityReason}`
				: ''
		}${totalRefundAmount ? `, 총환불금액: ${totalRefundAmount.toLocaleString()}원` : ''}`;

		await history.create(
			{
				esntlId: historyId,
				gosiwonEsntlId: contract.gosiwonEsntlId,
				roomEsntlId: contract.roomEsntlId,
				contractEsntlId: contractEsntlId,
				etcEsntlId: String(rrrSno),
				content: historyContent,
				category: 'REFUND',
				priority: 'NORMAL',
				publicRange: 0,
				writerAdminId: writerAdminId,
				writerType: 'ADMIN',
				deleteYN: 'N',
			},
			{ transaction }
		);

		await transaction.commit();

		errorHandler.successThrow(res, '환불 및 퇴실처리 성공', {
			rrr_sno: rrrSno,
			historyId: historyId,
			roomStatus: 'CHECKOUT_CONFIRMED',
		});
	} catch (err) {
		await transaction.rollback();
		next(err);
	}
};

// 환불 요청 등록
exports.refundInsert = async (req, res, next) => {
	const transaction = await mariaDBSequelize.transaction();
	try {
		const decodedToken = verifyAdminToken(req);
		const writerAdminId = getWriterAdminId(decodedToken);

		const {
			gswId, // gsw_eid
			romId, // rom_eid
			mbrId, // mbr_eid
			contractId, // ctt_eid
			type, // rrr_leave_type_cd (FULL, INTERIM, CANCEL, ETC)
			checkoutDate, // rrr_leave_date
			reason, // rrr_leave_reason
			paymentAmt, // rrr_payment_amt
			usePeriod, // rrr_use_period
			useAmt, // rrr_use_amt
			penalty, // rrr_penalty_amt
			refundAmt, // rrr_refund_total_amt
		} = req.body;

		// 필수 필드 검증
		if (!gswId) {
			errorHandler.errorThrow(400, 'gswId는 필수입니다.');
		}
		if (!romId) {
			errorHandler.errorThrow(400, 'romId는 필수입니다.');
		}
		if (!mbrId) {
			errorHandler.errorThrow(400, 'mbrId는 필수입니다.');
		}
		if (!contractId) {
			errorHandler.errorThrow(400, 'contractId는 필수입니다.');
		}
		if (!type) {
			errorHandler.errorThrow(400, 'type은 필수입니다.');
		}
		if (!checkoutDate) {
			errorHandler.errorThrow(400, 'checkoutDate는 필수입니다.');
		}
		if (!reason) {
			errorHandler.errorThrow(400, 'reason은 필수입니다.');
		}

		// type 유효성 검증
		const validTypes = ['FULL', 'INTERIM', 'CANCEL', 'ETC'];
		const upperType = String(type).toUpperCase();
		if (!validTypes.includes(upperType)) {
			errorHandler.errorThrow(
				400,
				`type은 ${validTypes.join(', ')} 중 하나여야 합니다.`
			);
		}

		// 환불 요청 등록
		const query = `
			INSERT INTO il_room_refund_request (
				gsw_eid,
				rom_eid,
				mbr_eid,
				ctt_eid,
				rrr_leave_type_cd,
				rrr_leave_date,
				rrr_leave_reason,
				rrr_payment_amt,
				rrr_use_period,
				rrr_use_amt,
				rrr_penalty_amt,
				rrr_refund_total_amt,
				rrr_registrant_id,
				rrr_update_dtm,
				rrr_updater_id
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)
		`;

		const values = [
			gswId,
			romId,
			mbrId,
			contractId,
			upperType,
			checkoutDate,
			reason,
			paymentAmt || 0,
			usePeriod || null,
			useAmt || 0,
			penalty || 0,
			refundAmt || 0,
			writerAdminId,
			writerAdminId,
		];

		const result = await mariaDBSequelize.query(query, {
			replacements: values,
			type: mariaDBSequelize.QueryTypes.INSERT,
			transaction,
		});

		await transaction.commit();

		return errorHandler.successThrow(res, '환불 요청 등록 성공', {
			rrr_sno: result[0],
		});
	} catch (error) {
		await transaction.rollback();
		next(error);
	}
};

// 환불 요청 목록 조회
exports.getRefundRequestList = async (req, res, next) => {
	try {
		verifyAdminToken(req);

		const {
			eId,
			year,
			month,
			day,
			search,
			page = 1,
			limit = 50,
		} = req.query;

		// 페이지 기반 페이징 (depositList와 동일하게 page/limit 사용)
		const safePage = Math.max(parseInt(page) || 1, 1);
		const safeLimit = Math.max(parseInt(limit) || 50, 1);
		const offset = (safePage - 1) * safeLimit;

		// WHERE 조건 구성 (환불 요청 1건당 1행만 나오도록 paymentLog 조인 제거)
		let whereClause = 'WHERE 1=1';
		const replacements = [];

		// 고시원 ID 필터 (GOSI로 시작하는 경우만)
		if (eId && eId.includes('GOSI')) {
			whereClause += ' AND RRR.gsw_eid = ?';
			replacements.push(eId);
		}

		// 날짜 필터 (년, 월, 일)
		if (year && month && day) {
			const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
			whereClause += ' AND DATE(RRR.rrr_regist_dtm) = ?';
			replacements.push(dateStr);
		} else if (year && month) {
			const dateStr = `${year}-${String(month).padStart(2, '0')}`;
			whereClause += ' AND DATE_FORMAT(RRR.rrr_regist_dtm, "%Y-%m") = ?';
			replacements.push(dateStr);
		} else if (year) {
			whereClause += ' AND YEAR(RRR.rrr_regist_dtm) = ?';
			replacements.push(year);
		}

		// 검색어 필터 (고시원명, 방번호, 입실자명, 연락처)
		if (search && search.trim()) {
			const searchValue = `%${search.trim()}%`;
			whereClause += ` AND (
				G.name LIKE ? OR
				R.roomNumber LIKE ? OR
				C.name LIKE ? OR
				C.phone LIKE ?
			)`;
			replacements.push(searchValue, searchValue, searchValue, searchValue);
		}

		// 메인 쿼리 (il_room_refund_request 1건당 1행, paymentLog 조인 제거로 중복 제거)
		const query = `
			SELECT 
				RRR.rrr_sno,
				RRR.rrr_regist_dtm,
				G.name AS gswName,
				R.roomNumber,
				R.roomType,
				R.window,
				C.name AS userName,
				C.birth,
				C.gender,
				C.phone,
				DATE(RRR.rrr_leave_date) AS pDate,
				TIME(RRR.rrr_regist_dtm) AS pTime,
				RRR.rrr_payment_amt AS calAmount,
				NULL AS paymentType,
				RRR.rrr_payment_amt AS paymentAmount,
				0 AS paymentPoint,
				0 AS paymentCoupon,
				RRR.rrr_use_amt,
				RRR.rrr_penalty_amt,
				RRR.rrr_refund_total_amt,
				RRR.rrr_payment_amt,
				RRR.rrr_process_status_cd,
				RRR.rrr_process_reason,
				RRR.ctt_eid,
				RC.esntlId AS contractId
			FROM il_room_refund_request RRR
			LEFT OUTER JOIN gosiwon AS G ON RRR.gsw_eid = G.esntlId
			LEFT OUTER JOIN room AS R ON RRR.rom_eid = R.esntlId
			LEFT OUTER JOIN customer AS C ON RRR.mbr_eid = C.esntlId
			LEFT OUTER JOIN roomContract AS RC ON RRR.ctt_eid = RC.esntlId
			${whereClause}
			ORDER BY RRR.rrr_sno DESC
			LIMIT ? OFFSET ?
		`;

		// 전체 개수 조회 (동일하게 paymentLog 미조인)
		const countQuery = `
			SELECT COUNT(*) AS total
			FROM il_room_refund_request RRR
			LEFT OUTER JOIN gosiwon AS G ON RRR.gsw_eid = G.esntlId
			LEFT OUTER JOIN room AS R ON RRR.rom_eid = R.esntlId
			LEFT OUTER JOIN customer AS C ON RRR.mbr_eid = C.esntlId
			LEFT OUTER JOIN roomContract AS RC ON RRR.ctt_eid = RC.esntlId
			${whereClause}
		`;

		const rows = await mariaDBSequelize.query(query, {
			replacements: [...replacements, safeLimit, offset],
			type: mariaDBSequelize.QueryTypes.SELECT,
		});

		// 전체 개수 조회 (필터 없음, paymentLog 미조인)
		const totalCountQuery = `
			SELECT COUNT(*) AS total
			FROM il_room_refund_request RRR
			LEFT OUTER JOIN gosiwon AS G ON RRR.gsw_eid = G.esntlId
			LEFT OUTER JOIN room AS R ON RRR.rom_eid = R.esntlId
			LEFT OUTER JOIN customer AS C ON RRR.mbr_eid = C.esntlId
			LEFT OUTER JOIN roomContract AS RC ON RRR.ctt_eid = RC.esntlId
		`;

		const [countResult, totalCountResult] = await Promise.all([
			mariaDBSequelize.query(countQuery, {
				replacements: replacements,
				type: mariaDBSequelize.QueryTypes.SELECT,
			}),
			mariaDBSequelize.query(totalCountQuery, {
				type: mariaDBSequelize.QueryTypes.SELECT,
			}),
		]);

		const recordsFiltered = countResult[0]?.total || 0;
		const recordsTotal = totalCountResult[0]?.total || 0;
		const data = (Array.isArray(rows) ? rows : []).map((row) => ({
			...row,
			age: formatAge(row.birth) ?? null,
		}));

		// 페이지 기반 형식으로 응답
		const result = {
			data,
			total: recordsFiltered,
			page: safePage,
			limit: safeLimit,
			totalPages: Math.ceil(recordsFiltered / safeLimit) || 0,
			recordsTotal, // 필터 미적용 전체 건수 (참고용)
		};

		return errorHandler.successThrow(res, '환불 요청 목록 조회 성공', result);
	} catch (error) {
		next(error);
	}
};

// 환불 요청 상태 업데이트
exports.updateRefundRequestStatus = async (req, res, next) => {
	const transaction = await mariaDBSequelize.transaction();
	try {
		const decodedToken = verifyAdminToken(req);
		const writerAdminId = getWriterAdminId(decodedToken);

		const { status, processReason, cttEid } = req.body;

		if (!status) {
			errorHandler.errorThrow(400, 'status는 필수입니다.');
		}
		if (!cttEid) {
			errorHandler.errorThrow(400, 'cttEid는 필수입니다.');
		}

		// 상태 유효성 검증
		const validStatuses = ['REQUEST', 'APPROVAL', 'REJECT', 'CANCELLATION'];
		if (!validStatuses.includes(status)) {
			errorHandler.errorThrow(
				400,
				`status는 ${validStatuses.join(', ')} 중 하나여야 합니다.`
			);
		}

		const query = `
			UPDATE il_room_refund_request 
			SET rrr_process_status_cd = ?,
				rrr_process_reason = ?,
				rrr_update_dtm = NOW(),
				rrr_updater_id = ?
			WHERE ctt_eid = ?
		`;

		await mariaDBSequelize.query(
			query,
			{
				replacements: [status, processReason || null, writerAdminId, cttEid],
				type: mariaDBSequelize.QueryTypes.UPDATE,
				transaction,
			}
		);

		await transaction.commit();

		return errorHandler.successThrow(res, '환불 요청 상태 업데이트 성공');
	} catch (error) {
		await transaction.rollback();
		next(error);
	}
};

// 환불 데이터 조회 (결제 정보 포함)
exports.getRefundData = async (req, res, next) => {
	try {
		verifyAdminToken(req);

		const { contractId } = req.query;

		if (!contractId) {
			errorHandler.errorThrow(400, 'contractId는 필수입니다.');
		}

		const query = `
			SELECT 
				RRR.rrr_payment_amt AS paymentAmt,
				RRR.rrr_refund_total_amt AS refundAmt,
				PL.tid,
				PL.paymentType,
				PL.esntlId AS MOID
			FROM il_room_refund_request RRR
			JOIN paymentLog AS PL ON PL.contractEsntlId = RRR.ctt_eid
			WHERE RRR.ctt_eid = ?
			LIMIT 1
		`;

		const [result] = await mariaDBSequelize.query(query, {
			replacements: [contractId],
			type: mariaDBSequelize.QueryTypes.SELECT,
		});

		if (!result) {
			errorHandler.errorThrow(404, '환불 데이터를 찾을 수 없습니다.');
		}

		return errorHandler.successThrow(res, '환불 데이터 조회 성공', result);
	} catch (error) {
		next(error);
	}
};

// 계약서 기반 환불 데이터 조회
exports.getRefundRequestData = async (req, res, next) => {
	try {
		verifyAdminToken(req);

		const { cttEid } = req.query;

		if (!cttEid) {
			errorHandler.errorThrow(400, 'cttEid는 필수입니다.');
		}

		const query = `
			SELECT 
				RC.esntlId,
				RC.startDate,
				RC.endDate,
				DATEDIFF(NOW(), RC.startDate) AS dateDiff,
				PL.paymentAmount,
				PL.paymentType,
				RC.monthlyRent,
				C.name,
				C.phone,
				R.esntlId AS romId,
				R.status AS roomStatus,
				RC.status AS roomContractStatus,
				RC.contractDate,
				R.gosiwonEsntlId AS gswId,
				RC.customerEsntlId AS mbrId,
				RRR.rrr_leave_type_cd AS leaveType,
				RRR.rrr_leave_reason AS reason,
				RRR.rrr_liability_reason AS liabilityReason,
				RRR.rrr_leave_date AS cancelDate,
				NULL AS refundMethod,
				RRR.rrr_payment_amt AS refundPaymentAmount,
				RRR.rrr_use_amt AS proratedRent,
				RRR.rrr_penalty_amt AS penalty,
				RRR.rrr_refund_total_amt AS totalRefundAmount
			FROM roomContract AS RC
			JOIN paymentLog AS PL ON PL.contractEsntlId = RC.esntlId
			JOIN customer AS C ON RC.customerEsntlId = C.esntlId
			JOIN room AS R ON RC.roomEsntlId = R.esntlId
			JOIN il_room_refund_request AS RRR ON RRR.ctt_eid = RC.esntlId
			WHERE RC.esntlId = ?
			ORDER BY RC.esntlId DESC
			LIMIT 1
		`;

		const [result] = await mariaDBSequelize.query(query, {
			replacements: [cttEid],
			type: mariaDBSequelize.QueryTypes.SELECT,
		});

		// if (!result) {
		// 	return errorHandler.successThrow(res, '환불 요청 데이터가 없습니다.', null);
		// }

		return errorHandler.successThrow(res, '환불 요청 데이터 조회 성공', result);
	} catch (error) {
		next(error);
	}
};

// 계약서 기반 환불 데이터 조회 + 계약정보·결제정보·정산정보 상세 (dataWithDetail)
exports.getRefundDataWithDetail = async (req, res, next) => {
	try {
		verifyAdminToken(req);

		const { cttEid } = req.query;
		if (!cttEid) {
			errorHandler.errorThrow(400, 'cttEid(계약 고유 아이디)는 필수입니다.');
		}

		// 1. 기존 /data와 동일한 기본 데이터 (RRR은 LEFT JOIN으로 없어도 조회 가능)
		const baseQuery = `
			SELECT 
				RC.esntlId,
				RC.startDate,
				RC.endDate,
				DATEDIFF(NOW(), RC.startDate) AS dateDiff,
				PL.paymentAmount,
				PL.paymentType,
				RC.monthlyRent,
				C.name,
				C.phone,
				R.esntlId AS romId,
				R.status AS roomStatus,
				RC.status AS roomContractStatus,
				RC.contractDate,
				R.gosiwonEsntlId AS gswId,
				RC.customerEsntlId AS mbrId,
				RRR.rrr_leave_type_cd AS leaveType,
				RRR.rrr_leave_reason AS reason,
				RRR.rrr_liability_reason AS liabilityReason,
				RRR.rrr_leave_date AS cancelDate,
				NULL AS refundMethod,
				RRR.rrr_payment_amt AS refundPaymentAmount,
				RRR.rrr_use_amt AS proratedRent,
				RRR.rrr_penalty_amt AS penalty,
				RRR.rrr_refund_total_amt AS totalRefundAmount
			FROM roomContract AS RC
			LEFT JOIN paymentLog AS PL ON PL.contractEsntlId = RC.esntlId
			JOIN customer AS C ON RC.customerEsntlId = C.esntlId
			JOIN room AS R ON RC.roomEsntlId = R.esntlId
			LEFT JOIN il_room_refund_request AS RRR ON RRR.ctt_eid = RC.esntlId
			WHERE RC.esntlId = ?
			ORDER BY PL.pDate DESC, PL.pTime DESC
			LIMIT 1
		`;
		const [baseRow] = await mariaDBSequelize.query(baseQuery, {
			replacements: [cttEid],
			type: mariaDBSequelize.QueryTypes.SELECT,
		});

		if (!baseRow) {
			errorHandler.errorThrow(404, '계약 정보를 찾을 수 없습니다.');
		}

		// 2. 계약정보 (roomContract 기준 + 방·입실자·계약자 + roomContract/detail과 동일한 agreement·계약서)
		const contractInfoQuery = `
			SELECT 
				RC.esntlId AS contractId,
				RC.contractDate,
				RC.startDate,
				RC.endDate,
				RC.month,
				RC.status AS roomContractStatus,
				RC.monthlyRent,
				G.name AS gosiwonName,
				R.esntlId AS roomEsntlId,
				R.roomNumber,
				R.roomType,
				R.agreementType AS agreementType,
				R.agreementContent AS agreementContent,
				G.contract AS gsw_contract,
				(SELECT content FROM adminContract ORDER BY numberOrder ASC LIMIT 1) AS gs_contract,
				GA.ceo AS adminName,
				GA.hp AS adminPhone,
				C.name AS customerName,
				C.phone AS customerPhone,
				C.gender AS customerGender,
				C.birth AS customerBirth,
				RCW.checkinName,
				RCW.checkinPhone,
				RCW.customerName AS contractorName,
				RCW.customerPhone AS contractorPhone
			FROM roomContract RC
			JOIN room R ON RC.roomEsntlId = R.esntlId
			JOIN gosiwon G ON RC.gosiwonEsntlId = G.esntlId
			LEFT JOIN gosiwonAdmin GA ON G.adminEsntlId = GA.esntlId
			JOIN customer C ON RC.customerEsntlId = C.esntlId
			LEFT JOIN roomContractWho RCW ON RC.esntlId = RCW.contractEsntlId
			WHERE RC.esntlId = ?
			LIMIT 1
		`;
		const [contractInfo] = await mariaDBSequelize.query(contractInfoQuery, {
			replacements: [cttEid],
			type: mariaDBSequelize.QueryTypes.SELECT,
		});

		// 3. 결제정보 (paymentLog 목록) - paymentLog 테이블 컬럼 기준 (paymentStatus 없음 → calculateStatus, createdAt 없음 → pDate+pTime)
		const paymentInfoQuery = `
			SELECT 
				esntlId,
				contractEsntlId,
				pDate,
				pTime,
				paymentType,
				paymentAmount,
				pyl_goods_amount,
				paymentPoint,
				paymentCoupon,
				calculateStatus,
				CONCAT(pDate, ' ', COALESCE(pTime, '00:00:00')) AS paymentCompleteDtm
			FROM paymentLog
			WHERE contractEsntlId = ?
				AND (withdrawalStatus IS NULL OR withdrawalStatus != 'WITHDRAWAL')
				AND calculateStatus = 'SUCCESS'
			ORDER BY pDate DESC, pTime DESC
		`;
		const paymentInfo = await mariaDBSequelize.query(paymentInfoQuery, {
			replacements: [cttEid],
			type: mariaDBSequelize.QueryTypes.SELECT,
		});

		// 4. 정산정보 (il_daily_selling_closing: 해당 고시원·결제일 기준 PAYMENT 마감 행 1건)
		let settlementInfo = null;
		if (baseRow?.gswId && Array.isArray(paymentInfo) && paymentInfo.length > 0) {
			const pDateRaw = paymentInfo[0].pDate;
			let firstPaymentDate = null;
			if (pDateRaw) {
				if (typeof pDateRaw === 'string') {
					firstPaymentDate = pDateRaw.split('T')[0].substring(0, 10);
				} else if (pDateRaw instanceof Date && !isNaN(pDateRaw.getTime())) {
					firstPaymentDate = pDateRaw.toISOString().slice(0, 10);
				}
			}
			if (firstPaymentDate) {
				const settlementQuery = `
					SELECT 
						dsc_sno,
						gsw_eid,
						dsc_closing_date,
						dsc_selling_type_cd,
						dsc_selling_cnt,
						dsc_goods_total_amt,
						dsc_gosiwon_coupon_total_amt,
						dsc_selling_total_amt,
						dsc_fee_total_amt,
						dsc_average_fee_percent,
						dsc_expected_payment_total_amt,
						dsc_refund_base_date,
						dsc_use_coupon_total_amt,
						dsc_use_point_total_amt,
						dsc_payment_total_amt,
						dsc_coupon_refund_amt,
						dsc_point_refund_amt,
						dsc_fee_refund_amt,
						dsc_business_support_amt,
						dsc_calculation_total_amt,
						dsc_complete_dtm,
						dsc_regist_dtm
					FROM il_daily_selling_closing
					WHERE gsw_eid = ?
						AND dsc_closing_date = ?
						AND dsc_selling_type_cd = 'PAYMENT'
					LIMIT 1
				`;
				const [settlementRow] = await mariaDBSequelize.query(settlementQuery, {
					replacements: [baseRow.gswId, firstPaymentDate],
					type: mariaDBSequelize.QueryTypes.SELECT,
				});
				settlementInfo = settlementRow || null;
			}
		}

		const result = {
			...baseRow,
			contractInfo: contractInfo
				? { ...contractInfo, customerAge: formatAge(contractInfo.customerBirth) ?? null }
				: null,
			paymentInfo: Array.isArray(paymentInfo) ? paymentInfo : [],
			settlementInfo,
		};

		return errorHandler.successThrow(res, '환불 데이터(상세) 조회 성공', result);
	} catch (error) {
		next(error);
	}
};

// 환불 요청 정보 업데이트
exports.updateRefundRequest = async (req, res, next) => {
	const transaction = await mariaDBSequelize.transaction();
	try {
		const decodedToken = verifyAdminToken(req);
		const writerAdminId = getWriterAdminId(decodedToken);

		const { status, usePeriod, useAmt, penalty, refundAmt, contractId } = req.body;

		if (!contractId) {
			errorHandler.errorThrow(400, 'contractId는 필수입니다.');
		}

		const query = `
			UPDATE il_room_refund_request 
			SET rrr_process_status_cd = ?,
				rrr_use_period = ?,
				rrr_use_amt = ?,
				rrr_penalty_amt = ?,
				rrr_refund_total_amt = ?,
				rrr_update_dtm = NOW(),
				rrr_updater_id = ?
			WHERE ctt_eid = ?
		`;

		await mariaDBSequelize.query(
			query,
			{
				replacements: [
					status || null,
					usePeriod || null,
					useAmt || 0,
					penalty || 0,
					refundAmt || 0,
					writerAdminId,
					contractId,
				],
				type: mariaDBSequelize.QueryTypes.UPDATE,
				transaction,
			}
		);

		await transaction.commit();

		return errorHandler.successThrow(res, '환불 요청 정보 업데이트 성공');
	} catch (error) {
		await transaction.rollback();
		next(error);
	}
};
