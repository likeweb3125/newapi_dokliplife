/**
 * 매일 오전 9시 예약 리마인더 잡
 * - il_room_reservation에서 ror_status_cd='WAIT', ror_check_in_date가 오늘 이후인 건 조회
 * - 각 건에 대해 ror_hp_no로 계약 링크 SMS 발송 (sendContractLinkSMS)
 * - messageSmsHistory에 발송 이력 저장
 */

const { mariaDBSequelize } = require('../models');
const { QueryTypes } = require('sequelize');
const { sendContractLinkSMS } = require('../utils/contractLinkSms');
const { formatDateKST } = require('../middleware/dateJson');

const JOB_NAME = 'DailyReserveReminderJob';

function log(msg, detail = '') {
	const ts = formatDateKST(new Date());
	console.log(`[${JOB_NAME}] ${ts} ${msg}${detail ? ' ' + detail : ''}`);
}

/**
 * WAIT 상태이고 입실예정일이 기준일 이후인 예약에 대해 계약 링크 문자 발송
 * @param {string|null} [targetDateStr] - 기준일 (YYYY-MM-DD). 없으면 당일. ror_check_in_date >= 이 날짜인 건 대상
 * @returns {Promise<{ total: number, sent: number, failed: number, targetDate: string }>}
 */
async function run(targetDateStr = null) {
	const today = new Date();
	const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
	const baseDate = (targetDateStr && /^\d{4}-\d{2}-\d{2}$/.test(String(targetDateStr).trim())) ? String(targetDateStr).trim() : todayStr;

	const result = { total: 0, sent: 0, failed: 0, targetDate: baseDate };
	log('시작', `기준일=${baseDate}`);

	const rows = await mariaDBSequelize.query(
		`SELECT ror.ror_sn, ror.rom_sn, ror.ror_hp_no, ror.ror_registrant_sn, ror.ror_check_in_date, r.gosiwonEsntlId
		 FROM il_room_reservation ror
		 JOIN room r ON r.esntlId = ror.rom_sn
		 WHERE ror.ror_status_cd = 'WAIT' AND ror.ror_check_in_date >= ?
		 ORDER BY ror.ror_check_in_date ASC`,
		{ replacements: [baseDate], type: QueryTypes.SELECT }
	);

	result.total = Array.isArray(rows) ? rows.length : 0;
	if (result.total === 0) {
		log('발송 대상 없음');
		return result;
	}

	log('발송 대상', `${result.total}건`);

	for (const row of rows) {
		const receiver = row.ror_hp_no;
		const roomEsntlId = row.rom_sn;
		const userSn = row.ror_registrant_sn || null;
		const gosiwonEsntlId = row.gosiwonEsntlId || null;
		if (!receiver || !String(receiver).trim()) {
			result.failed += 1;
			log('건너뜀 (수신자 없음)', `ror_sn=${row.ror_sn}`);
			continue;
		}
		try {
			await sendContractLinkSMS(receiver, roomEsntlId, userSn, gosiwonEsntlId);
			result.sent += 1;
		} catch (err) {
			result.failed += 1;
			log('발송 실패', `ror_sn=${row.ror_sn} ${err.message}`);
		}
	}

	log('완료', `total=${result.total}, sent=${result.sent}, failed=${result.failed}`);
	return result;
}

module.exports = {
	run,
	JOB_NAME,
};
