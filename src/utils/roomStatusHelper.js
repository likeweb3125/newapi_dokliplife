const { mariaDBSequelize } = require('../models');

/**
 * roomStatus.status → room.status 매핑.
 * roomStatus 입력/수정 시 room 테이블 상태를 이 값으로 동기화한다.
 * CONTRACT, RESERVE 외에는 room.startDate/endDate를 null로 둔다.
 *
 * [유지보수] 매핑/페어 변경 시: 1) 이 객체만 수정. 2) roomStatus를 INSERT/UPDATE하는 모든 곳에서
 * syncRoomFromRoomStatus(roomEsntlId, roomStatusStatus, { startDate?, endDate? }, transaction) 호출 여부 확인.
 */
const ROOM_STATUS_TO_ROOM_STATUS = {
	CONTRACT: 'CONTRACT',
	OVERDUE: 'CONTRACT',
	CHECKOUT_REQUESTED: 'CONTRACT',
	ROOM_MOVE: 'CONTRACT',
	RESERVE_PENDING: 'RESERVE',
	RESERVED: 'RESERVE',
	ON_SALE: 'OPEN',
	CAN_CHECKIN: 'OPEN',
	VBANK_PENDING: 'VBANK',
	CHECKOUT_ONSALE: 'LEAVE',
	END_DEPOSIT: 'EMPTY',
	END: 'EMPTY',
	ETC: 'EMPTY',
	BEFORE_SALES: 'EMPTY',
	CHECKOUT_CONFIRMED: 'EMPTY',
	PENDING: 'EMPTY',
};

/**
 * roomStatus.status에 대응하는 room.status 반환.
 * @param {string} roomStatusStatus - roomStatus.status 값
 * @returns {string} room.status 값 (매핑 없으면 'EMPTY')
 */
function getRoomStatusFromRoomStatus(roomStatusStatus) {
	if (!roomStatusStatus) return 'EMPTY';
	return ROOM_STATUS_TO_ROOM_STATUS[roomStatusStatus] ?? 'EMPTY';
}

/**
 * roomStatus 입력/수정에 따라 room 테이블 상태를 동기화한다.
 * CONTRACT, RESERVE인 경우에만 options.startDate/endDate를 반영하고, 그 외에는 startDate/endDate를 null로 둔다.
 *
 * @param {string} roomEsntlId - 방 고유 아이디
 * @param {string} roomStatusStatus - roomStatus.status 값 (방금 입력/수정된 값)
 * @param {{ startDate?: string | null; endDate?: string | null }} [options] - CONTRACT/RESERVE일 때 room.startDate, room.endDate (YYYY-MM-DD 등)
 * @param {object} [transaction] - Sequelize 트랜잭션 (선택)
 * @returns {Promise<void>}
 */
async function syncRoomFromRoomStatus(roomEsntlId, roomStatusStatus, options = {}, transaction = null) {
	if (!roomEsntlId || !roomStatusStatus) return;
	// CAN_CHECKIN 입력/수정 시에는 room 테이블 동기화하지 않음 (판매 기간 등만 반영, room.status는 유지)
	if (roomStatusStatus === 'CAN_CHECKIN') return;
	const roomStatus = getRoomStatusFromRoomStatus(roomStatusStatus);
	const keepDates = roomStatus === 'CONTRACT' || roomStatus === 'RESERVE';
	const startDate = options.startDate != null ? options.startDate : null;
	const endDate = options.endDate != null ? options.endDate : null;
	const setDates = keepDates && startDate != null && endDate != null;

	// room 테이블에는 updatedAt 컬럼이 없으므로 SET에서 제외
	if (setDates) {
		await mariaDBSequelize.query(
			`UPDATE room SET status = ?, startDate = ?, endDate = ? WHERE esntlId = ?`,
			{
				replacements: [roomStatus, startDate, endDate, roomEsntlId],
				type: mariaDBSequelize.QueryTypes.UPDATE,
				transaction,
			}
		);
	} else if (keepDates) {
		await mariaDBSequelize.query(
			`UPDATE room SET status = ? WHERE esntlId = ?`,
			{
				replacements: [roomStatus, roomEsntlId],
				type: mariaDBSequelize.QueryTypes.UPDATE,
				transaction,
			}
		);
	} else {
		await mariaDBSequelize.query(
			`UPDATE room SET status = ?, startDate = NULL, endDate = NULL WHERE esntlId = ?`,
			{
				replacements: [roomStatus, roomEsntlId],
				type: mariaDBSequelize.QueryTypes.UPDATE,
				transaction,
			}
		);
	}
}

/**
 * 해당 방에 아직 종료기간이 남아있는 roomStatus가 있으면,
 * statusEndDate를 (신규 상태 시작일 - 1일)로 업데이트하여 기간을 종료 처리한다.
 * 단, (신규 시작일 - 1일)이 해당 roomStatus의 statusStartDate보다 이전이면 -1일을 적용하지 않고 statusStartDate를 종료일로 둔다.
 * roomStatus INSERT 직전에 호출한다.
 *
 * @param {string} roomEsntlId - 방 고유 아이디
 * @param {string} newStatusStartDate - 신규 상태의 시작일(시) (YYYY-MM-DD 또는 YYYY-MM-DD HH:mm:ss)
 * @param {object} [transaction] - Sequelize 트랜잭션 (선택, INSERT와 동일 트랜잭션 권장)
 * @returns {Promise<void>}
 */
function toDateStr(val) {
	if (val instanceof Date) {
		return `${val.getFullYear()}-${String(val.getMonth() + 1).padStart(2, '0')}-${String(val.getDate()).padStart(2, '0')} 00:00:00`;
	}
	const s = String(val).trim();
	return s.length === 10 ? `${s} 00:00:00` : s;
}

/** 날짜 문자열에서 n일을 뺀 날짜 문자열 반환 (로컬 기준, YYYY-MM-DD 00:00:00) */
function addDaysToDateStr(dateStr, days) {
	const normalized = dateStr.replace(' ', 'T');
	const d = new Date(normalized);
	d.setDate(d.getDate() + days);
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day} 00:00:00`;
}

async function closeOpenStatusesForRoom(roomEsntlId, newStatusStartDate, transaction = null) {
	if (!roomEsntlId || newStatusStartDate == null) return;
	// 종료일 = 신규 상태 시작일 - 1일. 단 행의 statusStartDate보다 이전이면 statusStartDate 사용 (GREATEST)
	const endDtm = addDaysToDateStr(toDateStr(newStatusStartDate), -1);

	await mariaDBSequelize.query(
		`UPDATE roomStatus 
		 SET statusEndDate = GREATEST(?, COALESCE(statusStartDate, ?)), updatedAt = NOW() 
		 WHERE roomEsntlId = ? 
		   AND (statusEndDate IS NULL OR statusEndDate > ?)`,
		{
			replacements: [endDtm, endDtm, roomEsntlId, endDtm],
			type: mariaDBSequelize.QueryTypes.UPDATE,
			transaction,
		}
	);
}

module.exports = {
	closeOpenStatusesForRoom,
	ROOM_STATUS_TO_ROOM_STATUS,
	getRoomStatusFromRoomStatus,
	syncRoomFromRoomStatus,
};
