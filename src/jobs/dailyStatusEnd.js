/**
 * 일일 방상태 종료·체납 정리 잡
 * - roomStatus에서 statusEndDate가 기준일 이전인 건을 대상으로:
 *   1) status가 CHECKOUT_CONFIRMED인 경우: il_room_deposit(해당 방·계약자명·계약자 전화번호)의 rdp_return_dtm 여부에 따라
 *      rdp_return_dtm이 null이면 status를 END_DEPOSIT, 있으면 END로 업데이트
 *   2) status가 CONTRACT이고 statusEndDate가 기준일 이전인 경우: status를 OVERDUE로 업데이트
 * - il_room_reservation에서 전일 입실예정(ror_check_in_date가 기준일의 전날)인데 여전히 WAIT 상태인 예약을 EXPIRED로 변경하고,
 *   예약 시점에 roomStatus.RESERVE_PENDING.statusMemo에 저장해둔 ON_SALE/CAN_CHECKIN의 원래 statusEndDate를 복구한 뒤,
 *   RESERVE_PENDING은 소프트 삭제 처리하며, 복구된 종료일이 오늘 이후이면 room.status=OPEN, 모두 오늘 이전이면 room.status=END로 설정
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
 * @returns {Promise<{ targetDate: string, checkoutConfirmedProcessed: number, overdueUpdated: number, expiredReservations: number, expiredRoomsUpdated: number }>}
 */
async function run(dateStr) {
	const today = new Date();
	const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
	const targetDateStr = dateStr && /^\d{4}-\d{2}-\d{2}$/.test(String(dateStr).trim()) ? String(dateStr).trim() : todayStr;

	const result = {
		targetDate: targetDateStr,
		checkoutConfirmedProcessed: 0,
		overdueUpdated: 0,
		expiredReservations: 0,
		expiredRoomsUpdated: 0,
	};

	log('시작', `기준일=${targetDateStr}`);
	const transaction = await mariaDBSequelize.transaction();
	try {
		// 0) 전일 입실 예정이었으나 결제가 완료되지 않아 여전히 WAIT 상태인 예약 만료 처리
		const [year, month, day] = targetDateStr.split('-').map((v) => Number(v));
		const baseDate = new Date(year, month - 1, day);
		const prevDate = new Date(baseDate);
		prevDate.setDate(baseDate.getDate() - 1);
		const prevDateStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}-${String(prevDate.getDate()).padStart(2, '0')}`;

		const reservationRows = await mariaDBSequelize.query(
			`
			SELECT ror.ror_sn, ror.rom_sn AS roomEsntlId
			FROM il_room_reservation ror
			WHERE ror.ror_status_cd = 'WAIT'
				AND ror.ror_check_in_date = ?
			`,
			{
				replacements: [prevDateStr],
				type: QueryTypes.SELECT,
				transaction,
			}
		);
		const reservations = Array.isArray(reservationRows) ? reservationRows : [];

		if (reservations.length > 0) {
			const rorIds = reservations
				.map((row) => row.ror_sn)
				.filter((id) => id != null);

			if (rorIds.length > 0) {
				const placeholders = rorIds.map(() => '?').join(', ');
				await mariaDBSequelize.query(
					`
					UPDATE il_room_reservation
					SET ror_status_cd = 'EXPIRED',
						ror_update_dtm = NOW()
					WHERE ror_status_cd = 'WAIT'
						AND ror_sn IN (${placeholders})
					`,
					{
						replacements: rorIds,
						type: QueryTypes.UPDATE,
						transaction,
					}
				);
				result.expiredReservations = rorIds.length;
			}

			// 각 예약별로 RESERVE_PENDING 원복 및 room.status 조정
			for (const r of reservations) {
				const roomEsntlId = r.roomEsntlId;
				const reservationId = r.ror_sn;
				if (!roomEsntlId || !reservationId) continue;

				// 해당 예약과 연결된 RESERVE_PENDING 상태 1건 조회 (가장 최근 1건)
				const [reserveStatusRow] = await mariaDBSequelize.query(
					`
					SELECT esntlId, statusMemo
					FROM roomStatus
					WHERE roomEsntlId = ?
						AND reservationEsntlId = ?
						AND status = 'RESERVE_PENDING'
						AND (deleteYN IS NULL OR deleteYN = 'N')
					ORDER BY createdAt DESC, esntlId DESC
					LIMIT 1
					`,
					{
						replacements: [roomEsntlId, reservationId],
						type: QueryTypes.SELECT,
						transaction,
					}
				);

				let originalOnSaleEnd = null;
				let originalCanCheckinEnd = null;
				if (reserveStatusRow && reserveStatusRow.statusMemo && typeof reserveStatusRow.statusMemo === 'string') {
					const memoStr = reserveStatusRow.statusMemo;
					const match = memoStr.match(/\[RESERVE_ORIGINAL_DATES:(.*)\]$/);
					if (match && match[1]) {
						try {
							const parsed = JSON.parse(match[1]);
							if (parsed && typeof parsed === 'object') {
								const normalize = (val) => {
									if (!val) return null;
									const s = String(val).trim();
									if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s} 00:00:00`;
									if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(s)) return s.slice(0, 19);
									// 예전 형식(Sun Mar 15 2026 00:00:00 GMT+0900 ...) 지원: Date 파싱 후 YYYY-MM-DD 00:00:00 로 변환
									const d = new Date(s);
									if (!Number.isNaN(d.getTime())) {
										const y = d.getFullYear();
										const m = String(d.getMonth() + 1).padStart(2, '0');
										const day = String(d.getDate()).padStart(2, '0');
										return `${y}-${m}-${day} 00:00:00`;
									}
									return null;
								};
								if (parsed.ON_SALE) originalOnSaleEnd = normalize(parsed.ON_SALE);
								if (parsed.CAN_CHECKIN) originalCanCheckinEnd = normalize(parsed.CAN_CHECKIN);
							}
						} catch (e) {
							// JSON 파싱 실패 시 원복 정보 없음으로 간주
						}
					}
				}

				// 저장해 둔 종료일이 있으면 ON_SALE / CAN_CHECKIN의 statusEndDate를 복구
				if (originalOnSaleEnd) {
					await mariaDBSequelize.query(
						`
						UPDATE roomStatus
						SET statusEndDate = ?, updatedAt = NOW()
						WHERE roomEsntlId = ?
							AND status = 'ON_SALE'
							AND (deleteYN IS NULL OR deleteYN = 'N')
						ORDER BY statusEndDate DESC, esntlId DESC
						LIMIT 1
						`,
						{
							replacements: [originalOnSaleEnd, roomEsntlId],
							type: QueryTypes.UPDATE,
							transaction,
						}
					);
				}
				if (originalCanCheckinEnd) {
					await mariaDBSequelize.query(
						`
						UPDATE roomStatus
						SET statusEndDate = ?, updatedAt = NOW()
						WHERE roomEsntlId = ?
							AND status = 'CAN_CHECKIN'
							AND (deleteYN IS NULL OR deleteYN = 'N')
						ORDER BY statusEndDate DESC, esntlId DESC
						LIMIT 1
						`,
						{
							replacements: [originalCanCheckinEnd, roomEsntlId],
							type: QueryTypes.UPDATE,
							transaction,
						}
					);
				}

				// RESERVE_PENDING은 소프트 삭제
				if (reserveStatusRow && reserveStatusRow.esntlId) {
					await mariaDBSequelize.query(
						`
						UPDATE roomStatus
						SET deleteYN = 'Y',
							deletedBy = 'SYSTEM_DAILY_STATUS_END',
							deletedAt = NOW(),
							updatedAt = NOW()
						WHERE esntlId = ?
						`,
						{
							replacements: [reserveStatusRow.esntlId],
							type: QueryTypes.UPDATE,
							transaction,
						}
					);
				}

				// 복구된 ON_SALE / CAN_CHECKIN 종료일 기준으로 room.status 결정
				const [dateRow] = await mariaDBSequelize.query(
					`
					SELECT
						MAX(CASE WHEN status = 'ON_SALE' THEN DATE(statusEndDate) ELSE NULL END) AS onSaleEndDate,
						MAX(CASE WHEN status = 'CAN_CHECKIN' THEN DATE(statusEndDate) ELSE NULL END) AS canCheckinEndDate
					FROM roomStatus
					WHERE roomEsntlId = ?
						AND status IN ('ON_SALE', 'CAN_CHECKIN')
						AND (deleteYN IS NULL OR deleteYN = 'N')
					`,
					{
						replacements: [roomEsntlId],
						type: QueryTypes.SELECT,
						transaction,
					}
				);

				const onSaleEndDate = dateRow?.onSaleEndDate ? String(dateRow.onSaleEndDate) : null;
				const canCheckinEndDate = dateRow?.canCheckinEndDate ? String(dateRow.canCheckinEndDate) : null;

				const hasFutureOpen =
					(onSaleEndDate && onSaleEndDate >= targetDateStr) ||
					(canCheckinEndDate && canCheckinEndDate >= targetDateStr);

				const newRoomStatus = hasFutureOpen ? 'OPEN' : 'END';

				const [roomMeta] = await mariaDBSequelize.query(
					`
					UPDATE room
					SET status = ?, startDate = NULL, endDate = NULL
					WHERE esntlId = ?
					`,
					{
						replacements: [newRoomStatus, roomEsntlId],
						type: QueryTypes.UPDATE,
						transaction,
					}
				);
				const updatedCount = typeof roomMeta === 'number' ? roomMeta : (roomMeta?.affectedRows ?? 0);
				result.expiredRoomsUpdated += updatedCount;
			}

			log('예약 만료 처리', `전일 입실예정 WAIT → EXPIRED: ${result.expiredReservations}건, 방 상태 원복/조정: ${result.expiredRoomsUpdated}건`);
		}

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

		// 2) CONTRACT이고 statusEndDate가 기준일 이전인 roomStatus를 OVERDUE로 일괄 업데이트
		const [overdueMeta] = await mariaDBSequelize.query(
			`
			UPDATE roomStatus
			SET status = 'OVERDUE', updatedAt = NOW()
			WHERE (deleteYN IS NULL OR deleteYN = 'N')
				AND status = 'CONTRACT'
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
