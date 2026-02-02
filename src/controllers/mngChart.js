const { mariaDBSequelize, room, customer } = require('../models');
const errorHandler = require('../middleware/error');
const { next: idsNext } = require('../utils/idsNext');

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

// 날짜 포맷팅 함수 (YYYY-MM-DD -> YYYY-MM-DD HH:mm:ss)
const formatDateTime = (dateString) => {
	if (!dateString) return null;
	const date = new Date(dateString);
	if (isNaN(date.getTime())) return null;
	return date.toISOString().slice(0, 19).replace('T', ' ');
};

// 날짜에서 시간 제거 (YYYY-MM-DD 형식으로 변환)
const formatDateOnly = (dateString) => {
	if (!dateString) return null;
	if (typeof dateString === 'string' && dateString.includes(' ')) {
		return dateString.split(' ')[0];
	}
	return dateString;
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

// 방 상태 매핑 (프론트엔드와 동일한 구조)
const STATUS_MAP = {
	'BEFORE_SALES': { color: '#9B9B9B', label: '판매신청전' },
	'ON_SALE': { color: '#27A644', label: '판매중' },
	'PENDING': { color: '#FFB800', label: '입금대기중' },
	'RESERVED': { color: '#35BB88', label: '예약중' },
	'CONTRACT': { color: '#FF8A00', label: '이용중' },
	'OVERDUE': { color: '#D25454', label: '체납상태' },
	'CHECKOUT_REQUESTED': { color: '#9B9B9B', label: '퇴실요청' },
	'CHECKOUT_CONFIRMED': { color: '#9B9B9B', label: '퇴실확정' },
	'ROOM_MOVE': { color: '#4A67DD', label: '방이동' },
	'disabled': { color: '#9B9B9B', label: '비활성' },
	'in-progress': { color: '#FF8A00', label: '이용중' },
	'leave': { color: '#9B9B9B', label: '퇴실' },
};

// 관리객실현황 차트 데이터 조회
exports.mngChartMain = async (req, res, next) => {
	try {
		verifyAdminToken(req);

		const { gosiwonEsntlId, page = 1 } = req.query;

		if (!gosiwonEsntlId) {
			errorHandler.errorThrow(400, 'gosiwonEsntlId를 입력해주세요.');
		}

		// 페이징 처리: 오늘 기준으로 2개월 간격 (로컬 날짜 사용, toISOString은 UTC라 KST에서 하루 밀림 방지)
		const pageNum = parseInt(page) || 1;
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		
		// page=1: 오늘 ~ 1개월 전, page=2: 1개월 전 ~ 2개월 전
		const endDate = new Date(today);
		endDate.setMonth(endDate.getMonth() - (pageNum - 1));
		
		const startDate = new Date(today);
		startDate.setMonth(startDate.getMonth() - pageNum);
		
		const pad2 = (n) => String(n).padStart(2, '0');
		const toYmd = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
		const endDateStr = toYmd(endDate);
		const startDateStr = toYmd(startDate);

		// 1. Groups 데이터 조회 (활성 방 목록) - roomStatus 우선, 없으면 room.status 매핑
		const groupsQuery = `
			SELECT DISTINCT
				R.esntlId AS id,
				R.roomNumber,
				R.roomNumber AS roomName,
				R.roomType AS type,
				R.window,
				R.monthlyRent,
				R.gosiwonEsntlId,
				R.orderNo AS value,
				R.status AS roomStatus,
				RS.subStatus AS roomSubStatus,
				COALESCE(
					RS.status,
					CASE 
						WHEN R.status = 'CONTRACT' THEN 'CONTRACT'
						WHEN R.status = 'RESERVE' THEN 'RESERVED'
						WHEN R.status = 'VBANK' THEN 'PENDING'
						WHEN R.status = 'EMPTY' OR R.status = '' OR R.status IS NULL THEN 'BEFORE_SALES'
						ELSE 'BEFORE_SALES'
					END
				) AS status,
				COALESCE(RS.customerName, '') AS currentGuest,
				COALESCE(CONCAT(
					DATE_FORMAT(RS.statusStartDate, '%y-%m-%d'),
					'~',
					DATE_FORMAT(RS.statusEndDate, '%y-%m-%d')
				), '') AS stayPeriod
			FROM room R
			LEFT JOIN (
				SELECT RS1.*
				FROM roomStatus RS1
				INNER JOIN (
					SELECT roomEsntlId, MAX(updatedAt) as maxUpdatedAt
					FROM roomStatus
					WHERE status IN ('CONTRACT', 'RESERVED', 'PENDING', 'ON_SALE')
					GROUP BY roomEsntlId
				) RS2 ON RS1.roomEsntlId = RS2.roomEsntlId 
					AND RS1.updatedAt = RS2.maxUpdatedAt
					AND RS1.status IN ('CONTRACT', 'RESERVED', 'PENDING', 'ON_SALE')
				WHERE RS1.esntlId = (
					SELECT esntlId 
					FROM roomStatus RS3 
					WHERE RS3.roomEsntlId = RS1.roomEsntlId 
						AND RS3.updatedAt = RS2.maxUpdatedAt
						AND RS3.status IN ('CONTRACT', 'RESERVED', 'PENDING', 'ON_SALE')
					ORDER BY RS3.esntlId DESC
					LIMIT 1
				)
			) RS ON R.esntlId = RS.roomEsntlId
			WHERE R.gosiwonEsntlId = ?
				AND R.deleteYN = 'N'
			ORDER BY R.orderNo ASC, R.roomNumber ASC
		`;

		const rooms = await mariaDBSequelize.query(groupsQuery, {
			replacements: [gosiwonEsntlId],
			type: mariaDBSequelize.QueryTypes.SELECT,
		});

		// Groups 데이터 변환 - id는 room.esntlId 사용
		// subStatus가 ROOM_MOVE_OUT/ROOM_MOVE_IN이면 '방이동'(ROOM_MOVE)으로 표시
		const groups = rooms.map((room) => {
			const baseStatus = room.status || 'BEFORE_SALES';
			const statusKey = (room.roomSubStatus === 'ROOM_MOVE_OUT' || room.roomSubStatus === 'ROOM_MOVE_IN')
				? 'ROOM_MOVE'
				: baseStatus;
			const statusInfo = STATUS_MAP[statusKey] || STATUS_MAP['BEFORE_SALES'];
			
			return {
				id: room.id, // room.esntlId
				roomEsntlId: room.id, // room.esntlId
				roomNumber: room.roomNumber,
				roomName: room.roomName || room.roomNumber,
				status: statusInfo.label,
				type: room.type || '',
				window: room.window || '',
				monthlyRent: parseInt(room.monthlyRent) || 0,
				currentGuest: room.currentGuest || '',
				stayPeriod: room.stayPeriod || '',
				value: room.value || 0,
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

		// 2. Items 데이터 조회 (계약 정보) - 날짜 범위 필터 적용
		const contractItemsQuery = `
			SELECT 
				RC.esntlId AS id,
				RC.roomEsntlId,
				RC.gosiwonEsntlId,
				RC.startDate,
				RC.endDate,
				RC.checkInTime,
				RC.contractDate,
				RC.month,
				RC.status AS contractStatus,
				RC.monthlyRent,
				R.roomNumber,
				R.monthlyRent AS roomMonthlyRent,
				R.deposit AS roomDeposit,
				C.name AS customerName,
				C.phone AS customerPhone,
				C.gender AS customerGender,
				COALESCE(RCW.customerAge, ROUND((TO_DAYS(NOW()) - (TO_DAYS(C.birth))) / 365)) AS customerAge,
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
				PL.pyl_goods_amount
			FROM roomContract RC
			JOIN room R ON RC.roomEsntlId = R.esntlId
			JOIN customer C ON RC.customerEsntlId = C.esntlId
			LEFT JOIN roomContractWho RCW ON RC.esntlId = RCW.contractEsntlId
			LEFT JOIN (
				SELECT 
					contractEsntlId,
					SUM(CAST(paymentAmount AS UNSIGNED)) AS paymentAmount,
					SUM(pyl_goods_amount) AS pyl_goods_amount
				FROM paymentLog
				WHERE withdrawalStatus != 'WITHDRAWAL'
					AND isExtra = 0
				GROUP BY contractEsntlId
			) PL ON RC.esntlId = PL.contractEsntlId
			WHERE RC.gosiwonEsntlId = ?
				AND R.deleteYN = 'N'
				AND RC.startDate <= ?
				AND RC.endDate >= ?
			ORDER BY RC.startDate ASC
		`;

		const contracts = await mariaDBSequelize.query(contractItemsQuery, {
			replacements: [gosiwonEsntlId, endDateStr, startDateStr],
			type: mariaDBSequelize.QueryTypes.SELECT,
		});

		// 3. 비활성 상태 Items 조회 (roomStatus에서 퇴실, 점검중 등) - 날짜 범위 필터 적용
		const disabledItemsQuery = `
			SELECT 
				RS.esntlId AS id,
				RS.roomEsntlId,
				RS.status,
				RS.statusMemo,
				RS.etcStartDate,
				RS.etcEndDate,
				R.roomNumber
			FROM roomStatus RS
			JOIN room R ON RS.roomEsntlId = R.esntlId
			WHERE RS.gosiwonEsntlId = ?
				AND RS.status IN ('CHECKOUT_CONFIRMED', 'CHECKOUT_REQUESTED')
				AND R.deleteYN = 'N'
				AND (RS.etcStartDate IS NOT NULL OR RS.statusEndDate IS NOT NULL)
				AND (
					(COALESCE(RS.etcStartDate, RS.statusEndDate) >= ? AND COALESCE(RS.etcStartDate, RS.statusEndDate) < ?)
					OR (COALESCE(RS.etcEndDate, RS.statusEndDate) >= ? AND COALESCE(RS.etcEndDate, RS.statusEndDate) < ?)
					OR (COALESCE(RS.etcStartDate, RS.statusEndDate) < ? AND COALESCE(RS.etcEndDate, RS.statusEndDate) >= ?)
				)
			ORDER BY COALESCE(RS.etcStartDate, RS.statusEndDate) ASC
		`;

		const disabledStatuses = await mariaDBSequelize.query(disabledItemsQuery, {
			replacements: [
				gosiwonEsntlId,
				startDateStr,
				endDateStr,
				startDateStr,
				endDateStr,
				startDateStr,
				endDateStr
			],
			type: mariaDBSequelize.QueryTypes.SELECT,
		});

		// 3-1. 방이동 목록 조회 (날짜 구간과 겹치는 moveDate)
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

		// 4. Items 데이터 변환
		const items = [];
		let itemIdCounter = 0;
		const dependency = [];

		// 계약 Items 추가
		contracts.forEach((contract) => {
			const groupIndex = roomIdToGroupIndex[contract.roomEsntlId];
			if (groupIndex === undefined) return;

			const startDate = formatDateOnly(contract.startDate);
			const endDate = formatDateOnly(contract.endDate);
			if (!startDate || !endDate) return;

			const contractType = getContractType(contract.contractDate, contract.startDate);
			const paymentAmount = parseInt(contract.paymentAmount) || 0;
			const entryFee = contract.pyl_goods_amount || 0;

			// 입실자 정보 구성
			const guestName = contract.checkinName || contract.customerName || '';
			const guestAge = contract.checkinAge || contract.customerAge || '';
			const guestGender = contract.checkinGender || contract.customerGender || '';
			const guestPhone = contract.checkinPhone || contract.customerPhone || '';
			const guest = `${guestName} / ${guestAge} / ${guestGender}(${guestPhone})`;

			// 계약자 정보 구성
			const contractorName = contract.contractorName || contract.customerName || '';
			const contractorAge = contract.contractorAge || contract.customerAge || '';
			const contractorGender = contract.contractorGender || contract.customerGender || '';
			const contractorPhone = contract.contractorPhone || contract.customerPhone || '';
			const contractor = `${contractorName} / ${contractorAge} / ${contractorGender}(${contractorPhone})`;

			// 계좌정보
			const accountInfo = contract.customerBank && contract.customerBankAccount
				? `${contract.customerBank} ${contract.customerBankAccount} ${contractorName}`
				: '-';

			// 보증금
			const deposit = contract.roomDeposit || 0;

			// 추가 결제 옵션 조회 (주차비 등)
			// 이 부분은 별도 쿼리로 가져와야 함 (추후 최적화 가능)

			// 기간 표시 형식 (MM-dd ~ MM-dd)
			const period = startDate && endDate
				? `${startDate.slice(5, 7)}-${startDate.slice(8, 10)} ~ ${endDate.slice(5, 7)}-${endDate.slice(8, 10)}`
				: '';

			// 계약 상태에 따른 className 결정
			const contractStatus = contract.contractStatus;
			let className = 'timeline-item leave';
			if (contractStatus === 'ACTIVE' || contractStatus === 'CONTRACT') {
				className = 'timeline-item in-progress';
			}

			items.push({
				id: itemIdCounter++,
				group: contract.roomEsntlId,
				itemType: 'contract',
				start: formatDateTime(startDate),
				end: formatDateTime(endDate + ' 23:59:59'),
				period: period,
				currentGuest: guestName,
				guestPhone: guestPhone,
				className: className,
				contractNumber: contract.id,
				guest: guest,
				contractPerson: contractor,
				periodType: contract.month ? `${contract.month}개월` : '1개월',
				contractType: contractType,
				entryFee: entryFee > 0 ? `${Math.floor(entryFee / 10000)} 만원` : '0 원',
				paymentAmount: paymentAmount > 0 ? `${Math.floor(paymentAmount / 10000)} 만원` : '0 원',
				accountInfo: accountInfo,
				deposit: deposit > 0 ? `${deposit.toLocaleString()} 원` : '0 원',
				additionalPaymentOption: '-', // 추후 추가 결제 옵션 조회로 채워야 함
			});
		});

		// 비활성 상태 Items 추가
		disabledStatuses.forEach((status) => {
			const groupIndex = roomIdToGroupIndex[status.roomEsntlId];
			if (groupIndex === undefined) return;

			const startDate = status.etcStartDate || status.statusEndDate;
			const endDate = status.etcEndDate;
			if (!startDate) return;

			let content = '퇴실';
			if (status.statusMemo) {
				content = status.statusMemo;
			} else if (status.status === 'CHECKOUT_CONFIRMED') {
				content = '퇴실';
			} else if (status.status === 'CHECKOUT_REQUESTED') {
				content = '점검중';
			}

			const formattedStart = formatDateTime(startDate);
			const formattedEnd = endDate ? formatDateTime(endDate + ' 23:59:59') : formatDateTime(startDate + ' 23:59:59');

			items.push({
				id: itemIdCounter++,
				group: status.roomEsntlId,
				itemType: 'disabled',
				className: 'disabled',
				start: formattedStart,
				end: formattedEnd,
				content: content,
				reason: status.statusMemo || '',
				description: status.statusMemo || '판매 및 룸투어, 입실이 불가합니다.',
			});
		});

		// 4-1. 방이동 Items 및 dependency (ROOM_MOVE_OUT → id_item_1, ROOM_MOVE_IN → id_item_2)
		let dependencyId = 1;
		roomMoves.forEach((move) => {
			if (roomIdToGroupIndex[move.originalRoomEsntlId] === undefined || roomIdToGroupIndex[move.targetRoomEsntlId] === undefined) return;
			const moveDateStr = move.moveDate
				? (typeof move.moveDate === 'string'
					? move.moveDate.split(' ')[0].split('T')[0]
					: move.moveDate.toISOString?.().slice(0, 10) || String(move.moveDate).slice(0, 10))
				: null;
			if (!moveDateStr) return;
			const moveStart = formatDateTime(moveDateStr);
			const moveEnd = formatDateTime(moveDateStr + ' 23:59:59');
			const outItemId = itemIdCounter++;
			const inItemId = itemIdCounter++;
			items.push({
				id: outItemId,
				group: move.originalRoomEsntlId,
				itemType: 'room_move_out',
				className: 'room-move-out',
				start: moveStart,
				end: moveEnd,
				content: '방이동(출)',
				title: '방이동',
			});
			items.push({
				id: inItemId,
				group: move.targetRoomEsntlId,
				itemType: 'room_move_in',
				className: 'room-move-in',
				start: moveStart,
				end: moveEnd,
				content: '방이동(입)',
				title: '방이동',
			});
			dependency.push({
				id: dependencyId++,
				id_item_1: outItemId,
				id_item_2: inItemId,
				title: '방이동',
				direction: 0,
				color: '#4A67DD',
				line: 2,
				type: 2,
			});
		});

		// 5. RoomStatuses 데이터 조회 (방 상태 이력) - 날짜 범위 필터 적용
		const roomStatusesQuery = `
			SELECT 
				RS.esntlId AS id,
				RS.roomEsntlId,
				RS.status,
				RS.statusMemo,
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
				AND RS.status IN (
					'BEFORE_SALES', 'ON_SALE', 'PENDING', 
					'RESERVED', 'CHECKOUT_REQUESTED', 'CHECKOUT_CONFIRMED'
				)
				AND DATE(RS.createdAt) >= ?
				AND DATE(RS.createdAt) < ?
			ORDER BY RS.createdAt DESC
		`;

		const roomStatuses = await mariaDBSequelize.query(roomStatusesQuery, {
			replacements: [gosiwonEsntlId, startDateStr, endDateStr],
			type: mariaDBSequelize.QueryTypes.SELECT,
		});

		// RoomStatuses 데이터 변환 (각 상태를 개별 아이템으로 분리)
		const roomStatusesArray = [];
		let statusItemIdCounter = 0;
		
		roomStatuses.forEach((status) => {
			const groupIndex = roomIdToGroupIndex[status.roomEsntlId];
			if (groupIndex === undefined) return;

			const statusDate = formatDateOnly(status.createdAt);
			if (!statusDate) return;

			// 상태 레이블 변환
			const statusInfo = STATUS_MAP[status.status] || { label: status.status, color: '#9B9B9B' };
			const adminName = status.adminName || '관리자';
			const timestamp = status.createdAt 
				? new Date(status.createdAt).toLocaleString('ko-KR', { 
					year: '2-digit', 
					month: '2-digit', 
					day: '2-digit', 
					hour: '2-digit', 
					minute: '2-digit', 
					second: '2-digit',
					hour12: false
				}).replace(/\./g, '-').replace(/,/g, '').trim()
				: '';
			
			const contentText = `${statusInfo.label} ${timestamp} ${adminName}(관리자)`;

			// 각 상태를 개별 아이템으로 생성
			roomStatusesArray.push({
				id: `room-${status.roomEsntlId}-statuses-${statusItemIdCounter++}`,
				group: status.roomEsntlId,
				itemType: 'system',
				content: [contentText],
				colors: [statusInfo.color],
				start: formatDateTime(statusDate),
				end: null,
				className: 'room-statuses',
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
			const amountText = amount > 0 ? `${Math.floor(amount / 10000)}만원` : '';
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

		// 8. 응답 데이터 구성
		const responseData = {
			gosiwonEsntlId: gosiwonEsntlId,
			groups: groups,
			items: items,
			dependency: dependency,
			roomStatuses: roomStatusesArray,
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

// ID 생성 함수들
const generateRoomId = async (transaction) => {
	const [result] = await mariaDBSequelize.query(
		`SELECT CONCAT('ROOM', LPAD(COALESCE(MAX(CAST(SUBSTRING(esntlId, 5) AS UNSIGNED)), 0) + 1, 10, '0')) AS nextId FROM room WHERE esntlId LIKE 'ROOM%'`,
		{ type: mariaDBSequelize.QueryTypes.SELECT, transaction }
	);
	return result?.nextId || 'ROOM0000000001';
};

const generateCustomerId = async (transaction) => {
	const [result] = await mariaDBSequelize.query(
		`SELECT CONCAT('CUTR', LPAD(COALESCE(MAX(CAST(SUBSTRING(esntlId, 5) AS UNSIGNED)), 0) + 1, 10, '0')) AS nextId FROM customer WHERE esntlId LIKE 'CUTR%'`,
		{ type: mariaDBSequelize.QueryTypes.SELECT, transaction }
	);
	return result?.nextId || 'CUTR0000000001';
};

const generateContractId = async (transaction) => {
	const [result] = await mariaDBSequelize.query(
		`SELECT CONCAT('RCTT', LPAD(COALESCE(MAX(CAST(SUBSTRING(esntlId, 5) AS UNSIGNED)), 0) + 1, 10, '0')) AS nextId FROM roomContract WHERE esntlId LIKE 'RCTT%'`,
		{ type: mariaDBSequelize.QueryTypes.SELECT, transaction }
	);
	return result?.nextId || 'RCTT0000000001';
};

const generatePaymentLogId = async (transaction) => {
	const [result] = await mariaDBSequelize.query(
		`SELECT CONCAT('PYMT', LPAD(COALESCE(MAX(CAST(SUBSTRING(esntlId, 5) AS UNSIGNED)), 0) + 1, 10, '0')) AS nextId FROM paymentLog WHERE esntlId LIKE 'PYMT%'`,
		{ type: mariaDBSequelize.QueryTypes.SELECT, transaction }
	);
	return result?.nextId || 'PYMT0000000001';
};

const generateExtraPaymentId = async (transaction) => {
	const [result] = await mariaDBSequelize.query(
		`SELECT CONCAT('EXTR', LPAD(COALESCE(MAX(CAST(SUBSTRING(esntlId, 5) AS UNSIGNED)), 0) + 1, 10, '0')) AS nextId FROM extraPayment WHERE esntlId LIKE 'EXTR%'`,
		{ type: mariaDBSequelize.QueryTypes.SELECT, transaction }
	);
	return result?.nextId || 'EXTR0000000001';
};

// 테스트 데이터 삽입 API
exports.createTestData = async (req, res, next) => {
	const transaction = await mariaDBSequelize.transaction();
	try {
		verifyAdminToken(req);

		const { gosiwonEsntlId } = req.body;

		if (!gosiwonEsntlId) {
			errorHandler.errorThrow(400, 'gosiwonEsntlId를 입력해주세요.');
		}

		const createdData = {
			rooms: [],
			customers: [],
			roomStatuses: [],
			contracts: [],
			paymentLogs: [],
			extraPayments: [],
		};

		// 현재 날짜 기준으로 테스트 데이터 생성
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		
		// 2025년 8월 1일부터 현재까지의 랜덤 날짜 생성
		const startDate = new Date('2025-08-01');
		const endDate = new Date(today);
		
		// 두 날짜 사이의 랜덤 날짜 생성 함수
		const getRandomDate = (start, end) => {
			const startTime = start.getTime();
			const endTime = end.getTime();
			const randomTime = startTime + Math.random() * (endTime - startTime);
			return new Date(randomTime);
		};
		
		// 랜덤 날짜 생성 함수 (YYYY-MM-DD 형식)
		const getRandomDateString = (start, end) => {
			const date = getRandomDate(start, end);
			return date.toISOString().slice(0, 10);
		};

		// 랜덤 숫자 생성 함수 (min ~ max)
		const getRandomInt = (min, max) => {
			return Math.floor(Math.random() * (max - min + 1)) + min;
		};

		// 랜덤 이름 생성 함수
		const generateRandomName = () => {
			const surnames = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임'];
			const firstNames = ['민준', '서준', '도윤', '예준', '시우', '하준', '주원', '지호', '준서', '건우', 
								'서연', '서윤', '지우', '서현', '민서', '하은', '예은', '윤서', '채원', '지원'];
			const surname = surnames[getRandomInt(0, surnames.length - 1)];
			const firstName = firstNames[getRandomInt(0, firstNames.length - 1)];
			return surname + firstName;
		};

		// 랜덤 전화번호 생성 함수
		const generateRandomPhone = () => {
			const middle = String(getRandomInt(1000, 9999));
			const last = String(getRandomInt(1000, 9999));
			return `010${middle}${last}`;
		};

		// 1. 해당 고시원의 기존 방 조회
		const existingRooms = await room.findAll({
			where: {
				gosiwonEsntlId: gosiwonEsntlId,
				deleteYN: 'N',
			},
			attributes: ['esntlId', 'roomNumber'],
			transaction,
		});

		if (existingRooms.length === 0) {
			errorHandler.errorThrow(400, '해당 고시원에 등록된 방이 없습니다.');
		}

		// 2. 기존 방 중에서 랜덤하게 선택 (3~10개 또는 전체 방 개수 중 작은 값)
		const maxRoomCount = Math.min(getRandomInt(3, 10), existingRooms.length);
		const selectedRooms = [];
		const usedIndices = new Set();

		while (selectedRooms.length < maxRoomCount) {
			const randomIndex = getRandomInt(0, existingRooms.length - 1);
			if (!usedIndices.has(randomIndex)) {
				usedIndices.add(randomIndex);
				selectedRooms.push(existingRooms[randomIndex]);
			}
		}

		// 3. 선택된 방들에 대해 테스트 데이터 생성
		for (let i = 0; i < selectedRooms.length; i++) {
			const selectedRoom = selectedRooms[i];
			const roomId = selectedRoom.esntlId;
			const roomNumber = selectedRoom.roomNumber;

			createdData.rooms.push({ esntlId: roomId, roomNumber });

			// 2. 고객 데이터 생성 (각 방마다 랜덤 0~2명)
			const roomCustomers = []; // 이 방에 생성된 고객들 저장
			const customerCount = getRandomInt(0, 2);
			for (let j = 0; j < customerCount; j++) {
				const customerId = await generateCustomerId(transaction);
				const customerName = generateRandomName();
				const customerPhone = generateRandomPhone();
				const gender = getRandomInt(0, 1) === 0 ? 'M' : 'F';
				const birthYear = getRandomInt(1980, 2000);
				const birthMonth = String(getRandomInt(1, 12)).padStart(2, '0');
				const birthDay = String(getRandomInt(1, 28)).padStart(2, '0');
				const birth = `${birthYear}-${birthMonth}-${birthDay}`;
				const banks = ['KB국민은행', '신한은행', '우리은행', '하나은행', 'NH농협은행', 'IBK기업은행'];
				const bank = banks[getRandomInt(0, banks.length - 1)];
				const bankAccount = String(getRandomInt(1000000000, 9999999999));

				await customer.create(
					{
						esntlId: customerId,
						name: customerName,
						phone: customerPhone,
						gender: gender,
						birth: birth,
						bank: bank,
						bankAccount: bankAccount,
						regDate: today.toISOString().slice(0, 19).replace('T', ' '),
						cus_status: 'USED',
					},
					{ transaction }
				);

				roomCustomers.push({ esntlId: customerId, name: customerName, phone: customerPhone, gender: gender });
				createdData.customers.push({ esntlId: customerId, name: customerName });
			}

			// 3. 방 상태 데이터 생성 (랜덤 상태 할당)
			const statusId = await idsNext('roomStatus', undefined, transaction);
			// 고객이 있으면 CONTRACT 또는 RESERVED, 없으면 ON_SALE
			const statusOptions = roomCustomers.length > 0 
				? ['CONTRACT', 'RESERVED', 'ON_SALE'] 
				: ['ON_SALE'];
			const status = statusOptions[getRandomInt(0, statusOptions.length - 1)];
			
			// 고객이 있는 경우 랜덤하게 선택, 없는 경우 null
			const selectedCustomer = roomCustomers.length > 0 
				? roomCustomers[getRandomInt(0, roomCustomers.length - 1)] 
				: null;
			const customerId = selectedCustomer ? selectedCustomer.esntlId : null;
			const customerName = selectedCustomer ? selectedCustomer.name : null;
			
			// 상태별 날짜 범위 설정 (2025년 8월부터 현재까지 랜덤)
			let statusStartDate, statusEndDate;
			if (status === 'CONTRACT') {
				// 이용중: 랜덤 시작일부터 1개월 후까지
				const randomStart = getRandomDateString(startDate, endDate);
				const startDateObj = new Date(randomStart);
				const endDateObj = new Date(startDateObj);
				endDateObj.setMonth(endDateObj.getMonth() + 1);
				statusStartDate = formatDateTime(randomStart);
				statusEndDate = formatDateTime(endDateObj.toISOString().slice(0, 10));
			} else if (status === 'RESERVED') {
				// 예약중: 랜덤 시작일부터 1개월 후까지
				const randomStart = getRandomDateString(startDate, endDate);
				const startDateObj = new Date(randomStart);
				const endDateObj = new Date(startDateObj);
				endDateObj.setMonth(endDateObj.getMonth() + 1);
				statusStartDate = formatDateTime(randomStart);
				statusEndDate = formatDateTime(endDateObj.toISOString().slice(0, 10));
			} else {
				// 판매중: 랜덤 시작일부터 현재까지
				const randomStart = getRandomDateString(startDate, endDate);
				statusStartDate = formatDateTime(randomStart);
				statusEndDate = formatDateTime(today.toISOString().slice(0, 10));
			}

			await mariaDBSequelize.query(
				`INSERT INTO roomStatus (
					esntlId, roomEsntlId, gosiwonEsntlId, status, customerEsntlId, customerName,
					statusStartDate, statusEndDate, createdAt, updatedAt
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
				{
					replacements: [statusId, roomId, gosiwonEsntlId, status, customerId, customerName, statusStartDate, statusEndDate],
					type: mariaDBSequelize.QueryTypes.INSERT,
					transaction,
				}
			);

			createdData.roomStatuses.push({ esntlId: statusId, roomId, status });

			// 4. 계약 데이터 생성 (CONTRACT, RESERVED 상태인 경우만)
			if (status === 'CONTRACT' || status === 'RESERVED') {
				const contractId = await generateContractId(transaction);
				
				// 계약별 날짜 범위 설정 (2025년 8월부터 현재까지 랜덤)
				// 계약 시작일을 랜덤으로 생성
				const contractStartDateStr = getRandomDateString(startDate, endDate);
				const contractStartDateObj = new Date(contractStartDateStr);
				const contractEndDateObj = new Date(contractStartDateObj);
				contractEndDateObj.setMonth(contractEndDateObj.getMonth() + 1); // 1개월 후
				
				const contractDate = contractStartDateStr;
				const contractStartDate = contractStartDateStr;
				const contractEndDate = contractEndDateObj.toISOString().slice(0, 10);

				// monthlyRent는 10000으로 나눈 값으로 저장 (500000 -> 50)
				const monthlyRentValue = 50; // 500000 / 10000

				await mariaDBSequelize.query(
					`INSERT INTO roomContract (
						esntlId, roomEsntlId, gosiwonEsntlId, customerEsntlId,
						startDate, endDate, contractDate, month, status,
						customerName, customerPhone, customerGender, customerAge,
						checkinName, checkinPhone, checkinGender, checkinAge,
						monthlyRent
					) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'ACTIVE', ?, ?, ?, 30, ?, ?, ?, 30, ?)`,
					{
						replacements: [
							contractId,
							roomId,
							gosiwonEsntlId,
							selectedCustomer.esntlId,
							contractStartDate,
							contractEndDate,
							contractDate,
							selectedCustomer.name,
							selectedCustomer.phone,
							selectedCustomer.gender,
							selectedCustomer.name,
							selectedCustomer.phone,
							selectedCustomer.gender,
							monthlyRentValue,
						],
						type: mariaDBSequelize.QueryTypes.INSERT,
						transaction,
					}
				);

				createdData.contracts.push({ esntlId: contractId, roomId, customerId: selectedCustomer.esntlId });

				// 4-1. 계약 관련 roomStatus 이력 생성 (PENDING, RESERVED, CONTRACT 등)
				// 입금대기중 상태 (계약 시작일 3일 전)
				const depositPendingDateObj = new Date(contractStartDate);
				depositPendingDateObj.setDate(depositPendingDateObj.getDate() - 3);
				const depositPendingDate = depositPendingDateObj.toISOString().slice(0, 10);
				const depositPendingStatusId = await idsNext('roomStatus', undefined, transaction);
				
				await mariaDBSequelize.query(
					`INSERT INTO roomStatus (
						esntlId, roomEsntlId, gosiwonEsntlId, status, customerEsntlId, customerName,
						contractEsntlId, statusStartDate, statusEndDate, createdAt, updatedAt
					) VALUES (?, ?, ?, 'PENDING', ?, ?, ?, ?, ?, NOW(), NOW())`,
					{
						replacements: [
							depositPendingStatusId,
							roomId,
							gosiwonEsntlId,
							selectedCustomer.esntlId,
							selectedCustomer.name,
							contractId,
							formatDateTime(depositPendingDate),
							formatDateTime(contractStartDate),
						],
						type: mariaDBSequelize.QueryTypes.INSERT,
						transaction,
					}
				);
				createdData.roomStatuses.push({ esntlId: depositPendingStatusId, roomId, status: 'PENDING' });

				// 예약중 상태 (계약 시작일 1일 전)
				const reservedDateObj = new Date(contractStartDate);
				reservedDateObj.setDate(reservedDateObj.getDate() - 1);
				const reservedDate = reservedDateObj.toISOString().slice(0, 10);
				const reservedStatusId = await idsNext('roomStatus', undefined, transaction);
				
				await mariaDBSequelize.query(
					`INSERT INTO roomStatus (
						esntlId, roomEsntlId, gosiwonEsntlId, status, customerEsntlId, customerName,
						contractEsntlId, statusStartDate, statusEndDate, createdAt, updatedAt
					) VALUES (?, ?, ?, 'RESERVED', ?, ?, ?, ?, ?, NOW(), NOW())`,
					{
						replacements: [
							reservedStatusId,
							roomId,
							gosiwonEsntlId,
							selectedCustomer.esntlId,
							selectedCustomer.name,
							contractId,
							formatDateTime(reservedDate),
							formatDateTime(contractStartDate),
						],
						type: mariaDBSequelize.QueryTypes.INSERT,
						transaction,
					}
				);
				createdData.roomStatuses.push({ esntlId: reservedStatusId, roomId, status: 'RESERVED' });

				// 이용중 상태 (계약 시작일)
				const inUseStatusId = await idsNext('roomStatus', undefined, transaction);
				await mariaDBSequelize.query(
					`INSERT INTO roomStatus (
						esntlId, roomEsntlId, gosiwonEsntlId, status, customerEsntlId, customerName,
						contractEsntlId, statusStartDate, statusEndDate, createdAt, updatedAt
					) VALUES (?, ?, ?, 'CONTRACT', ?, ?, ?, ?, ?, NOW(), NOW())`,
					{
						replacements: [
							inUseStatusId,
							roomId,
							gosiwonEsntlId,
							selectedCustomer.esntlId,
							selectedCustomer.name,
							contractId,
							formatDateTime(contractStartDate),
							formatDateTime(contractEndDate),
						],
						type: mariaDBSequelize.QueryTypes.INSERT,
						transaction,
					}
				);
				createdData.roomStatuses.push({ esntlId: inUseStatusId, roomId, status: 'CONTRACT' });

				// 판매중 상태 (계약 시작 전 - 랜덤하게 일부 방에만)
				if (getRandomInt(0, 2) === 0) { // 33% 확률
					const onSaleDateObj = new Date(contractStartDate);
					onSaleDateObj.setDate(onSaleDateObj.getDate() - 5);
					const onSaleDate = onSaleDateObj.toISOString().slice(0, 10);
					const onSaleStatusId = await idsNext('roomStatus', undefined, transaction);
					
					await mariaDBSequelize.query(
						`INSERT INTO roomStatus (
							esntlId, roomEsntlId, gosiwonEsntlId, status, createdAt, updatedAt
						) VALUES (?, ?, ?, 'ON_SALE', NOW(), NOW())`,
						{
							replacements: [
								onSaleStatusId,
								roomId,
								gosiwonEsntlId,
							],
							type: mariaDBSequelize.QueryTypes.INSERT,
							transaction,
						}
					);
					createdData.roomStatuses.push({ esntlId: onSaleStatusId, roomId, status: 'ON_SALE' });
				}

				// 5. 결제 로그 데이터 생성
				const paymentLogId = await generatePaymentLogId(transaction);
				// 결제 날짜는 계약 시작일로 설정
				const pDate = contractStartDate;
				const pTime = '10:00:00';

				await mariaDBSequelize.query(
					`INSERT INTO paymentLog (
						esntlId, contractEsntlId, gosiwonEsntlId, roomEsntlId, customerEsntlId,
						pDate, pTime, paymentAmount, pyl_goods_amount, paymentType,
						withdrawalStatus, isExtra, imp_uid
					) VALUES (?, ?, ?, ?, ?, ?, ?, '700000', 700000, 'accountPayment', NULL, 0, 'TEST_IMP_UID')`,
					{
						replacements: [paymentLogId, contractId, gosiwonEsntlId, roomId, selectedCustomer.esntlId, pDate, pTime],
						type: mariaDBSequelize.QueryTypes.INSERT,
						transaction,
					}
				);

				createdData.paymentLogs.push({ esntlId: paymentLogId, contractId });

				// 6. 추가 결제 데이터 생성 (랜덤하게 일부 계약에만)
				if (getRandomInt(0, 2) === 0) { // 33% 확률
					const extraPaymentId = await generateExtraPaymentId(transaction);

					await mariaDBSequelize.query(
						`INSERT INTO extraPayment (
							esntlId, contractEsntlId, gosiwonEsntlId, roomEsntlId, customerEsntlId,
							extraCostName, paymentAmount, pyl_goods_amount, paymentStatus,
							deleteYN, imp_uid, createdAt, updatedAt
						) VALUES (?, ?, ?, ?, ?, '주차비', '100000', 100000, 'COMPLETED', 'N', 'TEST_IMP_UID', NOW(), NOW())`,
						{
							replacements: [extraPaymentId, contractId, gosiwonEsntlId, roomId, selectedCustomer.esntlId],
							type: mariaDBSequelize.QueryTypes.INSERT,
							transaction,
						}
					);

					createdData.extraPayments.push({ esntlId: extraPaymentId, contractId });
				}
			}
		}

		await transaction.commit();

		errorHandler.successThrow(res, '테스트 데이터 생성 성공', createdData);
	} catch (err) {
		await transaction.rollback();
		next(err);
	}
};
