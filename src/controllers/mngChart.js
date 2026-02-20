const { mariaDBSequelize } = require('../models');
const errorHandler = require('../middleware/error');
const formatAge = require('../utils/formatAge');

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

	if (!decodedToken || (!decodedToken.admin && !decodedToken.partner)) {
		errorHandler.errorThrow(401, '관리자 정보가 없습니다.');
	}
	return decodedToken;
};

// 날짜 포맷팅 - DB 값 그대로 사용 (UTC 변환 없음, 로컬 기준)
const pad2 = (n) => String(n).padStart(2, '0');
const formatDateTime = (val) => {
	if (val == null) return null;
	if (typeof val === 'string') {
		const s = val.trim().slice(0, 19).replace('T', ' ');
		if (s.length < 10) return null;
		return s.length === 10 ? `${s} 00:00:00` : s;
	}
	const d = new Date(val);
	if (isNaN(d.getTime())) return null;
	return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
};

// 날짜에서 시간 제거 (YYYY-MM-DD 형식)
const formatDateOnly = (val) => {
	if (val == null) return null;
	if (typeof val === 'string') {
		if (val.includes(' ')) return val.split(' ')[0];
		return val.length >= 10 ? val.slice(0, 10) : val;
	}
	const d = new Date(val);
	if (isNaN(d.getTime())) return null;
	return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

// 계약 타입 판단 함수
const getContractType = (contractDate, startDate) => {
	if (!contractDate || !startDate) return '신규';
	const contract = new Date(formatDateOnly(contractDate));
	const start = new Date(formatDateOnly(startDate));
	
	// 계약일과 시작일이 같으면 신규, 다르면 연장
	const diffDays = Math.floor((start - contract) / (1000 * 60 * 60 * 24));
	return diffDays === 0 ? '신규' : '연장';
};

// 방 상태 매핑 (roomStatus.status 값 기준) - color, label 관리
const STATUS_MAP = {
	'BEFORE_SALES': { color: '#9B9B9B', label: '판매신청전' },
	'ON_SALE': { color: '#27A644', label: '판매중' },
	'PENDING': { color: '#FFB800', label: '입금대기중' },
	'VBANK_PENDING': { color: '#FFB800', label: '입금대기중' },
	'RESERVE_PENDING': { color: '#FFB800', label: '예약금 입금대기중' },
	'RESERVED': { color: '#35BB88', label: '예약중' },
	'CONTRACT': { color: '#FF8A00', label: '이용중' },
	'OVERDUE': { color: '#D25454', label: '체납상태' },
	'CHECKOUT_REQUESTED': { color: '#9B9B9B', label: '퇴실요청' },
	'CHECKOUT_CONFIRMED': { color: '#9B9B9B', label: '퇴실확정(원장님이 확인)' },
	'CHECKOUT_ONSALE': { color: '#9B9B9B', label: '퇴실확정 방 판매중' },
	'END_DEPOSIT': { color: '#9B9B9B', label: '퇴실완료, 보증금 반환 필요' },
	'END': { color: '#9B9B9B', label: '퇴실완료, 보증금 반환 완료' },
	'ROOM_MOVE': { color: '#4A67DD', label: '방이동' },
	'ETC': { color: '#9B9B9B', label: '기타' },
	'disabled': { color: '#9B9B9B', label: '비활성' },
	'in-progress': { color: '#FF8A00', label: '이용중' },
	'leave': { color: '#9B9B9B', label: '퇴실' },
};

// typeName 조회 (STATUS_MAP.label 기반, ETC는 메모 추가)
const getTypeName = (status, statusMemo) => {
	if (!status) return '';
	const info = STATUS_MAP[status] || { label: String(status) };
	if (status === 'ETC' && statusMemo) {
		return `${info.label} (${statusMemo})`;
	}
	return info.label;
};

// 관리객실현황 차트 데이터 조회
exports.mngChartMain = async (req, res, next) => {
	try {
		verifyAdminToken(req);

		const { gosiwonEsntlId, page = 1 } = req.query;

		if (!gosiwonEsntlId) {
			errorHandler.errorThrow(400, 'gosiwonEsntlId를 입력해주세요.');
		}

		// 고시원 이름 및 관리자(대표자·연락처) 조회 (gosiwon.adminEsntlId → gosiwonAdmin)
		const [gosiwonRow] = await mariaDBSequelize.query(
			`SELECT G.name, GA.ceo AS gosiwonCeo, GA.hp AS gosiwonCeoHp
			 FROM gosiwon G
			 LEFT JOIN gosiwonAdmin GA ON G.adminEsntlId = GA.esntlId
			 WHERE G.esntlId = ? LIMIT 1`,
			{
				replacements: [gosiwonEsntlId],
				type: mariaDBSequelize.QueryTypes.SELECT,
			}
		);
		const gosiwonName = gosiwonRow?.name ?? null;
		const gosiwonCeo = gosiwonRow?.gosiwonCeo ?? null;
		const gosiwonCeoHp = gosiwonRow?.gosiwonCeoHp ?? null;

		// 페이징 처리 (로컬 날짜 사용)
		// page=1: 오늘 기준 앞뒤 45일 (총 90일), page>=2: 1달씩 과거, page<=0: 1달씩 미래
		const parsed = parseInt(page);
		const pageNum = (page !== undefined && page !== '' && !isNaN(parsed)) ? parsed : 1;
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		let startDate;
		let endDate;
		if (pageNum === 1) {
			// page=1: 오늘 기준 앞뒤 45일 (총 90일)
			startDate = new Date(today);
			startDate.setDate(startDate.getDate() - 45);
			endDate = new Date(today);
			endDate.setDate(endDate.getDate() + 45);
		} else if (pageNum >= 2) {
			// page>=2: 원래처럼 1달씩 과거 (page 2 = 1개월전~2개월전, page 3 = 2개월전~3개월전...)
			endDate = new Date(today);
			endDate.setMonth(endDate.getMonth() - (pageNum - 1));
			startDate = new Date(today);
			startDate.setMonth(startDate.getMonth() - pageNum);
		} else {
			// 미래: page=0 → 오늘~1개월후, page=-1 → 1개월후~2개월후
			const absPage = Math.abs(pageNum);
			startDate = new Date(today);
			startDate.setMonth(startDate.getMonth() + absPage);
			endDate = new Date(today);
			endDate.setMonth(endDate.getMonth() + absPage + 1);
		}

		const pad2 = (n) => String(n).padStart(2, '0');
		const toYmd = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
		const endDateStr = toYmd(endDate);
		const startDateStr = toYmd(startDate);

		// 1. Groups 데이터 조회 (활성 방 목록) - roomStatus 우선, statusStartDate 기준 최신 상태 사용 (esntlId/updatedAt 아님)
		const groupsQuery = `
			SELECT DISTINCT
				R.esntlId AS id,
				R.roomNumber,
				R.roomNumber AS roomName,
				R.roomType AS type,
				R.window,
				COALESCE(NULLIF(TRIM(R.monthlyRent), ''), RCAT.base_price, 0) AS monthlyRent,
				R.deposit,
				R.gosiwonEsntlId,
				R.orderNo AS value,
				R.status AS roomStatus,
				R.roomCategory AS roomCategoryEsntlId,
				R.useRoomRentFee,
				RS.contractEsntlId,
				RS.subStatus AS roomSubStatus,
				COALESCE(
					RS.status,
					CASE 
						WHEN R.status = 'CONTRACT' THEN 'CONTRACT'
						WHEN R.status = 'RESERVE' THEN 'RESERVE_PENDING'
						WHEN R.status = 'VBANK' THEN 'VBANK_PENDING'
						WHEN R.status = 'EMPTY' OR R.status = '' OR R.status IS NULL THEN 'BEFORE_SALES'
						ELSE 'BEFORE_SALES'
					END
				) AS status,
				COALESCE(RS.customerName, '') AS currentGuest,
				COALESCE(RCW.checkinName, C.name, RS.customerName, '') AS checkInName,
				C.gender AS customerGender,
				C.birth AS customerBirth,
				RCW.customerAge AS rcwCustomerAge,
				RCW.checkinGender AS checkinGender,
				RCW.checkinAge AS checkinAge,
				RS.customerEsntlId AS _dbg_rsCustomerEsntlId,
				RS.contractEsntlId AS _dbg_rsContractEsntlId,
				C.name AS _dbg_customerName,
				RCW.checkinName AS _dbg_rcwCheckinName,
				RS.customerName AS _dbg_rsCustomerName,
				COALESCE(CONCAT(
					DATE_FORMAT(RS.statusStartDate, '%y-%m-%d'),
					'~',
					DATE_FORMAT(RS.statusEndDate, '%y-%m-%d')
				), '') AS stayPeriod,
				RCAT.name AS roomCategoryName,
				RCAT.base_price AS roomCategoryBasePrice,
				RCAT.memo AS roomCategoryMemo
			FROM room R
			LEFT JOIN (
				SELECT RS1.*
				FROM roomStatus RS1
				INNER JOIN (
					SELECT roomEsntlId, MAX(COALESCE(statusStartDate, etcStartDate, createdAt)) AS maxStartDate
					FROM roomStatus
					WHERE status IN ('CONTRACT', 'RESERVED', 'RESERVE_PENDING', 'VBANK_PENDING', 'PENDING', 'ON_SALE', 'ETC')
						AND (deleteYN IS NULL OR deleteYN = 'N')
					GROUP BY roomEsntlId
				) RS2 ON RS1.roomEsntlId = RS2.roomEsntlId
					AND COALESCE(RS1.statusStartDate, RS1.etcStartDate, RS1.createdAt) = RS2.maxStartDate
					AND RS1.status IN ('CONTRACT', 'RESERVED', 'RESERVE_PENDING', 'VBANK_PENDING', 'PENDING', 'ON_SALE', 'ETC')
				AND (RS1.deleteYN IS NULL OR RS1.deleteYN = 'N')
				WHERE RS1.esntlId = (
					SELECT esntlId
					FROM roomStatus RS3
					WHERE RS3.roomEsntlId = RS1.roomEsntlId
						AND COALESCE(RS3.statusStartDate, RS3.etcStartDate, RS3.createdAt) = RS2.maxStartDate
						AND RS3.status IN ('CONTRACT', 'RESERVED', 'RESERVE_PENDING', 'VBANK_PENDING', 'PENDING', 'ON_SALE', 'ETC')
						AND (RS3.deleteYN IS NULL OR RS3.deleteYN = 'N')
					ORDER BY RS3.esntlId DESC
					LIMIT 1
				)
			) RS ON R.esntlId = RS.roomEsntlId
			LEFT JOIN customer C ON RS.customerEsntlId = C.esntlId
			LEFT JOIN roomContractWho RCW ON RS.contractEsntlId = RCW.contractEsntlId
			LEFT JOIN roomCategory RCAT ON R.roomCategory = RCAT.esntlId
			WHERE R.gosiwonEsntlId = ?
				AND R.deleteYN = 'N'
			ORDER BY R.orderNo ASC, R.roomNumber ASC
		`;

		const rooms = await mariaDBSequelize.query(groupsQuery, {
			replacements: [gosiwonEsntlId],
			type: mariaDBSequelize.QueryTypes.SELECT,
		});

		// 방별 계약 ID로 parkStatus 조회 (주차 정보)
		const contractIds = [...new Set(rooms.map((r) => r.contractEsntlId).filter(Boolean))];
		let parkStatusByContract = {};
		if (contractIds.length > 0) {
			const parkRows = await mariaDBSequelize.query(
				`
				SELECT esntlId, contractEsntlId, status, useStartDate, useEndDate, parkType, parkNumber, cost, memo
				FROM parkStatus
				WHERE contractEsntlId IN (?) AND deleteYN = 'N'
				ORDER BY contractEsntlId, useStartDate
				`,
				{
					replacements: [contractIds],
					type: mariaDBSequelize.QueryTypes.SELECT,
				}
			);
			parkRows.forEach((row) => {
				if (!parkStatusByContract[row.contractEsntlId]) parkStatusByContract[row.contractEsntlId] = [];
				parkStatusByContract[row.contractEsntlId].push({
					esntlId: row.esntlId,
					status: row.status,
					useStartDate: row.useStartDate,
					useEndDate: row.useEndDate,
					parkType: row.parkType,
					parkNumber: row.parkNumber,
					cost: row.cost != null ? parseInt(row.cost) : 0,
					memo: row.memo,
				});
			});
		}

		// Groups 데이터 변환 - id는 room.esntlId 사용
		// subStatus가 ROOM_MOVE_OUT/ROOM_MOVE_IN이면 '방이동'(ROOM_MOVE)으로 표시
		// roomEsntlId -> roomStatus.status(원본) 매핑 (items의 itemStatus용)
		// roomEsntlId -> roomNumber 매핑 (방이동 content용)
		const roomIdToStatusRaw = {};
		const roomIdToRoomNumber = {};
		const groups = rooms.map((room) => {
			roomIdToRoomNumber[room.id] = room.roomNumber || room.id;
			const baseStatus = room.status || 'BEFORE_SALES';
			const statusKey = (room.roomSubStatus === 'ROOM_MOVE_OUT' || room.roomSubStatus === 'ROOM_MOVE_IN')
				? 'ROOM_MOVE'
				: baseStatus;
			roomIdToStatusRaw[room.id] = statusKey;
			const statusInfo = STATUS_MAP[statusKey] || STATUS_MAP['BEFORE_SALES'];
			const roomCategory = room.roomCategoryEsntlId
				? {
					esntlId: room.roomCategoryEsntlId,
					name: room.roomCategoryName || '',
					base_price: room.roomCategoryBasePrice != null ? parseInt(room.roomCategoryBasePrice) : 0,
					memo: room.roomCategoryMemo || '',
				}
				: null;
			const parkStatus = parkStatusByContract[room.contractEsntlId] || [];

			return {
				id: room.id, // room.esntlId
				roomEsntlId: room.id, // room.esntlId
				roomNumber: room.roomNumber,
				roomName: room.roomName || room.roomNumber,
				status: statusInfo.label,
				type: room.type || '',
				window: room.window || '',
				monthlyRent: room.monthlyRent != null && room.monthlyRent !== '' ? (parseFloat(room.monthlyRent) || room.monthlyRent) : 0,
				deposit: room.deposit != null ? (parseInt(room.deposit, 10) || room.deposit) : null,
				currentGuest: room.currentGuest || '',
				checkInName: room.checkInName || room.currentGuest || '',
				customerGender: room.customerGender ?? null,
				customerAge: room.rcwCustomerAge ?? formatAge(room.customerBirth) ?? null,
				checkinGender: room.checkinGender ?? null,
				checkinAge: room.checkinAge ?? null,
				stayPeriod: room.stayPeriod || '',
				value: room.value || 0,
				roomCategory,
				useRoomRentFee: room.useRoomRentFee ?? null,
				parkStatus,
				color: {
					sidebar: statusInfo.color,
					statusBorder: statusInfo.color,
					statusText: statusInfo.color,
				},
			};
		});

		// 방 ID 매핑 생성 (roomEsntlId -> group index)
		const roomIdToGroupIndex = {};
		groups.forEach((group, index) => {
			roomIdToGroupIndex[group.id] = index; // group.id는 esntlId
		});

		// 2. Items 데이터 조회 (roomStatus: CONTRACT, OVERDUE, CHECKOUT_REQUESTED, ROOM_MOVE, RESERVE_*, PENDING)
		const roomStatusItemsQuery = `
			SELECT 
				RS.esntlId AS id,
				RS.roomEsntlId,
				RS.gosiwonEsntlId,
				RS.status,
				RS.subStatus,
				RS.statusMemo,
				RS.statusStartDate,
				RS.statusEndDate,
				RS.etcStartDate,
				RS.etcEndDate,
				RS.contractEsntlId,
				RS.createdAt AS roomStatusCreatedAt,
				R.roomNumber,
				RC.esntlId AS contractEsntlIdVal,
				RC.startDate AS contractStartDate,
				RC.endDate AS contractEndDate,
				RC.checkInTime,
				RC.contractDate,
				RC.month,
				RC.status AS contractStatus,
				RC.monthlyRent,
				R.monthlyRent AS roomMonthlyRent,
				R.deposit AS roomDeposit,
				C.name AS customerName,
				C.phone AS customerPhone,
				C.gender AS customerGender,
				C.birth AS customerBirth,
				RCW.customerAge AS rcwCustomerAge,
				C.bank AS customerBank,
				C.bankAccount AS customerBankAccount,
				RCW.checkinName AS checkinName,
				RCW.checkinPhone AS checkinPhone,
				RCW.checkinGender AS checkinGender,
				RCW.checkinAge AS checkinAge,
				RCW.customerName AS contractorName,
				RCW.customerPhone AS contractorPhone,
				RCW.customerGender AS contractorGender,
				RCW.customerAge AS contractorAge,
				PL.paymentAmount,
				PL.pyl_goods_amount,
				GA.ceo AS adminName,
				CASE WHEN RC.startDate IS NOT NULL AND RC.endDate IS NOT NULL THEN (
					SELECT D.rdp_eid FROM il_room_deposit D
					WHERE D.rom_eid = RS.roomEsntlId AND D.gsw_eid = RS.gosiwonEsntlId AND D.rdp_delete_dtm IS NULL
						AND (D.rdp_customer_name = C.name OR D.rdp_customer_name = RCW.checkinName OR D.rdp_customer_name = RCW.customerName)
						AND (
							(D.rdp_completed_dtm IS NOT NULL AND DATE(D.rdp_completed_dtm) >= RC.startDate AND DATE(D.rdp_completed_dtm) <= RC.endDate)
							OR (D.rdp_completed_dtm IS NULL AND (
								(D.rdp_check_in_date IS NOT NULL AND D.rdp_check_in_date >= RC.startDate AND D.rdp_check_in_date <= RC.endDate)
								OR (DATE(D.rdp_regist_dtm) >= RC.startDate AND DATE(D.rdp_regist_dtm) <= RC.endDate)
							))
						)
					ORDER BY D.rdp_completed_dtm DESC, D.rdp_regist_dtm DESC LIMIT 1
				) ELSE NULL END AS depositEsntlId,
				CASE WHEN RC.startDate IS NOT NULL AND RC.endDate IS NOT NULL THEN (
					SELECT D.rdp_completed_dtm FROM il_room_deposit D
					WHERE D.rom_eid = RS.roomEsntlId AND D.gsw_eid = RS.gosiwonEsntlId AND D.rdp_delete_dtm IS NULL
						AND (D.rdp_customer_name = C.name OR D.rdp_customer_name = RCW.checkinName OR D.rdp_customer_name = RCW.customerName)
						AND (
							(D.rdp_completed_dtm IS NOT NULL AND DATE(D.rdp_completed_dtm) >= RC.startDate AND DATE(D.rdp_completed_dtm) <= RC.endDate)
							OR (D.rdp_completed_dtm IS NULL AND (
								(D.rdp_check_in_date IS NOT NULL AND D.rdp_check_in_date >= RC.startDate AND D.rdp_check_in_date <= RC.endDate)
								OR (DATE(D.rdp_regist_dtm) >= RC.startDate AND DATE(D.rdp_regist_dtm) <= RC.endDate)
							))
						)
					ORDER BY D.rdp_completed_dtm DESC, D.rdp_regist_dtm DESC LIMIT 1
				) ELSE NULL END AS depositCompleteDate,
				CASE WHEN RC.startDate IS NOT NULL AND RC.endDate IS NOT NULL THEN (
					SELECT D.rdp_price FROM il_room_deposit D
					WHERE D.rom_eid = RS.roomEsntlId AND D.gsw_eid = RS.gosiwonEsntlId AND D.rdp_delete_dtm IS NULL
						AND (D.rdp_customer_name = C.name OR D.rdp_customer_name = RCW.checkinName OR D.rdp_customer_name = RCW.customerName)
						AND (
							(D.rdp_completed_dtm IS NOT NULL AND DATE(D.rdp_completed_dtm) >= RC.startDate AND DATE(D.rdp_completed_dtm) <= RC.endDate)
							OR (D.rdp_completed_dtm IS NULL AND (
								(D.rdp_check_in_date IS NOT NULL AND D.rdp_check_in_date >= RC.startDate AND D.rdp_check_in_date <= RC.endDate)
								OR (DATE(D.rdp_regist_dtm) >= RC.startDate AND DATE(D.rdp_regist_dtm) <= RC.endDate)
							))
						)
					ORDER BY D.rdp_completed_dtm DESC, D.rdp_regist_dtm DESC LIMIT 1
				) ELSE NULL END AS depositPrice
			FROM roomStatus RS
			JOIN room R ON RS.roomEsntlId = R.esntlId
			LEFT JOIN gosiwon G ON RS.gosiwonEsntlId = G.esntlId
			LEFT JOIN gosiwonAdmin GA ON G.adminEsntlId = GA.esntlId
			LEFT JOIN roomContract RC ON RS.contractEsntlId = RC.esntlId
			LEFT JOIN customer C ON RC.customerEsntlId = C.esntlId
			LEFT JOIN roomContractWho RCW ON RC.esntlId = RCW.contractEsntlId
			LEFT JOIN (
				SELECT 
					contractEsntlId,
					SUM(CAST(paymentAmount AS UNSIGNED)) AS paymentAmount,
					SUM(pyl_goods_amount) AS pyl_goods_amount
				FROM paymentLog
				WHERE withdrawalStatus != 'WITHDRAWAL'
					AND (extrapayEsntlId IS NULL OR extrapayEsntlId = '')
				GROUP BY contractEsntlId
			) PL ON RC.esntlId = PL.contractEsntlId
			WHERE RS.gosiwonEsntlId = ?
				AND R.deleteYN = 'N'
				AND (RS.deleteYN IS NULL OR RS.deleteYN = 'N')
				AND RS.status IN ('CONTRACT', 'OVERDUE', 'CHECKOUT_REQUESTED', 'ROOM_MOVE', 'RESERVE_PENDING', 'RESERVED', 'VBANK_PENDING', 'PENDING')
				AND (
					(RS.status IN ('CONTRACT', 'OVERDUE', 'ROOM_MOVE')
						AND RS.statusStartDate <= ?
						AND (RS.statusEndDate >= ? OR RS.statusEndDate IS NULL))
					OR
					(RS.status = 'CHECKOUT_REQUESTED'
						AND (RS.etcStartDate IS NOT NULL OR RS.statusEndDate IS NOT NULL)
						AND (
							(COALESCE(RS.etcStartDate, RS.statusEndDate) >= ? AND COALESCE(RS.etcStartDate, RS.statusEndDate) < ?)
							OR (COALESCE(RS.etcEndDate, RS.statusEndDate) >= ? AND COALESCE(RS.etcEndDate, RS.statusEndDate) < ?)
							OR (COALESCE(RS.etcStartDate, RS.statusEndDate) < ? AND COALESCE(RS.etcEndDate, RS.statusEndDate) >= ?)
						))
					OR
					(RS.status IN ('RESERVE_PENDING', 'RESERVED', 'VBANK_PENDING', 'PENDING')
						AND COALESCE(RS.statusStartDate, RS.etcStartDate, RS.createdAt) <= ?
						AND (COALESCE(RS.statusEndDate, RS.etcEndDate) >= ? OR (RS.statusEndDate IS NULL AND RS.etcEndDate IS NULL))
					)
			)
			ORDER BY COALESCE(RS.statusStartDate, RS.etcStartDate, RS.statusEndDate, RS.createdAt) ASC
		`;

		const roomStatusItems = await mariaDBSequelize.query(roomStatusItemsQuery, {
			replacements: [
				gosiwonEsntlId,
				endDateStr,
				startDateStr,
				startDateStr,
				endDateStr,
				startDateStr,
				endDateStr,
				startDateStr,
				endDateStr,
				endDateStr,
				startDateStr,
			],
			type: mariaDBSequelize.QueryTypes.SELECT,
		});

		// 3. 방이동 목록 조회 (날짜 구간과 겹치는 moveDate)
		const roomMovesQuery = `
			SELECT 
				RMS.esntlId,
				RMS.originalRoomEsntlId,
				RMS.targetRoomEsntlId,
				RMS.moveDate,
				RMS.memo,
				RMS.status AS moveStatus
			FROM roomMoveStatus RMS
			WHERE RMS.gosiwonEsntlId = ?
				AND RMS.deleteYN = 'N'
				AND DATE(RMS.moveDate) >= ?
				AND DATE(RMS.moveDate) <= ?
			ORDER BY RMS.moveDate ASC
		`;
		const roomMoves = await mariaDBSequelize.query(roomMovesQuery, {
			replacements: [gosiwonEsntlId, startDateStr, endDateStr],
			type: mariaDBSequelize.QueryTypes.SELECT,
		});

		// 4. Items 데이터 변환 (roomStatus 기준: start/end=roomStatus, contractStart/contractEnd=roomContract)
		const items = [];
		const statusLinesByRoom = {}; // roomEsntlId -> [{ typeName, datetime, color, adminName, dateStr }] (roomStatuses용 content 수집)
		let itemIdCounter = 0;

		const pushStatusLine = (roomEsntlId, rowOrStatus, createdAtField = 'roomStatusCreatedAt') => {
			if (!roomEsntlId) return;
			const raw = rowOrStatus[createdAtField] ?? rowOrStatus.createdAt;
			if (!raw) return;
			const status = rowOrStatus.status;
			const typeName = getTypeName(status, rowOrStatus.statusMemo ?? null);
			const datetime = formatDateTime(raw);
			const dateStr = formatDateOnly(raw);
			const color = (STATUS_MAP[status] && STATUS_MAP[status].color) ? STATUS_MAP[status].color : '#9B9B9B';
			const adminName = rowOrStatus.adminName ?? null;
			if (!statusLinesByRoom[roomEsntlId]) statusLinesByRoom[roomEsntlId] = [];
			statusLinesByRoom[roomEsntlId].push({ typeName, datetime, color, adminName, dateStr });
		};

		// roomStatus 기준 Items 추가 (CONTRACT/OVERDUE/ROOM_MOVE → contract, CHECKOUT_REQUESTED → disabled)
		roomStatusItems.forEach((row) => {
			const groupIndex = roomIdToGroupIndex[row.roomEsntlId];
			if (groupIndex === undefined) return;
			const computedCustomerAge = row.rcwCustomerAge ?? formatAge(row.customerBirth) ?? null;

			// start/end: roomStatus 값
			let statusStartRaw = null;
			let statusEndRaw = null;
			if (row.status === 'CHECKOUT_REQUESTED') {
				statusStartRaw = row.etcStartDate || row.statusEndDate;
				statusEndRaw = row.etcEndDate;
			} else if (['RESERVE_PENDING', 'RESERVED', 'VBANK_PENDING', 'PENDING'].includes(row.status)) {
				statusStartRaw = row.statusStartDate || row.etcStartDate || row.createdAt;
				statusEndRaw = row.statusEndDate || row.etcEndDate;
			} else {
				statusStartRaw = row.statusStartDate;
				statusEndRaw = row.statusEndDate;
			}
			const startDate = formatDateOnly(statusStartRaw);
			if (!startDate) return;

			const endDate = formatDateOnly(statusEndRaw);
			const formattedStart = formatDateTime(startDate);
			const formattedEnd = endDate ? formatDateTime(endDate + ' 23:59:59') : formatDateTime(startDate + ' 23:59:59');

			// contractStart/contractEnd: roomContract의 startDate, endDate (있을 때만)
			const contractStart = row.contractStartDate ? formatDateTime(formatDateOnly(row.contractStartDate)) : null;
			const contractEnd = row.contractEndDate ? formatDateTime(formatDateOnly(row.contractEndDate) + ' 23:59:59') : null;

			// 통일된 item 구조 (계약서 없으면 계약 관련 필드는 null, className은 timeline-item 고정)
			const hasContract = !!(row.contractEsntlIdVal || row.contractEsntlId);
			const baseItem = (overrides = {}) => ({
				id: itemIdCounter++,
				group: row.roomEsntlId,
				roomStatusEsntlId: row.id,
				itemType: 'contract',
				itemStatus: row.status,
				typeName: getTypeName(row.status, row.statusMemo),
				statusMemo: row.statusMemo ?? null,
				start: formattedStart,
				end: formattedEnd,
				contractStart: hasContract && row.contractStartDate ? formatDateTime(formatDateOnly(row.contractStartDate)) : null,
				contractEnd: hasContract && row.contractEndDate ? formatDateTime(formatDateOnly(row.contractEndDate) + ' 23:59:59') : null,
				period: startDate && endDate ? `${startDate.slice(5, 7)}-${startDate.slice(8, 10)} ~ ${endDate.slice(5, 7)}-${endDate.slice(8, 10)}` : '',
				currentGuest: null,
				guestPhone: null,
				customerGender: null,
				customerAge: null,
				checkinGender: null,
				checkinAge: null,
				className: 'timeline-item',
				contractNumber: null,
				guest: null,
				contractPerson: null,
				periodType: null,
				contractType: null,
				entryFee: null,
				paymentAmount: null,
				accountInfo: null,
				deposit: null,
				additionalPaymentOption: null,
				depositEsntlId: null,
				depositCompleteDate: null,
				depositPrice: null,
				...overrides,
			});

			const isReserveType = ['RESERVE_PENDING', 'RESERVED', 'VBANK_PENDING', 'PENDING'].includes(row.status);
			if (isReserveType) {
				// RESERVE_PENDING, RESERVED, VBANK_PENDING, PENDING → contract 형식 (계약 있으면 포함, 없으면 null)
				const reserveOverrides = {};
				if (hasContract) {
					reserveOverrides.contractStart = contractStart;
					reserveOverrides.contractEnd = contractEnd;
					reserveOverrides.contractNumber = row.contractEsntlIdVal || row.contractEsntlId;
					reserveOverrides.periodType = row.month ? `${row.month}개월` : '';
				}
				if (hasContract && (row.checkinName || row.customerName)) {
					const gn = row.checkinName || row.customerName || '';
					const ga = row.checkinAge ?? computedCustomerAge ?? '';
					const gg = row.checkinGender ?? row.customerGender ?? '';
					const gp = row.checkinPhone ?? row.customerPhone ?? '';
					reserveOverrides.currentGuest = gn;
					reserveOverrides.guestPhone = gp || null;
					reserveOverrides.customerGender = row.customerGender ?? null;
					reserveOverrides.customerAge = computedCustomerAge ?? null;
					reserveOverrides.checkinGender = row.checkinGender ?? null;
					reserveOverrides.checkinAge = row.checkinAge ?? null;
					reserveOverrides.guest = `${gn} / ${ga} / ${gg}(${gp})`;
				}
				if (hasContract && (row.contractorName || row.customerName)) {
					const cn = row.contractorName || row.customerName || '';
					const ca = row.contractorAge ?? computedCustomerAge ?? '';
					const cg = row.contractorGender ?? row.customerGender ?? '';
					const cp = row.contractorPhone ?? row.customerPhone ?? '';
					reserveOverrides.contractPerson = `${cn} / ${ca} / ${cg}(${cp})`;
					if (row.customerBank && row.customerBankAccount) {
						reserveOverrides.accountInfo = `${row.customerBank} ${row.customerBankAccount} ${cn}`;
					}
				}
				if (hasContract && row.pyl_goods_amount) reserveOverrides.entryFee = `${row.pyl_goods_amount}`;
				if (hasContract && (parseInt(row.paymentAmount) || 0) > 0) reserveOverrides.paymentAmount = `${parseInt(row.paymentAmount) || 0}`;
				if (hasContract && (parseInt(row.roomDeposit) || 0) > 0) reserveOverrides.deposit = `${(parseInt(row.roomDeposit) || 0).toLocaleString()} 원`;
				if (row.depositEsntlId != null && String(row.depositEsntlId).trim() !== '') reserveOverrides.depositEsntlId = row.depositEsntlId;
				if (row.depositCompleteDate != null) reserveOverrides.depositCompleteDate = formatDateTime(row.depositCompleteDate);
				if (row.depositPrice != null) reserveOverrides.depositPrice = row.depositPrice;
				items.push(baseItem(reserveOverrides));
				pushStatusLine(row.roomEsntlId, row);
			} else if (row.status !== 'CHECKOUT_REQUESTED') {
				// CONTRACT, OVERDUE, ROOM_MOVE → contract (계약 있으면 정보 포함, 없으면 null, className은 timeline-item 고정)
				const contractOverrides = {};
				if (hasContract) {
					const contractType = getContractType(row.contractDate, row.contractStartDate);
					const paymentAmount = parseInt(row.paymentAmount) || 0;
					const entryFee = row.pyl_goods_amount || 0;

					const guestName = row.checkinName || row.customerName || '';
					const guestAge = row.checkinAge || computedCustomerAge || '';
					const guestGender = row.checkinGender || row.customerGender || '';
					const guestPhone = row.checkinPhone || row.customerPhone || '';
					const guest = `${guestName} / ${guestAge} / ${guestGender}(${guestPhone})`;

					const contractorName = row.contractorName || row.customerName || '';
					const contractorAge = row.contractorAge || computedCustomerAge || '';
					const contractorGender = row.contractorGender || row.customerGender || '';
					const contractorPhone = row.contractorPhone || row.customerPhone || '';
					const contractor = `${contractorName} / ${contractorAge} / ${contractorGender}(${contractorPhone})`;

					const accountInfo = row.customerBank && row.customerBankAccount
						? `${row.customerBank} ${row.customerBankAccount} ${contractorName}`
						: '-';

					const deposit = row.roomDeposit || 0;

					contractOverrides.contractStart = contractStart;
					contractOverrides.contractEnd = contractEnd;
					contractOverrides.period = startDate && endDate ? `${startDate.slice(5, 7)}-${startDate.slice(8, 10)} ~ ${endDate.slice(5, 7)}-${endDate.slice(8, 10)}` : '';
					contractOverrides.currentGuest = guestName;
					contractOverrides.guestPhone = guestPhone || null;
					contractOverrides.customerGender = row.customerGender ?? null;
					contractOverrides.customerAge = computedCustomerAge ?? null;
					contractOverrides.checkinGender = row.checkinGender ?? null;
					contractOverrides.checkinAge = row.checkinAge ?? null;
					contractOverrides.contractNumber = row.contractEsntlIdVal || row.contractEsntlId;
					contractOverrides.guest = guest;
					contractOverrides.contractPerson = contractor;
					contractOverrides.periodType = row.month ? `${row.month}개월` : '1개월';
					contractOverrides.contractType = contractType;
					contractOverrides.entryFee = entryFee > 0 ? `${entryFee}` : '0';
					contractOverrides.paymentAmount = paymentAmount > 0 ? `${paymentAmount}` : '0';
					contractOverrides.accountInfo = accountInfo;
					contractOverrides.deposit = deposit > 0 ? `${deposit.toLocaleString()} 원` : '0 원';
					if (row.depositEsntlId != null && String(row.depositEsntlId).trim() !== '') contractOverrides.depositEsntlId = row.depositEsntlId;
					if (row.depositCompleteDate != null) contractOverrides.depositCompleteDate = formatDateTime(row.depositCompleteDate);
					if (row.depositPrice != null) contractOverrides.depositPrice = row.depositPrice;
				}

				const contractItem = baseItem(contractOverrides);
				if (row.subStatus === 'ROOM_MOVE_OUT' || row.subStatus === 'ROOM_MOVE_IN') {
					contractItem._moveSubStatus = row.subStatus;
				}
				items.push(contractItem);
				pushStatusLine(row.roomEsntlId, row);
			} else {
				// CHECKOUT_REQUESTED → contract 형식 (계약 있으면 포함, 없으면 null, className은 timeline-item 고정)
				const checkoutOverrides = {};
				if (hasContract) {
					const guestName = row.checkinName || row.customerName || '';
					const contractorName = row.contractorName || row.customerName || '';
					const guest = guestName ? `${guestName} / ${row.checkinAge || computedCustomerAge || ''} / ${row.checkinGender || row.customerGender || ''}(${row.checkinPhone || row.customerPhone || ''})` : '';
					const contractor = contractorName ? `${contractorName} / ${row.contractorAge || computedCustomerAge || ''} / ${row.contractorGender || row.customerGender || ''}(${row.contractorPhone || row.customerPhone || ''})` : '';
					checkoutOverrides.contractStart = contractStart;
					checkoutOverrides.contractEnd = contractEnd;
					checkoutOverrides.period = startDate && endDate ? `${startDate.slice(5, 7)}-${startDate.slice(8, 10)} ~ ${endDate.slice(5, 7)}-${endDate.slice(8, 10)}` : '';
					checkoutOverrides.currentGuest = guestName;
					checkoutOverrides.guestPhone = row.checkinPhone || row.customerPhone || null;
					checkoutOverrides.customerGender = row.customerGender ?? null;
					checkoutOverrides.customerAge = computedCustomerAge ?? null;
					checkoutOverrides.checkinGender = row.checkinGender ?? null;
					checkoutOverrides.checkinAge = row.checkinAge ?? null;
					checkoutOverrides.contractNumber = row.contractEsntlIdVal || row.contractEsntlId;
					checkoutOverrides.guest = guest;
					checkoutOverrides.contractPerson = contractor;
					checkoutOverrides.periodType = row.month ? `${row.month}개월` : '';
					checkoutOverrides.contractType = row.contractDate && row.contractStartDate ? getContractType(row.contractDate, row.contractStartDate) : '';
					checkoutOverrides.entryFee = row.pyl_goods_amount ? `${row.pyl_goods_amount}` : '0';
					checkoutOverrides.paymentAmount = (parseInt(row.paymentAmount) || 0) > 0 ? `${parseInt(row.paymentAmount) || 0}` : '0';
					checkoutOverrides.accountInfo = row.customerBank && row.customerBankAccount ? `${row.customerBank} ${row.customerBankAccount} ${contractorName}` : '-';
					checkoutOverrides.deposit = (parseInt(row.roomDeposit) || 0) > 0 ? `${(parseInt(row.roomDeposit) || 0).toLocaleString()} 원` : '0 원';
					if (row.depositEsntlId != null && String(row.depositEsntlId).trim() !== '') checkoutOverrides.depositEsntlId = row.depositEsntlId;
					if (row.depositCompleteDate != null) checkoutOverrides.depositCompleteDate = formatDateTime(row.depositCompleteDate);
					if (row.depositPrice != null) checkoutOverrides.depositPrice = row.depositPrice;
				}
				items.push(baseItem(checkoutOverrides));
				pushStatusLine(row.roomEsntlId, row);
			}
		});

		// 4-1. roomStatus.subStatus ROOM_MOVE_IN/OUT인 CONTRACT items에 moveID·moveFrom·moveTo·moveRole 설정 (별도 room_move 아이템 없이, 이동은 하나의 유니크 moveID로 연결)
		let moveIDCounter = 1;
		roomMoves.forEach((move) => {
			const moveDateStr = formatDateOnly(move.moveDate);
			if (!moveDateStr) return;

			const outItem = items.find(
				(it) =>
					it.itemType === 'contract' &&
					it._moveSubStatus === 'ROOM_MOVE_OUT' &&
					it.group === move.originalRoomEsntlId &&
					formatDateOnly(it.end) === moveDateStr
			);
			const inItem = items.find(
				(it) =>
					it.itemType === 'contract' &&
					it._moveSubStatus === 'ROOM_MOVE_IN' &&
					it.group === move.targetRoomEsntlId &&
					formatDateOnly(it.start) === moveDateStr
			);
			if (outItem != null && inItem != null) {
				const moveID = moveIDCounter++;
				const moveFrom = outItem.id;
				const moveTo = inItem.id;
				outItem.moveID = moveID;
				outItem.moveFrom = moveFrom;
				outItem.moveTo = moveTo;
				outItem.moveRole = 'out'; // 이 방에서 out
				inItem.moveID = moveID;
				inItem.moveFrom = moveFrom;
				inItem.moveTo = moveTo;
				inItem.moveRole = 'in'; // 이 방으로 in
			}
		});
		// 응답에 내보낼 때 사용한 내부 표시 제거
		items.forEach((it) => {
			if (it._moveSubStatus !== undefined) delete it._moveSubStatus;
		});

		// 5. RoomStatuses 데이터 조회 (방 상태 이력) - ON_SALE, CHECKOUT_ONSALE, END_DEPOSIT, END, ETC, BEFORE_SALES, CHECKOUT_CONFIRMED만 (RESERVE_*, RESERVED, VBANK_PENDING은 items로)
		// 포함 조건: 생성일이 구간 안에 있거나, 상태 기간(statusStartDate~statusEndDate)이 조회 구간과 겹치는 건 포함 (나중에 입력한 ETC 등도 해당 기간에 표시)
		const roomStatusesQuery = `
			SELECT 
				RS.esntlId AS id,
				RS.roomEsntlId,
				RS.contractEsntlId,
				RS.status,
				RS.statusMemo,
				RS.statusStartDate,
				RS.statusEndDate,
				RS.etcStartDate,
				RS.etcEndDate,
				RS.createdAt,
				RS.updatedAt,
				GA.ceo AS adminName,
				GA.hp AS adminHp,
				R.roomNumber
			FROM roomStatus RS
			JOIN room R ON RS.roomEsntlId = R.esntlId
			LEFT JOIN gosiwon G ON RS.gosiwonEsntlId = G.esntlId
			LEFT JOIN gosiwonAdmin GA ON G.adminEsntlId = GA.esntlId
			WHERE RS.gosiwonEsntlId = ?
				AND R.deleteYN = 'N'
				AND (RS.deleteYN IS NULL OR RS.deleteYN = 'N')
				AND RS.status IN (
					'ON_SALE', 'CHECKOUT_ONSALE', 'END_DEPOSIT', 'END', 'ETC', 'BEFORE_SALES', 'CHECKOUT_CONFIRMED'
				)
				AND (
					(DATE(RS.createdAt) >= ? AND DATE(RS.createdAt) < ?)
					OR (
						DATE(COALESCE(RS.statusStartDate, RS.etcStartDate, RS.createdAt)) < ?
						AND (RS.statusEndDate IS NULL AND RS.etcEndDate IS NULL OR DATE(COALESCE(RS.statusEndDate, RS.etcEndDate)) >= ?)
					)
				)
			ORDER BY RS.createdAt DESC
		`;

		const roomStatuses = await mariaDBSequelize.query(roomStatusesQuery, {
			replacements: [gosiwonEsntlId, startDateStr, endDateStr, endDateStr, startDateStr],
			type: mariaDBSequelize.QueryTypes.SELECT,
		});

		// RoomStatuses: items에 ON_SALE, CHECKOUT_ONSALE 등 추가 (start/end는 statusStartDate/statusEndDate 사용)
		roomStatuses.forEach((status) => {
			const groupIndex = roomIdToGroupIndex[status.roomEsntlId];
			if (groupIndex === undefined) return;

			// start/end: roomStatus의 statusStartDate, statusEndDate 사용 (없으면 createdAt으로 대체)
			const statusStartRaw = status.statusStartDate || status.etcStartDate || status.createdAt;
			const statusEndRaw = status.statusEndDate || status.etcEndDate;
			const startDate = formatDateOnly(statusStartRaw);
			if (!startDate) return;

			const endDate = formatDateOnly(statusEndRaw);
			const formattedStart = formatDateTime(startDate);
			const formattedEnd = endDate ? formatDateTime(endDate + ' 23:59:59') : formatDateTime(startDate + ' 23:59:59');
			const period = startDate && endDate ? `${startDate.slice(5, 7)}-${startDate.slice(8, 10)} ~ ${endDate.slice(5, 7)}-${endDate.slice(8, 10)}` : '';

			// items에 roomStatus 전체 값 추가. contractEsntlId 있으면 반드시 리턴 (CHECKOUT_CONFIRMED 등)
			const contractEsntlIdVal = status.contractEsntlId ?? null;
			items.push({
				id: itemIdCounter++,
				group: status.roomEsntlId,
				roomStatusEsntlId: status.id,
				itemType: 'contract',
				itemStatus: status.status ?? null,
				typeName: getTypeName(status.status, status.statusMemo),
				statusMemo: status.statusMemo ?? null,
				start: formattedStart,
				end: formattedEnd,
				contractStart: null,
				contractEnd: null,
				period,
				currentGuest: null,
				guestPhone: null,
				customerGender: null,
				customerAge: null,
				checkinGender: null,
				checkinAge: null,
				className: 'timeline-item',
				contractNumber: contractEsntlIdVal,
				contractEsntlId: contractEsntlIdVal,
				guest: null,
				contractPerson: null,
				periodType: null,
				contractType: null,
				entryFee: null,
				paymentAmount: null,
				accountInfo: null,
				deposit: null,
				additionalPaymentOption: null,
			});

			pushStatusLine(status.roomEsntlId, status, 'createdAt');
		});

		// history 테이블: roomEsntlId·createdAt 기준 조회 후 roomStatuses content에 추가, start/end는 createdAt 반영
		const roomIds = groups.map((g) => g.id || g.roomEsntlId).filter(Boolean);
		if (roomIds.length > 0) {
			const historyPlaceholders = roomIds.map(() => '?').join(',');
			const historyQuery = `
				SELECT roomEsntlId, content, createdAt
				FROM history
				WHERE gosiwonEsntlId = ?
					AND roomEsntlId IN (${historyPlaceholders})
					AND DATE(createdAt) >= ? AND DATE(createdAt) < ?
					AND deleteYN = 'N'
					AND (category IS NULL OR category != 'ROOM')
				ORDER BY createdAt ASC
			`;
			const historyRows = await mariaDBSequelize.query(historyQuery, {
				replacements: [gosiwonEsntlId, ...roomIds, startDateStr, endDateStr],
				type: mariaDBSequelize.QueryTypes.SELECT,
			});
			historyRows.forEach((row) => {
				if (!row.roomEsntlId) return;
				if (!statusLinesByRoom[row.roomEsntlId]) statusLinesByRoom[row.roomEsntlId] = [];
				const datetime = formatDateTime(row.createdAt);
				const dateStr = formatDateOnly(row.createdAt);
				const typeName = (row.content && String(row.content).trim()) || '(내역)';
				statusLinesByRoom[row.roomEsntlId].push({
					typeName,
					datetime,
					color: '#9B9B9B',
					adminName: null,
					dateStr,
				});
			});
		}

		// roomStatuses: 방·날짜별로 1건씩, 당일만 표시 (start = end = 해당 날짜), content는 해당 날짜 라인만
		const roomStatusesArray = [];
		let statusBlockIdx = 0;
		groups.forEach((g) => {
			const roomEsntlId = g.id || g.roomEsntlId;
			const lines = statusLinesByRoom[roomEsntlId];
			if (!lines || lines.length === 0) return;
			// datetime 오름차순 정렬
			lines.sort((a, b) => (a.datetime || '').localeCompare(b.datetime || ''));
			// 날짜별로 묶기 (dateStr 기준)
			const linesByDate = {};
			lines.forEach((l) => {
				const d = l.dateStr || '';
				if (!linesByDate[d]) linesByDate[d] = [];
				linesByDate[d].push(l);
			});
			const dates = Object.keys(linesByDate).filter(Boolean).sort();
			dates.forEach((dateStr) => {
				const dayLines = linesByDate[dateStr];
				if (!dayLines || dayLines.length === 0) return;
				const content = dayLines.map((l) => {
					const dtShort = l.datetime && l.datetime.length >= 19 ? l.datetime.slice(2, 19) : l.datetime; // YY-MM-DD HH:mm:ss
					const adminPart = l.adminName ? `${l.adminName}(관리자)` : '(관리자)';
					return `${l.typeName} ${dtShort} ${adminPart}`.trim();
				});
				const colors = dayLines.map((l) => l.color);
				roomStatusesArray.push({
					id: `room-${roomEsntlId}-statuses-${dateStr}-${statusBlockIdx++}`,
					group: roomEsntlId,
					itemType: 'system',
					content,
					start: dateStr,
					end: dateStr,
					className: 'room-statuses',
					colors,
				});
			});
		});

		// 6. 추가 결제 옵션 정보 조회 및 items에 추가
		const additionalPaymentQuery = `
			SELECT 
				EP.contractEsntlId,
				EP.extraCostName,
				EP.paymentAmount,
				RC.roomEsntlId
			FROM extraPayment EP
			JOIN roomContract RC ON EP.contractEsntlId = RC.esntlId
			WHERE EP.gosiwonEsntlId = ?
				AND EP.deleteYN = 'N'
				AND EP.paymentStatus = 'COMPLETED'
			ORDER BY EP.createdAt ASC
		`;

		const additionalPayments = await mariaDBSequelize.query(additionalPaymentQuery, {
			replacements: [gosiwonEsntlId],
			type: mariaDBSequelize.QueryTypes.SELECT,
		});

		// 계약별 추가 결제 옵션 매핑
		const contractAdditionalPayments = {};
		additionalPayments.forEach((payment) => {
			if (!contractAdditionalPayments[payment.contractEsntlId]) {
				contractAdditionalPayments[payment.contractEsntlId] = [];
			}
			const amount = parseInt(payment.paymentAmount) || 0;
			const amountText = amount > 0 ? `${amount}` : '';
			contractAdditionalPayments[payment.contractEsntlId].push(
				`${payment.extraCostName} ${amountText}`
			);
		});

		// items에 추가 결제 옵션 정보 추가
		items.forEach((item) => {
			if (item.itemType === 'contract' && item.contractNumber) {
				const additionalPayments = contractAdditionalPayments[item.contractNumber] || [];
				if (additionalPayments.length > 0) {
					item.additionalPaymentOption = additionalPayments.join(', ');
				}
			}
		});

		// 7. 전체 페이지 수 계산 (최대 12개월까지 조회 가능하다고 가정)
		const totalPages = 12; // 1년치 데이터

		// 8. 응답 데이터 구성 (dependency 제거, 방이동은 items의 moveID·moveFrom·moveTo로 표시)
		// statusLabels: STATUS_MAP 기반 명칭 맵 (frontend 참조용, 관리 편의)
		const statusLabels = Object.fromEntries(
			Object.entries(STATUS_MAP).map(([k, v]) => [k, v.label])
		);
		const responseData = {
			gosiwonEsntlId: gosiwonEsntlId,
			gosiwonName: gosiwonName,
			gosiwonCeo: gosiwonCeo,
			gosiwonCeoHp: gosiwonCeoHp,
			groups: groups,
			items: items,
			roomStatuses: roomStatusesArray,
			statusLabels,
			page: pageNum,
			totalPages: totalPages,
			dateRange: {
				startDate: startDateStr,
				endDate: endDateStr,
			},
		};

		errorHandler.successThrow(res, '관리객실현황 차트 데이터 조회 성공', responseData);
	} catch (err) {
		next(err);
	}
};
