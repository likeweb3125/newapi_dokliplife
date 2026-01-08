const express = require('express');
const { mariaDBSequelize } = require('../models');
const errorHandler = require('../middleware/error');
const { QueryTypes } = require('sequelize');

// TODO: GosiwonCalculate 모듈 import 필요
// const GosiwonCalculate = require('../models/gosiwonCalculate');

/**
 * 일별 고시원 정산 목록 조회 (2023년 8월 이후)
 */
exports.selectListToCalculateDaily = async (req, res, next) => {
	try {
		const { gosiwonEsntlId, baseDate } = req.body;

		if (!gosiwonEsntlId) {
			errorHandler.errorThrow(400, 'gosiwonEsntlId는 필수입니다.');
		}

		if (!baseDate) {
			errorHandler.errorThrow(400, 'baseDate는 필수입니다.');
		}

		// GosiwonCalculate.selectListToCalculateDaily 함수 호출
		// 임시로 직접 구현
		const query = `
			SELECT 
				dsc_sno,
				LEFT(dsc.dsc_closing_date, 10) AS dsc_base_date,
				dsc.gsw_eid AS gsw_eid,
				SUM(dsc.dsc_selling_cnt) AS dsc_selling_cnt,
				SUM(IF(dsc.dsc_selling_type_cd = 'PAYMENT', dsc.dsc_selling_cnt, 0)) AS dsc_payment_cnt,
				SUM(IF(dsc.dsc_selling_type_cd = 'REFUND', dsc.dsc_selling_cnt, 0)) AS dsc_refund_cnt,
				SUM(dsc.dsc_goods_total_amt) AS dsc_goods_total_amt,
				SUM(dsc.dsc_gosiwon_coupon_total_amt) AS dsc_gosiwon_coupon_total_amt,
				SUM(dsc.dsc_selling_total_amt) AS dsc_selling_total_amt,
				dsc.dsc_average_fee_percent,
				SUM(dsc.dsc_fee_total_amt) AS dsc_fee_total_amt,
				SUM(dsc.dsc_use_coupon_total_amt) AS dsc_use_coupon_total_amt,
				SUM(dsc.dsc_use_point_total_amt) AS dsc_use_point_total_amt,
				SUM(dsc.dsc_payment_total_amt) AS dsc_payment_total_amt,
				SUM(dsc.dsc_calculation_total_amt) AS dsc_calculation_total_amt,
				SUM(dsc.dsc_coupon_refund_amt) AS dsc_coupon_refund_amt,
				SUM(dsc.dsc_point_refund_amt) AS dsc_point_refund_amt,
				SUM(dsc.dsc_fee_refund_amt) AS dsc_fee_refund_amt,
				SUM(dsc.dsc_business_support_amt) AS dsc_business_support_amt,
				SUM(dsc.dsc_coupon_refund_amt) + SUM(dsc.dsc_point_refund_amt) + SUM(dsc.dsc_fee_refund_amt) + SUM(dsc.dsc_business_support_amt) AS dsc_support_total_amt,
				SUM(dsc.dsc_expected_payment_total_amt) AS dsc_expected_payment_total_amt,
				LEFT(dsc.dsc_refund_base_date, 10) AS dsc_refund_base_date,
				LEFT(dsc.dsc_complete_dtm, 16) AS dsc_complete_dtm
			FROM il_daily_selling_closing dsc
			WHERE 1=1
				AND dsc.gsw_eid = ?
				AND LEFT(dsc.dsc_closing_date, 7) = ?
			GROUP BY LEFT(dsc.dsc_closing_date, 10), dsc.gsw_eid
			ORDER BY 3
		`;

		const month = baseDate.substring(0, 7); // YYYY-MM 형식에서 월 추출
		const rows = await mariaDBSequelize.query(query, {
			replacements: [gosiwonEsntlId, month],
			type: QueryTypes.SELECT,
		});

		const countQuery = `
			SELECT COUNT(*) AS totcnt
			FROM il_daily_selling_closing dsc
			WHERE 1=1
				AND dsc.gsw_eid = ?
				AND LEFT(dsc.dsc_closing_date, 7) = ?
		`;

		const countResult = await mariaDBSequelize.query(countQuery, {
			replacements: [gosiwonEsntlId, month],
			type: QueryTypes.SELECT,
		});

		const totalCount = countResult[0]?.totcnt || 0;

		const result = {
			result: 'SUCCESS',
			data: rows,
			recordsTotal: totalCount,
			recordsFiltered: totalCount,
		};

		res.json(result);
	} catch (err) {
		next(err);
	}
};

/**
 * 일별 고시원 정산 목록 조회 - 관리자 (2023년 8월 이후)
 */
exports.selectCalculateAdminByDate = async (req, res, next) => {
	try {
		const { baseDate } = req.body;

		if (!baseDate) {
			errorHandler.errorThrow(400, 'baseDate는 필수입니다.');
		}

		const query = `
			SELECT 
				dsc_sno,
				LEFT(dsc.dsc_closing_date, 10) AS dsc_base_date,
				g.name AS gsw_name,
				g.corpNumber AS gsw_corp_number,
				dsc.gsw_eid AS gsw_eid,
				SUM(dsc.dsc_selling_cnt) AS dsc_selling_cnt,
				SUM(IF(dsc.dsc_selling_type_cd = 'PAYMENT', dsc.dsc_selling_cnt, 0)) AS dsc_payment_cnt,
				SUM(IF(dsc.dsc_selling_type_cd = 'REFUND', dsc.dsc_selling_cnt, 0)) AS dsc_refund_cnt,
				SUM(dsc.dsc_goods_total_amt) AS dsc_goods_total_amt,
				SUM(dsc.dsc_gosiwon_coupon_total_amt) AS dsc_gosiwon_coupon_total_amt,
				SUM(dsc.dsc_selling_total_amt) AS dsc_selling_total_amt,
				dsc.dsc_average_fee_percent,
				SUM(dsc.dsc_fee_total_amt) AS dsc_fee_total_amt,
				SUM(dsc.dsc_use_coupon_total_amt) AS dsc_use_coupon_total_amt,
				SUM(dsc.dsc_use_point_total_amt) AS dsc_use_point_total_amt,
				SUM(dsc.dsc_payment_total_amt) AS dsc_payment_total_amt,
				SUM(dsc.dsc_calculation_total_amt) AS dsc_calculation_total_amt,
				SUM(dsc.dsc_coupon_refund_amt) AS dsc_coupon_refund_amt,
				SUM(dsc.dsc_point_refund_amt) AS dsc_point_refund_amt,
				SUM(dsc.dsc_fee_refund_amt) AS dsc_fee_refund_amt,
				SUM(dsc.dsc_business_support_amt) AS dsc_business_support_amt,
				SUM(dsc.dsc_coupon_refund_amt) + SUM(dsc.dsc_point_refund_amt) + SUM(dsc.dsc_fee_refund_amt) + SUM(dsc.dsc_business_support_amt) AS dsc_support_total_amt,
				SUM(dsc.dsc_expected_payment_total_amt) AS dsc_expected_payment_total_amt,
				LEFT(dsc.dsc_refund_base_date, 10) AS dsc_refund_base_date,
				LEFT(dsc.dsc_complete_dtm, 16) AS dsc_complete_dtm,
				g.corpNumber AS gsw_corp_no,
				g.bank AS gsw_bank_name,
				g.bankAccount AS gsw_bank_account,
				g.accountHolder AS gsw_account_holder,
				g.email AS gsw_keeper_email,
				g.keeperName AS gsw_keeper_name,
				g.keeperHp AS gsw_keeper_hp,
				ga.ceo AS gsw_admin_name,
				ga.hp AS gsw_admin_hp,
				g.manager AS gsw_manager,
				g.use_settlement AS use_settlement
			FROM il_daily_selling_closing dsc
				LEFT OUTER JOIN gosiwon g ON dsc.gsw_eid = g.esntlId
				LEFT OUTER JOIN gosiwonAdmin ga ON g.adminEsntlId = ga.esntlId
			WHERE 1=1
				AND LEFT(dsc.dsc_closing_date, 10) = ?
			GROUP BY LEFT(dsc.dsc_closing_date, 10), dsc.gsw_eid
			ORDER BY 3
		`;

		const rows = await mariaDBSequelize.query(query, {
			replacements: [baseDate],
			type: QueryTypes.SELECT,
		});

		const countQuery = `
			SELECT COUNT(*) AS totcnt
			FROM il_daily_selling_closing dsc
			WHERE 1=1
				AND LEFT(dsc.dsc_closing_date, 10) = ?
		`;

		const countResult = await mariaDBSequelize.query(countQuery, {
			replacements: [baseDate],
			type: QueryTypes.SELECT,
		});

		const totalCount = countResult[0]?.totcnt || 0;

		// use_settlement 값 변환: 0 -> false, 1 -> true
		const transformedRows = rows.map((row) => {
			const useSettlement = row.use_settlement;
			let useSettlementValue = null;
			if (useSettlement === 0 || useSettlement === '0') {
				useSettlementValue = false;
			} else if (useSettlement === 1 || useSettlement === '1') {
				useSettlementValue = true;
			}
			return {
				...row,
				use_settlement: useSettlementValue,
			};
		});

		const result = {
			result: 'SUCCESS',
			data: transformedRows,
			recordsTotal: totalCount,
			recordsFiltered: totalCount,
		};

		res.json(result);
	} catch (err) {
		next(err);
	}
};

/**
 * 일별 고시원 정산 세부 내역 조회 (2023년 8월 이후)
 */
exports.selectListCalculateCompleteByType = async (req, res, next) => {
	try {
		const { gosiwonEsntlId, baseDate } = req.body;

		if (!gosiwonEsntlId) {
			errorHandler.errorThrow(400, 'gosiwonEsntlId는 필수입니다.');
		}

		if (!baseDate) {
			errorHandler.errorThrow(400, 'baseDate는 필수입니다.');
		}

		const query = `
			SELECT 
				LEFT(dsc.dsc_closing_date, 10) AS dsc_base_date,
				dsc.dsc_selling_type_cd AS dsc_selling_type_cd,
				SUM(dsc.dsc_selling_cnt) AS dsc_selling_cnt,
				SUM(dsc.dsc_goods_total_amt) AS dsc_goods_total_amt,
				SUM(dsc.dsc_gosiwon_coupon_total_amt) AS dsc_gosiwon_coupon_total_amt,
				SUM(dsc.dsc_selling_total_amt) AS dsc_selling_total_amt,
				dsc.dsc_average_fee_percent,
				SUM(dsc.dsc_fee_total_amt) AS dsc_fee_total_amt,
				SUM(dsc.dsc_use_coupon_total_amt) AS dsc_use_coupon_total_amt,
				SUM(dsc.dsc_use_point_total_amt) AS dsc_use_point_total_amt,
				SUM(dsc.dsc_payment_total_amt) AS dsc_payment_total_amt,
				SUM(dsc.dsc_calculation_total_amt) AS dsc_calculation_total_amt,
				SUM(dsc.dsc_coupon_refund_amt) AS dsc_coupon_refund_amt,
				SUM(dsc.dsc_point_refund_amt) AS dsc_point_refund_amt,
				SUM(dsc.dsc_fee_refund_amt) AS dsc_fee_refund_amt,
				SUM(dsc.dsc_business_support_amt) AS dsc_business_support_amt,
				SUM(dsc.dsc_coupon_refund_amt) + SUM(dsc.dsc_point_refund_amt) + SUM(dsc.dsc_fee_refund_amt) + SUM(dsc.dsc_business_support_amt) AS dsc_support_total_amt,
				SUM(dsc.dsc_expected_payment_total_amt) AS dsc_expected_payment_total_amt,
				LEFT(dsc.dsc_refund_base_date, 10) AS dsc_refund_base_date,
				LEFT(dsc.dsc_complete_dtm, 16) AS dsc_complete_dtm
			FROM il_daily_selling_closing dsc
			WHERE 1=1
				AND dsc.gsw_eid = ?
				AND LEFT(dsc.dsc_closing_date, 10) = ?
			GROUP BY LEFT(dsc.dsc_closing_date, 10), dsc.dsc_selling_type_cd
			ORDER BY 1 DESC, 2
		`;

		const rows = await mariaDBSequelize.query(query, {
			replacements: [gosiwonEsntlId, baseDate],
			type: QueryTypes.SELECT,
		});

		const countQuery = `
			SELECT COUNT(*) AS totcnt
			FROM il_daily_selling_closing dsc
			WHERE 1=1
				AND dsc.gsw_eid = ?
				AND LEFT(dsc.dsc_closing_date, 10) = ?
		`;

		const countResult = await mariaDBSequelize.query(countQuery, {
			replacements: [gosiwonEsntlId, baseDate],
			type: QueryTypes.SELECT,
		});

		const totalCount = countResult[0]?.totcnt || 0;

		const result = {
			result: 'SUCCESS',
			data: rows,
			recordsTotal: totalCount,
			recordsFiltered: totalCount,
		};

		res.json(result);
	} catch (err) {
		next(err);
	}
};

/**
 * 일별 고시원 정산 결제 내역 조회 - 월별 (2023년 8월 이후)
 */
exports.selectListToPaymentLogMonth = async (req, res, next) => {
	try {
		const { gosiwonEsntlId, baseDate } = req.body;

		if (!gosiwonEsntlId) {
			errorHandler.errorThrow(400, 'gosiwonEsntlId는 필수입니다.');
		}

		if (!baseDate) {
			errorHandler.errorThrow(400, 'baseDate는 필수입니다.');
		}

		const query = `
			SELECT 
				esntlId,
				CONCAT(pDate, ' ', pTime) AS pDateTime,
				paymentType,
				contractEsntlId,
				gosiwonEsntlId,
				roomEsntlId,
				(SELECT roomNumber FROM room WHERE esntlId=pl.roomEsntlId) AS roomName,
				customerEsntlId,
				(SELECT name FROM customer WHERE esntlId=pl.customerEsntlId) AS customerName,
				paymentAmount,
				paymentPoint,
				paymentCoupon,
				collectPoint,
				code,
				reason,
				calAmount,
				imp_uid,
				cAmount,
				cPercent,
				calculateStatus,
				tid
			FROM paymentLog pl
			WHERE 1=1
				AND pl.calculateStatus = 'SUCCESS'
				AND pl.gosiwonEsntlId = ?
				AND pl.pDate LIKE CONCAT(?, '%')
			ORDER BY esntlId DESC
		`;

		const month = baseDate.substring(0, 7); // YYYY-MM 형식에서 월 추출
		const rows = await mariaDBSequelize.query(query, {
			replacements: [gosiwonEsntlId, month],
			type: QueryTypes.SELECT,
		});

		const countQuery = `
			SELECT COUNT(*) AS totcnt
			FROM paymentLog pl
			WHERE 1=1
				AND pl.calculateStatus = 'SUCCESS'
				AND pl.gosiwonEsntlId = ?
				AND pl.pDate LIKE CONCAT(?, '%')
		`;

		const countResult = await mariaDBSequelize.query(countQuery, {
			replacements: [gosiwonEsntlId, month],
			type: QueryTypes.SELECT,
		});

		const totalCount = countResult[0]?.totcnt || 0;

		const result = {
			result: 'SUCCESS',
			data: rows,
			recordsTotal: totalCount,
			recordsFiltered: totalCount,
		};

		res.json(result);
	} catch (err) {
		next(err);
	}
};

/**
 * 일별 고시원 정산 결제 내역 조회 - 일별 (2023년 8월 이후)
 */
exports.selectListToPaymentLog = async (req, res, next) => {
	try {
		const { gosiwonEsntlId, baseDate } = req.body;

		if (!gosiwonEsntlId) {
			errorHandler.errorThrow(400, 'gosiwonEsntlId는 필수입니다.');
		}

		if (!baseDate) {
			errorHandler.errorThrow(400, 'baseDate는 필수입니다.');
		}

		const query = `
			SELECT 
				pyl1.esntlId,
				CONCAT(pDate, ' ', pTime) AS pDateTime,
				paymentType,
				r.roomNumber AS rom_name,
				c.name AS cus_name,
				pyl_goods_amount,
				paymentAmount,
				paymentPoint,
				IF(ucp.type = 'GCP', 0, paymentCoupon) AS paymentCoupon,
				collectPoint,
				code,
				calAmount,
				imp_uid,
				cAmount,
				cPercent,
				calculateStatus,
				tid,
				IF(ucp.type = 'GCP', paymentCoupon, 0) AS gosiwonCoupon
			FROM paymentLog AS pyl1
			JOIN roomContract AS rc ON rc.esntlId = pyl1.contractEsntlId
			JOIN room AS r ON r.esntlId = rc.roomEsntlId
			JOIN customer AS c ON c.esntlId = rc.customerEsntlId
			LEFT OUTER JOIN userCoupon AS ucp ON ucp.esntlId = pyl1.ucp_eid
			WHERE pyl1.gosiwonEsntlId = ?
				AND pyl1.pDate = ?
				AND pyl1.calculateStatus = 'SUCCESS'
				AND pyl1.paymentType <> 'REFUND'
			UNION
			SELECT 
				pyl2.esntlId,
				CONCAT(contractDate, ' ', contractTime) AS pDateTime,
				paymentType,
				r.roomNumber AS rom_name,
				c.name AS cus_name,
				pyl_goods_amount,
				paymentAmount,
				paymentPoint,
				IF(ucp.type = 'GCP', 0, paymentCoupon) AS paymentCoupon,
				collectPoint,
				code,
				calAmount,
				imp_uid,
				cAmount,
				cPercent,
				calculateStatus,
				tid,
				IF(ucp.type = 'GCP', paymentCoupon, 0) AS gosiwonCoupon
			FROM paymentLog AS pyl2
			JOIN roomContract AS rc ON rc.esntlId = pyl2.contractEsntlId
			JOIN room AS r ON r.esntlId = rc.roomEsntlId
			JOIN customer AS c ON c.esntlId = rc.customerEsntlId
			LEFT OUTER JOIN userCoupon AS ucp ON ucp.esntlId = pyl2.ucp_eid
			WHERE pyl2.gosiwonEsntlId = ?
				AND pyl2.pDate = ?
				AND pyl2.calculateStatus = 'SUCCESS'
				AND pyl2.paymentType = 'REFUND'
			ORDER BY 2 DESC
		`;

		const rows = await mariaDBSequelize.query(query, {
			replacements: [gosiwonEsntlId, baseDate, gosiwonEsntlId, baseDate],
			type: QueryTypes.SELECT,
		});

		const result = {
			result: 'SUCCESS',
			data: rows,
			recordsTotal: rows.length,
			recordsFiltered: rows.length,
		};

		res.json(result);
	} catch (err) {
		next(err);
	}
};

