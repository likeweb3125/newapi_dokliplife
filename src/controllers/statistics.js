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