/**
 * 대시보드 통계 API
 * - 회원 방문자 수(yn_access_log), 계약건수(roomContract), 매출(il_daily_selling_closing) 일별 집계
 */
const { mariaDBSequelize } = require('../models');
const errorHandler = require('../middleware/error');

/**
 * 오늘 00:00:00 기준 날짜 문자열 (YYYY-MM-DD)
 */
const getTodayDateString = () => {
	const now = new Date();
	const y = now.getFullYear();
	const m = String(now.getMonth() + 1).padStart(2, '0');
	const d = String(now.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
};

/**
 * 오늘을 기준으로 과거 N일 전 날짜 문자열 (YYYY-MM-DD)
 */
const getDateStringDaysAgo = (daysAgo) => {
	const d = new Date();
	d.setDate(d.getDate() - daysAgo);
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
};

/**
 * 기준일(YYYY-MM-DD)에서 N일 전 날짜 문자열 (YYYY-MM-DD)
 * @param {string} dateStr YYYY-MM-DD
 * @param {number} daysAgo 양수
 * @returns {string} YYYY-MM-DD
 */
const getDateStringDaysFrom = (dateStr, daysAgo) => {
	const d = new Date(dateStr + 'T00:00:00');
	d.setDate(d.getDate() - daysAgo);
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
};

/**
 * GET /v1/dashboard/stats
 * 기준일 포함 최근 30일간 일별: 회원 방문자 수, 계약 건수, 매출을 반환.
 * query.date(YYYY-MM-DD) 미입력 시 오늘을 기준일로 사용.
 */
exports.getStats = async (req, res, next) => {
	try {
		const endStr = isValidDateString(req.query.date) ? req.query.date : getTodayDateString();
		const startStr = getDateStringDaysFrom(endStr, 29); // 기준일 포함 30일

		// 1) 회원 방문자 수 - yn_access_log, asl_regist_dtm 기준 일별, asl_user_id DISTINCT (NULL 제외)
		const visitorQuery = `
			SELECT
				DATE(asl_regist_dtm) AS date,
				COUNT(DISTINCT asl_user_id) AS count
			FROM yn_access_log
			WHERE asl_user_id IS NOT NULL
				AND asl_user_id != ''
				AND asl_regist_dtm >= ?
				AND asl_regist_dtm < DATE_ADD(?, INTERVAL 1 DAY)
			GROUP BY DATE(asl_regist_dtm)
			ORDER BY date ASC
		`;
		const visitorRows = await mariaDBSequelize.query(visitorQuery, {
			replacements: [startStr + ' 00:00:00', endStr + ' 00:00:00'],
			type: mariaDBSequelize.QueryTypes.SELECT,
		});

		// 2) 계약 건수 - roomContract, contractDate 기준 일별 (취소 제외한 계약 건수)
		const contractQuery = `
			SELECT
				DATE(contractDate) AS date,
				COUNT(*) AS count
			FROM roomContract
			WHERE status != 'CANCEL'
				AND contractDate >= ?
				AND contractDate < DATE_ADD(?, INTERVAL 1 DAY)
			GROUP BY DATE(contractDate)
			ORDER BY date ASC
		`;
		const contractRows = await mariaDBSequelize.query(contractQuery, {
			replacements: [startStr, endStr],
			type: mariaDBSequelize.QueryTypes.SELECT,
		});

		// 3) 매출 - il_daily_selling_closing, dsc_closing_date 기준 일별 (PAYMENT 합계, REFUND 별도 가능)
		const salesQuery = `
			SELECT
				DATE(dsc_closing_date) AS date,
				COALESCE(SUM(CASE WHEN dsc_selling_type_cd = 'PAYMENT' THEN dsc_selling_cnt ELSE 0 END), 0) AS selling_cnt,
				COALESCE(SUM(CASE WHEN dsc_selling_type_cd = 'PAYMENT' THEN dsc_selling_total_amt ELSE 0 END), 0) AS selling_total_amt,
				COALESCE(SUM(CASE WHEN dsc_selling_type_cd = 'REFUND' THEN dsc_selling_cnt ELSE 0 END), 0) AS refund_cnt,
				COALESCE(SUM(CASE WHEN dsc_selling_type_cd = 'REFUND' THEN dsc_selling_total_amt ELSE 0 END), 0) AS refund_total_amt
			FROM il_daily_selling_closing
			WHERE dsc_closing_date >= ?
				AND dsc_closing_date < DATE_ADD(?, INTERVAL 1 DAY)
			GROUP BY DATE(dsc_closing_date)
			ORDER BY date ASC
		`;
		const salesRows = await mariaDBSequelize.query(salesQuery, {
			replacements: [startStr, endStr],
			type: mariaDBSequelize.QueryTypes.SELECT,
		});

		// 날짜별 객체로 채우기 (기준일 포함 30일, 빈 날은 0으로)
		const dateMap = {};
		for (let i = 0; i < 30; i++) {
			const key = getDateStringDaysFrom(endStr, 29 - i);
			dateMap[key] = {
				date: key,
				visitorCount: 0,
				contractCount: 0,
				sellingCnt: 0,
				sellingTotalAmt: 0,
				refundCnt: 0,
				refundTotalAmt: 0,
			};
		}
		visitorRows.forEach((r) => {
			const d = r.date ? (typeof r.date === 'string' ? r.date.slice(0, 10) : r.date) : null;
			if (d && dateMap[d]) dateMap[d].visitorCount = Number(r.count) || 0;
		});
		contractRows.forEach((r) => {
			const d = r.date ? (typeof r.date === 'string' ? r.date.slice(0, 10) : r.date) : null;
			if (d && dateMap[d]) dateMap[d].contractCount = Number(r.count) || 0;
		});
		salesRows.forEach((r) => {
			const d = r.date ? (typeof r.date === 'string' ? r.date.slice(0, 10) : r.date) : null;
			if (d && dateMap[d]) {
				dateMap[d].sellingCnt = Number(r.selling_cnt) || 0;
				dateMap[d].sellingTotalAmt = Number(r.selling_total_amt) || 0;
				dateMap[d].refundCnt = Number(r.refund_cnt) || 0;
				dateMap[d].refundTotalAmt = Number(r.refund_total_amt) || 0;
			}
		});

		const daily = Object.keys(dateMap)
			.sort()
			.map((k) => dateMap[k]);

		return res.status(200).json({
			statusCode: 200,
			message: '대시보드 통계 조회 성공',
			data: {
				from: startStr,
				to: endStr,
				daily,
				summary: {
					totalVisitorCount: daily.reduce((s, row) => s + row.visitorCount, 0),
					totalContractCount: daily.reduce((s, row) => s + row.contractCount, 0),
					totalSellingCnt: daily.reduce((s, row) => s + row.sellingCnt, 0),
					totalSellingAmt: daily.reduce((s, row) => s + row.sellingTotalAmt, 0),
					totalRefundCnt: daily.reduce((s, row) => s + row.refundCnt, 0),
					totalRefundAmt: daily.reduce((s, row) => s + row.refundTotalAmt, 0),
				},
			},
		});
	} catch (err) {
		next(err);
	}
};

/** 오늘 요일 한글 (일~토) */
const getTodayDayName = () => {
	const days = ['일', '월', '화', '수', '목', '금', '토'];
	return days[new Date().getDay()];
};

/**
 * YYYY-MM-DD 문자열에 해당하는 요일 한글 (일~토)
 * @param {string} dateStr YYYY-MM-DD
 * @returns {string} '일' | '월' | ... | '토'
 */
const getDayNameFromDateString = (dateStr) => {
	const days = ['일', '월', '화', '수', '목', '금', '토'];
	const d = new Date(dateStr + 'T00:00:00');
	const dayIndex = d.getDay();
	if (Number.isNaN(d.getTime())) return getTodayDayName();
	return days[dayIndex] ?? getTodayDayName();
};

/** 일일 스케줄 정렬용 순서 */
const DAILY_SCHEDULE_ORDER = {
	판매오픈: 1,
	판매종료: 2,
	계약일: 3,
	환불요청: 4,
	퇴실요청: 5,
	체납상태: 6,
	입실일: 7,
	퇴실일: 8,
	청소일: 9,
	룸투어_예약요청: 10,
	룸투어_예약방문: 11,
};

/** YYYY-MM-DD 형식 유효 여부 */
const isValidDateString = (str) => {
	if (!str || typeof str !== 'string') return false;
	if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
	const d = new Date(str + 'T00:00:00');
	return !Number.isNaN(d.getTime());
};

/**
 * GET /v1/dashboard/dailySchedule
 * roomStatus 등에서 기준일로 시작(또는 해당)되는 일일 스케줄 목록 반환.
 * query.date(YYYY-MM-DD) 미입력 시 오늘 기준.
 * 응답: 상태값, 고시원이름, 방호수, 상태값에 따른 내용
 */
exports.getDailySchedule = async (req, res, next) => {
	try {
		const targetDateStr = isValidDateString(req.query.date)
			? req.query.date
			: getTodayDateString();
		const targetDayName = getDayNameFromDateString(targetDateStr);
		const items = [];

		// 1) roomStatus: 오늘 시작 또는 오늘 종료 (deleteYN 제외, room.deleteYN 제외)
		const roomStatusQuery = `
			SELECT
				RS.status,
				RS.subStatus,
				DATE(RS.statusStartDate) AS startDate,
				DATE(RS.statusEndDate) AS endDate,
				G.name AS gosiwonName,
				R.roomNumber,
				COALESCE(RS.customerName, RCW.checkinName, RCW.customerName, C.name, '') AS guestName,
				COALESCE(RS.customerEsntlId, RC.customerEsntlId) AS customerEsntlId,
				RCW.checkinPhone,
				RCW.customerPhone,
				C.phone AS customerHp
			FROM roomStatus RS
			INNER JOIN room R ON R.esntlId = RS.roomEsntlId AND (R.deleteYN IS NULL OR R.deleteYN = 'N')
			INNER JOIN gosiwon G ON G.esntlId = RS.gosiwonEsntlId
			LEFT JOIN roomContract RC ON RC.esntlId = RS.contractEsntlId AND RS.status = 'CONTRACT'
			LEFT JOIN roomContractWho RCW ON RCW.contractEsntlId = RC.esntlId
			LEFT JOIN customer C ON C.esntlId = COALESCE(RS.customerEsntlId, RC.customerEsntlId)
			WHERE (RS.deleteYN IS NULL OR RS.deleteYN = 'N')
				AND (
					(DATE(RS.statusStartDate) = ? AND RS.status IN ('ON_SALE', 'CONTRACT', 'OVERDUE', 'CHECKOUT_REQUESTED'))
					OR (DATE(RS.statusEndDate) = ? AND RS.status = 'ON_SALE' AND (RS.subStatus IS NULL OR RS.subStatus != 'END'))
				)
		`;
		const roomStatusRows = await mariaDBSequelize.query(roomStatusQuery, {
			replacements: [targetDateStr, targetDateStr],
			type: mariaDBSequelize.QueryTypes.SELECT,
		});

		for (const row of roomStatusRows || []) {
			const gosiwonName = row.gosiwonName || '';
			const roomNumber = row.roomNumber != null ? String(row.roomNumber) : '';
			const guestName = (row.guestName || '').trim();
			const phone = (row.checkinPhone || row.customerPhone || row.customerHp || '').trim();
			const guestLabel = guestName ? (phone ? `${guestName}(${phone})` : guestName) : '';

			if (row.status === 'ON_SALE' && row.startDate === targetDateStr) {
				items.push({
					statusValue: '판매오픈',
					gosiwonName,
					roomNumber,
					content: `${gosiwonName}의 빈 방 1개 판매가 시작되었습니다.`,
					sortOrder: DAILY_SCHEDULE_ORDER.판매오픈,
				});
			} else if (row.status === 'ON_SALE' && row.endDate === targetDateStr) {
				items.push({
					statusValue: '판매종료',
					gosiwonName,
					roomNumber,
					content: `${gosiwonName} ${roomNumber}호 방 판매가 종료되었습니다.`,
					sortOrder: DAILY_SCHEDULE_ORDER.판매종료,
				});
			} else if (row.status === 'CONTRACT' && row.startDate === targetDateStr) {
				items.push({
					statusValue: '입실일',
					gosiwonName,
					roomNumber,
					content: guestLabel ? `${guestLabel} 님의 입실일입니다.` : `${gosiwonName} ${roomNumber}호 입실일입니다.`,
					sortOrder: DAILY_SCHEDULE_ORDER.입실일,
				});
			} else if (row.status === 'CONTRACT' && row.endDate === targetDateStr) {
				items.push({
					statusValue: '퇴실일',
					gosiwonName,
					roomNumber,
					content: guestLabel ? `${guestLabel} 님의 퇴실일입니다.` : `${gosiwonName} ${roomNumber}호 퇴실일입니다.`,
					sortOrder: DAILY_SCHEDULE_ORDER.퇴실일,
				});
			} else if (row.status === 'OVERDUE' && row.startDate === targetDateStr) {
				items.push({
					statusValue: '체납상태',
					gosiwonName,
					roomNumber,
					content: guestLabel ? `${guestLabel} 님이 금일부터 체납상태로 전환되었습니다.` : `${gosiwonName} ${roomNumber}호 금일부터 체납상태입니다.`,
					sortOrder: DAILY_SCHEDULE_ORDER.체납상태,
				});
			} else if (row.status === 'CHECKOUT_REQUESTED' && row.startDate === targetDateStr) {
				items.push({
					statusValue: '퇴실요청',
					gosiwonName,
					roomNumber,
					content: guestLabel ? `${guestLabel} 님이 퇴실을 요청하였습니다.` : `${gosiwonName} ${roomNumber}호 퇴실 요청이 있습니다.`,
					sortOrder: DAILY_SCHEDULE_ORDER.퇴실요청,
				});
			}
		}

		// 2) roomContract: 오늘 계약일
		const contractQuery = `
			SELECT
				G.name AS gosiwonName,
				R.roomNumber,
				COALESCE(RCW.checkinName, RCW.customerName, C.name, '') AS guestName,
				COALESCE(RCW.checkinPhone, RCW.customerPhone, C.phone, '') AS phone
			FROM roomContract RC
			INNER JOIN room R ON R.esntlId = RC.roomEsntlId AND (R.deleteYN IS NULL OR R.deleteYN = 'N')
			INNER JOIN gosiwon G ON G.esntlId = RC.gosiwonEsntlId
			LEFT JOIN roomContractWho RCW ON RCW.contractEsntlId = RC.esntlId
			LEFT JOIN customer C ON C.esntlId = RC.customerEsntlId
			WHERE RC.status = 'CONTRACT'
				AND DATE(RC.contractDate) = ?
		`;
		const contractRows = await mariaDBSequelize.query(contractQuery, {
			replacements: [targetDateStr],
			type: mariaDBSequelize.QueryTypes.SELECT,
		});
		for (const row of contractRows || []) {
			const gosiwonName = row.gosiwonName || '';
			const roomNumber = row.roomNumber != null ? String(row.roomNumber) : '';
			const guestName = (row.guestName || '').trim();
			const phone = (row.phone || '').trim();
			const guestLabel = guestName ? (phone ? `${guestName}(${phone})` : guestName) : '';
			items.push({
				statusValue: '계약일',
				gosiwonName,
				roomNumber,
				content: guestLabel ? `${guestLabel} 님이 계약하셨습니다.` : `${gosiwonName} ${roomNumber}호 계약이 체결되었습니다.`,
				sortOrder: DAILY_SCHEDULE_ORDER.계약일,
			});
		}

		// 3) il_room_refund_request: 오늘 등록된 환불요청
		const refundQuery = `
			SELECT
				G.name AS gosiwonName,
				R.roomNumber,
				COALESCE(RCW.checkinName, RCW.customerName, C.name, '') AS guestName,
				COALESCE(RCW.checkinPhone, RCW.customerPhone, C.phone, '') AS phone
			FROM il_room_refund_request RRR
			INNER JOIN room R ON R.esntlId = RRR.rom_eid AND (R.deleteYN IS NULL OR R.deleteYN = 'N')
			INNER JOIN gosiwon G ON G.esntlId = RRR.gsw_eid
			LEFT JOIN roomContract RC ON RC.esntlId = RRR.ctt_eid
			LEFT JOIN roomContractWho RCW ON RCW.contractEsntlId = RC.esntlId
			LEFT JOIN customer C ON C.esntlId = RC.customerEsntlId
			WHERE DATE(RRR.rrr_regist_dtm) = ?
		`;
		const refundRows = await mariaDBSequelize.query(refundQuery, {
			replacements: [targetDateStr],
			type: mariaDBSequelize.QueryTypes.SELECT,
		});
		for (const row of refundRows || []) {
			const gosiwonName = row.gosiwonName || '';
			const roomNumber = row.roomNumber != null ? String(row.roomNumber) : '';
			const guestName = (row.guestName || '').trim();
			const phone = (row.phone || '').trim();
			const guestLabel = guestName ? (phone ? `${guestName}(${phone})` : guestName) : '';
			items.push({
				statusValue: '환불요청',
				gosiwonName,
				roomNumber,
				content: guestLabel ? `${guestLabel} 님의 환불 요청이 접수되었습니다.` : `${gosiwonName} ${roomNumber}호 환불 요청이 접수되었습니다.`,
				sortOrder: DAILY_SCHEDULE_ORDER.환불요청,
			});
		}

		// 4) 청소일: 오늘 요일이 청소 요일인 고시원 (현재 적용 설정), 담당자 = gosiwonAdmin. cleaning_days 형식 "월 / 수 / 금"
		const cleaningQuery = `
			SELECT
				G.name AS gosiwonName,
				GC.cleaning_days,
				GA.ceo AS adminName
			FROM gosiwonClean GC
			INNER JOIN gosiwon G ON G.esntlId = GC.gosiwonEsntlId
			LEFT JOIN gosiwonAdmin GA ON GA.esntlId = G.adminEsntlId
			WHERE (GC.application_start_date IS NULL OR GC.application_start_date <= ?)
				AND (GC.application_end_date IS NULL OR GC.application_end_date >= ?)
			ORDER BY GC.created_at DESC
		`;
		const cleaningRows = await mariaDBSequelize.query(cleaningQuery, {
			replacements: [targetDateStr, targetDateStr],
			type: mariaDBSequelize.QueryTypes.SELECT,
		});
		const seenGosiwonClean = new Set();
		for (const row of cleaningRows || []) {
			const daysStr = (row.cleaning_days || '').replace(/\s/g, '');
			const daysArr = daysStr.split('/').map((d) => d.trim()).filter(Boolean);
			if (!daysArr.includes(targetDayName)) continue;
			if (seenGosiwonClean.has(row.gosiwonName)) continue;
			seenGosiwonClean.add(row.gosiwonName);
			const gosiwonName = row.gosiwonName || '';
			const adminName = (row.adminName || '').trim();
			items.push({
				statusValue: '청소일',
				gosiwonName,
				roomNumber: '',
				content: adminName ? `담당자 ${adminName} 님의 청소일입니다.` : `${gosiwonName} 청소일입니다.`,
				sortOrder: DAILY_SCHEDULE_ORDER.청소일,
			});
		}

		// 5) 룸투어: 오늘 등록된 예약요청 / 오늘이 방문 예정일인 예약방문
		const roomTourRequestQuery = `
			SELECT
				G.name AS gosiwonName,
				R.roomNumber,
				RR.ror_hp_no AS phone,
				RR.ror_regist_dtm
			FROM il_room_reservation RR
			INNER JOIN room R ON R.esntlId = RR.rom_sn AND (R.deleteYN IS NULL OR R.deleteYN = 'N')
			INNER JOIN gosiwon G ON G.esntlId = R.gosiwonEsntlId
			WHERE RR.ror_status_cd = 'WAIT'
				AND DATE(RR.ror_regist_dtm) = ?
		`;
		const roomTourVisitQuery = `
			SELECT
				G.name AS gosiwonName,
				R.roomNumber,
				RR.ror_hp_no AS phone
			FROM il_room_reservation RR
			INNER JOIN room R ON R.esntlId = RR.rom_sn AND (R.deleteYN IS NULL OR R.deleteYN = 'N')
			INNER JOIN gosiwon G ON G.esntlId = R.gosiwonEsntlId
			WHERE RR.ror_status_cd = 'WAIT'
				AND DATE(RR.ror_check_in_date) = ?
		`;
		const tourRequestRows = await mariaDBSequelize.query(roomTourRequestQuery, {
			replacements: [targetDateStr],
			type: mariaDBSequelize.QueryTypes.SELECT,
		});
		const tourVisitRows = await mariaDBSequelize.query(roomTourVisitQuery, {
			replacements: [targetDateStr],
			type: mariaDBSequelize.QueryTypes.SELECT,
		});
		for (const row of tourRequestRows || []) {
			items.push({
				statusValue: '룸투어 예약요청',
				gosiwonName: row.gosiwonName || '',
				roomNumber: row.roomNumber != null ? String(row.roomNumber) : '',
				content: `${row.gosiwonName || ''} ${row.roomNumber != null ? row.roomNumber + '호' : ''} 룸투어 예약이 요청되었습니다.`.trim(),
				sortOrder: DAILY_SCHEDULE_ORDER.룸투어_예약요청,
			});
		}
		for (const row of tourVisitRows || []) {
			const phone = (row.phone || '').trim();
			const guestLabel = phone ? `연락처 ${phone}` : '고객';
			items.push({
				statusValue: '룸투어 예약방문',
				gosiwonName: row.gosiwonName || '',
				roomNumber: row.roomNumber != null ? String(row.roomNumber) : '',
				content: `${guestLabel} 님의 룸투어 방문 예정일입니다.`,
				sortOrder: DAILY_SCHEDULE_ORDER.룸투어_예약방문,
			});
		}

		// 정렬: 상태 순서 → 고시원명 → 방호수
		items.sort((a, b) => {
			const orderA = a.sortOrder ?? 99;
			const orderB = b.sortOrder ?? 99;
			if (orderA !== orderB) return orderA - orderB;
			const gn = (a.gosiwonName || '').localeCompare(b.gosiwonName || '');
			if (gn !== 0) return gn;
			return String(a.roomNumber || '').localeCompare(String(b.roomNumber || ''), undefined, { numeric: true });
		});

		const list = items.map(({ statusValue, gosiwonName, roomNumber, content }) => ({
			statusValue,
			gosiwonName,
			roomNumber: roomNumber ? String(roomNumber) : '',
			content,
		}));

		return res.status(200).json({
			statusCode: 200,
			message: '일일 스케줄 조회 성공',
			data: {
				date: targetDateStr,
				list,
			},
		});
	} catch (err) {
		next(err);
	}
};

/**
 * 입력 날짜 기준 7일 구간 시작일 (date - 6일) 00:00:00 ~ date 23:59:59 포함
 * @param {string} dateStr YYYY-MM-DD
 * @returns {{ startDtm: string, endDtm: string }} startDtm(포함), endDtm(미포함, 다음날 00:00:00)
 */
const getWeekRange = (dateStr) => {
	const end = new Date(dateStr + 'T00:00:00');
	end.setDate(end.getDate() + 1);
	const endY = end.getFullYear();
	const endM = String(end.getMonth() + 1).padStart(2, '0');
	const endD = String(end.getDate()).padStart(2, '0');
	const start = new Date(dateStr + 'T00:00:00');
	start.setDate(start.getDate() - 6);
	const startY = start.getFullYear();
	const startM = String(start.getMonth() + 1).padStart(2, '0');
	const startD = String(start.getDate()).padStart(2, '0');
	return {
		startDtm: `${startY}-${startM}-${startD} 00:00:00`,
		endDtm: `${endY}-${endM}-${endD} 00:00:00`,
	};
};

/**
 * GET /v1/dashboard/weeklyRanking
 * 입력 날짜 기준 1주일(7일) 구간에서 roomLike/roomSee 집계 후 roomEsntlId별 상위 5개씩 반환. 방·고시원명 포함.
 */
exports.getWeeklyRanking = async (req, res, next) => {
	try {
		const dateParam = req.query.date;
		const dateStr = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(String(dateParam).trim())
			? String(dateParam).trim()
			: getTodayDateString();
		const { startDtm, endDtm } = getWeekRange(dateStr);

		// like/see 순위를 병렬 조회 (응답 시간 단축)
		const likeQuery = `
			SELECT
				RL.roomEsntlId,
				R.roomNumber,
				R.gosiwonEsntlId,
				G.name AS gosiwonName,
				COUNT(*) AS cnt
			FROM roomLike RL
			INNER JOIN room R ON R.esntlId = RL.roomEsntlId AND (R.deleteYN IS NULL OR R.deleteYN = 'N')
			INNER JOIN gosiwon G ON G.esntlId = R.gosiwonEsntlId
			WHERE RL.rlk_regist_dtm >= ? AND RL.rlk_regist_dtm < ?
			GROUP BY RL.roomEsntlId, R.roomNumber, R.gosiwonEsntlId, G.name
			ORDER BY cnt DESC
			LIMIT 5
		`;
		const seeQuery = `
			SELECT
				RS.roomEsntlId,
				R.roomNumber,
				R.gosiwonEsntlId,
				G.name AS gosiwonName,
				COUNT(*) AS cnt
			FROM roomSee RS
			INNER JOIN room R ON R.esntlId = RS.roomEsntlId AND (R.deleteYN IS NULL OR R.deleteYN = 'N')
			INNER JOIN gosiwon G ON G.esntlId = R.gosiwonEsntlId
			WHERE RS.rse_regist_dtm >= ? AND RS.rse_regist_dtm < ?
			GROUP BY RS.roomEsntlId, R.roomNumber, R.gosiwonEsntlId, G.name
			ORDER BY cnt DESC
			LIMIT 5
		`;
		const replacements = [startDtm, endDtm];
		const [likeRows, seeRows] = await Promise.all([
			mariaDBSequelize.query(likeQuery, { replacements: [...replacements], type: mariaDBSequelize.QueryTypes.SELECT }),
			mariaDBSequelize.query(seeQuery, { replacements: [...replacements], type: mariaDBSequelize.QueryTypes.SELECT }),
		]);

		const likeData = (likeRows || []).map((r) => ({
			roomEsntlId: r.roomEsntlId,
			roomNumber: r.roomNumber != null ? String(r.roomNumber) : '',
			gosiwonEsntlId: r.gosiwonEsntlId,
			gosiwonName: r.gosiwonName || '',
			count: Number(r.cnt) || 0,
		}));
		const seeData = (seeRows || []).map((r) => ({
			roomEsntlId: r.roomEsntlId,
			roomNumber: r.roomNumber != null ? String(r.roomNumber) : '',
			gosiwonEsntlId: r.gosiwonEsntlId,
			gosiwonName: r.gosiwonName || '',
			count: Number(r.cnt) || 0,
		}));

		return res.status(200).json({
			statusCode: 200,
			message: '주간 랭킹 조회 성공',
			data: {
				date: dateStr,
				from: startDtm.slice(0, 10),
				to: dateStr,
				likeData,
				seeData,
			},
		});
	} catch (err) {
		next(err);
	}
};
