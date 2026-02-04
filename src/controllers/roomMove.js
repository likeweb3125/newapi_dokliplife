const { mariaDBSequelize, room, history } = require('../models');
const errorHandler = require('../middleware/error');
const { getWriterAdminId } = require('../utils/auth');
const { roomAfterUse } = require('./refund');
const { next: idsNext } = require('../utils/idsNext');

const ROOMMOVE_PREFIX = 'RMV';
const ROOMMOVE_PADDING = 10;
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

// 방이동 처리
exports.processRoomMove = async (req, res, next) => {
	const transaction = await mariaDBSequelize.transaction();
	try {
		const decodedToken = verifyAdminToken(req);
		const writerAdminId = getWriterAdminId(decodedToken);

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

		// adjustmentAmount와 adjustmentType 유효성 검증
		const finalAdjustmentAmount = adjustmentAmount || 0;
		if (finalAdjustmentAmount < 0) {
			errorHandler.errorThrow(400, 'adjustmentAmount는 0 이상의 값만 허용됩니다.');
		}
		
		// adjustmentType 유효성 검증
		if (adjustmentType) {
			const validAdjustmentTypes = ['ADDITION', 'REFUND'];
			if (!validAdjustmentTypes.includes(adjustmentType)) {
				errorHandler.errorThrow(
					400,
					`adjustmentType은 ${validAdjustmentTypes.join(', ')} 중 하나여야 합니다.`
				);
			}
		}
		
		// adjustmentAmount가 0이 아니면 adjustmentType 필수
		if (finalAdjustmentAmount > 0 && !adjustmentType) {
			errorHandler.errorThrow(400, 'adjustmentAmount가 0보다 크면 adjustmentType은 필수입니다.');
		}
		
		// adjustmentAmount가 0이면 adjustmentType은 NULL
		const finalAdjustmentType = finalAdjustmentAmount > 0 ? adjustmentType : null;

		// 계약 정보 및 원래 방 상태 조회 (기존 계약 종료일은 RC.endDate → originalEndDate로 명시, RS 컬럼에 의해 덮어쓰임 방지)
		const [contractInfo] = await mariaDBSequelize.query(
			`
			SELECT 
				RC.esntlId, RC.roomEsntlId, RC.gosiwonEsntlId, RC.customerEsntlId,
				RC.startDate, RC.endDate AS originalEndDate, RC.contractDate, RC.month, RC.status,
				RC.monthlyRent, RC.memo, RC.memo2, RC.checkInTime,
				RS.esntlId AS roomStatusEsntlId,
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

		// moveDate를 YYYY-MM-DD 형식으로 변환 (시간 부분 제거)
		const moveDateStr = moveDate ? (typeof moveDate === 'string' ? moveDate.split(' ')[0].split('T')[0] : moveDate) : null;
		
		if (!moveDateStr) {
			errorHandler.errorThrow(400, 'moveDate를 입력해주세요.');
		}
		
		// 오늘 날짜 (한국 시간) 가져오기
		const today = new Date();
		const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

		// 기존 계약 만료일: roomContract.endDate(RC)를 우선 사용. RC가 이동일과 같을 때만(이전 버그로 덮어쓴 경우) roomStatus.statusEndDate(RS) 사용.
		// RS는 DATETIME이라 타임존 변환 시 하루 빠져 나올 수 있으므로 RC가 정상이면 반드시 RC 사용.
		const toYmd = (v) => (v == null ? null : (typeof v === 'string' ? v.split(' ')[0].split('T')[0] : v.toISOString?.().slice(0, 10) || String(v).slice(0, 10)));
		const rcEnd = toYmd(contractInfo.originalEndDate ?? contractInfo.endDate);
		const rsEnd = toYmd(contractInfo.statusEndDate);
		const originalContractEndDate = (rcEnd && rcEnd !== moveDateStr) ? rcEnd : (rsEnd && rsEnd > moveDateStr ? rsEnd : (rcEnd || rsEnd));
		if (!originalContractEndDate) {
			errorHandler.errorThrow(400, '기존 계약의 종료일(endDate)을 찾을 수 없습니다.');
		}

		// [roomMove 디버그] 사용할 날짜 값
		console.log('[roomMove] 날짜 값:', {
			moveDateStr,
			'RC.endDate(originalEndDate)': rcEnd,
			'RS.statusEndDate': rsEnd,
			originalContractEndDate,
			같은지: moveDateStr === originalContractEndDate,
		});

		// 1. 기존 계약서 중지: endDate를 이동날짜로 변경, memo2에 타겟방 기록, status 'ENDED'
		const originalMemo2Append = `방이동: → ${targetRoomNumber}로`;
		await mariaDBSequelize.query(
			`
			UPDATE roomContract 
			SET status = 'ENDED',
				endDate = ?,
				memo2 = TRIM(CONCAT(IFNULL(memo2, ''), IF(IFNULL(TRIM(memo2), '') = '', '', ' '), ?))
			WHERE esntlId = ?
		`,
			{
				replacements: [moveDateStr, originalMemo2Append, contractEsntlId],
				type: mariaDBSequelize.QueryTypes.UPDATE,
				transaction,
			}
		);

		// 2. 원래 방의 roomStatus subStatus를 ROOM_MOVE_OUT으로 변경하고 statusEndDate를 moveDate로 변경
		await mariaDBSequelize.query(
			`
			UPDATE roomStatus 
			SET subStatus = 'ROOM_MOVE_OUT',
				statusEndDate = ?,
				updatedAt = NOW()
			WHERE esntlId = ?
		`,
			{
				replacements: [moveDateStr, contractInfo.roomStatusEsntlId],
				type: mariaDBSequelize.QueryTypes.UPDATE,
				transaction,
			}
		);

		// 3. 새로운 계약서 생성 (IDS 테이블 roomContract RCTT)
		const newContractEsntlId = await idsNext('roomContract', 'RCTT', transaction);
		const contractDate = new Date();
		const contractDateStr = `${contractDate.getFullYear()}-${String(contractDate.getMonth() + 1).padStart(2, '0')}-${String(contractDate.getDate()).padStart(2, '0')}`;
		
		// 기존 계약서 필드 복사하여 새 계약서 생성. endDate는 기존 계약 끝나는 날(originalContractEndDate). status=USED.
		const insertReplacements = [
			newContractEsntlId,
			targetRoomEsntlId,
			moveDateStr, // startDate: 이동일
			originalContractEndDate, // endDate: 기존 계약 끝나는 날
			contractDateStr, // contractDate: 오늘 날짜
			contractEsntlId, // 기존 계약서 ID
		];
		console.log('[roomMove] roomContract INSERT 사용 값:', {
			newContractEsntlId,
			startDate: insertReplacements[2],
			endDate: insertReplacements[3],
			contractDate: insertReplacements[4],
		});
		await mariaDBSequelize.query(
			`
			INSERT INTO roomContract (
				esntlId, roomEsntlId, gosiwonEsntlId, customerEsntlId,
				startDate, endDate, contractDate, month, status,
				monthlyRent, memo, memo2,
				checkInTime
			)
			SELECT 
				?, ?, gosiwonEsntlId, customerEsntlId,
				?, ?, ?, month, 'USED',
				monthlyRent, memo, memo2,
				checkInTime
			FROM roomContract
			WHERE esntlId = ?
		`,
			{
				replacements: insertReplacements,
				type: mariaDBSequelize.QueryTypes.INSERT,
				transaction,
			}
		);

		// [roomMove 디버그] 방금 INSERT한 새 계약서의 DB 저장값 확인
		const [insertedContract] = await mariaDBSequelize.query(
			`SELECT esntlId, startDate, endDate, contractDate, status FROM roomContract WHERE esntlId = ?`,
			{ replacements: [newContractEsntlId], type: mariaDBSequelize.QueryTypes.SELECT, transaction }
		);
		console.log('[roomMove] roomContract INSERT 직후 DB 조회:', insertedContract || '없음');

		// 새 계약서 memo2에 원래 방에서 이 타겟방으로 왔다는 기록
		const newContractMemo2Append = `방이동: ← ${originalRoomNumber}에서`;
		await mariaDBSequelize.query(
			`
			UPDATE roomContract
			SET memo2 = TRIM(CONCAT(IFNULL(memo2, ''), IF(IFNULL(TRIM(memo2), '') = '', '', ' '), ?))
			WHERE esntlId = ?
		`,
			{
				replacements: [newContractMemo2Append, newContractEsntlId],
				type: mariaDBSequelize.QueryTypes.UPDATE,
				transaction,
			}
		);

		// roomContractWho 복사 (기존 계약 → 새 계약)
		await mariaDBSequelize.query(
			`
			INSERT INTO roomContractWho (contractEsntlId, checkinName, checkinPhone, checkinGender, checkinAge, customerName, customerPhone, customerGender, customerAge, emergencyContact, createdAt, updatedAt)
			SELECT ?, RCW.checkinName, RCW.checkinPhone, RCW.checkinGender, RCW.checkinAge, RCW.customerName, RCW.customerPhone, RCW.customerGender, RCW.customerAge, RCW.emergencyContact, NOW(), NOW()
			FROM roomContract RC
			LEFT JOIN roomContractWho RCW ON RC.esntlId = RCW.contractEsntlId
			WHERE RC.esntlId = ?
			LIMIT 1
			`,
			{
				replacements: [newContractEsntlId, contractEsntlId],
				type: mariaDBSequelize.QueryTypes.INSERT,
				transaction,
			}
		);

		// 4. 새로운 roomStatus 레코드 생성 (이동할 방용, 새로운 계약서 연결)
		// statusStartDate는 moveDate, statusEndDate는 새 계약서의 endDate로 설정
		const newRoomStatusId = await idsNext('roomStatus', undefined, transaction);
		await mariaDBSequelize.query(
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
					newContractEsntlId, // 새로운 계약서 ID
					moveDateStr, // statusStartDate: moveDate
					originalContractEndDate, // statusEndDate: 기존 계약 끝나는 날
					contractInfo.etcStartDate,
					contractInfo.etcEndDate,
					contractInfo.statusMemo,
				],
				type: mariaDBSequelize.QueryTypes.INSERT,
				transaction,
			}
		);

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

		// room 테이블: 타겟방 먼저 넣어야 계약날짜가 제대로 들어감 (docs/room_move_logic.md)
		const isMoveToday = moveDateStr === todayStr;
		// 타겟방: startDate=이동일, endDate=기존 계약 끝나는 날, status=CONTRACT
		console.log('[roomMove] room.update 타겟방:', {
			targetRoomEsntlId,
			startDate: moveDateStr,
			endDate: originalContractEndDate,
		});
		await room.update(
			{
				startDate: moveDateStr,
				endDate: originalContractEndDate,
				status: 'CONTRACT',
			},
			{ where: { esntlId: targetRoomEsntlId }, transaction }
		);
		// [roomMove 디버그] room.update 직후 타겟방 DB 저장값 확인
		const [updatedRoom] = await mariaDBSequelize.query(
			`SELECT esntlId, startDate, endDate, status FROM room WHERE esntlId = ?`,
			{ replacements: [targetRoomEsntlId], type: mariaDBSequelize.QueryTypes.SELECT, transaction }
		);
		console.log('[roomMove] room.update 타겟방 직후 DB 조회:', updatedRoom || '없음');

		// 기존 방: startDate, endDate null, status=roomAfterUse에 맞게 (오늘 이동: EMPTY, 미래 이동: LEAVE)
		await room.update(
			{
				startDate: null,
				endDate: null,
				status: isMoveToday ? 'EMPTY' : 'LEAVE',
			},
			{ where: { esntlId: originalRoomEsntlId }, transaction }
		);

		// 이동일이 오늘일 때만: extraPayment, parkStatus의 contractEsntlId를 기존 → 신규 계약서 id로 변경 (docs/room_move_logic.md, 스케줄러 제외)
		if (isMoveToday) {
			await mariaDBSequelize.query(
				`UPDATE extraPayment SET contractEsntlId = ? WHERE contractEsntlId = ?`,
				{
					replacements: [newContractEsntlId, contractEsntlId],
					type: mariaDBSequelize.QueryTypes.UPDATE,
					transaction,
				}
			);
			await mariaDBSequelize.query(
				`UPDATE parkStatus SET contractEsntlId = ? WHERE contractEsntlId = ? AND deleteYN = 'N'`,
				{
					replacements: [newContractEsntlId, contractEsntlId],
					type: mariaDBSequelize.QueryTypes.UPDATE,
					transaction,
				}
			);
		}

		// 3. roomMoveStatus에 저장
		const roomMoveStatusId = await generateRoomMoveStatusId(transaction);
		// memo에 contactedOwner 정보 포함
		const memoWithContact = memo 
			? `${memo}${contactedOwner ? ` [원장님연락: ${contactedOwner === 'Y' ? '연락됨' : '연락안됨'}]` : ''}`
			: contactedOwner ? `[원장님연락: ${contactedOwner === 'Y' ? '연락됨' : '연락안됨'}]` : null;
		
		// adjustmentStatus 설정: adjustmentAmount가 0이 아니면 PENDING, 0이면 NULL
		const finalAdjustmentStatus = finalAdjustmentAmount !== 0 ? 'PENDING' : null;
		
		// memo에 생성된 상태 ID 정보 추가 (JSON 형식)
		// 기존 memo가 있으면 유지하고, 생성된 상태 ID 정보를 JSON으로 추가
		const statusIdsInfo = {
			createdRoomStatusIds: [], // roomAfterUse로 생성될 상태 ID들 (아직 생성 전이므로 빈 배열)
			originalRoomStatusId: contractInfo.roomStatusEsntlId,
			newRoomStatusId: newRoomStatusId,
			originalContractEsntlId: contractEsntlId, // 기존 계약서 ID
			newContractEsntlId: newContractEsntlId, // 새로운 계약서 ID
			targetRoomOnSaleStatuses: targetRoomOnSaleStatuses || [], // 타겟 방의 원래 ON_SALE 상태 정보
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
					newContractEsntlId, // 새로운 계약서 ID로 변경
					contractInfo.roomStatusCustomerEsntlId,
					originalRoomEsntlId,
					targetRoomEsntlId,
					reason,
					roomMoveStatusValue,
					new Date(moveDate),
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
			const historyContentOriginal = `이 방에서 ${targetRoomNumber}로 방이동`;
			const historyContentTarget = `${originalRoomNumber}에서 이 방으로 방이동`;

			// ID를 나눠서 생성 (한 번에 두 개 부르면 같은 ID가 나와 두 번째 create에서 PK 중복 발생)
			const historyIdOut = await generateHistoryId(transaction);
			await history.create(
				{
					esntlId: historyIdOut,
					gosiwonEsntlId: contractInfo.gosiwonEsntlId,
					roomEsntlId: originalRoomEsntlId,
					contractEsntlId: contractEsntlId,
					content: historyContentOriginal,
					category: 'CONTRACT',
					priority: 'NORMAL',
					publicRange: 0,
					writerAdminId: writerAdminId,
					writerType: 'ADMIN',
					deleteYN: 'N',
				},
				{ transaction }
			);

			const historyIdIn = await generateHistoryId(transaction);
			await history.create(
				{
					esntlId: historyIdIn,
					gosiwonEsntlId: contractInfo.gosiwonEsntlId,
					roomEsntlId: targetRoomEsntlId,
					contractEsntlId: newContractEsntlId,
					content: historyContentTarget,
					category: 'CONTRACT',
					priority: 'NORMAL',
					publicRange: 0,
					writerAdminId: writerAdminId,
					writerType: 'ADMIN',
					deleteYN: 'N',
				},
				{ transaction }
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

		// roomAfterUse로 생성된 상태 ID들을 roomMoveStatus의 memo에 업데이트
		// createdRoomStatusIds가 있거나 targetRoomOnSaleStatuses가 있으면 업데이트
		// (targetRoomOnSaleStatuses는 초기에 저장되지만, createdRoomStatusIds가 나중에 추가되므로 항상 업데이트)
		if (createdRoomStatusIds.length > 0 || (targetRoomOnSaleStatuses && targetRoomOnSaleStatuses.length > 0)) {
			// memo에서 기존 STATUS_IDS 정보를 찾아서 업데이트
			const updatedStatusIdsInfo = {
				createdRoomStatusIds: createdRoomStatusIds,
				originalRoomStatusId: contractInfo.roomStatusEsntlId,
				newRoomStatusId: newRoomStatusId,
				originalContractEsntlId: contractEsntlId,
				newContractEsntlId: newContractEsntlId,
				targetRoomOnSaleStatuses: targetRoomOnSaleStatuses || [],
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
			// createdRoomStatusIds는 없지만 targetRoomOnSaleStatuses가 있는 경우에도 업데이트
			const updatedStatusIdsInfo = {
				createdRoomStatusIds: [],
				originalRoomStatusId: contractInfo.roomStatusEsntlId,
				newRoomStatusId: newRoomStatusId,
				originalContractEsntlId: contractEsntlId,
				newContractEsntlId: newContractEsntlId,
				targetRoomOnSaleStatuses: targetRoomOnSaleStatuses,
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
			originalContractEsntlId: contractEsntlId,
			newContractEsntlId: newContractEsntlId,
		});
	} catch (err) {
		await transaction.rollback();
		next(err);
	}
};

// 방이동 삭제 및 원상복구
exports.deleteRoomMove = async (req, res, next) => {
	const transaction = await mariaDBSequelize.transaction();
	try {
		const decodedToken = verifyAdminToken(req);
		const writerAdminId = getWriterAdminId(decodedToken);

		const { roomMoveStatusId } = req.params;

		if (!roomMoveStatusId) {
			errorHandler.errorThrow(400, '방이동 상태 ID를 입력해주세요.');
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
			errorHandler.errorThrow(404, '방이동 상태를 찾을 수 없습니다.');
		}

		// adjustmentStatus가 COMPLETED인 경우 삭제 불가
		if (existingRoomMove.adjustmentStatus === 'COMPLETED') {
			errorHandler.errorThrow(
				400,
				'조정 처리가 완료된 방이동은 삭제할 수 없습니다.'
			);
		}

		// memo에서 계약서 ID 정보 추출
		let originalContractEsntlId = null;
		let newContractEsntlId = existingRoomMove.contractEsntlId; // 기본값은 현재 contractEsntlId
		
		if (existingRoomMove.memo) {
			const statusIdsMatch = existingRoomMove.memo.match(/\[STATUS_IDS:(.*?)\]/);
			if (statusIdsMatch) {
				try {
					const statusIdsInfo = JSON.parse(statusIdsMatch[1]);
					originalContractEsntlId = statusIdsInfo.originalContractEsntlId || null;
					newContractEsntlId = statusIdsInfo.newContractEsntlId || existingRoomMove.contractEsntlId;
				} catch (err) {
					console.error('Failed to parse STATUS_IDS from memo:', err);
				}
			}
		}

		// 기존 계약서 정보 조회 (복구용)
		const [originalContractInfo] = await mariaDBSequelize.query(
			`
			SELECT endDate, status
			FROM roomContract
			WHERE esntlId = ?
			LIMIT 1
		`,
			{
				replacements: [originalContractEsntlId || existingRoomMove.contractEsntlId],
				type: mariaDBSequelize.QueryTypes.SELECT,
				transaction,
			}
		);

		if (!originalContractInfo && originalContractEsntlId) {
			errorHandler.errorThrow(404, '기존 계약 정보를 찾을 수 없습니다.');
		}

		// 새 계약서 정보 조회 (삭제용)
		const [newContractInfo] = await mariaDBSequelize.query(
			`
			SELECT endDate
			FROM roomContract
			WHERE esntlId = ?
			LIMIT 1
		`,
			{
				replacements: [newContractEsntlId],
				type: mariaDBSequelize.QueryTypes.SELECT,
				transaction,
			}
		);

		if (!newContractInfo) {
			errorHandler.errorThrow(404, '새 계약 정보를 찾을 수 없습니다.');
		}

		// 1. 기존 계약서 복구 (endDate와 status 복구)
		if (originalContractEsntlId) {
			// 새 계약서의 endDate를 기존 계약서의 endDate로 복구 (원래 endDate)
			await mariaDBSequelize.query(
				`
				UPDATE roomContract 
				SET endDate = ?,
					status = 'ACTIVE'
				WHERE esntlId = ?
			`,
				{
					replacements: [newContractInfo.endDate, originalContractEsntlId],
					type: mariaDBSequelize.QueryTypes.UPDATE,
					transaction,
				}
			);
		}

		// 2. 원래 방의 roomStatus 복구 (ROOM_MOVE_OUT -> CONTRACT, statusEndDate 복구)
		await mariaDBSequelize.query(
			`
			UPDATE roomStatus 
			SET subStatus = NULL,
				statusEndDate = ?,
				contractEsntlId = ?,
				updatedAt = NOW()
			WHERE contractEsntlId = ?
				AND roomEsntlId = ?
				AND status = 'CONTRACT'
				AND subStatus = 'ROOM_MOVE_OUT'
		`,
			{
				replacements: [
					originalContractInfo?.endDate || newContractInfo.endDate,
					originalContractEsntlId || existingRoomMove.contractEsntlId,
					newContractEsntlId,
					existingRoomMove.originalRoomEsntlId,
				],
				type: mariaDBSequelize.QueryTypes.UPDATE,
				transaction,
			}
		);

		// 2-1. 이동 전 방(원래 방) room 테이블 상태값 CONTRACT로 복구
		await room.update(
			{ status: 'CONTRACT' },
			{ where: { esntlId: existingRoomMove.originalRoomEsntlId }, transaction }
		);

		// 3. 새로운 방의 roomStatus 삭제 (ROOM_MOVE_IN 상태)
		await mariaDBSequelize.query(
			`
			DELETE FROM roomStatus
			WHERE contractEsntlId = ?
				AND roomEsntlId = ?
				AND status = 'CONTRACT'
				AND subStatus = 'ROOM_MOVE_IN'
		`,
			{
				replacements: [
					newContractEsntlId,
					existingRoomMove.targetRoomEsntlId,
				],
				type: mariaDBSequelize.QueryTypes.DELETE,
				transaction,
			}
		);

		// 4. 새 계약서 삭제
		await mariaDBSequelize.query(
			`
			DELETE FROM roomContract
			WHERE esntlId = ?
		`,
			{
				replacements: [newContractEsntlId],
				type: mariaDBSequelize.QueryTypes.DELETE,
				transaction,
			}
		);

		// 4-1. 이동하려고 했던 방(타겟 방) room 테이블 상태값 EMPTY로 변경
		await room.update(
			{ status: 'EMPTY' },
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

		await transaction.commit();

		res.status(200).json({
			success: true,
			message: '방이동 상태가 삭제되고 원상복구되었습니다.',
		});
	} catch (error) {
		await transaction.rollback();
		next(error);
	}
};

