/**
 * API 응답에서 Date 객체가 UTC(ISO)로 직렬화되면 KST 기준으로 -9시간 되어 보이는 문제를 방지합니다.
 * res.json() 호출 시 payload 내 모든 Date를 DB 저장값(KST) 그대로 보이도록 'YYYY-MM-DD HH:mm:ss' 문자열로 직렬화합니다.
 * 규칙: "날짜·시간은 DB에 있는 그대로 표시·저장", "조회(API 응답): UTC·ISO 등으로 바꾸지 말고"
 */

/**
 * Date를 Asia/Seoul 기준 'YYYY-MM-DD HH:mm:ss' 문자열로 반환
 * @param {Date} date
 * @returns {string}
 */
function formatDateKST(date) {
	if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
		return null;
	}
	// sv-SE 로케일 + Asia/Seoul 타임존 → 'YYYY-MM-DD HH:mm:ss'
	return date.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).replace('T', ' ');
}

/**
 * res.json()을 래핑하여 Date를 KST 문자열로 직렬화하는 미들웨어
 */
function dateJsonMiddleware(req, res, next) {
	const originalJson = res.json.bind(res);
	res.json = function (body) {
		const replacer = (key, value) => {
			if (value instanceof Date) {
				return formatDateKST(value);
			}
			return value;
		};
		res.setHeader('Content-Type', 'application/json');
		return originalJson(JSON.parse(JSON.stringify(body, replacer)));
	};
	next();
}

module.exports = { dateJsonMiddleware, formatDateKST };
