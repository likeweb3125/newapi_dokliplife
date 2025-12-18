const {
	mariaDBSequelize,
	ilRoomRefundRequest,
	room,
	customer,
	history,
} = require('../models');
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


		// 환불 정보 생성 (il_room_refund_request 테이블 사용)
		const refundRequest = await ilRoomRefundRequest.create(
			{
				gsw_eid: contract.gosiwonEsntlId,
				rom_eid: contract.roomEsntlId,
				mbr_eid: contract.customerEsntlId,
				ctt_eid: contractEsntlId,
				rrr_leave_type_cd: rrr_leave_type_cd,
				rrr_leave_date: cancelDate,
				rrr_leave_reason: cancelMemo || '',
				rrr_payment_amt: paymentAmount || 0,
				rrr_use_period: usePeriod || null,
				rrr_use_amt: proratedRent || 0,
				rrr_penalty_amt: penalty || 0,
				rrr_refund_total_arr: totalRefundAmount || 0,
				rrr_process_status_: 'REQUEST',
				rrr_process_reason: '',
				rrr_regist_dtm: new Date(),
				rrr_registrant_id: writerAdminId || 'SYSTEM',
			},
			{ transaction }
		);

		const refundId = refundRequest.rrr_sno;

		// roomStatus를 CHECKOUT_REQUESTED로 업데이트
		// 기존 roomStatus 레코드 확인
		const [existingStatus] = await mariaDBSequelize.query(
			`SELECT esntlId, status FROM roomStatus WHERE roomEsntlId = ?`,
			{
				replacements: [contract.roomEsntlId],
				type: mariaDBSequelize.QueryTypes.SELECT,
				transaction,
			}
		);

		if (existingStatus) {
			// 기존 레코드 업데이트
			await mariaDBSequelize.query(
				`
				UPDATE roomStatus 
				SET status = 'CHECKOUT_REQUESTED',
					customerName = ?,
					reservationEsntlId = ?,
					reservationName = ?,
					contractorEsntlId = ?,
					contractorName = ?,
					statusEndDate = ?,
					updatedAt = NOW()
				WHERE roomEsntlId = ?
			`,
				{
					replacements: [
						customerName,
						reservationEsntlId,
						reservationName,
						contractorEsntlId,
						contractorName,
						cancelDate,
						contract.roomEsntlId,
					],
					type: mariaDBSequelize.QueryTypes.UPDATE,
					transaction,
				}
			);
		} else {
			// 새 레코드 생성
			// roomStatus ID 생성 (RSTA prefix 사용)
			const [statusIdResult] = await mariaDBSequelize.query(
				`
				SELECT CONCAT('RSTA', LPAD(COALESCE(MAX(CAST(SUBSTRING(esntlId, 5) AS UNSIGNED)), 0) + 1, 10, '0')) AS nextId
				FROM roomStatus
			`,
				{
					type: mariaDBSequelize.QueryTypes.SELECT,
					transaction,
				}
			);

			const statusId =
				statusIdResult?.nextId || 'RSTA0000000001';

			await mariaDBSequelize.query(
				`
				INSERT INTO roomStatus (
					esntlId,
					roomEsntlId,
					status,
					customerEsntlId,
					customerName,
					reservationEsntlId,
					reservationName,
					contractorEsntlId,
					contractorName,
					contractEsntlId,
					statusEndDate,
					createdAt,
					updatedAt
				) VALUES (?, ?, 'CHECKOUT_REQUESTED', ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
			`,
				{
					replacements: [
						statusId,
						contract.roomEsntlId,
						contract.customerEsntlId,
						customerName,
						reservationEsntlId,
						reservationName,
						contractorEsntlId,
						contractorName,
						contractEsntlId,
						cancelDate,
					],
					type: mariaDBSequelize.QueryTypes.INSERT,
					transaction,
				}
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
			rrr_sno: refundId,
			historyId: historyId,
			roomStatus: 'CHECKOUT_REQUESTED',
		});
	} catch (err) {
		await transaction.rollback();
		next(err);
	}
};
