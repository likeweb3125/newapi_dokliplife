const { mariaDBSequelize, room } = require('../models');
const errorHandler = require('../middleware/error');
const { getWriterAdminId } = require('../utils/auth');
const { roomAfterUse } = require('./refund');

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

		// 1. 원래 방의 roomStatus subStatus를 ROOM_MOVE_OUT으로 변경
		await mariaDBSequelize.query(
			`
			UPDATE roomStatus 
			SET subStatus = 'ROOM_MOVE_OUT',
				updatedAt = NOW()
			WHERE esntlId = ?
		`,
			{
				replacements: [contractInfo.roomStatusEsntlId],
				type: mariaDBSequelize.QueryTypes.UPDATE,
				transaction,
			}
		);

		// 2. 새로운 roomStatus 레코드 생성 (이동할 방용)
		const newRoomStatusId = await generateRoomStatusId(transaction);
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
					contractEsntlId,
					contractInfo.statusStartDate,
					contractInfo.statusEndDate,
					contractInfo.etcStartDate,
					contractInfo.etcEndDate,
					contractInfo.statusMemo,
				],
				type: mariaDBSequelize.QueryTypes.INSERT,
				transaction,
			}
		);

		// 3. roomMoveStatus에 저장
		const roomMoveStatusId = await generateRoomMoveStatusId(transaction);
		// memo에 contactedOwner 정보 포함
		const memoWithContact = memo 
			? `${memo}${contactedOwner ? ` [원장님연락: ${contactedOwner === 'Y' ? '연락됨' : '연락안됨'}]` : ''}`
			: contactedOwner ? `[원장님연락: ${contactedOwner === 'Y' ? '연락됨' : '연락안됨'}]` : null;
		
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
				memo,
				deleteYN,
				createdAt,
				updatedAt
			) VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, 'N', NOW(), NOW())
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
					new Date(moveDate),
					finalAdjustmentAmount,
					finalAdjustmentType,
					memoWithContact,
				],
				type: mariaDBSequelize.QueryTypes.INSERT,
				transaction,
			}
		);

		// 4. roomAfterUse 함수 호출 (원래 방에 대해)
		if (
			check_basic_sell !== undefined ||
			unableCheckInReason ||
			check_room_only_config !== undefined ||
			sell_able_start_date ||
			can_checkin_start_date
		) {
			await roomAfterUse(
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
				},
				transaction
			);
		}

		await transaction.commit();

		errorHandler.successThrow(res, '방이동 처리 성공', {
			roomMoveStatusId: roomMoveStatusId,
			originalRoomStatusId: contractInfo.roomStatusEsntlId,
			newRoomStatusId: newRoomStatusId,
		});
	} catch (err) {
		await transaction.rollback();
		next(err);
	}
};

