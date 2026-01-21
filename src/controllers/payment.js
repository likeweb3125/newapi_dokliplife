const { mariaDBSequelize } = require('../models');
const errorHandler = require('../middleware/error');

// pyl_contract_data: 값이 있으면 ?로 바인딩, 없으면 NULL 리터럴 (바인딩 시 null 누락 이슈 회피)
function getInsertPaymentLogSql(hasPylContractData) {
	const pylExpr = hasPylContractData ? '?' : 'NULL';
	return `
INSERT INTO paymentLog (
  esntlId, pDate, pTime, withdrawalStatus, paymentType, contractEsntlId,
  gosiwonEsntlId, roomEsntlId, customerEsntlId, paymentAmount, discountAmount,
  paymentPoint, paymentCoupon, ucp_eid, collectPoint, code, reason,
  calAmount, pyl_goods_amount, imp_uid, cAmount, cPercent, calculateStatus,
  tid, pyl_contract_data, pyl_expected_settlement_date
) VALUES (
  ?, LEFT(NOW(), 10), RIGHT(NOW(), 8), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${pylExpr}, fn_addBusinessDays(LEFT(NOW(), 10), 4)
)`;
}

const generatePaymentLogId = async (transaction) => {
	const [result] = await mariaDBSequelize.query(
		`SELECT CONCAT('PYMT', LPAD(COALESCE(MAX(CAST(SUBSTRING(esntlId, 5) AS UNSIGNED)), 0) + 1, 10, '0')) AS nextId FROM paymentLog WHERE esntlId LIKE 'PYMT%'`,
		{ type: mariaDBSequelize.QueryTypes.SELECT, transaction }
	);
	return result?.nextId || 'PYMT0000000001';
};

/**
 * 결제 준비: paymentLog에 REQUEST 상태로 INSERT 후 esntlId 반환 (PG 결제창 호출 전 사용)
 */
exports.preparePayment = async (req, res, next) => {
	const transaction = await mariaDBSequelize.transaction();
	try {
		const {
			paymentType,
			gosiwonEsntlId,
			roomEsntlId,
			customerEsntlId,
			contractEsntlId,
			paymentAmount,
			pointAmount,
			couponAmount,
			ucp_eid,
			collectPoint,
			calAmount,
			pyl_goods_amount,
			feeAmount,
			feePercent,
			tid,
			pyl_contract_data,
		} = req.body;

		if (!paymentType) {
			errorHandler.errorThrow(400, '"paymentType"을(를) 입력해주세요.');
		}
		if (!gosiwonEsntlId) {
			errorHandler.errorThrow(400, '"gosiwonEsntlId"를 입력해주세요.');
		}
		if (!roomEsntlId) {
			errorHandler.errorThrow(400, '"roomEsntlId"를 입력해주세요.');
		}
		if (!customerEsntlId) {
			errorHandler.errorThrow(400, '"customerEsntlId"를 입력해주세요.');
		}
		if (calAmount === undefined || calAmount === null) {
			errorHandler.errorThrow(400, '"calAmount"를 입력해주세요.');
		}
		if (pyl_goods_amount === undefined || pyl_goods_amount === null) {
			errorHandler.errorThrow(400, '"pyl_goods_amount"를 입력해주세요.');
		}

		const eid = await generatePaymentLogId(transaction);
		const imp_uid = eid;

		const hasPylContractData = pyl_contract_data != null && pyl_contract_data !== '';
		const baseReplacements = [
			eid,
			'',
			paymentType,
			contractEsntlId || '',
			gosiwonEsntlId,
			roomEsntlId,
			customerEsntlId,
			String(paymentAmount ?? 0),
			'0',
			String(pointAmount ?? 0),
			String(couponAmount ?? 0),
			ucp_eid ?? null,
			String(collectPoint ?? 0),
			'',
			'',
			String(calAmount),
			Number(pyl_goods_amount),
			imp_uid,
			feeAmount != null ? String(feeAmount) : null,
			feePercent != null ? String(feePercent) : null,
			'REQUEST',
			tid || '',
		];
		const replacements = hasPylContractData ? [...baseReplacements, String(pyl_contract_data)] : baseReplacements;

		await mariaDBSequelize.query(getInsertPaymentLogSql(hasPylContractData), {
			replacements,
			transaction,
		});

		await transaction.commit();

		errorHandler.successThrow(res, '결제 준비가 완료되었습니다.', {
			esntlId: eid,
			imp_uid,
		});
	} catch (err) {
		await transaction.rollback();
		next(err);
	}
};
