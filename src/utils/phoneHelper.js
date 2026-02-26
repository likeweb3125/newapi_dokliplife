/**
 * 전화번호 포맷 유틸리티
 * 저장: "-", 공백 등 제거 (숫자만)
 * 반환: "-" 구분자로 포맷팅
 */

/**
 * 저장용: 전화번호에서 "-", 공백 등 제거 후 숫자만 반환
 * @param {string|null|undefined} v - 전화번호
 * @returns {string|null} 숫자만 포함된 문자열 또는 null
 */
function phoneToRaw(v) {
	if (v == null || v === '') return null;
	const s = String(v).trim();
	if (!s) return null;
	const raw = s.replace(/\s*-\s*/g, '').replace(/[-.\s()]/g, '').replace(/\D/g, '');
	return raw || null;
}

/**
 * 반환용: 숫자 전화번호를 "-" 구분자로 포맷팅
 * 한국 번호 형식: 010-1234-5678, 02-123-4567, 031-123-4567 등
 * @param {string|null|undefined} v - 전화번호 (숫자만 또는 이미 포맷된 값)
 * @returns {string|null} "-" 구분 포맷 또는 null
 */
function phoneToDisplay(v) {
	if (v == null || v === '') return null;
	const raw = phoneToRaw(v);
	if (!raw) return null;
	const len = raw.length;
	// 010으로 시작 (휴대폰)
	if (raw.startsWith('010')) {
		if (len === 11) return `${raw.slice(0, 3)}-${raw.slice(3, 7)}-${raw.slice(7)}`;
		if (len === 10) return `${raw.slice(0, 3)}-${raw.slice(3, 6)}-${raw.slice(6)}`;
	}
	// 02 (서울)
	if (raw.startsWith('02')) {
		if (len === 9) return `${raw.slice(0, 2)}-${raw.slice(2, 5)}-${raw.slice(5)}`;
		if (len === 10) return `${raw.slice(0, 2)}-${raw.slice(2, 6)}-${raw.slice(6)}`;
	}
	// 031, 032, 041 등 지역번호 (3자리)
	if (/^0(31|32|33|41|42|43|44|51|52|53|54|55|61|62|63|64)/.test(raw)) {
		if (len === 10) return `${raw.slice(0, 3)}-${raw.slice(3, 6)}-${raw.slice(6)}`;
		if (len === 11) return `${raw.slice(0, 3)}-${raw.slice(3, 7)}-${raw.slice(7)}`;
	}
	// 070, 080 등
	if (raw.startsWith('070') || raw.startsWith('080')) {
		if (len >= 10) return `${raw.slice(0, 3)}-${raw.slice(3, 6)}-${raw.slice(6)}`;
	}
	// 그 외: 3-4-4 또는 그냥 3자리씩
	if (len >= 10) {
		return `${raw.slice(0, 3)}-${raw.slice(3, 7)}-${raw.slice(7)}`;
	}
	if (len >= 7) {
		return `${raw.slice(0, 3)}-${raw.slice(3)}`;
	}
	return raw;
}

module.exports = {
	phoneToRaw,
	phoneToDisplay,
};
