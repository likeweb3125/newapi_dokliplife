/**
 * 일일 매출 마감 잡
 * - 전일(pDate) 결제(PAYMENT) 건을 il_daily_selling_closing에 INSERT
 * - 전일 결제일 기준 환불(REFUND) 건을 il_daily_selling_closing에 INSERT
 * - 매일 자정 스케줄러에서 호출
 * - 테이블: il_daily_selling_closing, 고시원 ID 컬럼: gsw_eid
 */

const { mariaDBSequelize } = require('../models');
const { QueryTypes } = require('sequelize');

const JOB_NAME = 'DailySellingClosingJob';

/** 등록자 식별 (환경 변수 DAILY_CLOSING_REGISTRANT, 미설정 시 'SYSTEM') */
const REGISTRANT = process.env.DAILY_CLOSING_REGISTRANT || 'SYSTEM';

/**
 * 일일 매출 마감 실행
 * @returns {Promise<{ sel_target_cnt: number, sel_success_cnt: number, sel_skip_cnt: number }>}
 */
function log(msg, detail = '') {
	const ts = new Date().toISOString();
	console.log(`[${JOB_NAME}] ${ts} ${msg}${detail ? ' ' + detail : ''}`);
}

async function run() {
	const result = {
		sel_target_cnt: 0,
		sel_success_cnt: 0,
		sel_skip_cnt: 0,
	};

	log('시작');
	const transaction = await mariaDBSequelize.transaction();
	try {
		// 1) PAYMENT: 전일(pDate) 결제 건 마감
		log('PAYMENT INSERT 실행 중...');
		const insertPaymentSql = `
			INSERT INTO il_daily_selling_closing (
				gsw_eid,
				dsc_closing_date,
				dsc_selling_type_cd,
				dsc_selling_cnt,
				dsc_goods_total_amt,
				dsc_gosiwon_coupon_total_amt,
				dsc_selling_total_amt,
				dsc_fee_total_amt,
				dsc_average_fee_percent,
				dsc_expected_payment_total_amt,
				dsc_refund_base_date,
				dsc_use_coupon_total_amt,
				dsc_use_point_total_amt,
				dsc_payment_total_amt,
				dsc_regist_dtm,
				dsc_registrant_eid
			)
			SELECT gosiwonEsntlId AS gsw_eid
				, pDate AS dsc_closing_date
				, 'PAYMENT' AS dsc_selling_type_cd
				, COUNT(*) AS dsc_selling_cnt
				, SUM(pyl_goods_amount) AS dsc_goods_total_amt
				, SUM(IF(C.type = 'GCP', paymentCoupon, 0)) AS dsc_gosiwon_coupon_total_amt
				, SUM(calAmount) AS dsc_selling_total_amt
				, SUM(cAmount) AS dsc_fee_total_amt
				, CAST(AVG(cPercent) AS DECIMAL(3,1)) AS dsc_average_fee_percent
				, SUM(calAmount) - SUM(cAmount) AS dsc_expected_payment_total_amt
				, pyl_expected_settlement_date AS dsc_refund_base_date
				, SUM(IF(C.type = 'GCP', 0, paymentCoupon)) AS dsc_use_coupon_total_amt
				, SUM(paymentPoint) AS dsc_use_point_total_amt
				, SUM(paymentAmount) AS dsc_payment_total_amt
				, NOW() AS dsc_regist_dtm
				, ? AS dsc_registrant_eid
			FROM paymentLog AS PL
			LEFT OUTER JOIN userCoupon AS UC ON PL.ucp_eid = UC.esntlId
			LEFT OUTER JOIN coupon AS C ON UC.couponEsntlId = C.esntlId
			WHERE pDate = DATE_ADD(CURDATE(), INTERVAL -1 DAY)
				AND PL.paymentType <> 'REFUND'
				AND calculateStatus = 'SUCCESS'
			GROUP BY pDate, gosiwonEsntlId, pyl_expected_settlement_date
			ORDER BY pDate DESC, gosiwonEsntlId
		`;
		const [paymentMeta] = await mariaDBSequelize.query(insertPaymentSql, {
			replacements: [REGISTRANT],
			transaction,
			type: QueryTypes.INSERT,
		});
		const paymentRows = typeof paymentMeta === 'number' ? paymentMeta : (paymentMeta?.affectedRows ?? 0);
		result.sel_target_cnt += paymentRows;
		result.sel_success_cnt += paymentRows;
		log('PAYMENT INSERT 완료', `(insert ${paymentRows}행)`);

		// 2) REFUND: 전일 결제일 기준 환불 건 마감 (paymentDate >= 2023-08-01)
		log('REFUND INSERT 실행 중...');
		const insertRefundSql = `
			INSERT INTO il_daily_selling_closing (
				gsw_eid,
				dsc_closing_date,
				dsc_selling_type_cd,
				dsc_selling_cnt,
				dsc_goods_total_amt,
				dsc_gosiwon_coupon_total_amt,
				dsc_selling_total_amt,
				dsc_fee_total_amt,
				dsc_average_fee_percent,
				dsc_expected_payment_total_amt,
				dsc_refund_base_date,
				dsc_use_coupon_total_amt,
				dsc_use_point_total_amt,
				dsc_payment_total_amt,
				dsc_regist_dtm,
				dsc_registrant_eid
			)
			SELECT gosiwonEsntlId AS gsw_eid
				, paymentDate AS dsc_closing_date
				, paymentType AS dsc_selling_type_cd
				, COUNT(*) AS dsc_selling_cnt
				, SUM(pyl_goods_amount) AS dsc_goods_total_amt
				, SUM(IF(couponType = 'GCP', paymentCoupon, 0)) AS dsc_gosiwon_coupon_total_amt
				, SUM(calAmount) AS dsc_selling_total_amt
				, SUM(cAmount) AS dsc_fee_total_amt
				, CAST(AVG(cPercent) AS DECIMAL(3,1)) AS dsc_average_fee_percent
				, SUM(calAmount) - SUM(cAmount) AS dsc_expected_payment_total_amt
				, (SELECT dsc_refund_base_date
					FROM il_daily_selling_closing
					WHERE dsc_closing_date = T.paymentDate
						AND dsc_selling_type_cd = 'PAYMENT'
					ORDER BY dsc_sno DESC
					LIMIT 1) AS dsc_refund_base_date
				, SUM(IF(couponType = 'GCP', 0, paymentCoupon)) AS dsc_use_coupon_total_amt
				, SUM(paymentPoint) AS dsc_use_point_total_amt
				, SUM(paymentAmount) AS dsc_payment_total_amt
				, NOW() AS dsc_regist_dtm
				, ? AS dsc_registrant_eid
			FROM (
				SELECT (SELECT MAX(pDate)
						FROM paymentLog
						WHERE contractEsntlId = PL.contractEsntlId
							AND paymentType <> 'REFUND'
							AND calculateStatus = 'SUCCESS') AS paymentDate
					, C.type AS couponType
					, PL.*
				FROM paymentLog AS PL
				LEFT OUTER JOIN userCoupon AS UC ON PL.ucp_eid = UC.esntlId
				LEFT OUTER JOIN coupon AS C ON UC.couponEsntlId = C.esntlId
				WHERE pDate = DATE_ADD(CURDATE(), INTERVAL -1 DAY)
					AND PL.paymentType = 'REFUND'
					AND calculateStatus = 'SUCCESS'
			) T
			WHERE paymentDate >= '2023-08-01'
			GROUP BY paymentDate, gosiwonEsntlId
			ORDER BY paymentDate DESC, gosiwonEsntlId
		`;
		const [refundMeta] = await mariaDBSequelize.query(insertRefundSql, {
			replacements: [REGISTRANT],
			transaction,
			type: QueryTypes.INSERT,
		});
		const refundRows = typeof refundMeta === 'number' ? refundMeta : (refundMeta?.affectedRows ?? 0);
		result.sel_target_cnt += refundRows;
		result.sel_success_cnt += refundRows;
		log('REFUND INSERT 완료', `(insert ${refundRows}행)`);

		result.sel_skip_cnt = result.sel_target_cnt - result.sel_success_cnt;
		log('트랜잭션 커밋 중...');
		await transaction.commit();
		log('완료', `sel_target_cnt=${result.sel_target_cnt}, sel_success_cnt=${result.sel_success_cnt}`);
		return result;
	} catch (err) {
		await transaction.rollback();
		log('실패(롤백)', err.message);
		throw err;
	}
}

module.exports = {
	run,
	JOB_NAME,
};
