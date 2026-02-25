/**
 * 일일 방상태 종료·체납 정리 잡
 * - roomStatus에서 statusEndDate가 기준일 이전인 건을 대상으로:
 *   1) status가 CHECKOUT_CONFIRMED인 경우: il_room_deposit(해당 방·계약자명·계약자 전화번호)의 rdp_return_dtm 여부에 따라
 *      rdp_return_dtm이 null이면 status를 END_DEPOSIT, 있으면 END로 업데이트
 *   2) status가 CHECKOUT_CONFIRMED가 아닌 경우: status를 OVERDUE로 업데이트
 * - 매일 00:05 스케줄러에서 호출
 * - 수동 실행: GET /v1/room/daily/statusEnd (query.date 없으면 당일 기준)
 */

const { mariaDBSequelize } = require('../models');
const { QueryTypes } = require('sequelize');
const { formatDateKST } = require('../middleware/dateJson');

const JOB_NAME = 'DailyStatusEndJob';

function log(msg, detail = '') {
	const ts = formatDateKST(new Date());
	console.log(`[${JOB_NAME}] ${ts} ${msg}${detail ? ' ' + detail : ''}`);
}

/**
 * 기준일 이전에 종료된 roomStatus에 대해 CHECKOUT_CONFIRMED → END_DEPOSIT/END, 그 외 → OVERDUE 처리
 * @param {string|null} [dateStr] - 기준일 (YYYY-MM-DD). 없으면 당일.
 * @returns {Promise<{ targetDate: string, checkoutConfirmedProcessed: number, overdueUpdated: number }>}
 */
async function run(dateStr) {
	const today = new Date();
	const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
	const targetDateStr = dateStr && /^\d{4}-\d{2}-\d{2}$/.test(String(dateStr).trim()) ? String(dateStr).trim() : todayStr;

	const result = {
		targetDate: targetDateStr,
		checkoutConfirmedProcessed: 0,
		overdueUpdated: 0,
	};

	log('시작', `기준일=${targetDateStr}`);
	const transaction = await mariaDBSequelize.transaction();
	try {
		// 1) CHECKOUT_CONFIRMED 이고 statusEndDate가 기준일 이전인 roomStatus 조회 (계약자 정보 포함)
		const checkoutRows = await mariaDBSequelize.query(
			`
			SELECT RS.esntlId AS roomStatusId, RS.roomEsntlId, RS.gosiwonEsntlId, RS.contractEsntlId,
				COALESCE(RCW.customerName, RCW.checkinName) AS contractorName,
				COALESCE(RCW.customerPhone, RCW.checkinPhone) AS contractorPhone
			FROM roomStatus RS
			LEFT JOIN roomContractWho RCW ON RCW.contractEsntlId = RS.contractEsntlId
			WHERE (RS.deleteYN IS NULL OR RS.deleteYN = 'N')
				AND RS.status = 'CHECKOUT_CONFIRMED'
				AND DATE(RS.statusEndDate) < ?
			`,
			{
				replacements: [targetDateStr],
				type: QueryTypes.SELECT,
				transaction,
			}
		);
		const checkoutList = Array.isArray(checkoutRows) ? checkoutRows : [];

		for (const row of checkoutList) {
			const roomEsntlId = row.roomEsntlId;
			const gosiwonEsntlId = row.gosiwonEsntlId;
			const contractorName = row.contractorName != null ? String(row.contractorName).trim() : null;
			const contractorPhone = row.contractorPhone != null ? String(row.contractorPhone).trim() : null;
			const roomStatusId = row.roomStatusId;

			// il_room_deposit에서 해당 방·계약자명·계약자 전화번호로 1건 조회 (최신 1건, 미삭제)
			let newStatus = 'END_DEPOSIT'; // 매칭 보증금 없으면 보증금 반환 필요로 간주
			if (gosiwonEsntlId && roomEsntlId && (contractorName || contractorPhone)) {
				const depositRows = await mariaDBSequelize.query(
					`
					SELECT rdp_return_dtm
					FROM il_room_deposit
					WHERE gsw_eid = ? AND rom_eid = ?
						AND (rdp_delete_dtm IS NULL)
						AND (rdp_customer_name <=> ?)
						AND (rdp_customer_phone <=> ?)
					ORDER BY rdp_regist_dtm DESC
					LIMIT 1
					`,
					{
						replacements: [gosiwonEsntlId, roomEsntlId, contractorName, contractorPhone],
						type: QueryTypes.SELECT,
						transaction,
					}
				);
				const deposit = Array.isArray(depositRows) && depositRows.length > 0 ? depositRows[0] : null;
				if (deposit != null) {
					newStatus = deposit.rdp_return_dtm != null ? 'END' : 'END_DEPOSIT';
				}
			}

			await mariaDBSequelize.query(
				`UPDATE roomStatus SET status = ?, updatedAt = NOW() WHERE esntlId = ?`,
				{
					replacements: [newStatus, roomStatusId],
					type: QueryTypes.UPDATE,
					transaction,
				}
			);
			result.checkoutConfirmedProcessed += 1;
		}

		// 2) CHECKOUT_CONFIRMED가 아니고 statusEndDate가 기준일 이전인 roomStatus를 OVERDUE로 일괄 업데이트
		const [overdueMeta] = await mariaDBSequelize.query(
			`
			UPDATE roomStatus
			SET status = 'OVERDUE', updatedAt = NOW()
			WHERE (deleteYN IS NULL OR deleteYN = 'N')
				AND status <> 'CHECKOUT_CONFIRMED'
				AND status NOT IN ('END_DEPOSIT', 'END', 'ON_SALE', 'BEFORE_SALES', 'ETC', 'CHECKOUT_ONSALE', 'CAN_CHECKIN')
				AND DATE(statusEndDate) < ?
			`,
			{
				replacements: [targetDateStr],
				type: QueryTypes.UPDATE,
				transaction,
			}
		);
		const overdueCount = typeof overdueMeta === 'number' ? overdueMeta : (overdueMeta?.affectedRows ?? 0);
		result.overdueUpdated = overdueCount;

		log('CHECKOUT_CONFIRMED 처리', `건수=${result.checkoutConfirmedProcessed}`);
		log('OVERDUE 업데이트', `건수=${result.overdueUpdated}`);
		await transaction.commit();
		log('완료', `targetDate=${targetDateStr}`);
		return result;
	} catch (err) {
		await transaction.rollback();
		log('실패(롤백)', err.message);
		throw err;
	}
}

module.exports = {
	run,
	JOB_NAME,
};
