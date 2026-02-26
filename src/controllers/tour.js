/**
 * 방문 예약(tour) 관련 컨트롤러
 * il_tour_reservation, customer, room, gosiwon, gosiwonAdmin 테이블 사용
 * 알림톡 대체로 문자(SMS) 발송
 */

const crypto = require('crypto');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { mariaDBSequelize } = require('../models');
const errorHandler = require('../middleware/error');
const { getWriterAdminId } = require('../utils/auth');
const aligoSMS = require('../module/aligo/sms');
const { next: idsNext } = require('../utils/idsNext');
const { phoneToDisplay } = require('../utils/phoneHelper');
const dashboardController = require('./dashboard');

// 공통 토큰 검증 함수 (관리자/파트너)
const verifyAdminToken = (req) => {
	const authHeader = req.get('Authorization');
	if (!authHeader) {
		errorHandler.errorThrow(401, '토큰이 없습니다.');
	}
	const token = authHeader.split(' ')[1];
	if (!token) {
		errorHandler.errorThrow(401, '토큰 형식이 올바르지 않습니다.');
	}
	let decodedToken;
	try {
		decodedToken = jwt.decode(token);
	} catch (err) {
		errorHandler.errorThrow(401, '토큰 디코딩에 실패했습니다.');
	}
	if (!decodedToken || (!decodedToken.admin && !decodedToken.partner)) {
		errorHandler.errorThrow(401, '관리자 정보가 없습니다.');
	}
	return decodedToken;
};

/**
 * 파트너가 해당 고시원에 접근 가능한지 검증
 * @param {string} gosiwonEsntlId - 고시원 ID (gsw_eid)
 * @param {Object} decodedToken - 디코딩된 JWT
 */
const verifyPartnerGosiwonAccess = async (gosiwonEsntlId, decodedToken) => {
	// partner가 고시원 ID인 경우 (예: GOSI0000002130)
	if (decodedToken.partner === gosiwonEsntlId) {
		return true;
	}
	// partner가 관리자 ID인 경우: gosiwon.adminEsntlId = partner
	const [row] = await mariaDBSequelize.query(
		`SELECT 1 FROM gosiwon WHERE esntlId = ? AND adminEsntlId = ? LIMIT 1`,
		{
			replacements: [gosiwonEsntlId, decodedToken.partner || decodedToken.admin],
			type: mariaDBSequelize.QueryTypes.SELECT,
		}
	);
	if (row) return true;
	// admin이면 전체 접근 허용 (슈퍼관리자)
	if (decodedToken.admin) return true;
	return false;
};

/**
 * 룸투어 리스트 조회 (페이징 지원)
 * GET /v1/tour/items
 * query: startDate, endDate, gswEid, status, search, page, limit
 */
exports.getTourItems = async (req, res, next) => {
	try {
		const decodedToken = verifyAdminToken(req);
		const startDate = req.query.startDate || '';
		const endDate = req.query.endDate || '';
		const gswEid = req.query.gswEid || '';

		// 통계용 effective date range (리스트와 동일: rtr_tour_dtm 기준)
		const today = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
		const pad = (n) => String(n).padStart(2, '0');
		const addDays = (dStr, days) => {
			const d = new Date(dStr + 'T00:00:00');
			d.setDate(d.getDate() + days);
			return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
		};
		const addMonths = (dStr, m) => {
			const d = new Date(dStr + 'T00:00:00');
			d.setMonth(d.getMonth() + m);
			return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
		};
		const statsStart = startDate || addDays(today, -7);
		const statsEnd = endDate || addMonths(startDate || today, 6);
		const status = req.query.status || '';
		const search = req.query.search || '';
		const page = parseInt(req.query.page) || 1;
		const limit = Math.min(parseInt(req.query.limit) || 20, 100);
		const offset = (page - 1) * limit;

		let whereClause = 'WHERE 1 = 1';
		const replacements = [];

		// 날짜 필터 (rtr_tour_dtm 기준). 날짜 미지정 시 7일 전 ~ 6개월 후
		if (startDate) {
			whereClause += ' AND DATE(T.rtr_tour_dtm) >= DATE(?)';
			replacements.push(startDate);
		} else {
			whereClause += ' AND T.rtr_tour_dtm >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)';
		}
		if (endDate) {
			whereClause += ' AND DATE(T.rtr_tour_dtm) <= DATE(?)';
			replacements.push(endDate);
		} else if (!startDate) {
			whereClause += ' AND T.rtr_tour_dtm <= DATE_ADD(CURDATE(), INTERVAL 6 MONTH)';
		}

		// 고시원 필터
		if (gswEid) {
			const hasAccess = await verifyPartnerGosiwonAccess(gswEid, decodedToken);
			if (!hasAccess) {
				errorHandler.errorThrow(403, '해당 고시원에 대한 권한이 없습니다.');
			}
			whereClause += ' AND T.gsw_eid = ?';
			replacements.push(gswEid);
		} else if (decodedToken.partner) {
			// partner인데 gswEid 없으면, 해당 partner가 관리하는 고시원만
			if (decodedToken.partner.match(/^GOSI/)) {
				whereClause += ' AND T.gsw_eid = ?';
				replacements.push(decodedToken.partner);
			} else {
				whereClause += ' AND EXISTS (SELECT 1 FROM gosiwon G WHERE G.esntlId = T.gsw_eid AND G.adminEsntlId = ?)';
				replacements.push(decodedToken.partner);
			}
		}

		// 상태 필터
		if (status) {
			whereClause += ' AND T.rtr_status = ?';
			replacements.push(status);
		}

		// 검색 필터 (이름, 전화번호, 방번호, 고시원명)
		if (search) {
			whereClause += ' AND (LOWER(C.name) LIKE LOWER(?) OR LOWER(C.phone) LIKE LOWER(?) OR LOWER(R.roomNumber) LIKE LOWER(?) OR LOWER(G.name) LIKE LOWER(?))';
			const searchPattern = `%${search}%`;
			replacements.push(searchPattern, searchPattern, searchPattern, searchPattern);
		}

		const listReplacements = [...replacements, limit, offset];

		const listQuery = `
			SELECT
				T.rtr_eid AS rtr_eid,
				T.rtr_status AS rtr_status,
				DATE_FORMAT(T.rtr_tour_dtm, '%Y-%m-%d %H:%i:%s') AS rtr_tour_dtm,
				T.rtr_message AS rtr_message,
				T.rtr_join_date AS rtr_join_date,
				T.rtr_stay_period AS rtr_stay_period,
				T.rtr_user_bizcall AS rtr_user_bizcall,
				DATE_FORMAT(T.rtr_regist_dtm, '%Y-%m-%d %H:%i:%s') AS rtr_regist_dtm,
				DATE_FORMAT(T.rtr_confirm_dtm, '%Y-%m-%d %H:%i:%s') AS rtr_confirm_dtm,
				C.name AS name,
				C.birth AS birth,
				C.gender AS gender,
				C.phone AS phone,
				G.name AS gsw_name,
				G.esntlId AS gsw_eid,
				G.serviceNumber AS serviceNumber,
				R.roomNumber AS roomNumber,
				R.status AS roomStatus,
				R.endDate AS roomEndDate,
				IGC.gsc_payment_able_start_date AS paymentAbleStartDate
			FROM il_tour_reservation T
			LEFT JOIN customer C ON T.cus_eid = C.esntlId
			LEFT JOIN gosiwon G ON T.gsw_eid = G.esntlId
			LEFT JOIN room R ON T.rom_eid = R.esntlId
			LEFT JOIN il_gosiwon_config IGC ON G.esntlId = IGC.gsw_eid
			${whereClause}
			ORDER BY T.rtr_tour_dtm DESC
			LIMIT ? OFFSET ?
		`;

		const countQuery = `
			SELECT COUNT(*) AS total
			FROM il_tour_reservation T
			LEFT JOIN customer C ON T.cus_eid = C.esntlId
			LEFT JOIN gosiwon G ON T.gsw_eid = G.esntlId
			LEFT JOIN room R ON T.rom_eid = R.esntlId
			${whereClause}
		`;

		const [rows, countResult, tourReservationStats] = await Promise.all([
			mariaDBSequelize.query(listQuery, {
				replacements: listReplacements,
				type: mariaDBSequelize.QueryTypes.SELECT,
			}),
			mariaDBSequelize.query(countQuery, {
				replacements,
				type: mariaDBSequelize.QueryTypes.SELECT,
			}),
			dashboardController.fetchTourReservationStatsData(null, { startDate: statsStart, endDate: statsEnd }),
		]);

		const total = countResult?.[0]?.total != null ? parseInt(countResult[0].total, 10) : 0;
		const data = (rows || []).map((row) => ({
			rtr_eid: row.rtr_eid ?? null,
			rtr_status: row.rtr_status ?? null,
			rtr_tour_dtm: row.rtr_tour_dtm ?? null,
			rtr_message: row.rtr_message ?? null,
			rtr_join_date: row.rtr_join_date ?? null,
			rtr_stay_period: row.rtr_stay_period ?? null,
			rtr_user_bizcall: row.rtr_user_bizcall ?? null,
			rtr_regist_dtm: row.rtr_regist_dtm ?? null,
			rtr_confirm_dtm: row.rtr_confirm_dtm ?? null,
			name: row.name ?? null,
			birth: row.birth ?? null,
			gender: row.gender ?? null,
			phone: phoneToDisplay(row.phone) ?? row.phone ?? null,
			gsw_name: row.gsw_name ?? null,
			gsw_eid: row.gsw_eid ?? null,
			serviceNumber: row.serviceNumber ?? null,
			roomNumber: row.roomNumber ?? null,
			roomStatus: row.roomStatus ?? null,
			roomEndDate: row.roomEndDate ?? null,
			paymentAbleStartDate: row.paymentAbleStartDate ?? null,
		}));

		errorHandler.successThrow(res, '룸투어 리스트 조회 성공', {
			total,
			page,
			limit,
			data,
			tourReservationStats,
		});
	} catch (err) {
		next(err);
	}
};

/**
 * 방문 예약 수락
 * POST /v1/tour/accept
 */
exports.acceptTourReservation = async (req, res, next) => {
	try {
		const decodedToken = verifyAdminToken(req);
		const writerAdminId = getWriterAdminId(decodedToken);
		const { rtr_eid } = req.body;

		if (!rtr_eid) {
			errorHandler.errorThrow(400, 'rtr_eid(방문예약일련번호)는 필수입니다.');
		}

		// 예약 정보 조회 (il_tour_reservation + customer, room, gosiwon, gosiwonAdmin)
		const infoQuery = `
			SELECT
				T.rtr_eid,
				T.cus_eid,
				T.gsw_eid,
				T.rom_eid,
				T.rtr_status,
				T.rtr_tour_dtm,
				T.rtr_user_bizcall,
				C.phone AS customer_phone,
				C.name AS customer_name,
				R.roomNumber,
				G.name AS gosiwon_name,
				GA.hp AS admin_phone
			FROM il_tour_reservation T
			LEFT JOIN customer C ON C.esntlId = T.cus_eid
			LEFT JOIN room R ON R.esntlId = T.rom_eid
			LEFT JOIN gosiwon G ON G.esntlId = T.gsw_eid
			LEFT JOIN gosiwonAdmin GA ON GA.esntlId = G.adminEsntlId
			WHERE T.rtr_eid = ?
			LIMIT 1
		`;
		const [tourRow] = await mariaDBSequelize.query(infoQuery, {
			replacements: [rtr_eid],
			type: mariaDBSequelize.QueryTypes.SELECT,
		});

		if (!tourRow) {
			errorHandler.errorThrow(404, '해당 방문 예약을 찾을 수 없습니다.');
		}

		// 이미 확정된 경우 (ACCEPT 및 기존 CONFIRMED 호환)
		if (['ACCEPT', 'CONFIRMED'].includes(tourRow.rtr_status)) {
			errorHandler.errorThrow(400, '이미 수락된 예약입니다.');
		}
		// 이미 취소된 경우
		if (['CANCEL_GOSIWON', 'CANCEL_USER', 'INVALID'].includes(tourRow.rtr_status)) {
			errorHandler.errorThrow(400, '취소되었거나 무효인 예약은 수락할 수 없습니다.');
		}

		// 파트너가 해당 고시원에 접근 가능한지 검증
		const hasAccess = await verifyPartnerGosiwonAccess(tourRow.gsw_eid, decodedToken);
		if (!hasAccess) {
			errorHandler.errorThrow(403, '해당 고시원의 방문 예약에 대한 권한이 없습니다.');
		}

		const phone = tourRow.customer_phone || '';
		let customerPhoneNumber = phone;

		// 비즈콜 매핑 (선택, 실패 시 원번호 사용)
		const bizcallIid = process.env.BIZCALL_IID || 'krjnwzvaplelmj1003bn';
		const tourDtm = tourRow.rtr_tour_dtm;
		if (phone && tourDtm) {
			try {
				const bizcallAuthMd5 = crypto.createHash('md5').update(`${bizcallIid}${phone}`).digest('hex');
				const bizcallAuth = Buffer.from(bizcallAuthMd5).toString('base64');
				const tourDate = new Date(tourDtm);
				const currentDate = new Date();
				const hoursDifference = (tourDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60);
				const bizcallExpireHour = Math.floor(hoursDifference) + 6;

				const params = {
					iid: bizcallIid,
					rn: phone,
					expire_hour: Math.max(bizcallExpireHour, 1),
					auth: bizcallAuth,
				};
				const query = Object.keys(params)
					.map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(params[k]))
					.join('&');
				const mappingUrl = `https://api.050bizcall.co.kr/link/auto_expire_mapp.do?${query}`;

				const mappingRes = await axios.post(mappingUrl, null, { timeout: 10000 });
				const mappingResult = mappingRes.data;
				if (mappingResult && mappingResult.rs === 'SUCCESS' && mappingResult.vn) {
					customerPhoneNumber = mappingResult.vn;
				}
			} catch (bizcallErr) {
				console.error('비즈콜 매핑 실패, 원번호 사용:', bizcallErr.message);
			}
		}

		// il_tour_reservation 업데이트 (수락)
		await mariaDBSequelize.query(
			`UPDATE il_tour_reservation 
			 SET rtr_status = 'ACCEPT', rtr_confirm_dtm = NOW(), rtr_user_bizcall = ? 
			 WHERE rtr_eid = ?`,
			{
				replacements: [customerPhoneNumber || null, rtr_eid],
				type: mariaDBSequelize.QueryTypes.UPDATE,
			}
		);

		// 고객에게 문자 발송 (알림톡 대체)
		const tourDtmStr = tourDtm
			? new Date(tourDtm).toLocaleString('ko-KR', {
					year: 'numeric',
					month: '2-digit',
					day: '2-digit',
					hour: '2-digit',
					minute: '2-digit',
			  })
			: '';
		const roomInfo = tourRow.roomNumber ? ` 방번호: ${tourRow.roomNumber}` : '';
		const customerSmsMessage = `[${tourRow.gosiwon_name || '고시원'}] 방문 예약이 수락되었습니다.${tourDtmStr ? ` 방문일시: ${tourDtmStr}` : ''}${roomInfo}`;

		if (phone) {
			try {
				await aligoSMS.send({
					receiver: phone,
					message: customerSmsMessage,
					title: '방문 예약 수락',
				});
				// 발송 이력 저장
				const historyEsntlId = await idsNext('messageSmsHistory');
				await mariaDBSequelize.query(
					`INSERT INTO messageSmsHistory (esntlId, title, content, gosiwonEsntlId, userEsntlId, receiverPhone, createdBy, createdAt, updatedAt)
					 VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
					{
						replacements: [
							historyEsntlId,
							'방문 예약 수락',
							customerSmsMessage,
							tourRow.gsw_eid,
							tourRow.cus_eid,
							phone,
							writerAdminId,
						],
						type: mariaDBSequelize.QueryTypes.INSERT,
					}
				);
			} catch (smsErr) {
				console.error('방문 예약 수락 문자 발송 실패:', smsErr.message);
				// 문자 실패해도 수락 처리 성공으로 응답
			}
		}

		// 관리자에게 문자 발송 (알림톡 대체)
		if (tourRow.admin_phone) {
			try {
				const adminSmsMessage = `[${tourRow.gosiwon_name || '고시원'}] 방문 예약이 수락되었습니다. 예약자: ${tourRow.customer_name || '-'}, 방문일시: ${tourDtmStr || '-'}`;
				await aligoSMS.send({
					receiver: tourRow.admin_phone,
					message: adminSmsMessage,
					title: '방문 예약 수락',
				});
			} catch (adminSmsErr) {
				console.error('관리자 문자 발송 실패:', adminSmsErr.message);
			}
		}

		errorHandler.successThrow(res, '방문 예약 수락 완료', {
			rtr_eid,
			status: 'ACCEPT',
		});
	} catch (err) {
		next(err);
	}
};

/**
 * 방문 예약 취소
 * POST /v1/tour/cancel
 */
exports.cancelTourReservation = async (req, res, next) => {
	try {
		const decodedToken = verifyAdminToken(req);
		const writerAdminId = getWriterAdminId(decodedToken);
		const { rtr_eid, message } = req.body;

		if (!rtr_eid) {
			errorHandler.errorThrow(400, 'rtr_eid(방문예약일련번호)는 필수입니다.');
		}

		// 예약 정보 조회
		const infoQuery = `
			SELECT
				T.rtr_eid,
				T.cus_eid,
				T.gsw_eid,
				T.rtr_status,
				T.rtr_tour_dtm,
				C.phone AS customer_phone,
				C.name AS customer_name,
				G.name AS gosiwon_name,
				GA.hp AS admin_phone
			FROM il_tour_reservation T
			LEFT JOIN customer C ON C.esntlId = T.cus_eid
			LEFT JOIN gosiwon G ON G.esntlId = T.gsw_eid
			LEFT JOIN gosiwonAdmin GA ON GA.esntlId = G.adminEsntlId
			WHERE T.rtr_eid = ?
			LIMIT 1
		`;
		const [tourRow] = await mariaDBSequelize.query(infoQuery, {
			replacements: [rtr_eid],
			type: mariaDBSequelize.QueryTypes.SELECT,
		});

		if (!tourRow) {
			errorHandler.errorThrow(404, '해당 방문 예약을 찾을 수 없습니다.');
		}

		// 이미 취소된 경우
		if (['CANCEL_GOSIWON', 'CANCEL_USER', 'INVALID'].includes(tourRow.rtr_status)) {
			errorHandler.errorThrow(400, '이미 취소되었거나 무효인 예약입니다.');
		}

		// 파트너 권한 검증
		const hasAccess = await verifyPartnerGosiwonAccess(tourRow.gsw_eid, decodedToken);
		if (!hasAccess) {
			errorHandler.errorThrow(403, '해당 고시원의 방문 예약에 대한 권한이 없습니다.');
		}

		const cancelMessage = (message && String(message).trim()) || '';

		// il_tour_reservation 업데이트 (취소)
		await mariaDBSequelize.query(
			`UPDATE il_tour_reservation 
			 SET rtr_status = 'CANCEL_GOSIWON', rtr_message = ?, rtr_confirm_dtm = NOW() 
			 WHERE rtr_eid = ?`,
			{
				replacements: [cancelMessage, rtr_eid],
				type: mariaDBSequelize.QueryTypes.UPDATE,
			}
		);

		// 고객에게 문자 발송 (알림톡 대체)
		const tourDtmStr = tourRow.rtr_tour_dtm
			? new Date(tourRow.rtr_tour_dtm).toLocaleString('ko-KR', {
					year: 'numeric',
					month: '2-digit',
					day: '2-digit',
					hour: '2-digit',
					minute: '2-digit',
			  })
			: '';
		const reasonText = cancelMessage ? `\n취소 사유: ${cancelMessage}` : '';
		const customerSmsMessage = `[${tourRow.gosiwon_name || '고시원'}] 방문 예약이 취소되었습니다.${tourDtmStr ? ` (예정일시: ${tourDtmStr})` : ''}${reasonText}`;

		if (tourRow.customer_phone) {
			try {
				await aligoSMS.send({
					receiver: tourRow.customer_phone,
					message: customerSmsMessage,
					title: '방문 예약 취소',
				});
				// 발송 이력 저장
				const historyEsntlId = await idsNext('messageSmsHistory');
				await mariaDBSequelize.query(
					`INSERT INTO messageSmsHistory (esntlId, title, content, gosiwonEsntlId, userEsntlId, receiverPhone, createdBy, createdAt, updatedAt)
					 VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
					{
						replacements: [
							historyEsntlId,
							'방문 예약 취소',
							customerSmsMessage,
							tourRow.gsw_eid,
							tourRow.cus_eid,
							tourRow.customer_phone,
							writerAdminId,
						],
						type: mariaDBSequelize.QueryTypes.INSERT,
					}
				);
			} catch (smsErr) {
				console.error('방문 예약 취소 문자 발송 실패:', smsErr.message);
			}
		}

		// 관리자에게 문자 발송 (알림톡 대체)
		if (tourRow.admin_phone) {
			try {
				const adminSmsMessage = `[${tourRow.gosiwon_name || '고시원'}] 방문 예약 취소 처리되었습니다. 예약자: ${tourRow.customer_name || '-'}${cancelMessage ? `, 사유: ${cancelMessage}` : ''}`;
				await aligoSMS.send({
					receiver: tourRow.admin_phone,
					message: adminSmsMessage,
					title: '방문 예약 취소',
				});
			} catch (adminSmsErr) {
				console.error('관리자 문자 발송 실패:', adminSmsErr.message);
			}
		}

		errorHandler.successThrow(res, '방문 예약 취소 완료', {
			rtr_eid,
			status: 'CANCEL_GOSIWON',
		});
	} catch (err) {
		next(err);
	}
};
