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
	const selectQuery = `SELECT prefix, count FROM IDS WHERE tableName = :tbl_name`;
	const updateQuery = `INSERT INTO IDS (tableName, prefix, count) VALUES (:tbl_name, :prefix, 1) ON DUPLICATE KEY UPDATE count = count + 1`;

	const replacements = {
		tbl_name: tbl_name,
		prefix: prefix != null && prefix !== '' ? prefix : null,
	};

	// prefix 미지정 시 기존 행 조회로 prefix 채우기
	if (replacements.prefix === null) {
		const existingRows = await mariaDBSequelize.query(
			`SELECT prefix FROM IDS WHERE tableName = :tbl_name LIMIT 1`,
			{
				replacements: { tbl_name: tbl_name },
				type: mariaDBSequelize.QueryTypes.SELECT,
				transaction,
			}
		);
		const existing = Array.isArray(existingRows) && existingRows.length > 0 ? existingRows[0] : null;
		if (existing && existing.prefix != null) {
			replacements.prefix = existing.prefix;
		} else {
			throw new Error(`IDS: tableName "${tbl_name}"에 대한 prefix가 없습니다. next(tbl_name, prefix) 로 prefix를 지정하세요.`);
		}
	}

	// 1) count 증가 (INSERT ... ON DUPLICATE KEY UPDATE)
	await mariaDBSequelize.query(updateQuery, {
		replacements,
		transaction,
	});

	// 2) 증가된 count 조회
	const rows = await mariaDBSequelize.query(selectQuery, {
		replacements: { tbl_name: tbl_name },
		type: mariaDBSequelize.QueryTypes.SELECT,
		transaction,
	});

	const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
	const _prefix = String(row ? row.prefix : replacements.prefix);
	const _count = String(row && row.count != null ? row.count : 1).padStart(
		ID_LENGTH - _prefix.length,
		'0'
	);
	return _prefix.concat(_count);
}

module.exports = { next, ID_LENGTH };
