/**
 * 날짜·날짜시간을 로컬(서버/DB 세션) 기준 문자열로 다룰 때 사용.
 * Date → YYYY-MM-DD 변환 시 toISOString() 사용 금지 (UTC라 KST 기준 하루 밀림 발생).
 */

/**
 * 값을 로컬 날짜 문자열 'YYYY-MM-DD'로 반환
 * @param {Date|string|null|undefined} v - DB에서 온 Date, 또는 이미 'YYYY-MM-DD' / 'YYYY-MM-DD HH:mm:ss' 형태 문자열
 * @returns {string|null} 'YYYY-MM-DD' 또는 null
 */
function dateToYmd(v) {
	if (v == null) return null;
	if (typeof v === 'string') return v.split(' ')[0].split('T')[0];
	if (v instanceof Date && !Number.isNaN(v.getTime())) {
		return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
	}
	return String(v).slice(0, 10);
}

/**
 * Date를 로컬 기준 'YYYY-MM-DD HH:mm:ss' 문자열로 반환 (JSON 직렬화 시 UTC로 나가는 문제 방지)
 * @param {Date|string|null|undefined} v - DB에서 온 Date, 또는 이미 'YYYY-MM-DD HH:mm:ss' 형태 문자열
 * @returns {string|null} 'YYYY-MM-DD HH:mm:ss' 또는 null
 */
function dateToYmdHms(v) {
	if (v == null) return null;
	if (typeof v === 'string') return v.slice(0, 19);
	if (v instanceof Date && !Number.isNaN(v.getTime())) {
		const pad = (n) => String(n).padStart(2, '0');
		return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())} ${pad(v.getHours())}:${pad(v.getMinutes())}:${pad(v.getSeconds())}`;
	}
	return String(v).slice(0, 19);
}

module.exports = {
	dateToYmd,
	dateToYmdHms,
};
