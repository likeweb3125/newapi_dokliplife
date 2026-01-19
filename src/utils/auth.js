/**
 * 인증 관련 공통 유틸리티 함수
 */

/**
 * 관리자 토큰에서 writerAdminId 추출
 * 다양한 토큰 필드 케이스에 대응 (admin 또는 partner)
 * @param {Object} decodedToken - 디코딩된 JWT 토큰
 * @returns {string|null} 관리자 ID 또는 파트너 ID 또는 null
 */
const getWriterAdminId = (decodedToken) => {
	// admin이 문자열인 경우 (예: "ADMN00000000001")
	if (typeof decodedToken.admin === 'string') {
		return decodedToken.admin;
	}
	// partner가 문자열인 경우 (예: "GOSI0000002130")
	if (typeof decodedToken.partner === 'string') {
		return decodedToken.partner;
	}
	// admin이 객체인 경우
	if (decodedToken.admin) {
		return (
			decodedToken.admin?.id ||
			decodedToken.adminId ||
			decodedToken.admin?.adminId ||
			decodedToken.admin?.sn ||
			null
		);
	}
	// partner가 객체인 경우
	if (decodedToken.partner) {
		return (
			decodedToken.partner?.id ||
			decodedToken.partnerId ||
			decodedToken.partner?.partnerId ||
			null
		);
	}
	return null;
};

module.exports = {
	getWriterAdminId,
};
