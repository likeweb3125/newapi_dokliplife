const {
	mariaDBSequelize,
	refund,
	room,
	customer,
	history,
} = require('../models');
const errorHandler = require('../middleware/error');
const { getWriterAdminId } = require('../utils/auth');

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

	if (!decodedToken || !decodedToken.admin) {
		errorHandler.errorThrow(401, '관리자 정보가 없습니다.');
	}
	return decodedToken;
};

// roomStatus ID 생성 함수
const generateRoomStatusId = async (transaction) => {
	const [result] = await mariaDBSequelize.query(
		`
		SELECT CONCAT('RSTA', LPAD(COALESCE(MAX(CAST(SUBSTRING(esntlId, 5) AS UNSIGNED)), 0) + 1, 10, '0')) AS nextId
		FROM roomStatus
		`,
		{
			type: mariaDBSequelize.QueryTypes.SELECT,
			transaction,
		}
	);
	return result?.nextId || 'RSTA0000000001';
};

// 방 사용 후 상태 설정 함수
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
	},
	transaction
) => {
	if (check_basic_sell === true) {
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

		// 현재 날짜 계산
		const now = new Date();
		const checkinStartDate = new Date(now);
		checkinStartDate.setDate(checkinStartDate.getDate() + checkinAbleDate);

		const sellStartDate = new Date(checkinStartDate);
		const sellEndDate = new Date(sellStartDate);
		sellEndDate.setDate(sellEndDate.getDate() + sellAblePeriod);

		// 무한대 날짜 (9999-12-31)
		const infiniteDate = new Date('9999-12-31 23:59:59');

		// CAN_CHECKIN 상태 레코드 생성
		const canCheckinId = await generateRoomStatusId(transaction);
		await mariaDBSequelize.query(
			`
			INSERT INTO roomStatus (
				esntlId,
				roomEsntlId,
				gosiwonEsntlId,
				status,
				statusStartDate,
				statusEndDate,
				createdAt,
				updatedAt
			) VALUES (?, ?, ?, 'CAN_CHECKIN', ?, ?, NOW(), NOW())
			`,
			{
				replacements: [
					canCheckinId,
					roomEsntlId,
					gosiwonEsntlId,
					checkinStartDate,
					infiniteDate,
				],
				type: mariaDBSequelize.QueryTypes.INSERT,
				transaction,
			}
		);

		// ON_SALE 상태 레코드 생성
		const onSaleId = await generateRoomStatusId(transaction);
		await mariaDBSequelize.query(
			`
			INSERT INTO roomStatus (
				esntlId,
				roomEsntlId,
				gosiwonEsntlId,
				status,
				statusStartDate,
				statusEndDate,
				createdAt,
				updatedAt
			) VALUES (?, ?, ?, 'ON_SALE', ?, ?, NOW(), NOW())
			`,
			{
				replacements: [
					onSaleId,
					roomEsntlId,
					gosiwonEsntlId,
					sellStartDate,
					sellEndDate,
				],
				type: mariaDBSequelize.QueryTypes.INSERT,
				transaction,
			}
		);
	} else if (check_basic_sell === false) {
		if (unableCheckInReason) {
			// unableCheckInReason이 있는 경우: BEFORE_SALES 상태 생성
			const beforeSalesId = await generateRoomStatusId(transaction);
			const now = new Date();
			const infiniteDate = new Date('9999-12-31 23:59:59');

			await mariaDBSequelize.query(
				`
				INSERT INTO roomStatus (
					esntlId,
					roomEsntlId,
					gosiwonEsntlId,
					status,
					statusName,
					statusStartDate,
					statusEndDate,
					statusMemo,
					createdAt,
					updatedAt
				) VALUES (?, ?, ?, 'BEFORE_SALES', ?, ?, ?, ?, NOW(), NOW())
				`,
				{
					replacements: [
						beforeSalesId,
						roomEsntlId,
						gosiwonEsntlId,
						unableCheckInReason,
						now,
						infiniteDate,
						unableCheckInReason,
					],
					type: mariaDBSequelize.QueryTypes.INSERT,
					transaction,
				}
			);
		} else if (check_room_only_config === true) {
			// unableCheckInReason이 없고 check_room_only_config가 true인 경우: ON_SALE과 CAN_CHECKIN 상태 생성
			if (!sell_able_start_date || !sell_able_end_date) {
				errorHandler.errorThrow(
					400,
					'check_basic_sell가 false이고 check_room_only_config가 true일 경우 sell_able_start_date와 sell_able_end_date가 필요합니다.'
				);
			}
			if (!can_checkin_start_date || !can_checkin_end_date) {
				errorHandler.errorThrow(
					400,
					'check_basic_sell가 false이고 check_room_only_config가 true일 경우 can_checkin_start_date와 can_checkin_end_date가 필요합니다.'
				);
			}

			// ON_SALE 상태 레코드 생성
			const onSaleId = await generateRoomStatusId(transaction);
			await mariaDBSequelize.query(
				`
				INSERT INTO roomStatus (
					esntlId,
					roomEsntlId,
					gosiwonEsntlId,
					status,
					statusStartDate,
					statusEndDate,
					createdAt,
					updatedAt
				) VALUES (?, ?, ?, 'ON_SALE', ?, ?, NOW(), NOW())
				`,
				{
					replacements: [
						onSaleId,
						roomEsntlId,
						gosiwonEsntlId,
						new Date(sell_able_start_date),
						new Date(sell_able_end_date),
					],
					type: mariaDBSequelize.QueryTypes.INSERT,
					transaction,
				}
			);

			// CAN_CHECKIN 상태 레코드 생성
			const canCheckinId = await generateRoomStatusId(transaction);
			await mariaDBSequelize.query(
				`
				INSERT INTO roomStatus (
					esntlId,
					roomEsntlId,
					gosiwonEsntlId,
					status,
					statusStartDate,
					statusEndDate,
					createdAt,
					updatedAt
				) VALUES (?, ?, ?, 'CAN_CHECKIN', ?, ?, NOW(), NOW())
				`,
				{
					replacements: [
						canCheckinId,
						roomEsntlId,
						gosiwonEsntlId,
						new Date(can_checkin_start_date),
						new Date(can_checkin_end_date),
					],
					type: mariaDBSequelize.QueryTypes.INSERT,
					transaction,
				}
			);
		}
	}
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
			cancelReason, // EXPIRED_CHECKOUT, MIDDLE_CHECKOUT, CONTRACT_CANCEL
			cancelDate,
			cancelMemo,
			liabilityReason, // OWNER, OCCUPANT
			contactedOwner, // 0 or 1
			refundMethod,
			paymentAmount,
			proratedRent,
			penalty,
			totalRefundAmount,
			usePeriod,
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
			EXPIRED_CHECKOUT: 'FULL',
			MIDDLE_CHECKOUT: 'INTERIM',
			CONTRACT_CANCEL: 'CANCEL',
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
				C.name AS customerName,
				D.contractorEsntlId,
				CT.name AS contractorName
			FROM roomContract RC
			JOIN room R ON RC.roomEsntlId = R.esntlId
			JOIN customer C ON RC.customerEsntlId = C.esntlId
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
		const customerName = contract.customerName || null;
		const reservationEsntlId = contract.customerEsntlId || null; // 예약자 정보가 없으면 입실자와 동일
		const reservationName = contract.customerName || null; // 예약자 이름이 없으면 입실자 이름과 동일
		const contractorEsntlId = contract.contractorEsntlId || contract.customerEsntlId || null; // 계약자 정보가 없으면 입실자와 동일
		const contractorName = contract.contractorName || contract.customerName || null; // 계약자 이름이 없으면 입실자 이름과 동일


		// 환불 정보 생성 (refund 테이블 사용)
		const refundId = await generateRefundId(transaction);
		const refundRecord = await refund.create(
			{
				esntlId: refundId,
				gosiwonEsntlId: contract.gosiwonEsntlId,
				roomEsntlId: contract.roomEsntlId,
				contractEsntlId: contractEsntlId,
				contractorEsntlId: contractorEsntlId,
				customerEsntlId: contract.customerEsntlId,
				cancelReason: cancelReason,
				cancelDate: cancelDate,
				cancelMemo: cancelMemo || null,
				liabilityReason: liabilityReason || null,
				contactedOwner: contactedOwner ? 1 : 0,
				refundMethod: refundMethod || null,
				paymentAmount: paymentAmount || 0,
				proratedRent: proratedRent || 0,
				penalty: penalty || 0,
				totalRefundAmount: totalRefundAmount || 0,
				deleteYN: 'N',
			},
			{ transaction }
		);

		// roomStatus를 CHECKOUT_CONFIRMED로 업데이트 (contractEsntlId 기준)
		await mariaDBSequelize.query(
			`
			UPDATE roomStatus 
			SET status = 'CHECKOUT_CONFIRMED',
				updatedAt = NOW()
			WHERE contractEsntlId = ?
		`,
			{
				replacements: [contractEsntlId],
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
			EXPIRED_CHECKOUT: '만기퇴실',
			MIDDLE_CHECKOUT: '중도퇴실',
			CONTRACT_CANCEL: '계약취소',
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
				etcEsntlId: String(refundId),
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
			refundId: refundId,
			historyId: historyId,
			roomStatus: 'CHECKOUT_CONFIRMED',
		});
	} catch (err) {
		await transaction.rollback();
		next(err);
	}
};
