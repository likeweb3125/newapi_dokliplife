const moment = require('moment');
const { Op, Sequelize } = require('sequelize');
const {
	i_logs,
	sequelize,
	i_board,
	i_board_comment,
	i_member,
	mariaDBSequelize,
} = require('../models');
const errorHandler = require('../middleware/error');
const enumConfig = require('../middleware/enum');
const { QueryTypes } = require('sequelize');
const logs = require('../models/logs');

// 전체통계
// 2023.09.12 ash
exports.getStatCnt = async (req, res, next) => {
	try {
		const logsTopUrl = await i_logs.findOne({
			attributes: [
				[
					mariaDBSequelize.fn(
						'COUNT',
						mariaDBSequelize.col('id')
					),
					'CNT',
				],
				'previousUrl',
			],
			group: ['previousUrl'],
			order: [[mariaDBSequelize.literal('CNT'), 'DESC']],
			limit: 1,
		});

		const logsTopAgent = await i_logs.findOne({
			attributes: [
				[
					mariaDBSequelize.fn(
						'COUNT',
						mariaDBSequelize.col('id')
					),
					'CNT',
				],
				'userAgent',
			],
			group: ['userAgent'],
			order: [[mariaDBSequelize.literal('CNT'), 'DESC']],
			limit: 1,
		});

		const logsTotalCnt = await i_logs.count();

		const userTotalCnt = await i_member.count();

		const boardTotalCnt = await i_board.count();

		const commentTotalCnt = await i_board_comment.count();

		const statObj = {
			logsTopUrl: logsTopUrl,
			logsTopAgent: logsTopAgent,
			logsTotalCnt: logsTotalCnt,
			userTotalCnt: userTotalCnt,
			boardTotalCnt: boardTotalCnt,
			commentTotalCnt: commentTotalCnt,
		};

		//res.status(200).json(adminMainResult);
		errorHandler.successThrow(res, '', statObj);
	} catch (err) {
		next(err);
	}
};

// 기간별 현황 통계
// 2023.09.13 ash
exports.getPeriodStatCnt = async (req, res, next) => {
	const { start, end } = req.query;

	const currentDate = new Date();

	const startDate =
		moment(start).add(0, 'day').format('YYYY-MM-DD') ||
		moment(currentDate).add(-7, 'day').format('YYYY-MM-DD');
	const endDate =
		moment(end).add(0, 'day').format('YYYY-MM-DD') ||
		moment(currentDate).format('YYYY-MM-DD');

	try {
		const query1 = `
      SELECT DATE_FORMAT(DateRange.date, '%Y.%m.%d') as date , IFNULL(logsCount, 0) AS logsCnt, IFNULL(userCount, 0) AS userCnt,
      IFNULL(boardCount, 0) AS boardCnt, IFNULL(commentCount, 0) AS commentCnt
      FROM (
         SELECT '${startDate}' AS date
         UNION ALL
         SELECT DATE_ADD(date, INTERVAL 1 DAY)
         FROM (
            SELECT '${startDate}' AS date`;
		let query2 = '';
		for (
			let date = moment(startDate);
			date.isBefore(endDate);
			date.add(1, 'day')
		) {
			query2 += ` UNION ALL
               SELECT DATE_ADD('${date.format(
				'YYYY.MM.DD'
			)}', INTERVAL 1 DAY) `;
		}
		const query3 = `  ) AS DateRange
      WHERE date < '${endDate}'
      ) AS DateRange
      LEFT JOIN (
      SELECT DATE(reg_date) AS date, COUNT(*) AS logsCount
      FROM i_logs
      WHERE DATE(reg_date) BETWEEN '${startDate}' AND '${endDate}'
      GROUP BY date
      ) AS LogCounts ON DateRange.date = LogCounts.date
      LEFT JOIN (
         SELECT DATE(reg_date) AS date, COUNT(*) AS userCount
      FROM i_member
      WHERE DATE(reg_date) BETWEEN '${startDate}' AND '${endDate}'
      GROUP BY date
      ) AS userCnt On DateRange.date = userCnt.date
      LEFT JOIN (
         SELECT DATE(b_reg_date) AS date, COUNT(*) AS boardCount
      FROM i_board
      WHERE DATE(b_reg_date) BETWEEN '${startDate}' AND '${endDate}'
      GROUP BY date
      ) AS boardCnt On DateRange.date = boardCnt.date
      LEFT JOIN (
         SELECT DATE(c_reg_date) AS date, COUNT(*) AS commentCount
      FROM i_board_comment
      WHERE DATE(c_reg_date) BETWEEN '${startDate}' AND '${endDate}'
      GROUP BY date
      ) AS commentCnt On DateRange.date = commentCnt.date
      ORDER BY DateRange.date desc; `;

		// console.log(query3);
		const countsByDate = await mariaDBSequelize.query(
			query1 + query2 + query3,
			{
				type: QueryTypes.SELECT,
			}
		);
		//console.log(countsByDate);
		if (!countsByDate || countsByDate.length === 0) {
			errorHandler.errorThrow(404, '');
		}

		let totalLogCnt = 0;
		let totalUserCnt = 0;
		let totalBoardCnt = 0;
		let totalCommentCnt = 0;
		for (let i = 0; i < countsByDate.length; i++) {
			//console.log(countsByDate[i].logsCnt);
			totalLogCnt += countsByDate[i].logsCnt;
			totalUserCnt += countsByDate[i].userCnt;
			totalBoardCnt += countsByDate[i].boardCnt;
			totalCommentCnt += countsByDate[i].commentCnt;
		}

		//res.status(200).json(adminMainResult);
		errorHandler.successThrow(res, '', {
			totalLogCnt: totalLogCnt,
			totalUserCnt: totalUserCnt,
			totalBoardCnt: totalBoardCnt,
			totalCommentCnt: totalCommentCnt,
			list: countsByDate,
		});
	} catch (err) {
		next(err);
	}
};

// chart 통계
exports.getPeriodStatChart = async (req, res, next) => {
	try {
		const { start, end, type } = req.query;
		const currentDate = new Date();
		let startDate;
		let endDate;

		if (type === 'daily') {
			startDate =
				moment(start).add(0, 'day').format('YYYY-MM-DD') ||
				moment(currentDate)
					.add(-7, 'day')
					.format('YYYY-MM-DD');
			endDate =
				moment(end).add(0, 'day').format('YYYY-MM-DD') ||
				moment(currentDate).format('YYYY-MM-DD');
		} else if (type === 'monthly') {
			startDate =
				moment(start)
					.add(0, 'month')
					.startOf('month')
					.format('YYYY-MM') ||
				moment(currentDate)
					.add(-1, 'month')
					.startOf('month')
					.format('YYYY-MM');
			endDate =
				moment(end)
					.add(0, 'month')
					.endOf('month')
					.format('YYYY-MM') ||
				moment(currentDate)
					.endOf('month')
					.format('YYYY-MM');
		} else {
			// Handle unknown type or default to daily
			startDate =
				moment(start).add(0, 'day').format('YYYY-MM-DD') ||
				moment(currentDate)
					.add(-7, 'day')
					.format('YYYY-MM-DD');
			endDate =
				moment(end).add(0, 'day').format('YYYY-MM-DD') ||
				moment(currentDate).format('YYYY-MM-DD');
		}

		const dateRange = generateDateRange(startDate, endDate, type);

		const logsCounts = await getCounts(
			i_logs,
			'id',
			'reg_date',
			dateRange
		);
		const memberCounts = await getCounts(
			i_member,
			'idx',
			'reg_date',
			dateRange
		);
		const boardCounts = await getCounts(
			i_board,
			'idx',
			'b_reg_date',
			dateRange
		);
		const commentCounts = await getCounts(
			i_board_comment,
			'idx',
			'c_reg_date',
			dateRange
		);

		const maxCount = Math.max(
			getMaxCount(logsCounts),
			getMaxCount(memberCounts),
			getMaxCount(boardCounts),
			getMaxCount(commentCounts)
		);

		const chartObj = {
			type: 'line',
			scales: `{y: {max: '${maxCount}'}}`,
			legendPosition: 'top',
			label: 'true',
			labels: dateRange,
			datasets: [
				{
					label: '방문',
					data: getChartData(dateRange, logsCounts),
				},
				{
					label: '가입회원',
					data: getChartData(dateRange, memberCounts),
				},
				{
					label: '게시글',
					data: getChartData(dateRange, boardCounts),
				},
				{
					label: '댓글',
					data: getChartData(dateRange, commentCounts),
				},
			],
		};

		errorHandler.successThrow(res, '', chartObj);
	} catch (err) {
		next(err);
	}
};

//chart 통계 날짜 배열
function generateDateRange(startDate, endDate, type) {
	const dateRange = [];
	let currentDate = moment(startDate);

	while (currentDate <= moment(endDate)) {
		dateRange.push(
			type === 'monthly'
				? currentDate.format('YYYY-MM')
				: currentDate.format('YYYY-MM-DD')
		);
		currentDate.add(1, type === 'monthly' ? 'month' : 'day');
	}

	return dateRange;
}

//chart 통계 갯수 불러오기
async function getCounts(model, idColumn, dateColumn, dateRange) {
	return await model.findAll({
		attributes: [
			[
				mariaDBSequelize.fn(
					'DATE_FORMAT',
					mariaDBSequelize.col(dateColumn),
					'%Y-%m-%d'
				),
				'date',
			],
			[
				mariaDBSequelize.fn(
					'COUNT',
					mariaDBSequelize.col(idColumn)
				),
				'count',
			],
		],
		where: {
			[dateColumn]: {
				[Op.between]: [
					dateRange[0],
					dateRange[dateRange.length - 1],
				],
			},
		},
		group: [
			mariaDBSequelize.fn(
				'DATE_FORMAT',
				mariaDBSequelize.col(dateColumn),
				'%Y-%m-%d'
			),
		],
		raw: true,
	});
}

//chart 통계 Max 값
function getMaxCount(counts) {
	return Math.max(...counts.map((entry) => entry.count));
}

//chart 통계 갯수 표기
function getChartData(dateRange, counts) {
	const countMap = new Map(counts.map(({ date, count }) => [date, count]));
	return dateRange.map((date) => countMap.get(date) || 0);
}

exports.getStatHistory = async (req, res, next) => {
	const { start, end, getLimit, getPage, searchTxt } = req.query;

	const currentDate = new Date();

	const startDate =
		moment(start).add(0, 'day').format('YYYY-MM-DD') ||
		moment(currentDate).add(-7, 'day').format('YYYY-MM-DD');
	const endDate =
		moment(end).add(0, 'day').format('YYYY-MM-DD') ||
		moment(currentDate).format('YYYY-MM-DD');

	const page = parseInt(getPage) || 1;
	const searchTxtQuery = searchTxt;

	const limit = parseInt(getLimit) || 10;
	const offset = (page - 1) * limit;

	try {
		const logsList = await i_logs.findAndCountAll({
			offset: offset,
			limit: limit,
			order: [['id', 'DESC']],
			attributes: [
				'id',
				'user',
				'clientIp',
				'previousUrl',
				'userAgent',
				'reg_date',
			],
		});

		const lastPage = Math.ceil(logsList.count / limit);
		const maxPage = 10;
		const startPage = Math.max(
			1,
			Math.floor((page - 1) / maxPage) * maxPage + 1
		);
		const endPage = Math.min(lastPage, startPage + maxPage - 1);

		const logsResult = logsList.rows.map((list) => ({
			id: list.id,
			user: list.user,
			b_title: list.b_title,
			clientIp: list.clientIp,
			previousUrl: list.previousUrl,
			userAgent: list.userAgent,
			reg_date: moment.utc(list.reg_date).format('YYYY.MM.DD'),
		}));

		const logsTopUrl = await i_logs.findOne({
			attributes: [
				[
					mariaDBSequelize.fn(
						'COUNT',
						mariaDBSequelize.col('id')
					),
					'CNT',
				],
				'previousUrl',
			],
			group: ['previousUrl'],
			order: [[mariaDBSequelize.literal('CNT'), 'DESC']],
			limit: 1,
		});

		const logsTopAgent = await i_logs.findOne({
			attributes: [
				[
					mariaDBSequelize.fn(
						'COUNT',
						mariaDBSequelize.col('id')
					),
					'CNT',
				],
				'userAgent',
			],
			group: ['userAgent'],
			order: [[mariaDBSequelize.literal('CNT'), 'DESC']],
			limit: 1,
		});

		errorHandler.successThrow(res, '', {
			logsTopUrl: logsTopUrl,
			logsTopAgent: logsTopAgent,
			limit: limit,
			current_page: page,
			start_page: startPage,
			max_page: maxPage,
			last_page: lastPage,
			end_page: endPage,
			total_count: logsList.count,
			logs_list: logsResult,
		});
	} catch (err) {
		next(err);
	}
};

exports.getStatUrl = async (req, res, next) => {
	try {
		const urlResult = await i_logs.findAll({
			attributes: [
				[
					mariaDBSequelize.literal(
						'ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC)'
					),
					'row_number',
				],
				'previousUrl',
				[
					mariaDBSequelize.fn(
						'COUNT',
						mariaDBSequelize.col('*')
					),
					'cnt',
				],
			],
			group: ['previousUrl'],
			order: [
				[
					mariaDBSequelize.fn(
						'COUNT',
						mariaDBSequelize.col('*')
					),
					'DESC',
				],
			],
			limit: 20,
		});
		//console.log(urlResult);
		errorHandler.successThrow(res, '', urlResult);
	} catch (err) {
		next(err);
	}
};

exports.getStatAgent = async (req, res, next) => {
	try {
		const result = await i_logs.findAll({
			attributes: [
				[
					mariaDBSequelize.literal(
						'ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC)'
					),
					'row_number',
				],
				'userAgent',
				[
					mariaDBSequelize.fn(
						'COUNT',
						mariaDBSequelize.col('*')
					),
					'cnt',
				],
			],
			group: ['userAgent'],
			order: [
				[
					mariaDBSequelize.fn(
						'COUNT',
						mariaDBSequelize.col('*')
					),
					'DESC',
				],
			],
			limit: 20,
		});
		console.log(result);

		errorHandler.successThrow(res, '', result);
	} catch (err) {
		next(err);
	}
};

// 실시간 매출 현황 조회
exports.getRealTimeStats = async (req, res, next) => {
	try {
		const { year, month, day } = req.body;

		if (!year || !month || !day) {
			errorHandler.errorThrow(400, 'year, month, day는 필수입니다.');
		}

		// 월, 일을 2자리로 포맷팅
		const monthFormatted = String(month).padStart(2, '0');
		const dayFormatted = String(day).padStart(2, '0');

		// 오늘 날짜 (서울 시간 기준)
		const now = new Date();
		const seoulTime = new Date(now.getTime() + 9 * 60 * 60 * 1000);
		const todayYear = seoulTime.getUTCFullYear();
		const todayMonth = String(seoulTime.getUTCMonth() + 1).padStart(2, '0');
		const todayDay = String(seoulTime.getUTCDate()).padStart(2, '0');
		const todayDateStr = `${todayYear}-${todayMonth}-${todayDay}`;

		const targetDateStr = `${year}-${monthFormatted}-${dayFormatted}`;
		const yearInt = parseInt(year);
		const monthInt = parseInt(monthFormatted);

		// SQL 쿼리: paymentLog 테이블에서 결제/환불 통계 조회
		// 기존 selectPaymentSummery 함수와 동일한 로직 사용
		// paymentType 컬럼 사용 (REFUND면 'Refund', 아니면 'Payment')
		const query = `
			SELECT 
				'TODAY' AS type,
				IF(pl.paymentType = 'REFUND', 'Refund', 'Payment') AS paymentType,
				COUNT(pl.paymentAmount) AS paymentTypeCnt,
				CAST(SUM(CAST(pl.paymentAmount AS DECIMAL(20, 0))) AS UNSIGNED) AS paymentAmount,
				CAST(SUM(CAST(COALESCE(NULLIF(pl.calAmount, ''), '0') AS DECIMAL(20, 0))) AS UNSIGNED) AS calAmount
			FROM paymentLog pl
			WHERE 1=1
				AND pl.pDate = CURDATE()
				AND pl.calculateStatus = 'SUCCESS'
				AND pl.gosiwonEsntlId <> 'GOSI0000000199'
			GROUP BY IF(pl.paymentType = 'REFUND', 'Refund', 'Payment')
			
			UNION ALL
			
			SELECT 
				'YEAR' AS type,
				IF(pl.paymentType = 'REFUND', 'Refund', 'Payment') AS paymentType,
				COUNT(pl.paymentAmount) AS paymentTypeCnt,
				CAST(SUM(CAST(pl.paymentAmount AS DECIMAL(20, 0))) AS UNSIGNED) AS paymentAmount,
				CAST(SUM(CAST(COALESCE(NULLIF(pl.calAmount, ''), '0') AS DECIMAL(20, 0))) AS UNSIGNED) AS calAmount
			FROM paymentLog pl
			WHERE 1=1
				AND pl.pDate LIKE CONCAT(?, '%')
				AND pl.calculateStatus = 'SUCCESS'
				AND pl.gosiwonEsntlId <> 'GOSI0000000199'
			GROUP BY IF(pl.paymentType = 'REFUND', 'Refund', 'Payment')
			
			UNION ALL
			
			SELECT 
				'MONTH' AS type,
				IF(pl.paymentType = 'REFUND', 'Refund', 'Payment') AS paymentType,
				COUNT(pl.paymentAmount) AS paymentTypeCnt,
				CAST(SUM(CAST(pl.paymentAmount AS DECIMAL(20, 0))) AS UNSIGNED) AS paymentAmount,
				CAST(SUM(CAST(COALESCE(NULLIF(pl.calAmount, ''), '0') AS DECIMAL(20, 0))) AS UNSIGNED) AS calAmount
			FROM paymentLog pl
			WHERE 1=1
				AND pl.pDate LIKE CONCAT(?, '%')
				AND pl.calculateStatus = 'SUCCESS'
				AND pl.gosiwonEsntlId <> 'GOSI0000000199'
			GROUP BY IF(pl.paymentType = 'REFUND', 'Refund', 'Payment')
			
			UNION ALL
			
			SELECT 
				'DAY' AS type,
				IF(pl.paymentType = 'REFUND', 'Refund', 'Payment') AS paymentType,
				COUNT(pl.paymentAmount) AS paymentTypeCnt,
				CAST(SUM(CAST(pl.paymentAmount AS DECIMAL(20, 0))) AS UNSIGNED) AS paymentAmount,
				CAST(SUM(CAST(COALESCE(NULLIF(pl.calAmount, ''), '0') AS DECIMAL(20, 0))) AS UNSIGNED) AS calAmount
			FROM paymentLog pl
			WHERE 1=1
				AND pl.pDate = ?
				AND pl.calculateStatus = 'SUCCESS'
				AND pl.gosiwonEsntlId <> 'GOSI0000000199'
			GROUP BY IF(pl.paymentType = 'REFUND', 'Refund', 'Payment')
			ORDER BY type, paymentType
		`;

		const rows = await mariaDBSequelize.query(query, {
			replacements: [
				`${year}`, // YEAR: LIKE '2025%'
				`${year}-${monthFormatted}`, // MONTH: LIKE '2025-07%'
				targetDateStr, // DAY: = '2025-07-01'
			],
			type: mariaDBSequelize.QueryTypes.SELECT,
		});

		errorHandler.successThrow(res, '실시간 매출 현황 조회 성공', rows);
	} catch (err) {
		next(err);
	}
};

// 실시간 매출 현황 상세 목록 조회
exports.getRealTimeList = async (req, res, next) => {
	try {
		const { date, page = 1, limit = 10, start = 0, length = 10 } = req.body;

		if (!date) {
			errorHandler.errorThrow(400, 'date는 필수입니다.');
		}

		// DataTables 파라미터 처리
		const pageNum = parseInt(page) || Math.floor(parseInt(start) / parseInt(length)) + 1 || 1;
		const limitNum = parseInt(limit) || parseInt(length) || 10;
		const offset = (pageNum - 1) * limitNum;

		// 메인 쿼리
		const mainQuery = `
			SELECT 
				pl.esntlId,
				pl.pDate,
				pl.pTime,
				pl.paymentType,
				pl.isExtra,
				pl.contractEsntlId AS contractEsntlId,
				pl.gosiwonEsntlId,
				(SELECT name FROM gosiwon WHERE esntlId = pl.gosiwonEsntlId) AS gosiwonName,
				pl.roomEsntlId AS roomEsntlId,
				(SELECT roomNumber FROM room WHERE esntlId = pl.roomEsntlId) AS roomName,
				pl.customerEsntlId,
				c.name AS customerName,
				ROUND((TO_DAYS(NOW()) - (TO_DAYS(c.birth))) / 365) AS age,
				c.gender,
				r.deposit AS roomDeposit,
				gu.deposit AS gosiwonDeposit,
				pl.paymentAmount,
				pl.paymentPoint,
				pl.paymentCoupon,
				pl.collectPoint,
				pl.code,
				pl.reason,
				pl.calAmount,
				pl.imp_uid,
				pl.cAmount,
				pl.cPercent,
				pl.calculateStatus,
				pl.tid,
				CASE
					WHEN pl.paymentType = 'REFUND' THEN rc.cancelStatus
					WHEN (SELECT COUNT(*)
						FROM roomContract rc2
						WHERE pl.contractEsntlId = rc2.esntlId
							AND rc2.checkInTime LIKE 'RCTT%') = 0 THEN '입실료'
					ELSE '추가결제'
				END AS contractType
			FROM paymentLog pl
			LEFT JOIN customer c ON pl.customerEsntlId = c.esntlId
			JOIN room r ON pl.roomEsntlId = r.esntlId
			JOIN gosiwonUse gu ON pl.gosiwonEsntlId = gu.esntlId
			JOIN roomContract AS rc ON rc.esntlId = pl.contractEsntlId
			WHERE 1=1
				AND pl.calculateStatus = 'SUCCESS'
				AND pl.pDate LIKE CONCAT(?, '%')
			ORDER BY pl.esntlId DESC
			LIMIT ? OFFSET ?
		`;

		// 전체 개수 조회 쿼리
		const countQuery = `
			SELECT COUNT(*) AS total
			FROM paymentLog pl
			LEFT JOIN customer c ON pl.customerEsntlId = c.esntlId
			JOIN room r ON pl.roomEsntlId = r.esntlId
			JOIN gosiwonUse gu ON pl.gosiwonEsntlId = gu.esntlId
			JOIN roomContract AS rc ON rc.esntlId = pl.contractEsntlId
			WHERE 1=1
				AND pl.calculateStatus = 'SUCCESS'
				AND pl.pDate LIKE CONCAT(?, '%')
		`;

		const [rows, countResult] = await Promise.all([
			mariaDBSequelize.query(mainQuery, {
				replacements: [date, limitNum, offset],
				type: mariaDBSequelize.QueryTypes.SELECT,
			}),
			mariaDBSequelize.query(countQuery, {
				replacements: [date],
				type: mariaDBSequelize.QueryTypes.SELECT,
			}),
		]);

		const totalCount = countResult[0]?.total || 0;

		// deposit 필드 계산 및 고유값 생성
		const data = rows.map((ele) => {
			let deposit = 0;
			if (ele.roomDeposit === null && ele.gosiwonDeposit === null) {
				deposit = 0;
			} else if (ele.roomDeposit === null && ele.gosiwonDeposit !== null) {
				deposit = ele.gosiwonDeposit * 10000;
			} else {
				deposit = ele.roomDeposit;
			}

			// pDate에서 날짜 추출 (YYYY-MM-DD 형식 → YYYYMMDD)
			let dateStr = '';
			if (ele.pDate) {
				// pDate가 "2025-07-31" 형식이면 "20250731"로 변환
				dateStr = ele.pDate.replace(/-/g, '');
			}

			// esntlId에서 숫자 부분 추출하고 앞의 0 제거 (예: PYLG0000048259 → 48259)
			let esntlIdNumeric = '';
			if (ele.esntlId) {
				const numericPart = ele.esntlId.replace(/\D/g, '');
				// 앞의 0 제거
				esntlIdNumeric = numericPart.replace(/^0+/, '') || '0';
			}

			// uniqueId 생성: 날짜(YYYYMMDD) + 숫자 부분(앞의 0 제거)
			const uniqueId = dateStr && esntlIdNumeric ? `${dateStr}${esntlIdNumeric}` : null;

			const {
				esntlId,
				pDate,
				pTime,
				paymentType,
				isExtra,
				contractEsntlId,
				gosiwonEsntlId,
				gosiwonName,
				roomEsntlId,
				roomName,
				customerEsntlId,
				customerName,
				age,
				gender,
				roomDeposit,
				gosiwonDeposit,
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
				tid,
				contractType,
			} = ele;

			// isExtra 값을 payType으로 변환 (0: checkInPay, 1: extraPay)
			let payType = null;
			if (isExtra === 0 || isExtra === '0' || isExtra === false) {
				payType = 'checkInPay';
			} else if (isExtra === 1 || isExtra === '1' || isExtra === true) {
				payType = 'extraPay';
			}

			return {
				esntlId,
				uniqueId: uniqueId,
				pDate,
				pTime,
				payMethod: paymentType || null,
				payType: payType,
				isExtra: isExtra,
				contractEsntlId,
				gosiwonEsntlId,
				gosiwonName,
				roomEsntlId,
				roomName,
				customerEsntlId,
				customerName,
				age,
				gender,
				roomDeposit,
				gosiwonDeposit,
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
				tid,
				contractType,
				deposit: deposit,
			};
		});

		// DataTables 형식으로 응답
		const result = {
			data: data,
			recordsTotal: totalCount,
			recordsFiltered: totalCount,
			draw: req.body.draw || 1,
		};

		errorHandler.successThrow(res, '실시간 매출 현황 상세 목록 조회 성공', result);
	} catch (err) {
		next(err);
	}
};

// 계약현황 통계 조회
exports.getContractStats = async (req, res, next) => {
	try {
		const { year, month, day } = req.body;

		if (!year || !month || !day) {
			errorHandler.errorThrow(400, 'year, month, day는 필수입니다.');
		}

		// 월, 일을 2자리로 포맷팅
		const monthFormatted = String(month).padStart(2, '0');
		const dayFormatted = String(day).padStart(2, '0');

		// 오늘 날짜 (서울 시간 기준)
		const now = new Date();
		const seoulTime = new Date(now.getTime() + 9 * 60 * 60 * 1000);
		const todayYear = seoulTime.getUTCFullYear();
		const todayMonth = String(seoulTime.getUTCMonth() + 1).padStart(2, '0');
		const todayDay = String(seoulTime.getUTCDate()).padStart(2, '0');
		const todayDateStr = `${todayYear}-${todayMonth}-${todayDay}`;

		const targetDateStr = `${year}-${monthFormatted}-${dayFormatted}`;
		const yearInt = parseInt(year);
		const monthInt = parseInt(monthFormatted);
		const dayInt = parseInt(dayFormatted);

		// 한 해 전, 한 달 전, 하루 전 날짜 계산
		// YEAR_AGO: 한 해 전의 같은 연도 전체
		const oneYearAgoYear = yearInt - 1;
		
		// MONTH_AGO: 한 달 전의 같은 월 전체
		const oneMonthAgoDate = new Date(yearInt, monthInt - 1, 1);
		oneMonthAgoDate.setMonth(oneMonthAgoDate.getMonth() - 1);
		const oneMonthAgoYear = oneMonthAgoDate.getFullYear();
		const oneMonthAgoMonth = oneMonthAgoDate.getMonth() + 1;
		
		// DAY_AGO: 하루 전 날짜
		const oneDayAgoDate = new Date(yearInt, monthInt - 1, dayInt);
		oneDayAgoDate.setDate(oneDayAgoDate.getDate() - 1);
		const oneDayAgoYear = oneDayAgoDate.getFullYear();
		const oneDayAgoMonth = oneDayAgoDate.getMonth() + 1;
		const oneDayAgoDay = oneDayAgoDate.getDate();
		const oneDayAgo = `${oneDayAgoYear}-${String(oneDayAgoMonth).padStart(2, '0')}-${String(oneDayAgoDay).padStart(2, '0')}`;

		// 1) 건수: roomContract (contractDate 기준)
		const countQuery = `
			SELECT 'YEAR' AS period,
				COUNT(CASE WHEN status != 'CANCEL' THEN 1 END) AS paymentCnt,
				COUNT(CASE WHEN status = 'CANCEL' THEN 1 END) AS refundCnt
			FROM roomContract WHERE YEAR(contractDate) = ?
			UNION ALL
			SELECT 'MONTH',
				COUNT(CASE WHEN status != 'CANCEL' THEN 1 END),
				COUNT(CASE WHEN status = 'CANCEL' THEN 1 END)
			FROM roomContract WHERE YEAR(contractDate) = ? AND MONTH(contractDate) = ?
			UNION ALL
			SELECT 'DAY',
				COUNT(CASE WHEN status != 'CANCEL' THEN 1 END),
				COUNT(CASE WHEN status = 'CANCEL' THEN 1 END)
			FROM roomContract WHERE DATE(contractDate) = ?
			UNION ALL
			SELECT 'YEAR_AGO',
				COUNT(CASE WHEN status != 'CANCEL' THEN 1 END),
				COUNT(CASE WHEN status = 'CANCEL' THEN 1 END)
			FROM roomContract WHERE YEAR(contractDate) = ?
			UNION ALL
			SELECT 'MONTH_AGO',
				COUNT(CASE WHEN status != 'CANCEL' THEN 1 END),
				COUNT(CASE WHEN status = 'CANCEL' THEN 1 END)
			FROM roomContract WHERE YEAR(contractDate) = ? AND MONTH(contractDate) = ?
			UNION ALL
			SELECT 'DAY_AGO',
				COUNT(CASE WHEN status != 'CANCEL' THEN 1 END),
				COUNT(CASE WHEN status = 'CANCEL' THEN 1 END)
			FROM roomContract WHERE DATE(contractDate) = ?
		`;

		// 2) 금액: paymentLog + roomContract (contractDate 기준, calculateStatus SUCCESS)
		const amountQuery = `
			SELECT 'YEAR' AS period,
				CAST(COALESCE(SUM(CASE WHEN pl.paymentType != 'REFUND' THEN CAST(pl.paymentAmount AS DECIMAL(20,0)) ELSE 0 END), 0) AS UNSIGNED) AS paymentAmount,
				CAST(COALESCE(SUM(CASE WHEN pl.paymentType = 'REFUND' THEN CAST(pl.paymentAmount AS DECIMAL(20,0)) ELSE 0 END), 0) AS UNSIGNED) AS refundAmount
			FROM paymentLog pl
			JOIN roomContract rc ON pl.contractEsntlId = rc.esntlId
			WHERE pl.calculateStatus = 'SUCCESS' AND pl.gosiwonEsntlId <> 'GOSI0000000199'
				AND YEAR(rc.contractDate) = ?
			UNION ALL
			SELECT 'MONTH',
				CAST(COALESCE(SUM(CASE WHEN pl.paymentType != 'REFUND' THEN CAST(pl.paymentAmount AS DECIMAL(20,0)) ELSE 0 END), 0) AS UNSIGNED),
				CAST(COALESCE(SUM(CASE WHEN pl.paymentType = 'REFUND' THEN CAST(pl.paymentAmount AS DECIMAL(20,0)) ELSE 0 END), 0) AS UNSIGNED)
			FROM paymentLog pl
			JOIN roomContract rc ON pl.contractEsntlId = rc.esntlId
			WHERE pl.calculateStatus = 'SUCCESS' AND pl.gosiwonEsntlId <> 'GOSI0000000199'
				AND YEAR(rc.contractDate) = ? AND MONTH(rc.contractDate) = ?
			UNION ALL
			SELECT 'DAY',
				CAST(COALESCE(SUM(CASE WHEN pl.paymentType != 'REFUND' THEN CAST(pl.paymentAmount AS DECIMAL(20,0)) ELSE 0 END), 0) AS UNSIGNED),
				CAST(COALESCE(SUM(CASE WHEN pl.paymentType = 'REFUND' THEN CAST(pl.paymentAmount AS DECIMAL(20,0)) ELSE 0 END), 0) AS UNSIGNED)
			FROM paymentLog pl
			JOIN roomContract rc ON pl.contractEsntlId = rc.esntlId
			WHERE pl.calculateStatus = 'SUCCESS' AND pl.gosiwonEsntlId <> 'GOSI0000000199'
				AND DATE(rc.contractDate) = ?
			UNION ALL
			SELECT 'YEAR_AGO',
				CAST(COALESCE(SUM(CASE WHEN pl.paymentType != 'REFUND' THEN CAST(pl.paymentAmount AS DECIMAL(20,0)) ELSE 0 END), 0) AS UNSIGNED),
				CAST(COALESCE(SUM(CASE WHEN pl.paymentType = 'REFUND' THEN CAST(pl.paymentAmount AS DECIMAL(20,0)) ELSE 0 END), 0) AS UNSIGNED)
			FROM paymentLog pl
			JOIN roomContract rc ON pl.contractEsntlId = rc.esntlId
			WHERE pl.calculateStatus = 'SUCCESS' AND pl.gosiwonEsntlId <> 'GOSI0000000199'
				AND YEAR(rc.contractDate) = ?
			UNION ALL
			SELECT 'MONTH_AGO',
				CAST(COALESCE(SUM(CASE WHEN pl.paymentType != 'REFUND' THEN CAST(pl.paymentAmount AS DECIMAL(20,0)) ELSE 0 END), 0) AS UNSIGNED),
				CAST(COALESCE(SUM(CASE WHEN pl.paymentType = 'REFUND' THEN CAST(pl.paymentAmount AS DECIMAL(20,0)) ELSE 0 END), 0) AS UNSIGNED)
			FROM paymentLog pl
			JOIN roomContract rc ON pl.contractEsntlId = rc.esntlId
			WHERE pl.calculateStatus = 'SUCCESS' AND pl.gosiwonEsntlId <> 'GOSI0000000199'
				AND YEAR(rc.contractDate) = ? AND MONTH(rc.contractDate) = ?
			UNION ALL
			SELECT 'DAY_AGO',
				CAST(COALESCE(SUM(CASE WHEN pl.paymentType != 'REFUND' THEN CAST(pl.paymentAmount AS DECIMAL(20,0)) ELSE 0 END), 0) AS UNSIGNED),
				CAST(COALESCE(SUM(CASE WHEN pl.paymentType = 'REFUND' THEN CAST(pl.paymentAmount AS DECIMAL(20,0)) ELSE 0 END), 0) AS UNSIGNED)
			FROM paymentLog pl
			JOIN roomContract rc ON pl.contractEsntlId = rc.esntlId
			WHERE pl.calculateStatus = 'SUCCESS' AND pl.gosiwonEsntlId <> 'GOSI0000000199'
				AND DATE(rc.contractDate) = ?
		`;

		const [countRows, amountRows] = await Promise.all([
			mariaDBSequelize.query(countQuery, {
				replacements: [yearInt, yearInt, monthInt, targetDateStr, oneYearAgoYear, oneMonthAgoYear, oneMonthAgoMonth, oneDayAgo],
				type: mariaDBSequelize.QueryTypes.SELECT,
			}),
			mariaDBSequelize.query(amountQuery, {
				replacements: [yearInt, yearInt, monthInt, targetDateStr, oneYearAgoYear, oneMonthAgoYear, oneMonthAgoMonth, oneDayAgo],
				type: mariaDBSequelize.QueryTypes.SELECT,
			}),
		]);

		const countP = {};
		const countR = {};
		countRows.forEach((r) => {
			countP[r.period] = r.paymentCnt != null ? parseInt(r.paymentCnt, 10) : 0;
			countR[r.period] = r.refundCnt != null ? parseInt(r.refundCnt, 10) : 0;
		});
		const amountP = {};
		const amountRef = {};
		amountRows.forEach((r) => {
			amountP[r.period] = r.paymentAmount != null ? Number(r.paymentAmount) : 0;
			amountRef[r.period] = r.refundAmount != null ? Number(r.refundAmount) : 0;
		});

		const mainPeriods = ['YEAR', 'MONTH', 'DAY'];
		const finalResult = mainPeriods.map((period) => {
			const row = {
				type: period,
				paymentAmount: amountP[period] ?? 0,
				paymentCnt: countP[period] ?? 0,
				refundAmount: amountRef[period] ?? 0,
				refundCnt: countR[period] ?? 0,
			};
			if (period === 'YEAR') row.ago = countP['YEAR_AGO'] ?? 0;
			else if (period === 'MONTH') row.ago = countP['MONTH_AGO'] ?? 0;
			else row.ago = countP['DAY_AGO'] ?? 0;
			return row;
		});

		errorHandler.successThrow(res, '계약현황 통계 조회 성공', finalResult);
	} catch (err) {
		next(err);
	}
};