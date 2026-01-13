const { mariaDBSequelize, room, customer } = require('../models');
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
	'DEPOSIT_PENDING': { color: '#FFB800', label: '입금대기중' },
	'RESERVED': { color: '#35BB88', label: '예약중' },
	'IN_USE': { color: '#FF8A00', label: '이용중' },
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

		// 페이징 처리: 오늘 기준으로 1개월 간격
		const pageNum = parseInt(page) || 1;
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		
		// page=1: 오늘 ~ 1개월 전, page=2: 1개월 전 ~ 2개월 전
		const endDate = new Date(today);
		endDate.setMonth(endDate.getMonth() - (pageNum - 1));
		
		const startDate = new Date(today);
		startDate.setMonth(startDate.getMonth() - pageNum);
		
		// 날짜 범위 문자열 생성 (YYYY-MM-DD 형식)
		const endDateStr = endDate.toISOString().slice(0, 10);
		const startDateStr = startDate.toISOString().slice(0, 10);

		// 1. Groups 데이터 조회 (활성 방 목록)
		const groupsQuery = `
			SELECT 
				R.esntlId AS id,
				R.roomNumber,
				R.roomNumber AS roomName,
				R.roomType AS type,
				R.window,
				R.monthlyRent,
				R.gosiwonEsntlId,
				R.orderNo AS value,
				COALESCE(RS.status, 'BEFORE_SALES') AS status,
				COALESCE(RS.customerName, '') AS currentGuest,
				COALESCE(CONCAT(
					DATE_FORMAT(RS.statusStartDate, '%y-%m-%d'),
					'~',
					DATE_FORMAT(RS.statusEndDate, '%y-%m-%d')
				), '') AS stayPeriod
			FROM room R
			LEFT JOIN roomStatus RS ON R.esntlId = RS.roomEsntlId 
				AND RS.status IN ('IN_USE', 'RESERVED', 'DEPOSIT_PENDING', 'ON_SALE')
			WHERE R.gosiwonEsntlId = ?
				AND R.deleteYN = 'N'
			ORDER BY R.orderNo ASC, R.roomNumber ASC
		`;

		const rooms = await mariaDBSequelize.query(groupsQuery, {
			replacements: [gosiwonEsntlId],
			type: mariaDBSequelize.QueryTypes.SELECT,
		});

		// Groups 데이터 변환
		const groups = rooms.map((room, index) => {
			const statusKey = room.status || 'BEFORE_SALES';
			const statusInfo = STATUS_MAP[statusKey] || STATUS_MAP['BEFORE_SALES'];
			
			return {
				id: index,
				roomNumber: room.roomNumber,
				roomName: room.roomName || room.roomNumber,
				status: statusInfo.label,
				type: room.type || '',
				window: room.window || '',
				monthlyRent: parseInt(room.monthlyRent) || 0,
				currentGuest: room.currentGuest || '',
				stayPeriod: room.stayPeriod || '',
				value: room.value || index + 1,
				color: {
					sidebar: statusInfo.color,
					statusBorder: statusInfo.color,
					statusText: statusInfo.color,
				},
			};
		});

		// 방 ID 매핑 생성 (roomEsntlId -> group index)
		const roomIdToGroupIndex = {};
		rooms.forEach((room, index) => {
			roomIdToGroupIndex[room.id] = index; // room.id는 esntlId
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
				COALESCE(RC.customerAge, ROUND((TO_DAYS(NOW()) - (TO_DAYS(C.birth))) / 365)) AS customerAge,
				C.bank AS customerBank,
				C.bankAccount AS customerBankAccount,
				RC.checkinName,
				RC.checkinPhone,
				RC.checkinGender,
				RC.checkinAge,
				RC.customerName AS contractorName,
				RC.customerPhone AS contractorPhone,
				RC.customerGender AS contractorGender,
				RC.customerAge AS contractorAge,
				PL.paymentAmount,
				PL.pyl_goods_amount
			FROM roomContract RC
			JOIN room R ON RC.roomEsntlId = R.esntlId
			JOIN customer C ON RC.customerEsntlId = C.esntlId
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
				AND (
					(RC.startDate >= ? AND RC.startDate < ?)
					OR (RC.endDate >= ? AND RC.endDate < ?)
					OR (RC.startDate < ? AND RC.endDate >= ?)
				)
			ORDER BY RC.startDate ASC
		`;

		const contracts = await mariaDBSequelize.query(contractItemsQuery, {
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

		// 4. Items 데이터 변환
		const items = [];
		let itemIdCounter = 0;

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
			if (contractStatus === 'ACTIVE' || contractStatus === 'IN_USE') {
				className = 'timeline-item in-progress';
			}

			items.push({
				id: itemIdCounter++,
				group: groupIndex,
				itemType: 'contract',
				start: formatDateTime(startDate),
				end: formatDateTime(endDate + ' 23:59:59'),
				period: period,
				currentGuest: guestName,
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
				group: groupIndex,
				itemType: 'disabled',
				className: 'disabled',
				start: formattedStart,
				end: formattedEnd,
				content: content,
				reason: status.statusMemo || '',
				description: status.statusMemo || '판매 및 룸투어, 입실이 불가합니다.',
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
					'BEFORE_SALES', 'ON_SALE', 'DEPOSIT_PENDING', 
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
				id: `room-${groupIndex}-statuses-${statusItemIdCounter++}`,
				group: groupIndex,
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
			groups: groups,
			items: items,
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

const generateRoomStatusId = async (transaction) => {
	const [result] = await mariaDBSequelize.query(
		`SELECT CONCAT('RSTA', LPAD(COALESCE(MAX(CAST(SUBSTRING(esntlId, 5) AS UNSIGNED)), 0) + 1, 10, '0')) AS nextId FROM roomStatus WHERE esntlId LIKE 'RSTA%'`,
		{ type: mariaDBSequelize.QueryTypes.SELECT, transaction }
	);
	return result?.nextId || 'RSTA0000000001';
};

const generateContractId = async (transaction) => {
	const [result] = await mariaDBSequelize.query(
		`SELECT CONCAT('RCON', LPAD(COALESCE(MAX(CAST(SUBSTRING(esntlId, 5) AS UNSIGNED)), 0) + 1, 10, '0')) AS nextId FROM roomContract WHERE esntlId LIKE 'RCON%'`,
		{ type: mariaDBSequelize.QueryTypes.SELECT, transaction }
	);
	return result?.nextId || 'RCON0000000001';
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
		
		// 최근 한 달 내 기간 설정 (과거 포함)
		const oneMonthAgo = new Date(today);
		oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
		
		const twoWeeksAgo = new Date(today);
		twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
		
		const oneWeekAgo = new Date(today);
		oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
		
		const twoWeeksLater = new Date(today);
		twoWeeksLater.setDate(twoWeeksLater.getDate() + 14);
		
		const oneMonthLater = new Date(today);
		oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);

		// 1. 방 데이터 생성 (3개)
		const roomNumbers = ['101', '102', '103'];
		for (let i = 0; i < roomNumbers.length; i++) {
			const roomId = await generateRoomId(transaction);
			const roomNumber = roomNumbers[i];

			await room.create(
				{
					esntlId: roomId,
					gosiwonEsntlId: gosiwonEsntlId,
					roomNumber: roomNumber,
					roomType: '원룸',
					window: '외창',
					monthlyRent: '50', // 만원 단위
					deposit: 200000,
					orderNo: i + 1,
					deleteYN: 'N',
					status: 'EMPTY',
					empty: '1',
					agreementType: 'GENERAL',
					availableGender: 'DEFAULT',
				},
				{ transaction }
			);

			createdData.rooms.push({ esntlId: roomId, roomNumber });

			// 2. 고객 데이터 생성 (각 방마다 1명)
			const customerId = await generateCustomerId(transaction);
			const customerName = `테스트고객${i + 1}`;
			const customerPhone = `0101234567${i}`;

			await customer.create(
				{
					esntlId: customerId,
					name: customerName,
					phone: customerPhone,
					gender: i % 2 === 0 ? 'M' : 'F',
					birth: '1990-01-01',
					bank: 'KB국민은행',
					bankAccount: `1234567890${i}`,
					regDate: today.toISOString().slice(0, 19).replace('T', ' '),
					cus_status: 'USED',
				},
				{ transaction }
			);

			createdData.customers.push({ esntlId: customerId, name: customerName });

			// 3. 방 상태 데이터 생성
			const statusId = await generateRoomStatusId(transaction);
			const status = i === 0 ? 'IN_USE' : i === 1 ? 'RESERVED' : 'ON_SALE';
			
			// 상태별 날짜 범위 설정 (최근 한 달 내)
			let statusStartDate, statusEndDate;
			if (status === 'IN_USE') {
				// 이용중: 2주 전부터 2주 후까지
				statusStartDate = formatDateTime(twoWeeksAgo.toISOString().slice(0, 10));
				statusEndDate = formatDateTime(twoWeeksLater.toISOString().slice(0, 10));
			} else if (status === 'RESERVED') {
				// 예약중: 1주 전부터 3주 후까지
				statusStartDate = formatDateTime(oneWeekAgo.toISOString().slice(0, 10));
				statusEndDate = formatDateTime(oneMonthLater.toISOString().slice(0, 10));
			} else {
				// 판매중: 현재부터 1개월 후까지
				statusStartDate = formatDateTime(today.toISOString().slice(0, 10));
				statusEndDate = formatDateTime(oneMonthLater.toISOString().slice(0, 10));
			}

			await mariaDBSequelize.query(
				`INSERT INTO roomStatus (
					esntlId, roomEsntlId, gosiwonEsntlId, status, customerEsntlId, customerName,
					statusStartDate, statusEndDate, createdAt, updatedAt
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 9 HOUR), DATE_ADD(UTC_TIMESTAMP(), INTERVAL 9 HOUR))`,
				{
					replacements: [statusId, roomId, gosiwonEsntlId, status, customerId, customerName, statusStartDate, statusEndDate],
					type: mariaDBSequelize.QueryTypes.INSERT,
					transaction,
				}
			);

			createdData.roomStatuses.push({ esntlId: statusId, roomId, status });

			// 4. 계약 데이터 생성 (IN_USE, RESERVED 상태인 경우만)
			if (status === 'IN_USE' || status === 'RESERVED') {
				const contractId = await generateContractId(transaction);
				
				// 계약별 날짜 범위 설정 (최근 한 달 내)
				let contractDate, contractStartDate, contractEndDate;
				if (status === 'IN_USE') {
					// 이용중 계약: 2주 전 시작, 2주 후 종료
					contractDate = twoWeeksAgo.toISOString().slice(0, 10);
					contractStartDate = twoWeeksAgo.toISOString().slice(0, 10);
					contractEndDate = twoWeeksLater.toISOString().slice(0, 10);
				} else {
					// 예약중 계약: 1주 전 시작, 3주 후 종료
					contractDate = oneWeekAgo.toISOString().slice(0, 10);
					contractStartDate = oneWeekAgo.toISOString().slice(0, 10);
					contractEndDate = oneMonthLater.toISOString().slice(0, 10);
				}

				await mariaDBSequelize.query(
					`INSERT INTO roomContract (
						esntlId, roomEsntlId, gosiwonEsntlId, customerEsntlId,
						startDate, endDate, contractDate, month, status,
						customerName, customerPhone, customerGender, customerAge,
						checkinName, checkinPhone, checkinGender, checkinAge,
						monthlyRent
					) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'ACTIVE', ?, ?, ?, 30, ?, ?, ?, 30, 500000)`,
					{
						replacements: [
							contractId,
							roomId,
							gosiwonEsntlId,
							customerId,
							contractStartDate,
							contractEndDate,
							contractDate,
							customerName,
							customerPhone,
							i % 2 === 0 ? 'M' : 'F',
							customerName,
							customerPhone,
							i % 2 === 0 ? 'M' : 'F',
						],
						type: mariaDBSequelize.QueryTypes.INSERT,
						transaction,
					}
				);

				createdData.contracts.push({ esntlId: contractId, roomId, customerId });

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
						replacements: [paymentLogId, contractId, gosiwonEsntlId, roomId, customerId, pDate, pTime],
						type: mariaDBSequelize.QueryTypes.INSERT,
						transaction,
					}
				);

				createdData.paymentLogs.push({ esntlId: paymentLogId, contractId });

				// 6. 추가 결제 데이터 생성 (첫 번째 계약만)
				if (i === 0) {
					const extraPaymentId = await generateExtraPaymentId(transaction);

					await mariaDBSequelize.query(
						`INSERT INTO extraPayment (
							esntlId, contractEsntlId, gosiwonEsntlId, roomEsntlId, customerEsntlId,
							extraCostName, paymentAmount, pyl_goods_amount, paymentStatus,
							deleteYN, imp_uid, createdAt, updatedAt
						) VALUES (?, ?, ?, ?, ?, '주차비', '100000', 100000, 'COMPLETED', 'N', 'TEST_IMP_UID', DATE_ADD(UTC_TIMESTAMP(), INTERVAL 9 HOUR), DATE_ADD(UTC_TIMESTAMP(), INTERVAL 9 HOUR))`,
						{
							replacements: [extraPaymentId, contractId, gosiwonEsntlId, roomId, customerId],
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
