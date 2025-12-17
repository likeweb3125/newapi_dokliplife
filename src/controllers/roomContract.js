const { mariaDBSequelize } = require('../models');
const errorHandler = require('../middleware/error');

// 공통 토큰 검증 함수
const verifyAdminToken = (req) => {
	const authHeader = req.get('Authorization');
	if (!authHeader) {
		errorHandler.errorThrow(401, '토큰이 없습니다.');
	}

	const token = authHeader.split(' ')[1];
	if (!token) {
		errorHandler.errorThrow(401, '토큰 형식이 올바르지 않습니다.');
	}

	const jwt = require('jsonwebtoken');
	let decodedToken;
	try {
		decodedToken = jwt.decode(token);
	} catch (err) {
		errorHandler.errorThrow(401, '토큰 디코딩에 실패했습니다.');
	}

	if (!decodedToken || !decodedToken.admin) {
		errorHandler.errorThrow(401, '관리자 정보가 없습니다.');
	}
	return decodedToken;
};

// 계약현황 목록 조회
exports.getContractList = async (req, res, next) => {
	try {
		verifyAdminToken(req);

		const {
			page = 1,
			status,
			startDate,
			endDate,
			searchString,
			order = 'DESC',
			limit = 50,
		} = req.query;

		// WHERE 조건 구성
		const buildWhereConditions = () => {
			const conditions = ['1=1'];
			const values = [];

			if (startDate && endDate) {
				conditions.push('RC.contractDate BETWEEN ? AND ?');
				values.push(startDate, endDate);
			}

			if (searchString) {
				conditions.push(
					'(G.esntlId LIKE ? OR G.name LIKE ? OR C.name LIKE ? OR C.phone LIKE ?)'
				);
				const searchPattern = `%${searchString}%`;
				values.push(searchPattern, searchPattern, searchPattern, searchPattern);
			}

			if (status) {
				conditions.push('RC.status = ?');
				values.push(status);
			}

			return { whereClause: conditions.join(' AND '), values };
		};

		const { whereClause, values: whereValues } = buildWhereConditions();
		const orderDirection = order === 'ASC' ? 'ASC' : 'DESC';
		const pageNum = parseInt(page);
		const limitNum = parseInt(limit);
		const offset = (pageNum - 1) * limitNum;

		// 메인 데이터 조회 쿼리
		const mainQuery = `
			SELECT 
				RC.esntlId,
				SUBSTRING_INDEX(SUBSTRING_INDEX(G.address, ' ', 2), ' ', -2) AS region,
				RC.contractDate,
				COALESCE(PL.pTime, '') AS pTime,
				RC.startDate,
				RC.endDate,
				RC.month,
				RC.gosiwonEsntlId,
				G.name AS gosiwonName,
				G.address AS gosiwonAddress,
				RC.contract,
				RC.spacialContract,
				R.roomNumber,
				R.roomType,
				R.window,
				C.name AS customerName,
				C.phone AS customerPhone,
				C.gender,
				FLOOR((CAST(REPLACE(CURRENT_DATE,'-','') AS UNSIGNED) - CAST(REPLACE(C.birth,'-','') AS UNSIGNED)) / 10000) AS age,
				COALESCE(PL.pyl_goods_amount, 0) AS pyl_goods_amount,
				FORMAT(COALESCE(PL.paymentAmount, 0), 0) AS paymentAmount,
				COALESCE(PL.paymentAmount, 0) AS payment_amount,
				FORMAT(COALESCE(PL.paymentPoint, 0), 0) AS paymentPoint,
				FORMAT(COALESCE(PL.paymentCoupon, 0), 0) AS paymentCoupon,
				FORMAT(COALESCE(PL.cAmount, 0), 0) AS cAmount,
				FORMAT(COALESCE(PL.cPercent, 0), 0) AS cPercent,
				1 AS paymentCount,
				COUNT(*) OVER() AS totcnt
			FROM roomContract RC
			JOIN gosiwon G ON RC.gosiwonEsntlId = G.esntlId
			JOIN customer C ON RC.customerEsntlId = C.esntlId
			JOIN room R ON RC.roomEsntlId = R.esntlId
			LEFT JOIN (
				SELECT 
					contractEsntlId,
					pTime,
					pyl_goods_amount,
					SUM(paymentAmount) AS paymentAmount,
					SUM(paymentPoint) AS paymentPoint,
					SUM(paymentCoupon) AS paymentCoupon,
					SUM(cAmount) AS cAmount,
					AVG(cPercent) AS cPercent
				FROM paymentLog 
				GROUP BY contractEsntlId
			) PL ON RC.esntlId = PL.contractEsntlId
			WHERE ${whereClause}
			ORDER BY RC.contractDate ${orderDirection}, COALESCE(PL.pTime, '') ${orderDirection}
			LIMIT ? OFFSET ?
		`;

		// 합계 조회 쿼리
		const summaryQuery = `
			SELECT 
				FORMAT(COALESCE(SUM(PL.paymentAmount), 0), 0) AS paymentAmount,
				FORMAT(COALESCE(SUM(PL.paymentPoint), 0), 0) AS paymentPoint,
				FORMAT(COALESCE(SUM(PL.paymentCoupon), 0), 0) AS paymentCoupon,
				FORMAT(COALESCE(SUM(PL.cAmount), 0), 0) AS cAmount,
				FORMAT(COALESCE(AVG(PL.cPercent), 0), 0) AS cPercent
			FROM roomContract RC
			JOIN gosiwon G ON RC.gosiwonEsntlId = G.esntlId
			JOIN customer C ON RC.customerEsntlId = C.esntlId
			LEFT JOIN paymentLog PL ON RC.esntlId = PL.contractEsntlId
			WHERE ${whereClause}
		`;

		// 쿼리 실행
		const mainValues = [...whereValues, limitNum, offset];
		const mainResult = await mariaDBSequelize.query(mainQuery, {
			replacements: mainValues,
			type: mariaDBSequelize.QueryTypes.SELECT,
		});

		const summaryResult = await mariaDBSequelize.query(summaryQuery, {
			replacements: whereValues,
			type: mariaDBSequelize.QueryTypes.SELECT,
		});

		// 전체 개수 조회 (페이징 없이)
		const countQuery = `
			SELECT COUNT(*) AS total
			FROM roomContract RC
			JOIN gosiwon G ON RC.gosiwonEsntlId = G.esntlId
			JOIN customer C ON RC.customerEsntlId = C.esntlId
			WHERE ${whereClause}
		`;

		const countResult = await mariaDBSequelize.query(countQuery, {
			replacements: whereValues,
			type: mariaDBSequelize.QueryTypes.SELECT,
		});

		const totalCount = countResult[0]?.total || 0;
		const resultList = Array.isArray(mainResult) ? mainResult : [];
		const summary = summaryResult[0] || {};

		// 응답 데이터 구성
		const response = {
			resultList: resultList,
			totcnt: totalCount,
			totPaymentAmount: summary.paymentAmount || '0',
			totPaymentPoint: summary.paymentPoint || '0',
			totPaymentCoupon: summary.paymentCoupon || '0',
			totCAmount: summary.cAmount || '0',
			totCPercent: summary.cPercent || '0',
			page: pageNum,
			limit: limitNum,
			totalPages: Math.ceil(totalCount / limitNum),
		};

		errorHandler.successThrow(res, '계약현황 목록 조회 성공', response);
	} catch (err) {
		next(err);
	}
};

// 계약 상세보기 (결제 내역 조회)
exports.getContractDetail = async (req, res, next) => {
	try {
		verifyAdminToken(req);

		const { contractEsntlId } = req.query;

		if (!contractEsntlId) {
			errorHandler.errorThrow(400, 'contractEsntlId를 입력해주세요.');
		}

		// 결제 내역 조회 쿼리
		const query = `
			SELECT 
				pDate,
				pTime,
				pyl.pyl_goods_amount AS pyl_goods_amount,
				FORMAT(IFNULL(paymentAmount, 0), 0) AS paymentAmount,
				FORMAT(IFNULL(paymentPoint, 0), 0) AS paymentPoint,
				FORMAT(IFNULL(paymentCoupon, 0), 0) AS paymentCoupon,
				ucp.name AS couponName,
				paymentType
			FROM paymentLog AS pyl
			LEFT JOIN userCoupon AS ucp
				ON pyl.ucp_eid = ucp.esntlId
			WHERE contractEsntlId = ?
		`;

		const result = await mariaDBSequelize.query(query, {
			replacements: [contractEsntlId],
			type: mariaDBSequelize.QueryTypes.SELECT,
		});

		const resultList = Array.isArray(result) ? result : [];

		errorHandler.successThrow(res, '계약 상세보기 조회 성공', {
			resultList: resultList,
		});
	} catch (err) {
		next(err);
	}
};
