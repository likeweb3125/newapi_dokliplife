/**
 * 계약 링크 SMS 발송 공통 유틸
 * - Aligo SMS로 계약 URL 발송 후 messageSmsHistory에 이력 저장
 */

const { mariaDBSequelize } = require('../models');
const { next: idsNext } = require('./idsNext');
const aligoSMS = require('../module/aligo/sms');

/**
 * 계약 링크 문자 발송 (receiver 번호로, messageSmsHistory 저장)
 * @param {string} receiverPhone - 수신자 전화번호 (ror_hp_no 등)
 * @param {string} roomEsntlId - 방 고유아이디 (rom_sn)
 * @param {string|null} [writerAdminId] - 발송자 관리자 ID (ror_registrant_sn 등, 잡에서는 null 가능)
 * @param {string|null} [gosiwonEsntlId] - 고시원 고유아이디
 */
async function sendContractLinkSMS(receiverPhone, roomEsntlId, writerAdminId, gosiwonEsntlId) {
	if (!receiverPhone || !String(receiverPhone).trim()) return;
	try {
		const link = `https://doklipuser.likeweb.co.kr/v2?page=contract&rom_eid=${roomEsntlId}`;
		const title = '[독립생활] 계약 요청 안내';
		const message = `아래 링크에서 계약을 진행해주세요.\n${link}`;
		await aligoSMS.send({ receiver: receiverPhone.trim(), title, message });

		const historyEsntlId = await idsNext('messageSmsHistory');
		const firstReceiver = String(receiverPhone).trim().split(',')[0]?.trim() || String(receiverPhone).trim();
		const userRows = await mariaDBSequelize.query(
			`SELECT C.esntlId FROM customer C
			 INNER JOIN roomContract RC ON RC.customerEsntlId = C.esntlId AND RC.status = 'USED'
			 WHERE C.phone = :receiverPhone ORDER BY RC.contractDate DESC LIMIT 1`,
			{ replacements: { receiverPhone: firstReceiver }, type: mariaDBSequelize.QueryTypes.SELECT }
		);
		const resolvedUserEsntlId = Array.isArray(userRows) && userRows.length > 0 ? userRows[0].esntlId : null;
		await mariaDBSequelize.query(
			`INSERT INTO messageSmsHistory (esntlId, title, content, gosiwonEsntlId, userEsntlId, receiverPhone, createdBy, createdAt, updatedAt)
			 VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
			{
				replacements: [historyEsntlId, title, message, gosiwonEsntlId || null, resolvedUserEsntlId, firstReceiver, writerAdminId || null],
				type: mariaDBSequelize.QueryTypes.INSERT,
			}
		);
	} catch (err) {
		console.error('계약 링크 문자 발송 실패:', err);
	}
}

module.exports = { sendContractLinkSMS };
