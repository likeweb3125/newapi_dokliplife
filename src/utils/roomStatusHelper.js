const { mariaDBSequelize } = require('../models');

/**
 * 해당 방에 아직 종료기간이 남아있는 roomStatus가 있으면,
 * statusEndDate를 신규 입력될 statusStartDate로 업데이트하여 기간을 종료 처리한다.
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

async function closeOpenStatusesForRoom(roomEsntlId, newStatusStartDate, transaction = null) {
	if (!roomEsntlId || newStatusStartDate == null) return;
	const endDtm = toDateStr(newStatusStartDate);

	await mariaDBSequelize.query(
		`UPDATE roomStatus 
		 SET statusEndDate = ?, updatedAt = NOW() 
		 WHERE roomEsntlId = ? 
		   AND (statusEndDate IS NULL OR statusEndDate > ?)`,
		{
			replacements: [endDtm, roomEsntlId, endDtm],
			type: mariaDBSequelize.QueryTypes.UPDATE,
			transaction,
		}
	);
}

module.exports = { closeOpenStatusesForRoom };
