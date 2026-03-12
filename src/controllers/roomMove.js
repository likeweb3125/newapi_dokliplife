const { mariaDBSequelize, room } = require('../models');
const errorHandler = require('../middleware/error');
const { getWriterAdminId } = require('../utils/auth');
const historyController = require('./history');
const extraPaymentController = require('./extraPayment');
const refundController = require('./refund');
const { roomAfterUse } = refundController;
const { next: idsNext } = require('../utils/idsNext');
const { closeOpenStatusesForRoom, endActiveBeforeSalesForRoom, syncRoomFromRoomStatus } = require('../utils/roomStatusHelper');
const { dateToYmd } = require('../utils/dateHelper');

const ROOMMOVE_PREFIX = 'RMV';
const ROOMMOVE_PADDING = 10;

/** roomContract.memo2 컬럼 최대 길이 (TEXT로 변경 후에도 과도한 누적 방지용으로 적용, DB는 TEXT) */
const ROOM_CONTRACT_MEMO2_MAX_LENGTH = 2000;

/** MySQL 데드락(1213, 40001) 여부 판별 */
const isDeadlockError = (err) => {
	if (!err) return false;
	const code = err.parent?.errno ?? err.errno;
	const sqlState = err.parent?.sqlState ?? err.sqlState;
	const msg = (err.message || '').toLowerCase();
	return code === 1213 || sqlState === '40001' || msg.includes('deadlock');
};

const MAX_DEADLOCK_RETRIES = 3;

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

// roomMoveStatus ID 생성 함수
const generateRoomMoveStatusId = async (transaction) => {
	const [result] = await mariaDBSequelize.query(
		`
		SELECT CONCAT('${ROOMMOVE_PREFIX}', LPAD(COALESCE(MAX(CAST(SUBSTRING(esntlId, ${ROOMMOVE_PREFIX.length + 1}) AS UNSIGNED)), 0) + 1, ${ROOMMOVE_PADDING}, '0')) AS nextId
		FROM roomMoveStatus
		`,
		{
			type: mariaDBSequelize.QueryTypes.SELECT,
			transaction,
		}
	);
	return result?.nextId || `${ROOMMOVE_PREFIX}${String(1).padStart(ROOMMOVE_PADDING, '0')}`;
};

// 다른 컨트롤러를 내부에서 호출하기 위한 헬퍼 (req 헤더/메서드는 유지, body만 교체)
const callControllerWithBody = (handler, req, body) =>
	new Promise((resolve, reject) => {
		// Express Request의 프로토타입(get 등 메서드)을 유지하면서 body만 덮어쓴다.
		const fakeReq = Object.assign(
			Object.create(Object.getPrototypeOf(req)),
			req,
			{ body }
		);

		const fakeRes = {
			statusCode: 200,
			status(code) {
				this.statusCode = code;
				return this;
			},
			json(payload) {
				resolve(payload);
			},
		};
		const next = (err) => {
			if (err) {
				reject(err);
			}
		};

		Promise.resolve(handler(fakeReq, fakeRes, next)).catch(reject);
	});

// 방이동 처리 (데드락 시 최대 MAX_DEADLOCK_RETRIES 회 재시도)
exports.processRoomMove = async (req, res, next) => {
	let lastErr;
	for (let attempt = 1; attempt <= MAX_DEADLOCK_RETRIES; attempt++) {
		const transaction = await mariaDBSequelize.transaction();
		try {
		const decodedToken = verifyAdminToken(req);
		const writerAdminId = getWriterAdminId(decodedToken);
		const writerName = decodedToken.admin?.name ?? decodedToken.partner?.name ?? '관리자';

		const {
			contractEsntlId,
			originalRoomEsntlId,
			targetRoomEsntlId,
			reason, // OWNER, CUSTOMER
			moveDate,
			adjustmentAmount,
			adjustmentType, // ADDITION, REFUND
			contactedOwner, // Y, N
			memo,
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
		if (!originalRoomEsntlId) {
			errorHandler.errorThrow(400, 'originalRoomEsntlId를 입력해주세요.');
		}
		if (!targetRoomEsntlId) {
			errorHandler.errorThrow(400, 'targetRoomEsntlId를 입력해주세요.');
		}
		if (!reason) {
			errorHandler.errorThrow(400, 'reason를 입력해주세요.');
		}
		if (!moveDate) {
			errorHandler.errorThrow(400, 'moveDate를 입력해주세요.');
		}

		// reason 유효성 검증
		const validReasons = ['OWNER', 'CUSTOMER'];
		if (!validReasons.includes(reason)) {
			errorHandler.errorThrow(
				400,
				`reason는 ${validReasons.join(', ')} 중 하나여야 합니다.`
			);
		}

		// contactedOwner 유효성 검증
		if (contactedOwner && !['Y', 'N'].includes(contactedOwner)) {
			errorHandler.errorThrow(400, 'contactedOwner는 Y 또는 N이어야 합니다.');
		}

		// adjustmentAmount와 adjustmentType 유효성 검증 (0 이상만 허용)
		const numAdjustment = adjustmentAmount != null ? Number(adjustmentAmount) : 0;
		if (adjustmentAmount != null && (isNaN(numAdjustment) || numAdjustment < 0)) {
			errorHandler.errorThrow(400, 'adjustmentAmount는 0 이상의 숫자여야 합니다.');
		}
		const finalAdjustmentAmount = Math.max(0, numAdjustment);

		if (adjustmentType) {
			const validAdjustmentTypes = ['ADDITION', 'REFUND'];
			if (!validAdjustmentTypes.includes(adjustmentType)) {
				errorHandler.errorThrow(400, `adjustmentType은 ${validAdjustmentTypes.join(', ')} 중 하나여야 합니다.`);
			}
		}

		if (finalAdjustmentAmount > 0 && !adjustmentType) {
			errorHandler.errorThrow(400, 'adjustmentAmount가 0보다 크면 adjustmentType은 필수입니다.');
		}

		const finalAdjustmentType = finalAdjustmentAmount > 0 ? adjustmentType : null;

		// 계약 정보 및 원래 방 상태 조회 (기존 계약 종료일은 RC.endDate → originalEndDate로 명시, RS 컬럼에 의해 덮어쓰임 방지)
		const [contractInfo] = await mariaDBSequelize.query(
			`
			SELECT 
				RC.esntlId, RC.roomEsntlId, RC.gosiwonEsntlId, RC.customerEsntlId,
				RC.startDate, RC.endDate AS originalEndDate, RC.contractDate, RC.month, RC.status,
				RC.monthlyRent, RC.memo, RC.memo2, RC.checkInTime,
				RS.esntlId AS roomStatusEsntlId,
				RS.subStatus AS roomStatusSubStatus,
				RS.customerEsntlId AS roomStatusCustomerEsntlId,
				RS.customerName AS roomStatusCustomerName,
				RS.reservationEsntlId AS roomStatusReservationEsntlId,
				RS.reservationName AS roomStatusReservationName,
				RS.contractorEsntlId AS roomStatusContractorEsntlId,
				RS.contractorName AS roomStatusContractorName,
				RS.statusStartDate,
				RS.statusEndDate,
				RS.etcStartDate,
				RS.etcEndDate,
				RS.statusMemo
			FROM roomContract RC
			JOIN roomStatus RS ON RC.esntlId = RS.contractEsntlId 
				AND RS.roomEsntlId = ?
				AND RS.status = 'CONTRACT'
			WHERE RC.esntlId = ?
			LIMIT 1
		`,
			{
				replacements: [originalRoomEsntlId, contractEsntlId],
				type: mariaDBSequelize.QueryTypes.SELECT,
				transaction,
			}
		);

		if (!contractInfo || !contractInfo.roomStatusEsntlId) {
			errorHandler.errorThrow(
				404,
				'계약 정보 또는 CONTRACT 상태의 방 상태를 찾을 수 없습니다.'
			);
		}

		// [roomMove 디버그] originalEndDate = roomContract.endDate(RC), statusEndDate = roomStatus(RS)
		console.log('[roomMove] contractInfo 조회 직후:', {
			'contractInfo.originalEndDate(RC.endDate)': contractInfo.originalEndDate,
			'contractInfo.statusEndDate(RS.statusEndDate)': contractInfo.statusEndDate,
			contractEsntlId: contractEsntlId,
		});

		// 이동할 방 정보 확인 (roomNumber: memo2·history용)
		const [targetRoom] = await mariaDBSequelize.query(
			`
			SELECT esntlId, gosiwonEsntlId, roomNumber
			FROM room
			WHERE esntlId = ?
			LIMIT 1
		`,
			{
				replacements: [targetRoomEsntlId],
				type: mariaDBSequelize.QueryTypes.SELECT,
				transaction,
			}
		);

		if (!targetRoom) {
			errorHandler.errorThrow(404, '이동할 방 정보를 찾을 수 없습니다.');
		}

		// 나가는 방 정보 (roomNumber: memo2·history용)
		const [originalRoom] = await mariaDBSequelize.query(
			`
			SELECT esntlId, roomNumber
			FROM room
			WHERE esntlId = ?
			LIMIT 1
		`,
			{
				replacements: [originalRoomEsntlId],
				type: mariaDBSequelize.QueryTypes.SELECT,
				transaction,
			}
		);

		const targetRoomNumber = targetRoom.roomNumber || targetRoomEsntlId;
		const originalRoomNumber = (originalRoom && originalRoom.roomNumber) ? originalRoom.roomNumber : originalRoomEsntlId;

		if (targetRoom.gosiwonEsntlId !== contractInfo.gosiwonEsntlId) {
			errorHandler.errorThrow(400, '이동할 방이 같은 고시원에 속해있지 않습니다.');
		}

		// moveDate를 YYYY-MM-DD 형식으로 변환 (Date일 때 로컬 날짜 사용, toISOString 금지)
		const moveDateStr = moveDate ? dateToYmd(moveDate) : null;

		if (!moveDateStr) {
			errorHandler.errorThrow(400, 'moveDate를 입력해주세요.');
		}
		
		// 오늘 날짜 (한국 시간) 가져오기
		const today = new Date();
		const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

		// 기존 계약 만료일: roomContract.endDate(RC)를 우선 사용. RC가 이동일과 같을 때만(이전 버그로 덮어쓴 경우) roomStatus.statusEndDate(RS) 사용.
		// RS는 DATETIME이라 타임존 변환 시 하루 빠져 나올 수 있으므로 RC가 정상이면 반드시 RC 사용.
		const toYmd = dateToYmd;
		const rcEnd = toYmd(contractInfo.originalEndDate ?? contractInfo.endDate);
		const rsEnd = toYmd(contractInfo.statusEndDate);
		const originalContractEndDate = (rcEnd && rcEnd !== moveDateStr) ? rcEnd : (rsEnd && rsEnd > moveDateStr ? rsEnd : (rcEnd || rsEnd));
		if (!originalContractEndDate) {
			errorHandler.errorThrow(400, '기존 계약의 종료일(endDate)을 찾을 수 없습니다.');
		}

		// 이동일 - 1일 (원래 방 roomStatus.statusEndDate용, 로컬 날짜 기준)
		const moveDateParts = moveDateStr.split('-').map(Number);
		const moveDatePrev = new Date(moveDateParts[0], moveDateParts[1] - 1, moveDateParts[2]);
		moveDatePrev.setDate(moveDatePrev.getDate() - 1);
		const moveDateMinusOneStr = `${moveDatePrev.getFullYear()}-${String(moveDatePrev.getMonth() + 1).padStart(2, '0')}-${String(moveDatePrev.getDate()).padStart(2, '0')}`;

		// 방이동 신청 시 추가결제/환불 연동 처리
		const moveMemo = `방이동: ${originalRoomNumber} → ${targetRoomNumber}`;

		// adjustmentType = ADDITION 인 경우: 추가 결제 요청 등록 (/v1/roomExtraPayment 내부 호출)
		if (finalAdjustmentType === 'ADDITION' && finalAdjustmentAmount > 0) {
			// 신청자(입주자) 연락처 조회
			const customerRows = await mariaDBSequelize.query(
				`
				SELECT phone
				FROM customer
				WHERE esntlId = ?
				LIMIT 1
				`,
				{
					replacements: [contractInfo.customerEsntlId],
					type: mariaDBSequelize.QueryTypes.SELECT,
					transaction,
				}
			);
			const customerRow = Array.isArray(customerRows) ? customerRows[0] : customerRows;
			const receiverPhone = customerRow?.phone || null;

			const extraPaymentBody = {
				contractEsntlId,
				extraPayments: [
					{
						extraCostName: '방이동',
						cost: finalAdjustmentAmount,
						memo: moveMemo,
						extendWithPayment: false,
						useStartDate: moveDateStr,
						optionInfo: '',
						optionName: '',
					},
				],
				receiverPhone,
				// 발송일: 추가 결제 요청일(신청일, 오늘 기준)
				sendDate: todayStr,
			};

			await callControllerWithBody(extraPaymentController.roomExtraPayment, req, extraPaymentBody);
		}

		// adjustmentType = REFUND 인 경우: 환불 요청만 등록 (/v1/refund/refundInsert 내부 호출)
		if (finalAdjustmentType === 'REFUND' && finalAdjustmentAmount > 0) {
			const refundInsertBody = {
				gswId: contractInfo.gosiwonEsntlId,
				romId: contractInfo.roomEsntlId,
				mbrId: contractInfo.customerEsntlId,
				contractId: contractEsntlId,
				type: 'INTERIM',
				// 퇴실(환불 기준일): 방이동 신청일 전날
				checkoutDate: moveDateMinusOneStr,
				// 이동 메모에 귀책사유(reason)를 함께 기록
				reason: `${moveMemo}, 귀책사유: ${reason}`,
				paymentAmt: 0,
				usePeriod: null,
				useAmt: 0,
				penalty: 0,
				refundAmt: finalAdjustmentAmount,
			};

			await callControllerWithBody(refundController.refundInsert, req, refundInsertBody);
		}

		const isMoveToday = moveDateStr === todayStr;

		// 이동일이 오늘이 아니면: 계약서·room·roomStatus는 변경하지 않고 roomMoveStatus만 등록 (해당 이동일에 스케줄러가 실제 처리)
		// 단, 이동할 방(타겟)은 방이동일까지 RESERVE로 표시하기 위해 room 갱신 + roomStatus RESERVED 추가
		if (!isMoveToday) {
			// 타겟 방의 활성 BEFORE_SALES가 있으면 오늘 날짜로 종료 후, RESERVE/roomStatus 추가
			await endActiveBeforeSalesForRoom(targetRoomEsntlId, todayStr, transaction);
			// 이동할 방을 방이동날까지 RESERVE로 표시 (room 테이블 + roomStatus RESERVED로 목록 API에서 기간 노출)
			await mariaDBSequelize.query(
				`UPDATE room SET status = ?, startDate = ?, endDate = ? WHERE esntlId = ?`,
				{
					replacements: ['RESERVE', todayStr, moveDateStr, targetRoomEsntlId],
					type: mariaDBSequelize.QueryTypes.UPDATE,
					transaction,
				}
			);
			const roomMoveReserveStatusId = await idsNext('roomStatus', undefined, transaction);
			await mariaDBSequelize.query(
				`
				INSERT INTO roomStatus (
					esntlId, roomEsntlId, gosiwonEsntlId, status, subStatus,
					customerEsntlId, customerName, reservationEsntlId, reservationName,
					contractorEsntlId, contractorName, contractEsntlId,
					statusStartDate, statusEndDate, etcStartDate, etcEndDate, statusMemo,
					createdAt, updatedAt
				) VALUES (?, ?, ?, 'RESERVED', 'ROOM_MOVE_RESERVE', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
				`,
				{
					replacements: [
						roomMoveReserveStatusId,
						targetRoomEsntlId,
						contractInfo.gosiwonEsntlId,
						contractInfo.roomStatusCustomerEsntlId,
						contractInfo.roomStatusCustomerName,
						contractInfo.roomStatusReservationEsntlId,
						contractInfo.roomStatusReservationName,
						contractInfo.roomStatusContractorEsntlId,
						contractInfo.roomStatusContractorName,
						contractEsntlId,
						todayStr,
						moveDateStr,
						contractInfo.etcStartDate,
						contractInfo.etcEndDate,
						'방이동 예약 (이동일까지)',
					],
					type: mariaDBSequelize.QueryTypes.INSERT,
					transaction,
				}
			);

			const [targetRoomOnSaleForMemo] = await mariaDBSequelize.query(
				`
				SELECT esntlId, statusEndDate, subStatus
				FROM roomStatus
				WHERE roomEsntlId = ?
					AND status = 'ON_SALE'
					AND (statusEndDate IS NULL 
						OR statusEndDate > ? 
						OR statusEndDate >= '9999-01-01')
			`,
				{
					replacements: [targetRoomEsntlId, moveDateStr],
					type: mariaDBSequelize.QueryTypes.SELECT,
					transaction,
				}
			);
			const targetRoomOnSaleStatuses = Array.isArray(targetRoomOnSaleForMemo) ? targetRoomOnSaleForMemo : [];
			const memoWithContact = memo
				? `${memo}${contactedOwner ? ` [원장님연락: ${contactedOwner === 'Y' ? '연락됨' : '연락안됨'}]` : ''}`
				: contactedOwner ? `[원장님연락: ${contactedOwner === 'Y' ? '연락됨' : '연락안됨'}]` : null;
			const finalAdjustmentStatus = finalAdjustmentAmount !== 0 ? 'PENDING' : null;
			const statusIdsInfo = {
				createdRoomStatusIds: [],
				originalRoomStatusId: contractInfo.roomStatusEsntlId,
				newRoomStatusId: null,
				contractEsntlId: contractEsntlId,
				originalContractStartDate: toYmd(contractInfo.startDate),
				targetRoomOnSaleStatuses: targetRoomOnSaleStatuses || [],
				restoreOriginalRoomStatus: {
					status: 'CONTRACT',
					subStatus: contractInfo.roomStatusSubStatus ?? null,
					statusEndDate: originalContractEndDate,
				},
			};
			const memoWithStatusIds = memoWithContact
				? `${memoWithContact} [STATUS_IDS:${JSON.stringify(statusIdsInfo)}]`
				: `[STATUS_IDS:${JSON.stringify(statusIdsInfo)}]`;
			const roomMoveStatusId = await generateRoomMoveStatusId(transaction);
			await mariaDBSequelize.query(
				`
				INSERT INTO roomMoveStatus (
					esntlId,
					gosiwonEsntlId,
					contractEsntlId,
					customerEsntlId,
					originalRoomEsntlId,
					targetRoomEsntlId,
					reason,
					status,
					moveDate,
					adjustmentAmount,
					adjustmentType,
					adjustmentStatus,
					memo,
					deleteYN,
					createdAt,
					updatedAt
				) VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, ?, 'N', NOW(), NOW())
			`,
				{
					replacements: [
						roomMoveStatusId,
						contractInfo.gosiwonEsntlId,
						contractEsntlId,
						contractInfo.roomStatusCustomerEsntlId,
						originalRoomEsntlId,
						targetRoomEsntlId,
						reason,
						moveDateStr ? `${moveDateStr} 00:00:00` : moveDateStr,
						finalAdjustmentAmount,
						finalAdjustmentType,
						finalAdjustmentStatus,
						memoWithStatusIds,
					],
					type: mariaDBSequelize.QueryTypes.INSERT,
					transaction,
				}
			);
			await transaction.commit();
			return errorHandler.successThrow(res, '방이동 예정이 등록되었습니다. 해당 이동일에 스케줄러가 처리합니다.', {
				roomMoveStatusId,
				contractEsntlId,
				scheduledMoveDate: moveDateStr,
			});
		}

		// 이하: 이동일이 오늘인 경우에만 계약서·roomStatus·room 실제 반영
		// 1. 기존 계약 유지: roomEsntlId를 이동할 방으로, startDate/endDate 갱신 (방이동 이력은 history 테이블에만 저장)
		await mariaDBSequelize.query(
			`
			UPDATE roomContract
			SET roomEsntlId = ?,
				startDate = ?,
				endDate = ?
			WHERE esntlId = ?
		`,
			{
				replacements: [targetRoomEsntlId, moveDateStr, originalContractEndDate, contractEsntlId],
				type: mariaDBSequelize.QueryTypes.UPDATE,
				transaction,
			}
		);

		// 1-1. adjustmentAmount가 있으면 월 입실료 차액 반영 (monthlyRent는 만원 단위: 15 = 15만원, 5000원 = 0.5)
		if (finalAdjustmentAmount > 0 && finalAdjustmentType) {
			const currentRent = parseFloat(contractInfo.monthlyRent) || 0;
			const delta = finalAdjustmentAmount / 10000; // 원 → 만원 단위
			const newRent = finalAdjustmentType === 'REFUND'
				? Math.max(0, currentRent - delta)
				: currentRent + delta;
			const newRentToStore = Number.isInteger(newRent) ? String(newRent) : String(Number(newRent.toFixed(2)));
			const adjustmentMemo = `월입실료 조정: ${finalAdjustmentType === 'REFUND' ? '환불' : '추가'} ${finalAdjustmentAmount}원 (기존 ${currentRent} → 변경 ${newRentToStore})`;
			await mariaDBSequelize.query(
				`UPDATE roomContract SET monthlyRent = ? WHERE esntlId = ?`,
				{
					replacements: [newRentToStore, contractEsntlId],
					type: mariaDBSequelize.QueryTypes.UPDATE,
					transaction,
				}
			);
			// 월 입실료 조정 내역은 history에만 상세히 기록
			try {
				await historyController.createHistoryRecord(
					{
						gosiwonEsntlId: contractInfo.gosiwonEsntlId,
						roomEsntlId: targetRoomEsntlId,
						contractEsntlId: contractEsntlId,
						content: `방이동 월입실료 조정: ${adjustmentMemo}`,
						category: 'CONTRACT',
						priority: 'NORMAL',
						publicRange: 0,
						writerAdminId: writerAdminId,
						writerName,
						writerType: 'ADMIN',
					},
					transaction
				);
			} catch (historyErr) {
				console.error('방이동 월입실료 조정 history 생성 실패:', historyErr);
			}
		}

		// 2. 원래 방의 roomStatus 처리
		if (contractInfo.roomStatusSubStatus === 'ROOM_MOVE_IN') {
			// 기존 행: status = ROOM_MOVE, subStatus = ROOM_MOVE_IN 유지, statusEndDate = 이동일 - 1일
			await mariaDBSequelize.query(
				`
				UPDATE roomStatus
				SET status = 'ROOM_MOVE',
					subStatus = 'ROOM_MOVE_IN',
					statusEndDate = ?,
					updatedAt = NOW()
				WHERE esntlId = ?
			`,
				{
					replacements: [moveDateMinusOneStr, contractInfo.roomStatusEsntlId],
					type: mariaDBSequelize.QueryTypes.UPDATE,
					transaction,
				}
			);
			// 추가 생성: status = ROOM_MOVE, subStatus = ROOM_MOVE_OUT, statusEndDate = 이동일 - 1일 (원래 방 1건 더)
			const roomMoveOutStatusId = await idsNext('roomStatus', undefined, transaction);
			await mariaDBSequelize.query(
				`
				INSERT INTO roomStatus (
					esntlId, roomEsntlId, gosiwonEsntlId, status, subStatus,
					customerEsntlId, customerName, reservationEsntlId, reservationName,
					contractorEsntlId, contractorName, contractEsntlId,
					statusStartDate, statusEndDate, etcStartDate, etcEndDate, statusMemo,
					createdAt, updatedAt
				) VALUES (?, ?, ?, 'ROOM_MOVE', 'ROOM_MOVE_OUT', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
			`,
				{
					replacements: [
						roomMoveOutStatusId,
						originalRoomEsntlId,
						contractInfo.gosiwonEsntlId,
						contractInfo.roomStatusCustomerEsntlId,
						contractInfo.roomStatusCustomerName,
						contractInfo.roomStatusReservationEsntlId,
						contractInfo.roomStatusReservationName,
						contractInfo.roomStatusContractorEsntlId,
						contractInfo.roomStatusContractorName,
						contractEsntlId,
						moveDateMinusOneStr,
						moveDateMinusOneStr,
						contractInfo.etcStartDate,
						contractInfo.etcEndDate,
						contractInfo.statusMemo,
					],
					type: mariaDBSequelize.QueryTypes.INSERT,
					transaction,
				}
			);
		} else {
			// subStatus = null 등: status = ROOM_MOVE, subStatus = ROOM_MOVE_OUT, statusEndDate = 이동일 - 1일 로 수정
			await mariaDBSequelize.query(
				`
				UPDATE roomStatus
				SET status = 'ROOM_MOVE',
					subStatus = 'ROOM_MOVE_OUT',
					statusEndDate = ?,
					updatedAt = NOW()
				WHERE esntlId = ?
			`,
				{
					replacements: [moveDateMinusOneStr, contractInfo.roomStatusEsntlId],
					type: mariaDBSequelize.QueryTypes.UPDATE,
					transaction,
				}
			);
		}

		// 3. 새로운 roomStatus 레코드 생성 (이동할 방용, 기존 계약 연결) (기존 미종료 상태는 신규 시작일로 종료 처리)
		// statusStartDate = moveDate, statusEndDate = originalContractEndDate, contractEsntlId = 기존 계약 ID
		// IDS 테이블과 roomStatus 실제 데이터 불일치 시 PRIMARY 중복 가능 → 중복 시 새 ID로 1회 재시도
		await closeOpenStatusesForRoom(targetRoomEsntlId, moveDateStr, transaction);
		let newRoomStatusId = await idsNext('roomStatus', undefined, transaction);
		const insertRoomStatusRow = () =>
			mariaDBSequelize.query(
				`
				INSERT INTO roomStatus (
					esntlId,
					roomEsntlId,
					gosiwonEsntlId,
					status,
					subStatus,
					customerEsntlId,
					customerName,
					reservationEsntlId,
					reservationName,
					contractorEsntlId,
					contractorName,
					contractEsntlId,
					statusStartDate,
					statusEndDate,
					etcStartDate,
					etcEndDate,
					statusMemo,
					createdAt,
					updatedAt
				) VALUES (?, ?, ?, 'CONTRACT', 'ROOM_MOVE_IN', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
			`,
				{
					replacements: [
						newRoomStatusId,
						targetRoomEsntlId,
						contractInfo.gosiwonEsntlId,
						contractInfo.roomStatusCustomerEsntlId,
						contractInfo.roomStatusCustomerName,
						contractInfo.roomStatusReservationEsntlId,
						contractInfo.roomStatusReservationName,
						contractInfo.roomStatusContractorEsntlId,
						contractInfo.roomStatusContractorName,
						contractEsntlId,
						moveDateStr,
						originalContractEndDate,
						contractInfo.etcStartDate,
						contractInfo.etcEndDate,
						contractInfo.statusMemo,
					],
					type: mariaDBSequelize.QueryTypes.INSERT,
					transaction,
				}
			);

		try {
			await insertRoomStatusRow();
		} catch (insertErr) {
			const isDup = insertErr.name === 'SequelizeUniqueConstraintError' || insertErr.parent?.errno === 1062;
			if (isDup && insertErr.errors?.[0]?.value === newRoomStatusId) {
				newRoomStatusId = await idsNext('roomStatus', undefined, transaction);
				await insertRoomStatusRow();
			} else {
				throw insertErr;
			}
		}

		// 3-1. ON_SALE이었던 타겟 방의 원래 상태 정보 조회 및 저장
		// statusEndDate가 NULL이거나 오늘 이후이거나 9999년(무제한)인 경우 변경
		const [targetRoomOnSaleStatuses] = await mariaDBSequelize.query(
			`
			SELECT esntlId, statusEndDate, subStatus
			FROM roomStatus
			WHERE roomEsntlId = ?
				AND status = 'ON_SALE'
				AND (statusEndDate IS NULL 
					OR statusEndDate > ? 
					OR statusEndDate >= '9999-01-01')
		`,
			{
				replacements: [targetRoomEsntlId, todayStr],
				type: mariaDBSequelize.QueryTypes.SELECT,
				transaction,
			}
		);

		// 타겟 방의 ON_SALE 상태를 변경
		await mariaDBSequelize.query(
			`
			UPDATE roomStatus 
			SET statusEndDate = ?,
				subStatus = 'END',
				updatedAt = NOW()
			WHERE roomEsntlId = ?
				AND status = 'ON_SALE'
				AND (statusEndDate IS NULL 
					OR statusEndDate > ? 
					OR statusEndDate >= '9999-01-01')
		`,
			{
				replacements: [moveDateStr, targetRoomEsntlId, todayStr],
				type: mariaDBSequelize.QueryTypes.UPDATE,
				transaction,
			}
		);

		// room 테이블: 타겟방 먼저, 기존 방 나중 (계약 유지 방식이라 extraPayment/parkStatus contractEsntlId 변경 없음)
		// 타겟방: roomStatus(CONTRACT) 반영 → status=CONTRACT, startDate/endDate 설정 (이동일이 오늘인 경우만 이 경로 진입)
		await syncRoomFromRoomStatus(
			targetRoomEsntlId,
			'CONTRACT',
			{ startDate: moveDateStr, endDate: originalContractEndDate },
			transaction
		);
		// 기존 방: roomStatus는 ROOM_MOVE이지만 비즈니스 규칙상 startDate/endDate null, status=오늘 이동이면 EMPTY, 아니면 LEAVE
		await room.update(
			{
				startDate: null,
				endDate: null,
				status: isMoveToday ? 'EMPTY' : 'LEAVE',
			},
			{ where: { esntlId: originalRoomEsntlId }, transaction }
		);

		// roomMoveStatus에 저장 (계약 유지이므로 contractEsntlId = 기존 계약 ID)
		const roomMoveStatusId = await generateRoomMoveStatusId(transaction);
		// memo에 contactedOwner 정보 포함
		const memoWithContact = memo 
			? `${memo}${contactedOwner ? ` [원장님연락: ${contactedOwner === 'Y' ? '연락됨' : '연락안됨'}]` : ''}`
			: contactedOwner ? `[원장님연락: ${contactedOwner === 'Y' ? '연락됨' : '연락안됨'}]` : null;
		
		// adjustmentStatus 설정: adjustmentAmount가 0이 아니면 PENDING, 0이면 NULL
		const finalAdjustmentStatus = finalAdjustmentAmount !== 0 ? 'PENDING' : null;
		
		// memo에 생성된 상태 ID 정보 추가 (JSON 형식, 계약 유지이므로 contractEsntlId 하나. 원상복구용 originalContractStartDate)
		// restoreOriginalRoomStatus: 취소 시 원래 방 roomStatus 복구에 사용 (하드코딩 대신 memo 값 사용)
		const statusIdsInfo = {
			createdRoomStatusIds: [], // roomAfterUse로 생성될 상태 ID들 (아직 생성 전이므로 빈 배열)
			originalRoomStatusId: contractInfo.roomStatusEsntlId,
			newRoomStatusId: newRoomStatusId,
			contractEsntlId: contractEsntlId, // 계약 유지
			originalContractStartDate: toYmd(contractInfo.startDate), // 원상복구 시 계약 startDate 복구용
			targetRoomOnSaleStatuses: targetRoomOnSaleStatuses || [], // 타겟 방의 원래 ON_SALE 상태 정보
			restoreOriginalRoomStatus: {
				status: 'CONTRACT',
				subStatus: contractInfo.roomStatusSubStatus ?? null,
				statusEndDate: originalContractEndDate, // 계약서 종료일(원래 방 roomStatus 복구 시 사용)
			},
		};
		let memoWithStatusIds = memoWithContact
			? `${memoWithContact} [STATUS_IDS:${JSON.stringify(statusIdsInfo)}]`
			: `[STATUS_IDS:${JSON.stringify(statusIdsInfo)}]`;
		
		// 당일 이동이면 status=COMPLETED, 아니면 PENDING
		const roomMoveStatusValue = isMoveToday ? 'COMPLETED' : 'PENDING';
		await mariaDBSequelize.query(
			`
			INSERT INTO roomMoveStatus (
				esntlId,
				gosiwonEsntlId,
				contractEsntlId,
				customerEsntlId,
				originalRoomEsntlId,
				targetRoomEsntlId,
				reason,
				status,
				moveDate,
				adjustmentAmount,
				adjustmentType,
				adjustmentStatus,
				memo,
				deleteYN,
				createdAt,
				updatedAt
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'N', NOW(), NOW())
		`,
			{
				replacements: [
					roomMoveStatusId,
					contractInfo.gosiwonEsntlId,
					contractEsntlId, // 계약 유지
					contractInfo.roomStatusCustomerEsntlId,
					originalRoomEsntlId,
					targetRoomEsntlId,
					reason,
					roomMoveStatusValue,
					moveDateStr ? `${moveDateStr} 00:00:00` : moveDateStr, // MySQL DATETIME 형식 (ISO Date 직렬화 오류 방지)
					finalAdjustmentAmount,
					finalAdjustmentType,
					finalAdjustmentStatus,
					memoWithStatusIds,
				],
				type: mariaDBSequelize.QueryTypes.INSERT,
				transaction,
			}
		);

		// 3-2. history 테이블에 방마다 히스토리 기록 (나가는 방: 이 방에서 타겟방으로, 타겟방: 어떤 방에서 이 방으로)
		try {
			const historyContentOriginal = `방이동: 이 방(${originalRoomNumber}) → ${targetRoomNumber}, 이동일 ${moveDateStr}, roomStatus ROOM_MOVE_OUT 처리`;
			const historyContentTarget = `방이동: ${originalRoomNumber} → 이 방(${targetRoomNumber}), 이동일 ${moveDateStr}, roomStatus CONTRACT(ROOM_MOVE_IN) 등록`;

			await historyController.createHistoryRecord(
				{
					gosiwonEsntlId: contractInfo.gosiwonEsntlId,
					roomEsntlId: originalRoomEsntlId,
					contractEsntlId: contractEsntlId,
					content: historyContentOriginal,
					category: 'CONTRACT',
					priority: 'NORMAL',
					publicRange: 0,
					writerAdminId: writerAdminId,
					writerName,
					writerType: 'ADMIN',
				},
				transaction
			);

			await historyController.createHistoryRecord(
				{
					gosiwonEsntlId: contractInfo.gosiwonEsntlId,
					roomEsntlId: targetRoomEsntlId,
					contractEsntlId: contractEsntlId,
					content: historyContentTarget,
					category: 'CONTRACT',
					priority: 'NORMAL',
					publicRange: 0,
					writerAdminId: writerAdminId,
					writerName,
					writerType: 'ADMIN',
				},
				transaction
			);
		} catch (historyErr) {
			console.error('방이동 history 생성 실패:', historyErr);
			// history 생성 실패해도 방이동 처리 자체는 완료
		}

		// 4. roomAfterUse 함수 호출 (기존 방 id로 새 roomStatus INSERT. 설정에 따라 ON_SALE/CAN_CHECKIN/BEFORE_SALES 등 생성)
		// 클라이언트가 설정을 보내면 그대로 사용, 없으면 check_basic_sell: true로 고시원 설정(il_gosiwon_config) 기준 생성
		let createdRoomStatusIds = [];
		const hasRoomAfterUseParams =
			check_basic_sell !== undefined ||
			unableCheckInReason ||
			check_room_only_config !== undefined ||
			sell_able_start_date ||
			can_checkin_start_date;
		createdRoomStatusIds = await roomAfterUse(
			{
				gosiwonEsntlId: contractInfo.gosiwonEsntlId,
				roomEsntlId: originalRoomEsntlId,
				check_basic_sell: hasRoomAfterUseParams ? check_basic_sell : true,
				unableCheckInReason: hasRoomAfterUseParams ? unableCheckInReason : undefined,
				check_room_only_config: hasRoomAfterUseParams ? check_room_only_config : undefined,
				sell_able_start_date: hasRoomAfterUseParams ? sell_able_start_date : undefined,
				sell_able_end_date: hasRoomAfterUseParams ? sell_able_end_date : undefined,
				can_checkin_start_date: hasRoomAfterUseParams ? can_checkin_start_date : undefined,
				can_checkin_end_date: hasRoomAfterUseParams ? can_checkin_end_date : undefined,
				baseDate: moveDate, // 방이동의 경우 moveDate를 기준 날짜로 사용
			},
			transaction
		);

		// roomAfterUse가 상태를 생성하지 않은 경우: 나간 방에 BEFORE_SALES 무기한(9999년) INSERT (기존 미종료 상태는 신규 시작일로 종료 처리)
		if (createdRoomStatusIds.length === 0) {
			const beforeSalesStartDate = moveDateStr; // 이동일 기준
			const beforeSalesEndDate = '9999-12-31 23:59:59';
			await closeOpenStatusesForRoom(originalRoomEsntlId, beforeSalesStartDate, transaction);
			const beforeSalesStatusId = await idsNext('roomStatus', undefined, transaction);
			createdRoomStatusIds.push(beforeSalesStatusId);
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
				) VALUES (?, ?, ?, 'BEFORE_SALES', ?, ?, ?, ?, NOW(), NOW())
				`,
				{
					replacements: [
						beforeSalesStatusId,
						originalRoomEsntlId,
						contractInfo.gosiwonEsntlId,
						beforeSalesStartDate,
						beforeSalesEndDate,
						beforeSalesStartDate,
						beforeSalesEndDate,
					],
					type: mariaDBSequelize.QueryTypes.INSERT,
					transaction,
				}
			);
		}

		// roomAfterUse로 생성된 상태 ID들을 roomMoveStatus의 memo에 업데이트
		// createdRoomStatusIds가 있거나 targetRoomOnSaleStatuses가 있으면 업데이트
		// (targetRoomOnSaleStatuses는 초기에 저장되지만, createdRoomStatusIds가 나중에 추가되므로 항상 업데이트)
		if (createdRoomStatusIds.length > 0 || (targetRoomOnSaleStatuses && targetRoomOnSaleStatuses.length > 0)) {
			// memo에서 기존 STATUS_IDS 정보를 찾아서 업데이트 (계약 유지)
			const updatedStatusIdsInfo = {
				createdRoomStatusIds: createdRoomStatusIds,
				originalRoomStatusId: contractInfo.roomStatusEsntlId,
				newRoomStatusId: newRoomStatusId,
				contractEsntlId: contractEsntlId,
				originalContractStartDate: statusIdsInfo.originalContractStartDate,
				targetRoomOnSaleStatuses: targetRoomOnSaleStatuses || [],
				restoreOriginalRoomStatus: statusIdsInfo.restoreOriginalRoomStatus,
			};
			const updatedMemo = memoWithStatusIds.replace(
				/\[STATUS_IDS:.*?\]/,
				`[STATUS_IDS:${JSON.stringify(updatedStatusIdsInfo)}]`
			);
			
			await mariaDBSequelize.query(
				`
				UPDATE roomMoveStatus 
				SET memo = ?,
					updatedAt = NOW()
				WHERE esntlId = ?
			`,
				{
					replacements: [updatedMemo, roomMoveStatusId],
					type: mariaDBSequelize.QueryTypes.UPDATE,
					transaction,
				}
			);
		} else if (targetRoomOnSaleStatuses && targetRoomOnSaleStatuses.length > 0) {
			// createdRoomStatusIds는 없지만 targetRoomOnSaleStatuses가 있는 경우에도 업데이트 (계약 유지)
			const updatedStatusIdsInfo = {
				createdRoomStatusIds: [],
				originalRoomStatusId: contractInfo.roomStatusEsntlId,
				newRoomStatusId: newRoomStatusId,
				contractEsntlId: contractEsntlId,
				originalContractStartDate: statusIdsInfo.originalContractStartDate,
				targetRoomOnSaleStatuses: targetRoomOnSaleStatuses,
				restoreOriginalRoomStatus: statusIdsInfo.restoreOriginalRoomStatus,
			};
			const updatedMemo = memoWithStatusIds.replace(
				/\[STATUS_IDS:.*?\]/,
				`[STATUS_IDS:${JSON.stringify(updatedStatusIdsInfo)}]`
			);
			
			await mariaDBSequelize.query(
				`
				UPDATE roomMoveStatus 
				SET memo = ?,
					updatedAt = NOW()
				WHERE esntlId = ?
			`,
				{
					replacements: [updatedMemo, roomMoveStatusId],
					type: mariaDBSequelize.QueryTypes.UPDATE,
					transaction,
				}
			);
		}

		await transaction.commit();

		errorHandler.successThrow(res, '방이동 처리 성공', {
			roomMoveStatusId: roomMoveStatusId,
			originalRoomStatusId: contractInfo.roomStatusEsntlId,
			newRoomStatusId: newRoomStatusId,
			contractEsntlId: contractEsntlId, // 계약 유지
		});
		return;
		} catch (err) {
			try {
				await transaction.rollback();
			} catch (_rollbackErr) {
				// 이미 완료된 트랜잭션(commit/rollback 된 경우)에서 rollback 호출 시 무시
			}
			lastErr = err;
			if (attempt < MAX_DEADLOCK_RETRIES && isDeadlockError(err)) {
				const delayMs = 50 + Math.floor(Math.random() * 150);
				console.error(`[roomMove/process] 데드락 발생, ${delayMs}ms 후 재시도 (${attempt}/${MAX_DEADLOCK_RETRIES}):`, err.message);
				await new Promise((r) => setTimeout(r, delayMs));
				continue;
			}
			// 원인 확인용 상세 로그 (Validation error 디버깅)
			console.error('[roomMove/process] 에러 발생:', {
				name: err.name,
				message: err.message,
				...(err.errors && { errors: err.errors }),
				...(err.parent && { sqlMessage: err.parent.message, sql: err.parent.sql }),
				stack: err.stack,
			});

			// Sequelize ValidationError는 400으로 변환해 상세 메시지 반환
			if (err.name === 'SequelizeValidationError' && err.errors && err.errors.length > 0) {
				const detail = err.errors.map((e) => `${e.path}: ${e.message}`).join('; ');
				const validationErr = new Error(`입력값 검증 실패: ${detail}`);
				validationErr.statusCode = 400;
				return next(validationErr);
			}
			return next(lastErr);
		}
	}
	// 재시도 모두 소진 후 데드락이었을 경우
	return next(lastErr);
};

// 방이동 삭제 및 원상복구
/**
 * 방이동 취소 내부 로직 (Express 핸들러와 스케줄러에서 공통 사용)
 * @param {string} roomMoveStatusId - 방이동 상태 ID
 * @param {string} writerAdminId - 작성자 ID
 * @param {string} writerName - 작성자 이름
 * @returns {Promise<void>}
 */
async function cancelRoomMoveInternal(roomMoveStatusId, writerAdminId, writerName) {
	const transaction = await mariaDBSequelize.transaction();
	try {
		if (!roomMoveStatusId) {
			throw new Error('방이동 상태 ID를 입력해주세요.');
		}

		// 방이동 상태 존재 확인 및 adjustmentStatus 확인
		const [existingRoomMove] = await mariaDBSequelize.query(
			`
			SELECT 
				RMS.esntlId,
				RMS.gosiwonEsntlId,
				RMS.contractEsntlId,
				RMS.originalRoomEsntlId,
				RMS.targetRoomEsntlId,
				RMS.moveDate,
				RMS.adjustmentStatus,
				RMS.memo
			FROM roomMoveStatus RMS
			WHERE RMS.esntlId = ?
				AND RMS.deleteYN = 'N'
			LIMIT 1
		`,
			{
				replacements: [roomMoveStatusId],
				type: mariaDBSequelize.QueryTypes.SELECT,
				transaction,
			}
		);

		if (!existingRoomMove) {
			throw new Error('방이동 상태를 찾을 수 없습니다.');
		}

		// adjustmentStatus가 COMPLETED인 경우 삭제 불가
		if (existingRoomMove.adjustmentStatus === 'COMPLETED') {
			throw new Error('조정 처리가 완료된 방이동은 삭제할 수 없습니다.');
		}

		// memo에서 계약서 ID 정보 및 원래 방 roomStatus 복구값 추출
		let originalContractEsntlId = null;
		let newContractEsntlId = existingRoomMove.contractEsntlId; // 기본값은 현재 contractEsntlId
		let originalContractStartDate = null; // 계약 유지 방식 원상복구용
		let isSingleContractMove = false; // 계약 유지(단일 계약) 방이동 여부
		let restoreOriginalRoomStatus = null; // memo에 저장된 원래 방 roomStatus 복구값 (status, subStatus, statusEndDate)

		if (existingRoomMove.memo) {
			const statusIdsMatch = existingRoomMove.memo.match(/\[STATUS_IDS:(.*?)\]/);
			if (statusIdsMatch) {
				try {
					const statusIdsInfo = JSON.parse(statusIdsMatch[1]);
					originalContractEsntlId = statusIdsInfo.originalContractEsntlId || statusIdsInfo.contractEsntlId || null;
					newContractEsntlId = statusIdsInfo.newContractEsntlId || statusIdsInfo.contractEsntlId || existingRoomMove.contractEsntlId;
					originalContractStartDate = statusIdsInfo.originalContractStartDate || null;
					isSingleContractMove = !statusIdsInfo.newContractEsntlId && !!statusIdsInfo.contractEsntlId;
					restoreOriginalRoomStatus = statusIdsInfo.restoreOriginalRoomStatus || null;
				} catch (err) {
					console.error('Failed to parse STATUS_IDS from memo:', err);
				}
			}
		}

		// 계약 정보 조회 (복구/삭제용)
		const contractIdForQuery = originalContractEsntlId || newContractEsntlId || existingRoomMove.contractEsntlId;
		const [originalContractInfo] = await mariaDBSequelize.query(
			`
			SELECT endDate, status, startDate
			FROM roomContract
			WHERE esntlId = ?
			LIMIT 1
		`,
			{
				replacements: [contractIdForQuery],
				type: mariaDBSequelize.QueryTypes.SELECT,
				transaction,
			}
		);

		if (!originalContractInfo) {
			throw new Error('계약 정보를 찾을 수 없습니다.');
		}

		const contractEndDate = originalContractInfo.endDate;

		if (isSingleContractMove) {
			// 계약 유지 방식 원상복구: 동일 계약의 roomEsntlId·startDate만 원래 방으로 복구, 계약 삭제 없음
			const restoreStartDate = originalContractStartDate || contractEndDate;
			await mariaDBSequelize.query(
				`
				UPDATE roomContract
				SET roomEsntlId = ?,
					startDate = ?
				WHERE esntlId = ?
			`,
				{
					replacements: [existingRoomMove.originalRoomEsntlId, restoreStartDate, existingRoomMove.contractEsntlId],
					type: mariaDBSequelize.QueryTypes.UPDATE,
					transaction,
				}
			);
			// 원래 방 roomStatus: ROOM_MOVE_OUT 행만 CONTRACT로 복구 (원래 방에 ROOM_MOVE_IN/OUT 두 건 있을 수 있음)
			const restoreStatus = restoreOriginalRoomStatus?.status ?? 'CONTRACT';
			const restoreSubStatus = restoreOriginalRoomStatus?.subStatus ?? null;
			const restoreStatusEndDate = restoreOriginalRoomStatus?.statusEndDate ?? contractEndDate;
			const [moveOutRow] = await mariaDBSequelize.query(
				`SELECT esntlId FROM roomStatus WHERE contractEsntlId = ? AND roomEsntlId = ? AND status = 'ROOM_MOVE' AND subStatus = 'ROOM_MOVE_OUT' LIMIT 1`,
				{ replacements: [existingRoomMove.contractEsntlId, existingRoomMove.originalRoomEsntlId], type: mariaDBSequelize.QueryTypes.SELECT, transaction }
			);
			if (moveOutRow && moveOutRow.esntlId) {
				await mariaDBSequelize.query(
					`UPDATE roomStatus SET status = ?, subStatus = ?, statusEndDate = ?, updatedAt = NOW() WHERE esntlId = ?`,
					{ replacements: [restoreStatus, restoreSubStatus, restoreStatusEndDate, moveOutRow.esntlId], type: mariaDBSequelize.QueryTypes.UPDATE, transaction }
				);
			}
			// 같은 계약·원래 방의 ROOM_MOVE_IN 행은 삭제 (복구 후 CONTRACT 1건만 남기기 위함)
			await mariaDBSequelize.query(
				`DELETE FROM roomStatus WHERE contractEsntlId = ? AND roomEsntlId = ? AND status = 'ROOM_MOVE' AND subStatus = 'ROOM_MOVE_IN'`,
				{ replacements: [existingRoomMove.contractEsntlId, existingRoomMove.originalRoomEsntlId], type: mariaDBSequelize.QueryTypes.DELETE, transaction }
			);
		} else {
			// 이전 방식: 기존 계약서 복구(endDate/status). 계약서는 삭제하지 않고 새 계약만 비활성 처리
			const [newContractInfo] = await mariaDBSequelize.query(
				`SELECT endDate FROM roomContract WHERE esntlId = ? LIMIT 1`,
				{ replacements: [newContractEsntlId], type: mariaDBSequelize.QueryTypes.SELECT, transaction }
			);
			if (!newContractInfo) {
				throw new Error('새 계약 정보를 찾을 수 없습니다.');
			}
			if (originalContractEsntlId) {
				// 원래 계약서 복구: roomEsntlId 원래 방으로, endDate 복구, status는 CONTRACT 유지
				await mariaDBSequelize.query(
					`UPDATE roomContract SET roomEsntlId = ?, endDate = ?, status = 'CONTRACT' WHERE esntlId = ?`,
					{ replacements: [existingRoomMove.originalRoomEsntlId, newContractInfo.endDate, originalContractEsntlId], type: mariaDBSequelize.QueryTypes.UPDATE, transaction }
				);
			}
			// 원래 방 roomStatus: ROOM_MOVE_OUT 또는 CONTRACT+ROOM_MOVE_OUT 행을 CONTRACT로 복구
			const restoreStatus = restoreOriginalRoomStatus?.status ?? 'CONTRACT';
			const restoreSubStatus = restoreOriginalRoomStatus?.subStatus ?? null;
			const restoreStatusEndDate = restoreOriginalRoomStatus?.statusEndDate ?? newContractInfo.endDate;
			await mariaDBSequelize.query(
				`
				UPDATE roomStatus
				SET status = ?, subStatus = ?, statusEndDate = ?, updatedAt = NOW()
				WHERE contractEsntlId = ? AND roomEsntlId = ?
					AND ((status = 'CONTRACT' AND subStatus = 'ROOM_MOVE_OUT') OR (status = 'ROOM_MOVE' AND subStatus = 'ROOM_MOVE_OUT'))
				`,
				{
					replacements: [restoreStatus, restoreSubStatus, restoreStatusEndDate, originalContractEsntlId, existingRoomMove.originalRoomEsntlId],
					type: mariaDBSequelize.QueryTypes.UPDATE,
					transaction,
				}
			);
			// 같은 계약·원래 방의 ROOM_MOVE_IN 행 삭제 (있을 경우)
			await mariaDBSequelize.query(
				`DELETE FROM roomStatus WHERE contractEsntlId = ? AND roomEsntlId = ? AND status = 'ROOM_MOVE' AND subStatus = 'ROOM_MOVE_IN'`,
				{ replacements: [originalContractEsntlId, existingRoomMove.originalRoomEsntlId], type: mariaDBSequelize.QueryTypes.DELETE, transaction }
			);
			// 계약서는 삭제하지 않음 (roomMoveStatus FK RESTRICT 및 이력 보존). 새 계약도 status 변경하지 않음 (CONTRACT 유지)
		}

		// 원래 방 room 테이블: CONTRACT + 계약 기간(startDate/endDate) 복구 (복구된 계약서 기준)
		const contractIdForOriginalRoom = isSingleContractMove ? existingRoomMove.contractEsntlId : originalContractEsntlId;
		if (contractIdForOriginalRoom) {
			const [contractDates] = await mariaDBSequelize.query(
				`SELECT startDate, endDate FROM roomContract WHERE esntlId = ? LIMIT 1`,
				{ replacements: [contractIdForOriginalRoom], type: mariaDBSequelize.QueryTypes.SELECT, transaction }
			);
			if (contractDates && (contractDates.startDate != null || contractDates.endDate != null)) {
				const toYmd = dateToYmd;
				const startDateStr = toYmd(contractDates.startDate);
				const endDateStr = toYmd(contractDates.endDate);
				await room.update(
					{ status: 'CONTRACT', startDate: startDateStr, endDate: endDateStr },
					{ where: { esntlId: existingRoomMove.originalRoomEsntlId }, transaction }
				);
			} else {
				await room.update(
					{ status: 'CONTRACT' },
					{ where: { esntlId: existingRoomMove.originalRoomEsntlId }, transaction }
				);
			}
		} else {
			await room.update(
				{ status: 'CONTRACT' },
				{ where: { esntlId: existingRoomMove.originalRoomEsntlId }, transaction }
			);
		}

		// 이동할 방의 roomStatus(ROOM_MOVE_IN) 삭제
		await mariaDBSequelize.query(
			`
			DELETE FROM roomStatus
			WHERE contractEsntlId = ? AND roomEsntlId = ? AND status = 'CONTRACT' AND subStatus = 'ROOM_MOVE_IN'
		`,
			{
				replacements: [existingRoomMove.contractEsntlId, existingRoomMove.targetRoomEsntlId],
				type: mariaDBSequelize.QueryTypes.DELETE,
				transaction,
			}
		);

		// 타겟 방 room 테이블: 원래 상태로 복귀 (EMPTY, 계약 기간 제거)
		await room.update(
			{ status: 'EMPTY', startDate: null, endDate: null },
			{ where: { esntlId: existingRoomMove.targetRoomEsntlId }, transaction }
		);

		// 3. 타겟 방의 ON_SALE 상태 복구 (END -> 원래 상태로)
		// memo에서 원래 상태 정보를 추출하여 복구
		const moveDateStr = existingRoomMove.moveDate 
			? (typeof existingRoomMove.moveDate === 'string' 
				? existingRoomMove.moveDate.split(' ')[0].split('T')[0] 
				: existingRoomMove.moveDate)
			: null;

		let targetRoomOnSaleStatuses = [];
		if (existingRoomMove.memo) {
			const statusIdsMatch = existingRoomMove.memo.match(/\[STATUS_IDS:(.*?)\]/);
			if (statusIdsMatch) {
				try {
					const statusIdsInfo = JSON.parse(statusIdsMatch[1]);
					targetRoomOnSaleStatuses = statusIdsInfo.targetRoomOnSaleStatuses || [];
				} catch (err) {
					console.error('Failed to parse STATUS_IDS from memo:', err);
				}
			}
		}

		if (targetRoomOnSaleStatuses.length > 0) {
			// 저장된 원래 상태 정보로 복구
			for (const onSaleStatus of targetRoomOnSaleStatuses) {
				// statusEndDate가 명시적으로 저장되어 있으면 사용, 없으면 NULL
				// subStatus도 마찬가지
				const originalSubStatus = onSaleStatus.subStatus !== undefined ? onSaleStatus.subStatus : null;
				const originalStatusEndDate = onSaleStatus.statusEndDate !== undefined ? onSaleStatus.statusEndDate : null;
				
				await mariaDBSequelize.query(
					`
					UPDATE roomStatus
					SET subStatus = ?,
						statusEndDate = ?,
						updatedAt = NOW()
					WHERE esntlId = ?
						AND roomEsntlId = ?
						AND status = 'ON_SALE'
						AND subStatus = 'END'
				`,
					{
						replacements: [
							originalSubStatus,
							originalStatusEndDate,
							onSaleStatus.esntlId,
							existingRoomMove.targetRoomEsntlId,
						],
						type: mariaDBSequelize.QueryTypes.UPDATE,
						transaction,
					}
				);
			}
		} else if (moveDateStr) {
			// STATUS_IDS 정보가 없는 경우 (기존 데이터)
			// moveDate 이전의 원래 상태를 찾아서 복구 시도
			// 하지만 정확한 원래 값을 알 수 없으므로, subStatus만 NULL로 복구하고
			// statusEndDate는 무제한(9999-12-31)으로 설정하거나, moveDate 이전의 다른 ON_SALE 상태를 참조
			
			// moveDate 이전에 생성된 다른 ON_SALE 상태가 있는지 확인
			const [previousOnSaleStatus] = await mariaDBSequelize.query(
				`
				SELECT statusEndDate, subStatus
				FROM roomStatus
				WHERE roomEsntlId = ?
					AND status = 'ON_SALE'
					AND createdAt < DATE_ADD(STR_TO_DATE(?, '%Y-%m-%d'), INTERVAL 9 HOUR)
					AND esntlId NOT IN (
						SELECT esntlId FROM roomStatus 
						WHERE roomEsntlId = ? 
						AND status = 'ON_SALE' 
						AND subStatus = 'END' 
						AND statusEndDate = ?
					)
				ORDER BY createdAt DESC
				LIMIT 1
			`,
				{
					replacements: [existingRoomMove.targetRoomEsntlId, moveDateStr, existingRoomMove.targetRoomEsntlId, moveDateStr],
					type: mariaDBSequelize.QueryTypes.SELECT,
					transaction,
				}
			);

			// subStatus를 NULL로 복구하고, statusEndDate는 이전 상태가 있으면 그 값을 사용, 없으면 무제한으로 설정
			const restoreStatusEndDate = previousOnSaleStatus && previousOnSaleStatus.statusEndDate 
				? previousOnSaleStatus.statusEndDate 
				: '9999-12-31 23:59:59';

			await mariaDBSequelize.query(
				`
				UPDATE roomStatus
				SET subStatus = NULL,
					statusEndDate = ?,
					updatedAt = NOW()
				WHERE roomEsntlId = ?
					AND status = 'ON_SALE'
					AND subStatus = 'END'
					AND statusEndDate = ?
			`,
				{
					replacements: [restoreStatusEndDate, existingRoomMove.targetRoomEsntlId, moveDateStr],
					type: mariaDBSequelize.QueryTypes.UPDATE,
					transaction,
				}
			);
		}

		// 4. 원래 방에 생성된 새로운 상태들 삭제 (roomAfterUse로 생성된 것들)
		// memo에서 STATUS_IDS 정보를 추출하여 정확한 ID들만 삭제
		let createdRoomStatusIds = [];
		if (existingRoomMove.memo) {
			const statusIdsMatch = existingRoomMove.memo.match(/\[STATUS_IDS:(.*?)\]/);
			if (statusIdsMatch) {
				try {
					const statusIdsInfo = JSON.parse(statusIdsMatch[1]);
					createdRoomStatusIds = statusIdsInfo.createdRoomStatusIds || [];
				} catch (err) {
					// JSON 파싱 실패 시 무시 (기존 방식으로 fallback)
					console.error('Failed to parse STATUS_IDS from memo:', err);
				}
			}
		}

		if (createdRoomStatusIds.length > 0) {
			// 저장된 정확한 ID들만 삭제
			await mariaDBSequelize.query(
				`
				DELETE FROM roomStatus
				WHERE esntlId IN (?)
			`,
				{
					replacements: [createdRoomStatusIds],
					type: mariaDBSequelize.QueryTypes.DELETE,
					transaction,
				}
			);
		} else {
			// STATUS_IDS 정보가 없는 경우 (기존 데이터) 기존 방식으로 삭제
			// moveDate 이후에 생성된 상태들을 삭제
			if (moveDateStr) {
				const moveDateTime = `${moveDateStr} 00:00:00`;
				
				await mariaDBSequelize.query(
					`
					DELETE FROM roomStatus
					WHERE roomEsntlId = ?
						AND (contractEsntlId IS NULL OR contractEsntlId != ?)
						AND DATE(createdAt) >= DATE(?)
						AND status IN ('ON_SALE', 'CAN_CHECKIN', 'BEFORE_SALES')
				`,
					{
						replacements: [
							existingRoomMove.originalRoomEsntlId,
							existingRoomMove.contractEsntlId,
							moveDateTime,
						],
						type: mariaDBSequelize.QueryTypes.DELETE,
						transaction,
					}
				);
			}
		}

		// 5. 소프트 삭제
		await mariaDBSequelize.query(
			`
			UPDATE roomMoveStatus 
			SET deleteYN = 'Y',
				deletedBy = ?,
				deletedAt = NOW(),
				updatedAt = NOW()
			WHERE esntlId = ?
		`,
			{
				replacements: [writerAdminId, roomMoveStatusId],
				type: mariaDBSequelize.QueryTypes.UPDATE,
				transaction,
			}
		);

		// 6. roomStatus 변경 history 기록 (원래방·이동방 각각)
		try {
			const [originalRoom] = await mariaDBSequelize.query(
				`SELECT roomNumber FROM room WHERE esntlId = ? LIMIT 1`,
				{ replacements: [existingRoomMove.originalRoomEsntlId], type: mariaDBSequelize.QueryTypes.SELECT, transaction }
			);
			const [targetRoom] = await mariaDBSequelize.query(
				`SELECT roomNumber FROM room WHERE esntlId = ? LIMIT 1`,
				{ replacements: [existingRoomMove.targetRoomEsntlId], type: mariaDBSequelize.QueryTypes.SELECT, transaction }
			);
			const origNum = originalRoom?.[0]?.roomNumber || existingRoomMove.originalRoomEsntlId;
			const tgtNum = targetRoom?.[0]?.roomNumber || existingRoomMove.targetRoomEsntlId;

			await historyController.createHistoryRecord(
				{
					gosiwonEsntlId: existingRoomMove.gosiwonEsntlId,
					roomEsntlId: existingRoomMove.originalRoomEsntlId,
					contractEsntlId: existingRoomMove.contractEsntlId,
					content: `방이동 취소: ${origNum}호 원상복구 (roomStatus ROOM_MOVE_OUT → CONTRACT, ROOM_MOVE_IN 삭제, 생성된 ON_SALE/CAN_CHECKIN/BEFORE_SALES 삭제)`,
					category: 'CONTRACT',
					priority: 'NORMAL',
					publicRange: 0,
					writerAdminId,
					writerName,
					writerType: 'ADMIN',
				},
				transaction
			);
			await historyController.createHistoryRecord(
				{
					gosiwonEsntlId: existingRoomMove.gosiwonEsntlId,
					roomEsntlId: existingRoomMove.targetRoomEsntlId,
					contractEsntlId: existingRoomMove.contractEsntlId,
					content: `방이동 취소: ${tgtNum}호 원상복구 (roomStatus CONTRACT/ROOM_MOVE_IN 삭제, room EMPTY, ON_SALE 상태 복구)`,
					category: 'CONTRACT',
					priority: 'NORMAL',
					publicRange: 0,
					writerAdminId,
					writerName,
					writerType: 'ADMIN',
				},
				transaction
			);
		} catch (historyErr) {
			console.error('[deleteRoomMove] history 생성 실패:', historyErr);
		}

		await transaction.commit();
	} catch (error) {
		try {
			await transaction.rollback();
		} catch (_rollbackErr) {
			// 이미 완료된 트랜잭션에서 rollback 호출 시 무시
		}
		throw error;
	}
}

exports.cancelRoomMoveInternal = cancelRoomMoveInternal;

exports.deleteRoomMove = async (req, res, next) => {
	try {
		const decodedToken = verifyAdminToken(req);
		const writerAdminId = getWriterAdminId(decodedToken);
		const writerName = decodedToken.admin?.name ?? decodedToken.partner?.name ?? '관리자';

		const { roomMoveStatusId } = req.params;

		if (!roomMoveStatusId) {
			errorHandler.errorThrow(400, '방이동 상태 ID를 입력해주세요.');
		}

		await cancelRoomMoveInternal(roomMoveStatusId, writerAdminId, writerName);

		res.status(200).json({
			success: true,
			message: '방이동 상태가 삭제되고 원상복구되었습니다.',
		});
	} catch (error) {
		next(error);
	}
};

/**
 * 스케줄러/수동 실행: roomMoveStatus 1건에 대해 당일 방이동 처리 (계약·roomStatus·room 반영 후 해당 row를 COMPLETED로 갱신)
 * @param {object} row - roomMoveStatus 행
 * @param {string} writerAdminId - 작성자
 * @param {object|null} transaction - 트랜잭션 (없으면 자체 생성)
 * @param {string|null} [effectiveDateStr] - 기준일(YYYY-MM-DD). 있으면 이 날짜를 '오늘'처럼 사용(이동예정일 기준 실행). 없으면 실제 오늘.
 */
async function executeOneScheduledRoomMove(row, writerAdminId, transaction, effectiveDateStr) {
	const ownTransaction = !transaction;
	const txn = transaction || (await mariaDBSequelize.transaction());
	try {
		const contractEsntlId = row.contractEsntlId;
		const originalRoomEsntlId = row.originalRoomEsntlId;
		const targetRoomEsntlId = row.targetRoomEsntlId;
		const toYmd = dateToYmd;
		const moveDateStr = toYmd(row.moveDate);
		// 이동예정일 기준 실행 시 effectiveDateStr를 '오늘'로 사용 (실행 시점이 아니라 이동예정일 기준으로 처리)
		const today = new Date();
		const todayStr = (effectiveDateStr && /^\d{4}-\d{2}-\d{2}$/.test(effectiveDateStr))
			? effectiveDateStr
			: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

		const [contractInfo] = await mariaDBSequelize.query(
			`
			SELECT RC.esntlId, RC.roomEsntlId, RC.gosiwonEsntlId, RC.customerEsntlId,
				RC.startDate, RC.endDate AS originalEndDate, RC.monthlyRent,
				RS.esntlId AS roomStatusEsntlId, RS.subStatus AS roomStatusSubStatus,
				RS.customerEsntlId AS roomStatusCustomerEsntlId, RS.customerName AS roomStatusCustomerName,
				RS.reservationEsntlId AS roomStatusReservationEsntlId, RS.reservationName AS roomStatusReservationName,
				RS.contractorEsntlId AS roomStatusContractorEsntlId, RS.contractorName AS roomStatusContractorName,
				RS.statusStartDate, RS.statusEndDate, RS.etcStartDate, RS.etcEndDate, RS.statusMemo
			FROM roomContract RC
			JOIN roomStatus RS ON RC.esntlId = RS.contractEsntlId AND RS.roomEsntlId = ? AND RS.status = 'CONTRACT'
			WHERE RC.esntlId = ? LIMIT 1
			`,
			{ replacements: [originalRoomEsntlId, contractEsntlId], type: mariaDBSequelize.QueryTypes.SELECT, transaction: txn }
		);
		if (!contractInfo || !contractInfo.roomStatusEsntlId) {
			throw new Error('계약 정보 또는 CONTRACT 상태의 방 상태를 찾을 수 없습니다.');
		}

		const rcEnd = toYmd(contractInfo.originalEndDate);
		const rsEnd = toYmd(contractInfo.statusEndDate);
		const originalContractEndDate = (rcEnd && rcEnd !== moveDateStr) ? rcEnd : (rsEnd && rsEnd > moveDateStr ? rsEnd : (rcEnd || rsEnd));
		if (!originalContractEndDate) throw new Error('기존 계약의 종료일을 찾을 수 없습니다.');

		const moveDateParts = moveDateStr.split('-').map(Number);
		const moveDatePrev = new Date(moveDateParts[0], moveDateParts[1] - 1, moveDateParts[2]);
		moveDatePrev.setDate(moveDatePrev.getDate() - 1);
		const moveDateMinusOneStr = `${moveDatePrev.getFullYear()}-${String(moveDatePrev.getMonth() + 1).padStart(2, '0')}-${String(moveDatePrev.getDate()).padStart(2, '0')}`;

		const [targetRoomList, originalRoomList] = await Promise.all([
			mariaDBSequelize.query(`SELECT esntlId, roomNumber FROM room WHERE esntlId = ? LIMIT 1`, { replacements: [targetRoomEsntlId], type: mariaDBSequelize.QueryTypes.SELECT, transaction: txn }),
			mariaDBSequelize.query(`SELECT esntlId, roomNumber FROM room WHERE esntlId = ? LIMIT 1`, { replacements: [originalRoomEsntlId], type: mariaDBSequelize.QueryTypes.SELECT, transaction: txn }),
		]);
		const targetRoom = targetRoomList && targetRoomList[0];
		const originalRoom = originalRoomList && originalRoomList[0];
		const targetRoomNumber = (targetRoom && targetRoom.roomNumber) || targetRoomEsntlId;
		const originalRoomNumber = (originalRoom && originalRoom.roomNumber) || originalRoomEsntlId;

		// roomContract.memo2에는 방이동 내용을 더 이상 누적하지 않고, 계약만 갱신 (이력은 history에 저장)
		await mariaDBSequelize.query(
			`UPDATE roomContract SET roomEsntlId = ?, startDate = ?, endDate = ? WHERE esntlId = ?`,
			{ replacements: [targetRoomEsntlId, moveDateStr, originalContractEndDate, contractEsntlId], type: mariaDBSequelize.QueryTypes.UPDATE, transaction: txn }
		);

		// adjustmentAmount가 있으면 월 입실료 차액 반영 (monthlyRent는 만원 단위: 15 = 15만원, 5000원 = 0.5)
		const adjAmount = row.adjustmentAmount != null ? Number(row.adjustmentAmount) : 0;
		const adjType = row.adjustmentType;
		if (adjAmount > 0 && adjType && ['ADDITION', 'REFUND'].includes(adjType)) {
			const currentRent = parseFloat(contractInfo.monthlyRent) || 0;
			const delta = adjAmount / 10000;
			const newRent = adjType === 'REFUND' ? Math.max(0, currentRent - delta) : currentRent + delta;
			const newRentToStore = Number.isInteger(newRent) ? String(newRent) : String(Number(newRent.toFixed(2)));
			const adjustmentMemo = `월입실료 조정: ${adjType === 'REFUND' ? '환불' : '추가'} ${adjAmount}원 (기존 ${currentRent} → 변경 ${newRentToStore})`;
			await mariaDBSequelize.query(
				`UPDATE roomContract SET monthlyRent = ? WHERE esntlId = ?`,
				{ replacements: [newRentToStore, contractEsntlId], type: mariaDBSequelize.QueryTypes.UPDATE, transaction: txn }
			);
			// 월 입실료 조정 내역은 history에만 상세히 기록
			try {
				await historyController.createHistoryRecord(
					{
						gosiwonEsntlId: contractInfo.gosiwonEsntlId,
						roomEsntlId: targetRoomEsntlId,
						contractEsntlId: contractEsntlId,
						content: `방이동 월입실료 조정: ${adjustmentMemo}`,
						category: 'CONTRACT',
						priority: 'NORMAL',
						publicRange: 0,
						writerAdminId,
						writerName,
						writerType: 'ADMIN',
					},
					txn
				);
			} catch (historyErr) {
				console.error('방이동 월입실료 조정 history 생성 실패 (스케줄러):', historyErr);
			}
		}

		if (contractInfo.roomStatusSubStatus === 'ROOM_MOVE_IN') {
			await mariaDBSequelize.query(`UPDATE roomStatus SET status = 'ROOM_MOVE', subStatus = 'ROOM_MOVE_IN', statusEndDate = ?, updatedAt = NOW() WHERE esntlId = ?`, { replacements: [moveDateMinusOneStr, contractInfo.roomStatusEsntlId], type: mariaDBSequelize.QueryTypes.UPDATE, transaction: txn });
			const roomMoveOutStatusId = await idsNext('roomStatus', undefined, txn);
			await mariaDBSequelize.query(
				`INSERT INTO roomStatus (esntlId, roomEsntlId, gosiwonEsntlId, status, subStatus, customerEsntlId, customerName, reservationEsntlId, reservationName, contractorEsntlId, contractorName, contractEsntlId, statusStartDate, statusEndDate, etcStartDate, etcEndDate, statusMemo, createdAt, updatedAt) VALUES (?, ?, ?, 'ROOM_MOVE', 'ROOM_MOVE_OUT', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
				{ replacements: [roomMoveOutStatusId, originalRoomEsntlId, contractInfo.gosiwonEsntlId, contractInfo.roomStatusCustomerEsntlId, contractInfo.roomStatusCustomerName, contractInfo.roomStatusReservationEsntlId, contractInfo.roomStatusReservationName, contractInfo.roomStatusContractorEsntlId, contractInfo.roomStatusContractorName, contractEsntlId, moveDateMinusOneStr, moveDateMinusOneStr, contractInfo.etcStartDate, contractInfo.etcEndDate, contractInfo.statusMemo], type: mariaDBSequelize.QueryTypes.INSERT, transaction: txn }
			);
		} else {
			await mariaDBSequelize.query(`UPDATE roomStatus SET status = 'ROOM_MOVE', subStatus = 'ROOM_MOVE_OUT', statusEndDate = ?, updatedAt = NOW() WHERE esntlId = ?`, { replacements: [moveDateMinusOneStr, contractInfo.roomStatusEsntlId], type: mariaDBSequelize.QueryTypes.UPDATE, transaction: txn });
		}

		await closeOpenStatusesForRoom(targetRoomEsntlId, moveDateStr, txn);
		let newRoomStatusId = await idsNext('roomStatus', undefined, txn);
		const insertRow = () => mariaDBSequelize.query(
			`INSERT INTO roomStatus (esntlId, roomEsntlId, gosiwonEsntlId, status, subStatus, customerEsntlId, customerName, reservationEsntlId, reservationName, contractorEsntlId, contractorName, contractEsntlId, statusStartDate, statusEndDate, etcStartDate, etcEndDate, statusMemo, createdAt, updatedAt) VALUES (?, ?, ?, 'CONTRACT', 'ROOM_MOVE_IN', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
			{ replacements: [newRoomStatusId, targetRoomEsntlId, contractInfo.gosiwonEsntlId, contractInfo.roomStatusCustomerEsntlId, contractInfo.roomStatusCustomerName, contractInfo.roomStatusReservationEsntlId, contractInfo.roomStatusReservationName, contractInfo.roomStatusContractorEsntlId, contractInfo.roomStatusContractorName, contractEsntlId, moveDateStr, originalContractEndDate, contractInfo.etcStartDate, contractInfo.etcEndDate, contractInfo.statusMemo], type: mariaDBSequelize.QueryTypes.INSERT, transaction: txn }
		);
		try { await insertRow(); } catch (e) {
			if (e.name === 'SequelizeUniqueConstraintError' || e.parent?.errno === 1062) {
				newRoomStatusId = await idsNext('roomStatus', undefined, txn);
				await insertRow();
			} else throw e;
		}

		const [targetRoomOnSaleStatuses] = await mariaDBSequelize.query(
			`SELECT esntlId, statusEndDate, subStatus FROM roomStatus WHERE roomEsntlId = ? AND status = 'ON_SALE' AND (statusEndDate IS NULL OR statusEndDate > ? OR statusEndDate >= '9999-01-01')`,
			{ replacements: [targetRoomEsntlId, todayStr], type: mariaDBSequelize.QueryTypes.SELECT, transaction: txn }
		);
		const targetRoomOnSaleList = Array.isArray(targetRoomOnSaleStatuses) ? targetRoomOnSaleStatuses : [];

		await mariaDBSequelize.query(
			`UPDATE roomStatus SET statusEndDate = ?, subStatus = 'END', updatedAt = NOW() WHERE roomEsntlId = ? AND status = 'ON_SALE' AND (statusEndDate IS NULL OR statusEndDate > ? OR statusEndDate >= '9999-01-01')`,
			{ replacements: [moveDateStr, targetRoomEsntlId, todayStr], type: mariaDBSequelize.QueryTypes.UPDATE, transaction: txn }
		);

		await syncRoomFromRoomStatus(targetRoomEsntlId, 'CONTRACT', { startDate: moveDateStr, endDate: originalContractEndDate }, txn);
		await room.update({ startDate: null, endDate: null, status: 'EMPTY' }, { where: { esntlId: originalRoomEsntlId }, transaction: txn });

		const statusIdsInfo = {
			createdRoomStatusIds: [],
			originalRoomStatusId: contractInfo.roomStatusEsntlId,
			newRoomStatusId,
			contractEsntlId,
			originalContractStartDate: toYmd(contractInfo.startDate),
			targetRoomOnSaleStatuses: targetRoomOnSaleList,
			restoreOriginalRoomStatus: { status: 'CONTRACT', subStatus: contractInfo.roomStatusSubStatus ?? null, statusEndDate: originalContractEndDate },
		};
		let memoWithStatusIds = (row.memo || '').replace(/\s*\[STATUS_IDS:.*?\]\s*/, '') + ` [STATUS_IDS:${JSON.stringify(statusIdsInfo)}]`;

		const scheduledWriterName = writerAdminId === 'SYSTEM' ? '시스템' : null;
		try {
			await historyController.createHistoryRecord(
				{
					gosiwonEsntlId: contractInfo.gosiwonEsntlId,
					roomEsntlId: originalRoomEsntlId,
					contractEsntlId,
					content: `방이동: 이 방(${originalRoomNumber}) → ${targetRoomNumber}, 이동일 ${moveDateStr}, roomStatus ROOM_MOVE_OUT 처리`,
					category: 'CONTRACT',
					priority: 'NORMAL',
					publicRange: 0,
					writerAdminId,
					writerName: scheduledWriterName,
					writerType: 'ADMIN',
				},
				txn
			);
			await historyController.createHistoryRecord(
				{
					gosiwonEsntlId: contractInfo.gosiwonEsntlId,
					roomEsntlId: targetRoomEsntlId,
					contractEsntlId,
					content: `방이동: ${originalRoomNumber} → 이 방(${targetRoomNumber}), 이동일 ${moveDateStr}, roomStatus CONTRACT(ROOM_MOVE_IN) 등록`,
					category: 'CONTRACT',
					priority: 'NORMAL',
					publicRange: 0,
					writerAdminId,
					writerName: scheduledWriterName,
					writerType: 'ADMIN',
				},
				txn
			);
		} catch (historyErr) {
			console.error('[executeOneScheduledRoomMove] history 생성 실패:', historyErr);
		}

		let createdRoomStatusIds = await roomAfterUse({ gosiwonEsntlId: contractInfo.gosiwonEsntlId, roomEsntlId: originalRoomEsntlId, check_basic_sell: true, baseDate: row.moveDate }, txn);
		if (!createdRoomStatusIds || createdRoomStatusIds.length === 0) {
			await closeOpenStatusesForRoom(originalRoomEsntlId, moveDateStr, txn);
			const beforeSalesStatusId = await idsNext('roomStatus', undefined, txn);
			createdRoomStatusIds = [beforeSalesStatusId];
			await mariaDBSequelize.query(
				`INSERT INTO roomStatus (esntlId, roomEsntlId, gosiwonEsntlId, status, statusStartDate, statusEndDate, etcStartDate, etcEndDate, createdAt, updatedAt) VALUES (?, ?, ?, 'BEFORE_SALES', ?, '9999-12-31 23:59:59', ?, '9999-12-31 23:59:59', NOW(), NOW())`,
				{ replacements: [beforeSalesStatusId, originalRoomEsntlId, contractInfo.gosiwonEsntlId, moveDateStr, moveDateStr], type: mariaDBSequelize.QueryTypes.INSERT, transaction: txn }
			);
		}

		const updatedStatusIdsInfo = { ...statusIdsInfo, createdRoomStatusIds };
		const updatedMemo = memoWithStatusIds.replace(/\[STATUS_IDS:.*?\]/, `[STATUS_IDS:${JSON.stringify(updatedStatusIdsInfo)}]`);
		await mariaDBSequelize.query(
			`UPDATE roomMoveStatus SET status = 'COMPLETED', memo = ?, updatedAt = NOW() WHERE esntlId = ?`,
			{ replacements: [updatedMemo, row.esntlId], type: mariaDBSequelize.QueryTypes.UPDATE, transaction: txn }
		);

		if (ownTransaction) await txn.commit();
	} catch (err) {
		if (ownTransaction && txn) {
			try {
				await txn.rollback();
			} catch (_rollbackErr) {
				// 이미 완료된 트랜잭션에서 rollback 호출 시 무시
			}
		}
		throw err;
	}
}

exports.executeOneScheduledRoomMove = executeOneScheduledRoomMove;

/**
 * 당일 PENDING 방이동 일괄 실행 API (GET /v1/room/daily/roomMove 수동 실행용)
 * query.date: 선택. 실행할 이동일 (YYYY-MM-DD). 없으면 당일.
 */
exports.runDailyRoomMoveAPI = async (req, res, next) => {
	try {
		let dateStr = req.query.date;
		if (dateStr != null && typeof dateStr === 'string') {
			dateStr = dateStr.trim();
			if (dateStr && !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
				errorHandler.errorThrow(400, 'date는 YYYY-MM-DD 형식이어야 합니다.');
			}
		}
		const result = await exports.runDailyRoomMove(dateStr || null);
		res.status(200).json({
			success: true,
			message: '방이동 실행 완료',
			data: result,
		});
	} catch (err) {
		next(err);
	}
};

/**
 * 어제 이동 예정이었던 PENDING 방이동 중, extraPayment(방이동)가 COMPLETED가 아닌 건을 조회하여
 * DELETE /v1/roomMove/:roomMoveStatusId 와 동일하게 방이동 취소(원상복구) 처리
 * @returns {Promise<{ cancelled: number, errors: Array<{ roomMoveStatusId: string, message: string }> }>}
 */
exports.runCancelUnpaidYesterdayRoomMoves = async function runCancelUnpaidYesterdayRoomMoves() {
	const yesterday = new Date();
	yesterday.setDate(yesterday.getDate() - 1);
	const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
	const writerId = process.env.DAILY_ROOMMOVE_REGISTRANT || 'SYSTEM';
	const writerName = 'SYSTEM';
	const result = { cancelled: 0, errors: [] };

	const rows = await mariaDBSequelize.query(
		`
		SELECT DISTINCT RMS.esntlId
		FROM roomMoveStatus RMS
		INNER JOIN extraPayment EP ON EP.contractEsntlId = RMS.contractEsntlId
			AND EP.roomEsntlId = RMS.originalRoomEsntlId
			AND EP.extraCostName = '방이동'
			AND (EP.paymentStatus IS NULL OR EP.paymentStatus != 'COMPLETED')
			AND (EP.deleteYN IS NULL OR EP.deleteYN = 'N')
		WHERE DATE(RMS.moveDate) = ?
			AND RMS.status = 'PENDING'
			AND (RMS.deleteYN IS NULL OR RMS.deleteYN = 'N')
		ORDER BY RMS.esntlId
		`,
		{ replacements: [yesterdayStr], type: mariaDBSequelize.QueryTypes.SELECT }
	);
	const list = Array.isArray(rows) ? rows : [];

	for (const row of list) {
		try {
			await cancelRoomMoveInternal(row.esntlId, writerId, writerName);
			result.cancelled += 1;
		} catch (err) {
			result.errors.push({ roomMoveStatusId: row.esntlId, message: err.message || String(err) });
		}
	}
	return result;
};

/**
 * PENDING 방이동 일괄 실행 (스케줄러·수동 API용)
 * @param {string|null} [dateStr] - 실행할 이동일 (YYYY-MM-DD). 없으면 당일.
 * @returns {Promise<{ total: number, processed: number, failed: number, errors: Array<{ roomMoveStatusId: string, message: string }>, targetDate: string }>}
 */
exports.runDailyRoomMove = async function runDailyRoomMove(dateStr) {
	const today = new Date();
	const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
	const targetDateStr = dateStr && /^\d{4}-\d{2}-\d{2}$/.test(String(dateStr).trim()) ? String(dateStr).trim() : todayStr;
	const result = { total: 0, processed: 0, failed: 0, errors: [], targetDate: targetDateStr };

	// QueryTypes.SELECT는 행 배열을 반환하므로 destructuring 하지 않음 (const [rows] 시 첫 행만 들어가 list가 빈 배열이 됨)
	const rows = await mariaDBSequelize.query(
		`SELECT esntlId, gosiwonEsntlId, contractEsntlId, customerEsntlId, originalRoomEsntlId, targetRoomEsntlId, reason, status, moveDate, adjustmentAmount, adjustmentType, adjustmentStatus, memo
		 FROM roomMoveStatus WHERE DATE(moveDate) = ? AND status = 'PENDING' AND (deleteYN IS NULL OR deleteYN = 'N') ORDER BY esntlId`,
		{ replacements: [targetDateStr], type: mariaDBSequelize.QueryTypes.SELECT }
	);
	const list = Array.isArray(rows) ? rows : [];
	result.total = list.length;

	for (const row of list) {
		try {
			// 방이동 실행 전: extraPayment에서 해당 방·계약 기준 extraCostName='방이동'이고 paymentStatus='PENDING'인 건 확인
			const pendingExtraPayments = await mariaDBSequelize.query(
				`SELECT esntlId FROM extraPayment
				 WHERE contractEsntlId = ? AND roomEsntlId = ? AND extraCostName = '방이동'
				   AND paymentStatus = 'PENDING' AND deleteYN = 'N'`,
				{ replacements: [row.contractEsntlId, row.originalRoomEsntlId], type: mariaDBSequelize.QueryTypes.SELECT }
			);

			if (pendingExtraPayments && pendingExtraPayments.length > 0) {
				// 방이동 추가비용이 PENDING(미결제) 상태이므로 방이동 취소 처리
				console.log(`[DailyRoomMove] 방이동 취소: roomMoveStatusId=${row.esntlId}, 미결제 방이동 추가비용 ${pendingExtraPayments.length}건 존재`);
				await cancelRoomMoveInternal(row.esntlId, process.env.DAILY_ROOMMOVE_REGISTRANT || 'SYSTEM', 'SYSTEM');
				result.failed += 1;
				result.errors.push({ roomMoveStatusId: row.esntlId, message: '방이동 추가비용이 미결제(PENDING) 상태이므로 방이동 취소 처리됨' });
				continue;
			}

			// targetDateStr(이동예정일)을 기준일로 넘겨서, 오늘이 아니라 해당일 기준으로 처리되도록 함
			await executeOneScheduledRoomMove(row, process.env.DAILY_ROOMMOVE_REGISTRANT || 'SYSTEM', null, targetDateStr);
			result.processed += 1;
		} catch (err) {
			result.failed += 1;
			result.errors.push({ roomMoveStatusId: row.esntlId, message: err.message || String(err) });
		}
	}
	return result;
};

