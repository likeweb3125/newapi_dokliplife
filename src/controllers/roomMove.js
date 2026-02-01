const { mariaDBSequelize, room } = require('../models');
const errorHandler = require('../middleware/error');
const { getWriterAdminId } = require('../utils/auth');
const { roomAfterUse } = require('./refund');
const { next: idsNext } = require('../utils/idsNext');

const ROOMMOVE_PREFIX = 'RMV';
const ROOMMOVE_PADDING = 10;

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

// 계약서 ID 생성 함수
const generateContractId = async (transaction) => {
	const [result] = await mariaDBSequelize.query(
		`SELECT CONCAT('RCTT', LPAD(COALESCE(MAX(CAST(SUBSTRING(esntlId, 5) AS UNSIGNED)), 0) + 1, 10, '0')) AS nextId FROM roomContract WHERE esntlId LIKE 'RCTT%'`,
		{ type: mariaDBSequelize.QueryTypes.SELECT, transaction }
	);
	return result?.nextId || 'RCTT0000000001';
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

		// 계약 정보 및 원래 방 상태 조회
		const [contractInfo] = await mariaDBSequelize.query(
			`
			SELECT 
				RC.*,
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
				AND RS.status = 'IN_USE'
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
				'계약 정보 또는 IN_USE 상태의 방 상태를 찾을 수 없습니다.'
			);
		}

		// 이동할 방 정보 확인
		const [targetRoom] = await mariaDBSequelize.query(
			`
			SELECT esntlId, gosiwonEsntlId
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

		// 1. 기존 계약서 중지 (endDate를 moveDate로 변경, status를 'ENDED'로 변경)
		await mariaDBSequelize.query(
			`
			UPDATE roomContract 
			SET endDate = ?,
				status = 'ENDED',
				updatedAt = NOW()
			WHERE esntlId = ?
		`,
			{
				replacements: [moveDateStr, contractEsntlId],
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

		// 3. 새로운 계약서 생성
		const newContractEsntlId = await generateContractId(transaction);
		const contractDate = new Date();
		const contractDateStr = `${contractDate.getFullYear()}-${String(contractDate.getMonth() + 1).padStart(2, '0')}-${String(contractDate.getDate()).padStart(2, '0')}`;
		
		// 기존 계약서의 모든 필드를 복사하여 새 계약서 생성 (roomEsntlId와 날짜만 변경)
		await mariaDBSequelize.query(
			`
			INSERT INTO roomContract (
				esntlId, roomEsntlId, gosiwonEsntlId, customerEsntlId,
				startDate, endDate, contractDate, month, status,
				customerName, customerPhone, customerGender, customerAge,
				checkinName, checkinPhone, checkinGender, checkinAge,
				monthlyRent, memo, memo2, emergencyContact,
				checkInTime, contractorEsntlId
			)
			SELECT 
				?, ?, gosiwonEsntlId, customerEsntlId,
				?, endDate, ?, month, 'ACTIVE',
				customerName, customerPhone, customerGender, customerAge,
				checkinName, checkinPhone, checkinGender, checkinAge,
				monthlyRent, memo, memo2, emergencyContact,
				checkInTime, contractorEsntlId
			FROM roomContract
			WHERE esntlId = ?
		`,
			{
				replacements: [
					newContractEsntlId,
					targetRoomEsntlId,
					moveDateStr, // startDate: moveDate
					contractDateStr, // contractDate: 오늘 날짜
					contractEsntlId, // 기존 계약서 ID
				],
				type: mariaDBSequelize.QueryTypes.INSERT,
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
			) VALUES (?, ?, ?, 'IN_USE', 'ROOM_MOVE_IN', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
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
					contractInfo.endDate, // statusEndDate: 기존 계약서의 endDate (새 계약서도 동일)
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
					newContractEsntlId, // 새로운 계약서 ID로 변경
					contractInfo.roomStatusCustomerEsntlId,
					originalRoomEsntlId,
					targetRoomEsntlId,
					reason,
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

		// 4. roomAfterUse 함수 호출 (원래 방에 대해)
		let createdRoomStatusIds = []; // roomAfterUse로 생성된 상태 ID들
		if (
			check_basic_sell !== undefined ||
			unableCheckInReason ||
			check_room_only_config !== undefined ||
			sell_able_start_date ||
			can_checkin_start_date
		) {
			createdRoomStatusIds = await roomAfterUse(
				{
					gosiwonEsntlId: contractInfo.gosiwonEsntlId,
					roomEsntlId: originalRoomEsntlId,
					check_basic_sell,
					unableCheckInReason,
					check_room_only_config,
					sell_able_start_date,
					sell_able_end_date,
					can_checkin_start_date,
					can_checkin_end_date,
					baseDate: moveDate, // 방이동의 경우 moveDate를 기준 날짜로 사용
				},
				transaction
			);
		}

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
					status = 'ACTIVE',
					updatedAt = NOW()
				WHERE esntlId = ?
			`,
				{
					replacements: [newContractInfo.endDate, originalContractEsntlId],
					type: mariaDBSequelize.QueryTypes.UPDATE,
					transaction,
				}
			);
		}

		// 2. 원래 방의 roomStatus 복구 (ROOM_MOVE_OUT -> IN_USE, statusEndDate 복구)
		await mariaDBSequelize.query(
			`
			UPDATE roomStatus 
			SET subStatus = NULL,
				statusEndDate = ?,
				contractEsntlId = ?,
				updatedAt = NOW()
			WHERE contractEsntlId = ?
				AND roomEsntlId = ?
				AND status = 'IN_USE'
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

		// 3. 새로운 방의 roomStatus 삭제 (ROOM_MOVE_IN 상태)
		await mariaDBSequelize.query(
			`
			DELETE FROM roomStatus
			WHERE contractEsntlId = ?
				AND roomEsntlId = ?
				AND status = 'IN_USE'
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

