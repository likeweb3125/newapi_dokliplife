/**
 * 생년월일(birth)로 만 나이 계산 (DB/시스템 기준, UTC 변환 없음)
 * @param {string|Date|null|undefined} data - 생년월일 (YYYY-MM-DD 또는 Date)
 * @returns {number|null} 만 나이, 유효하지 않으면 null
 */
function formatAge(data) {
	if (data == null || data === '') return null;
	const str = String(data).trim();
	if (!str) return null;
	// YYYY-MM-DD를 로컬 기준으로 파싱 (UTC 변환 없음)
	const m = str.match(/^(\d{4})-?(\d{2})?-?(\d{2})?/);
	if (!m) return null;
	const y = parseInt(m[1], 10);
	const month = m[2] != null ? parseInt(m[2], 10) - 1 : 0;
	const day = m[3] != null ? parseInt(m[3], 10) : 1;
	if (Number.isNaN(y) || y < 1900 || y > new Date().getFullYear()) return null;
	const birth = new Date(y, month, day);
	if (isNaN(birth.getTime())) return null;
	const today = new Date();
	let age = today.getFullYear() - birth.getFullYear();
	const monthDiff = today.getMonth() - birth.getMonth();
	if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
		age -= 1;
	}
	return age >= 0 && age <= 150 ? age : null;
}

module.exports = formatAge;
module.exports.formatAge = formatAge;
