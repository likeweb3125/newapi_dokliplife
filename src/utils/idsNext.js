const { mariaDBSequelize } = require('../models');

const ID_LENGTH = 14;

/**
 * IDS 테이블 기반 다음 ID 발급
 * - next(tbl_name) 호출 시 해당 tableName의 count가 1 증가하고, prefix + count(0 패딩) 반환
 * - prefix 미지정 시 기존 행의 prefix 사용, 없으면 tableName으로 행이 없어 에러 가능하므로 prefix 지정 권장
 *
 * @param {string} tbl_name - IDS.tableName (예: 'il_room_deposit_history', 'il_room_deposit', 'paymentLog')
 * @param {string} [prefix] - ID 접두사 (예: 'RDP', 'DEPO'). 최초 행 생성 시 사용, 생략 시 기존 행의 prefix 사용
 * @param {object} [transaction] - Sequelize 트랜잭션 (선택)
 * @returns {Promise<string>} - prefix + count(0 패딩, 총 14자)
 *
 * @example
 * await next('il_room_deposit_history', 'RDP');  // 'RDP00000000001' (입금/반환 이력 ID)
 * await next('il_room_deposit', 'RDP');          // 'RDP00000000001' (보증금 메인 ID)
 * await next('deposit', 'DEPO');                  // 'DEPO0000000001'
 */
async function next(tbl_name, prefix, transaction = null) {
	const replacements = {
		tbl_name: tbl_name,
		prefix: prefix != null && prefix !== '' ? prefix : null,
	};

	// 트랜잭션 없이 호출된 경우 PK 중복 방지를 위해 내부에서 트랜잭션 사용
	const ownTransaction = transaction == null;
	const txn = transaction || (await mariaDBSequelize.transaction());

	try {
		// 1) 행 없으면 생성 (prefix 필요)
		if (replacements.prefix === null) {
			const existingRows = await mariaDBSequelize.query(
				`SELECT prefix FROM IDS WHERE tableName = :tbl_name LIMIT 1`,
				{
					replacements: { tbl_name: tbl_name },
					type: mariaDBSequelize.QueryTypes.SELECT,
					transaction: txn,
				}
			);
			const existing = Array.isArray(existingRows) && existingRows.length > 0 ? existingRows[0] : null;
			if (existing && existing.prefix != null) {
				replacements.prefix = existing.prefix;
			} else {
				throw new Error(`IDS: tableName "${tbl_name}"에 대한 prefix가 없습니다. next(tbl_name, prefix) 로 prefix를 지정하세요.`);
			}
		}

		await mariaDBSequelize.query(
			`INSERT INTO IDS (tableName, prefix, count) VALUES (:tbl_name, :prefix, 0) ON DUPLICATE KEY UPDATE tableName = tableName`,
			{ replacements: { tbl_name: tbl_name, prefix: replacements.prefix }, type: mariaDBSequelize.QueryTypes.INSERT, transaction: txn }
		);

		// 2) 행 잠금 후 현재 count 조회 (동시 요청 시 PK 중복 방지)
		const rows = await mariaDBSequelize.query(
			`SELECT prefix, count FROM IDS WHERE tableName = :tbl_name FOR UPDATE`,
			{
				replacements: { tbl_name: tbl_name },
				type: mariaDBSequelize.QueryTypes.SELECT,
				transaction: txn,
			}
		);
		const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
		if (!row) {
			throw new Error(`IDS: tableName "${tbl_name}" 행을 찾을 수 없습니다.`);
		}
		const currentCount = row.count != null ? Number(row.count) : 0;
		const nextCount = currentCount + 1;

		// 3) count를 다음 값으로 업데이트
		await mariaDBSequelize.query(
			`UPDATE IDS SET count = :nextCount WHERE tableName = :tbl_name`,
			{
				replacements: { tbl_name: tbl_name, nextCount },
				type: mariaDBSequelize.QueryTypes.UPDATE,
				transaction: txn,
			}
		);

		const _prefix = String(row.prefix ?? replacements.prefix);
		const _count = String(nextCount).padStart(ID_LENGTH - _prefix.length, '0');
		const result = _prefix.concat(_count);

		if (ownTransaction) {
			await txn.commit();
		}
		return result;
	} catch (err) {
		if (ownTransaction && txn) {
			await txn.rollback();
		}
		throw err;
	}
}

module.exports = { next, ID_LENGTH };
