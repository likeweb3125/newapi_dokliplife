const { Op } = require('sequelize');
const { room, memo, history, roomCategory, roomCategoryOption, mariaDBSequelize } = require('../models');
const jwt = require('jsonwebtoken');
const errorHandler = require('../middleware/error');
const { getWriterAdminId } = require('../utils/auth');
const { next: idsNext } = require('../utils/idsNext');
const aligoSMS = require('../module/aligo/sms');

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

	let decodedToken;
	try {
		decodedToken = jwt.decode(token);
		console.log('📦 디코딩된 토큰 정보:', decodedToken);
	} catch (err) {
		errorHandler.errorThrow(401, '토큰 디코딩에 실패했습니다.');
	}

	if (!decodedToken || (!decodedToken.admin && !decodedToken.partner)) {
		errorHandler.errorThrow(401, '관리자 정보가 없습니다.');
	}
	return decodedToken;
};

const ROOM_PREFIX = 'ROOM';
const ROOM_PADDING = 10;

const MEMO_PREFIX = 'MEMO';
const MEMO_PADDING = 10;

const HISTORY_PREFIX = 'HISTORY';
const HISTORY_PADDING = 10;

// 히스토리 ID 생성 함수
const generateHistoryId = async (transaction) => {
	const latest = await history.findOne({
		attributes: ['esntlId'],
		order: [['esntlId', 'DESC']],
		transaction,
		lock: transaction ? transaction.LOCK.UPDATE : undefined,
	});

	if (!latest || !latest.esntlId) {
		return `${HISTORY_PREFIX}${String(1).padStart(HISTORY_PADDING, '0')}`;
	}

	const numberPart = parseInt(
		latest.esntlId.replace(HISTORY_PREFIX, ''),
		10
	);
	const nextNumber = Number.isNaN(numberPart) ? 1 : numberPart + 1;
	return `${HISTORY_PREFIX}${String(nextNumber).padStart(
		HISTORY_PADDING,
		'0'
	)}`;
};

// 메모 ID 생성 함수
const generateMemoId = async (transaction) => {
	const latest = await memo.findOne({
		attributes: ['esntlId'],
		order: [['esntlId', 'DESC']],
		transaction,
		lock: transaction ? transaction.LOCK.UPDATE : undefined,
	});

	if (!latest || !latest.esntlId) {
		return `${MEMO_PREFIX}${String(1).padStart(MEMO_PADDING, '0')}`;
	}

	const numberPart = parseInt(
		latest.esntlId.replace(MEMO_PREFIX, ''),
		10
	);
	const nextNumber = Number.isNaN(numberPart) ? 1 : numberPart + 1;
	return `${MEMO_PREFIX}${String(nextNumber).padStart(
		MEMO_PADDING,
		'0'
	)}`;
};

const generateRoomId = async (transaction) => {
	const latest = await room.findOne({
		attributes: ['esntlId'],
		order: [['esntlId', 'DESC']],
		transaction,
		lock: transaction ? transaction.LOCK.UPDATE : undefined,
	});

	if (!latest || !latest.esntlId) {
		return `${ROOM_PREFIX}${String(1).padStart(ROOM_PADDING, '0')}`;
	}

	const numberPart = parseInt(
		latest.esntlId.replace(ROOM_PREFIX, ''),
		10
	);
	const nextNumber = Number.isNaN(numberPart) ? 1 : numberPart + 1;
	return `${ROOM_PREFIX}${String(nextNumber).padStart(
		ROOM_PADDING,
		'0'
	)}`;
};

// 방 목록 조회
exports.getRoomList = async (req, res, next) => {
	try {
		verifyAdminToken(req);

		const { goID, roomName, sortBy } = req.query;

		if (!goID) {
			errorHandler.errorThrow(400, 'goID를 입력해주세요.');
		}

		// WHERE 조건 구성
		let whereClause = 'WHERE R.gosiwonEsntlId = :goID AND R.deleteYN = \'N\'';
		const replacements = { goID: goID };

		// roomName이 있으면 추가 검색 조건
		if (roomName) {
			whereClause += ' AND R.roomNumber LIKE :roomName';
			replacements.roomName = `%${roomName}%`;
		}

		// 정렬 기준 설정 (기본값: orderNo)
		let orderByClause = 'ORDER BY R.orderNo ASC';
		if (sortBy) {
			const sortMap = {
				roomName: 'R.roomNumber',
				roomStatus: 'R.status',
				roomType: 'R.roomType',
				winType: 'R.window',
				rentFee: 'R.monthlyRent',
			};

			const sortColumn = sortMap[sortBy];
			if (sortColumn) {
				orderByClause = `ORDER BY ${sortColumn} ASC`;
			}
		}

		// SQL 쿼리 구성
		// startDate, endDate, nowStatus는 roomStatus 테이블의 해당 방 최신 레코드에서 조회
		const query = `
			SELECT 
				R.esntlId,
				R.roomType,
				R.deposit AS room_deposit,
				R.monthlyRent,
				R.window,
				R.option,
				R.roomNumber,
				R.floor,
				R.intro,
				R.empty,
				R.status,
				R.description,
				R.top,
				R.availableGender,
				R.rom_dp_at,
				RCAT.name AS roomCategoryName,
				DATE_FORMAT(RS_LATEST.statusStartDate, '%Y-%m-%d') AS startDate,
				DATE_FORMAT(RS_LATEST.statusEndDate, '%Y-%m-%d') AS endDate,
				RS_LATEST.status AS nowStatus,
				(CASE WHEN RS_LATEST.statusStartDate IS NOT NULL AND RS_LATEST.statusEndDate IS NOT NULL
					THEN TIMESTAMPDIFF(MONTH, RS_LATEST.statusStartDate, RS_LATEST.statusEndDate) + 1
					ELSE NULL END) AS month,
				(SELECT count(*) FROM roomSee RSee WHERE RSee.roomEsntlId = R.esntlId) AS see,
				(SELECT count(*) FROM roomLike RL WHERE RL.roomEsntlId = R.esntlId) AS likes,
				(SELECT IFNULL(ror_sn, '') FROM il_room_reservation AS RR WHERE rom_sn = R.esntlId AND RR.ror_status_cd = 'WAIT' ORDER BY RR.ror_update_dtm DESC LIMIT 1) AS ror_sn
			FROM room R
			LEFT OUTER JOIN (
				SELECT rs1.roomEsntlId, rs1.statusStartDate, rs1.statusEndDate, rs1.status
				FROM roomStatus rs1
				INNER JOIN (
					SELECT roomEsntlId, MAX(createdAt) AS max_createdAt
					FROM roomStatus
					GROUP BY roomEsntlId
				) rs2 ON rs1.roomEsntlId = rs2.roomEsntlId AND rs1.createdAt = rs2.max_createdAt
				WHERE rs1.esntlId = (
					SELECT MAX(rs3.esntlId) FROM roomStatus rs3
					WHERE rs3.roomEsntlId = rs1.roomEsntlId AND rs3.createdAt = rs2.max_createdAt
				)
			) RS_LATEST ON RS_LATEST.roomEsntlId = R.esntlId
			LEFT OUTER JOIN roomCategory RCAT
				ON R.roomCategory = RCAT.esntlId
			${whereClause}
			${orderByClause}
		`;

		const roomList = await mariaDBSequelize.query(query, {
			replacements: replacements,
			type: mariaDBSequelize.QueryTypes.SELECT,
		});

		// 고시원 이름 조회
		const [gosiwonInfo] = await mariaDBSequelize.query(
			`SELECT name FROM gosiwon WHERE esntlId = ? LIMIT 1`,
			{
				replacements: [goID],
				type: mariaDBSequelize.QueryTypes.SELECT,
			}
		);

		const gosiwonName = gosiwonInfo?.name || null;

		// 리턴값에 고시원 이름 추가
		const result = {
			gosiwonName: gosiwonName,
			rooms: roomList,
		};

		errorHandler.successThrow(res, '방 목록 조회 성공', result);
	} catch (err) {
		next(err);
	}
};

// roomStatus 대시보드 집계 (전체/입금대기/예약중/이용중/체납/퇴실확정/보증금미납)
exports.getDashboardCnt = async (req, res, next) => {
	try {
		verifyAdminToken(req);

		const [row] = await mariaDBSequelize.query(
			`
			SELECT
				COUNT(*) AS total,
				SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) AS pending,
				SUM(CASE WHEN status = 'RESERVED' THEN 1 ELSE 0 END) AS reserved,
				SUM(CASE WHEN status = 'CONTRACT' THEN 1 ELSE 0 END) AS inUse,
				SUM(CASE WHEN status = 'OVERDUE' THEN 1 ELSE 0 END) AS overdue,
				SUM(CASE WHEN status = 'CHECKOUT_CONFIRMED' THEN 1 ELSE 0 END) AS checkoutConfirmed,
				SUM(CASE WHEN status = 'UNPAID' THEN 1 ELSE 0 END) AS unpaid
			FROM roomStatus
			`,
			{ type: mariaDBSequelize.QueryTypes.SELECT }
		);

		const data = {
			total: Number(row?.total ?? 0),
			pending: Number(row?.pending ?? 0),
			reserved: Number(row?.reserved ?? 0),
			inUse: Number(row?.inUse ?? 0),
			overdue: Number(row?.overdue ?? 0),
			checkoutConfirmed: Number(row?.checkoutConfirmed ?? 0),
			unpaid: Number(row?.unpaid ?? 0),
		};

		errorHandler.successThrow(res, '대시보드 집계 조회 성공', data);
	} catch (err) {
		next(err);
	}
};

// 방 정보 조회
exports.getRoomInfo = async (req, res, next) => {
	try {
		verifyAdminToken(req);

		const { esntlID } = req.query;

		if (!esntlID) {
			errorHandler.errorThrow(400, 'esntlID를 입력해주세요.');
		}

		// 요청된 SQL 형식으로 방 상세 정보 조회
		const query = `
			SELECT 
				r.esntlId,
				r.esntlId AS roomEsntlId,
				r.gosiwonEsntlId,
				r.roomType,
				r.roomCategory,
				r.useRoomRentFee,
				r.deposit AS rom_deposit,
				r.monthlyRent,
				r.startDate,
				r.endDate,
				r.rom_checkout_expected_date,
				r.window,
				r.option,
				r.orderOption,
				r.roomNumber,
				r.floor,
				r.intro,
				r.empty,
				r.status,
				r.month,
				r.description,
				r.top,
				r.youtube,
				r.customerEsntlId,
				r.rom_successor_eid,
				r.rom_dp_at,
				r.deleteYN,
				r.orderNo,
				r.agreementType,
				r.agreementContent,
				r.availableGender,
				gu.deposit AS gsw_deposit,
				g.contract as gsw_contract,
				(SELECT content
				 FROM adminContract
				 ORDER BY numberOrder ASC
				 LIMIT 1) AS gs_contract
			FROM room AS r
			JOIN gosiwonUse AS gu ON r.gosiwonEsntlId = gu.esntlId
			JOIN gosiwon AS g ON r.gosiwonEsntlId = g.esntlId
			WHERE r.esntlId = :esntlID
			LIMIT 1
		`;

		const [roomInfo] = await mariaDBSequelize.query(query, {
			replacements: { esntlID },
			type: mariaDBSequelize.QueryTypes.SELECT,
		});

		if (!roomInfo) {
			errorHandler.errorThrow(404, '방 정보를 찾을 수 없습니다.');
		}

		errorHandler.successThrow(res, '방 정보 조회 성공', roomInfo);
	} catch (err) {
		next(err);
	}
};

// 결제요청용 정보 (reserveInfo) - 방 ID로 room 기본정보 + 해당 방이 속한 카테고리(room.roomCategory) 정보만
exports.getReserveInfo = async (req, res, next) => {
	try {
		verifyAdminToken(req);

		const { roomId } = req.query;

		if (!roomId) {
			errorHandler.errorThrow(400, 'roomId를 입력해주세요.');
		}

		const roomRow = await room.findOne({
			where: { esntlId: roomId },
			attributes: ['monthlyRent', 'option', 'description', 'gosiwonEsntlId', 'roomCategory'],
		});

		if (!roomRow) {
			errorHandler.errorThrow(404, '방 정보를 찾을 수 없습니다.');
		}

		let categoriesData = [];
		if (roomRow.roomCategory) {
			const categoryRow = await roomCategory.findOne({
				where: { esntlId: roomRow.roomCategory },
				include: [
					{
						model: roomCategoryOption,
						as: 'options',
						required: false,
						attributes: ['option_name', 'option_amount'],
						order: [['sort_order', 'ASC']],
					},
				],
			});
			if (categoryRow) {
				categoriesData = [{
					id: categoryRow.esntlId,
					name: categoryRow.name,
					base_price: categoryRow.base_price,
					memo: categoryRow.memo ?? null,
					options: (categoryRow.options || []).map((opt) => ({
						option_name: opt.option_name,
						option_amount: opt.option_amount,
					})),
				}];
			}
		}

		const data = {
			monthlyRent: roomRow.monthlyRent,
			option: roomRow.option,
			description: roomRow.description,
			categories: categoriesData,
		};

		errorHandler.successThrow(res, '결제요청용 정보 조회 성공', data);
	} catch (err) {
		next(err);
	}
};

// 방 정보 등록
exports.createRoom = async (req, res, next) => {
	const transaction = await mariaDBSequelize.transaction();
	try {
		const decodedToken = verifyAdminToken(req);
		const writerAdminId = getWriterAdminId(decodedToken);

		const {
			goID,
			roomNumber,
			roomType,
			roomCategory,
			deposit,
			monthlyRent,
			startDate,
			endDate,
			rom_checkout_expected_date,
			window,
			option,
			orderOption,
			floor,
			intro,
			empty,
			status,
			month,
			description,
			top,
			youtube,
			customerEsntlId,
			rom_successor_eid,
			rom_dp_at,
			deleteYN,
			orderNo,
			agreementType,
			agreementContent,
			availableGender,
		} = req.body;

		if (!goID) {
			errorHandler.errorThrow(400, 'goID를 입력해주세요.');
		}

		const roomId = await generateRoomId(transaction);

		// 특약 타입 유효성 검사
		if (agreementType) {
			const validTypes = ['GENERAL', 'GOSIWON', 'ROOM'];
			if (!validTypes.includes(agreementType)) {
				errorHandler.errorThrow(
					400,
					'agreementType은 GENERAL, GOSIWON, ROOM 중 하나여야 합니다.'
				);
			}
		}

		// 이용 가능 성별 유효성 검사
		if (availableGender !== undefined) {
			const validGenders = ['DEFAULT', 'MALE', 'FEMALE'];
			if (!validGenders.includes(availableGender)) {
				errorHandler.errorThrow(
					400,
					'availableGender은 DEFAULT, MALE, FEMALE 중 하나여야 합니다.'
				);
			}
		}

		// 날짜 필드 유효성 검사 및 변환
		const validateDate = (dateValue, fieldName) => {
			if (!dateValue || dateValue === 'string' || dateValue === 'null' || dateValue === 'undefined') {
				return null;
			}
			// 날짜 형식 검증 (YYYY-MM-DD 또는 YYYY-MM-DD HH:mm:ss)
			const dateRegex = /^\d{4}-\d{2}-\d{2}(\s\d{2}:\d{2}:\d{2})?$/;
			if (!dateRegex.test(dateValue)) {
				return null;
			}
			return dateValue;
		};

		// monthlyRent(만원 단위) 받은 값 그대로 저장 (0.5, 1 등 가공 없음)
		const monthlyRentToStore = (monthlyRent !== undefined && monthlyRent !== null && monthlyRent !== '') ? String(monthlyRent) : null;

		await room.create(
			{
				esntlId: roomId,
				gosiwonEsntlId: goID,
				roomNumber: roomNumber || null,
				roomType: roomType || null,
				roomCategory: roomCategory || null,
				deposit: deposit !== undefined ? parseInt(deposit, 10) : null,
				monthlyRent: monthlyRentToStore,
				startDate: validateDate(startDate, 'startDate'),
				endDate: validateDate(endDate, 'endDate'),
				rom_checkout_expected_date: validateDate(rom_checkout_expected_date, 'rom_checkout_expected_date'),
				window: window || null,
				option: option || null,
				orderOption: orderOption || null,
				floor: floor || null,
				intro: intro || null,
				empty: empty || '1',
				status: status || 'EMPTY',
				month: month || null,
				description: description || null,
				top: top || null,
				youtube: youtube || null,
				customerEsntlId: customerEsntlId || null,
				rom_successor_eid: rom_successor_eid || null,
				rom_dp_at: rom_dp_at ? String(rom_dp_at).substring(0, 1) : null,
				deleteYN: deleteYN || 'N',
				orderNo: orderNo !== undefined ? parseInt(orderNo, 10) : 1,
				agreementType: agreementType || 'GENERAL',
				agreementContent: agreementContent || null,
				availableGender: availableGender || 'DEFAULT',
			},
			{ transaction }
		);

		// 히스토리 생성
		try {
			const historyId = await generateHistoryId(transaction);
			const historyContent = `방 정보가 등록되었습니다. 방번호: ${roomNumber || '미지정'}, 타입: ${roomType || '미지정'}, 상태: ${status || 'EMPTY'}`;

			await history.create(
				{
					esntlId: historyId,
					gosiwonEsntlId: goID,
					roomEsntlId: roomId,
					content: historyContent,
					category: 'ROOM',
					priority: 'NORMAL',
					publicRange: 0,
					writerAdminId: writerAdminId,
					writerType: 'ADMIN',
					deleteYN: 'N',
				},
				{ transaction }
			);
		} catch (historyError) {
			console.error('히스토리 생성 실패:', historyError);
			// 히스토리 생성 실패해도 방 정보 등록은 완료되도록 함
		}

		await transaction.commit();

		errorHandler.successThrow(res, '방 정보 등록 성공', { esntlID: roomId });
	} catch (err) {
		await transaction.rollback();
		next(err);
	}
};

// 방 정보 수정
exports.updateRoom = async (req, res, next) => {
	const transaction = await mariaDBSequelize.transaction();
	try {
		const decodedToken = verifyAdminToken(req);
		const writerAdminId = getWriterAdminId(decodedToken);

		const {
			esntlID,
			roomNumber,
			roomType,
			roomCategory,
			deposit,
			monthlyRent,
			startDate,
			endDate,
			rom_checkout_expected_date,
			window,
			option,
			orderOption,
			floor,
			intro,
			empty,
			status,
			month,
			description,
			top,
			youtube,
			customerEsntlId,
			rom_successor_eid,
			rom_dp_at,
			deleteYN,
			orderNo,
			agreementType,
			agreementContent,
			availableGender,
			useRoomRentFee,
		} = req.body;

		if (!esntlID) {
			errorHandler.errorThrow(400, 'esntlID를 입력해주세요.');
		}

		const roomInfo = await room.findByPk(esntlID);
		if (!roomInfo) {
			errorHandler.errorThrow(404, '방 정보를 찾을 수 없습니다.');
		}

		// 특약 타입 유효성 검사
		if (agreementType !== undefined) {
			const validTypes = ['GENERAL', 'GOSIWON', 'ROOM'];
			if (agreementType && !validTypes.includes(agreementType)) {
				errorHandler.errorThrow(
					400,
					'agreementType은 GENERAL, GOSIWON, ROOM 중 하나여야 합니다.'
				);
			}
		}

		// 이용 가능 성별 유효성 검사
		if (availableGender !== undefined) {
			const validGenders = ['DEFAULT', 'MALE', 'FEMALE'];
			if (availableGender && !validGenders.includes(availableGender)) {
				errorHandler.errorThrow(
					400,
					'availableGender은 DEFAULT, MALE, FEMALE 중 하나여야 합니다.'
				);
			}
		}

		// 카테고리 월비용 사용 YN 유효성 검사
		if (useRoomRentFee !== undefined) {
			const normalized = String(useRoomRentFee).toUpperCase().substring(0, 1);
			if (normalized !== 'Y' && normalized !== 'N') {
				errorHandler.errorThrow(400, 'useRoomRentFee는 Y 또는 N이어야 합니다.');
			}
		}

		const updateData = {};
		const changes = [];

		if (roomNumber !== undefined && roomNumber !== roomInfo.roomNumber) {
			updateData.roomNumber = roomNumber;
			changes.push(`방번호: ${roomInfo.roomNumber || '없음'} → ${roomNumber}`);
		}
		if (roomType !== undefined && roomType !== roomInfo.roomType) {
			updateData.roomType = roomType;
			changes.push(`타입: ${roomInfo.roomType || '없음'} → ${roomType}`);
		}
		if (roomCategory !== undefined && roomCategory !== roomInfo.roomCategory) {
			updateData.roomCategory = roomCategory;
			changes.push(`카테고리: ${roomInfo.roomCategory || '없음'} → ${roomCategory}`);
		}
		if (useRoomRentFee !== undefined) {
			const useRoomRentFeeValue = String(useRoomRentFee).toUpperCase().substring(0, 1);
			if (useRoomRentFeeValue !== (roomInfo.useRoomRentFee ?? 'N')) {
				updateData.useRoomRentFee = useRoomRentFeeValue;
				changes.push(`방 월비용 사용: ${roomInfo.useRoomRentFee ?? 'N'} → ${useRoomRentFeeValue}`);
			}
		}
		if (deposit !== undefined && parseInt(deposit, 10) !== roomInfo.deposit) {
			updateData.deposit = parseInt(deposit, 10);
			changes.push(`보증금: ${roomInfo.deposit || 0} → ${deposit}`);
		}
		if (monthlyRent !== undefined) {
			// monthlyRent(만원 단위) 받은 값 그대로 저장 (0.5, 1 등 가공 없음)
			const valueToStore = (monthlyRent !== null && monthlyRent !== '') ? String(monthlyRent) : null;
			if (valueToStore !== roomInfo.monthlyRent) {
				updateData.monthlyRent = valueToStore;
				changes.push(`월세: ${roomInfo.monthlyRent ?? '없음'} → ${valueToStore ?? '없음'}`);
			}
		}
		if (status !== undefined && status !== roomInfo.status) {
			updateData.status = status;
			changes.push(`상태: ${roomInfo.status || '없음'} → ${status}`);
		}
		if (customerEsntlId !== undefined && customerEsntlId !== roomInfo.customerEsntlId) {
			updateData.customerEsntlId = customerEsntlId;
			changes.push(`입실자: ${roomInfo.customerEsntlId || '없음'} → ${customerEsntlId || '없음'}`);
		}
		// 날짜 필드 유효성 검사 및 변환 함수
		const validateDate = (dateValue, fieldName) => {
			if (!dateValue || dateValue === 'string' || dateValue === 'null' || dateValue === 'undefined') {
				return null;
			}
			// 날짜 형식 검증 (YYYY-MM-DD 또는 YYYY-MM-DD HH:mm:ss)
			const dateRegex = /^\d{4}-\d{2}-\d{2}(\s\d{2}:\d{2}:\d{2})?$/;
			if (!dateRegex.test(dateValue)) {
				return null;
			}
			return dateValue;
		};

		if (startDate !== undefined) updateData.startDate = validateDate(startDate, 'startDate');
		if (endDate !== undefined) updateData.endDate = validateDate(endDate, 'endDate');
		if (rom_checkout_expected_date !== undefined)
			updateData.rom_checkout_expected_date = validateDate(rom_checkout_expected_date, 'rom_checkout_expected_date');
		if (window !== undefined) updateData.window = window;
		if (option !== undefined) updateData.option = option;
		if (orderOption !== undefined) updateData.orderOption = orderOption;
		if (floor !== undefined) updateData.floor = floor;
		if (intro !== undefined) updateData.intro = intro;
		if (empty !== undefined) updateData.empty = empty;
		if (month !== undefined) updateData.month = month;
		if (description !== undefined) updateData.description = description;
		if (top !== undefined) updateData.top = top;
		if (youtube !== undefined) updateData.youtube = youtube;
		if (rom_successor_eid !== undefined)
			updateData.rom_successor_eid = rom_successor_eid;
		if (rom_dp_at !== undefined) updateData.rom_dp_at = rom_dp_at ? String(rom_dp_at).substring(0, 1) : null;
		if (deleteYN !== undefined) updateData.deleteYN = deleteYN;
		if (orderNo !== undefined) updateData.orderNo = parseInt(orderNo, 10);
		if (agreementType !== undefined) updateData.agreementType = agreementType;
		if (agreementContent !== undefined) updateData.agreementContent = agreementContent;
		if (availableGender !== undefined && availableGender !== roomInfo.availableGender) {
			updateData.availableGender = availableGender;
			changes.push(`이용 가능 성별: ${roomInfo.availableGender || 'DEFAULT'} → ${availableGender}`);
		}

		// 변경사항이 있는 경우에만 업데이트 및 히스토리 생성
		if (Object.keys(updateData).length > 0) {
			await room.update(updateData, {
				where: { esntlId: esntlID },
				transaction,
			});

			// 히스토리 생성
			try {
				const historyId = await generateHistoryId(transaction);
				const historyContent = changes.length > 0 
					? `방 정보가 수정되었습니다. 변경사항: ${changes.join(', ')}`
					: '방 정보가 수정되었습니다.';

				await history.create(
					{
						esntlId: historyId,
						gosiwonEsntlId: roomInfo.gosiwonEsntlId,
						roomEsntlId: esntlID,
						content: historyContent,
						category: 'ROOM',
						priority: 'NORMAL',
						publicRange: 0,
						writerAdminId: writerAdminId,
						writerType: 'ADMIN',
						deleteYN: 'N',
					},
					{ transaction }
				);
			} catch (historyError) {
				console.error('히스토리 생성 실패:', historyError);
				// 히스토리 생성 실패해도 방 정보 수정은 완료되도록 함
			}
		}

		await transaction.commit();

		errorHandler.successThrow(res, '방 정보 수정 성공');
	} catch (err) {
		await transaction.rollback();
		next(err);
	}
};

// 여러 방의 카테고리(room.roomCategory) 한 번에 변경
exports.updateRoomCategory = async (req, res, next) => {
	const transaction = await mariaDBSequelize.transaction();
	try {
		const decodedToken = verifyAdminToken(req);
		const writerAdminId = getWriterAdminId(decodedToken);

		const { target, category } = req.body;

		if (!target || typeof target !== 'string') {
			errorHandler.errorThrow(400, 'target(방 ID 목록, 쉼표 구분)을 입력해주세요.');
		}
		if (!category || typeof category !== 'string') {
			errorHandler.errorThrow(400, 'category(카테고리 ID)를 입력해주세요.');
		}

		const roomIds = target.split(',').map((id) => id.trim()).filter(Boolean);
		if (roomIds.length === 0) {
			errorHandler.errorThrow(400, 'target에 유효한 방 ID가 없습니다.');
		}

		// 카테고리 존재 여부 확인
		const categoryRow = await roomCategory.findByPk(category);
		if (!categoryRow) {
			errorHandler.errorThrow(404, '해당 카테고리를 찾을 수 없습니다.');
		}
		const categoryName = categoryRow.name || category;

		const updatedRooms = [];
		const errors = [];

		for (const roomEsntlId of roomIds) {
			const roomInfo = await room.findByPk(roomEsntlId, { transaction });
			if (!roomInfo) {
				errors.push({ roomEsntlId, error: '방을 찾을 수 없습니다.' });
				continue;
			}
			if (roomInfo.roomCategory === category) {
				// 이미 동일 카테고리면 스킵 (히스토리만 남기지 않음)
				updatedRooms.push({ roomEsntlId, skipped: true });
				continue;
			}

			const previousCategory = roomInfo.roomCategory || '없음';

			await room.update(
				{ roomCategory: category },
				{ where: { esntlId: roomEsntlId }, transaction }
			);

			// 해당 방의 history에 카테고리 변경 기록
			const historyId = await generateHistoryId(transaction);
			const historyContent = `카테고리 변경: ${previousCategory} → ${categoryName}(${category})`;

			await history.create(
				{
					esntlId: historyId,
					gosiwonEsntlId: roomInfo.gosiwonEsntlId,
					roomEsntlId: roomEsntlId,
					content: historyContent,
					category: 'ROOM',
					priority: 'NORMAL',
					publicRange: 0,
					writerAdminId: writerAdminId,
					writerType: 'ADMIN',
					deleteYN: 'N',
				},
				{ transaction }
			);

			updatedRooms.push({ roomEsntlId, updated: true });
		}

		await transaction.commit();

		errorHandler.successThrow(res, '방 카테고리 일괄 변경 완료', {
			updated: updatedRooms.filter((r) => r.updated).length,
			skipped: updatedRooms.filter((r) => r.skipped).length,
			errors: errors.length > 0 ? errors : undefined,
			rooms: updatedRooms,
		});
	} catch (err) {
		await transaction.rollback();
		next(err);
	}
};

// 방 특약 내역 수정
exports.updateRoomAgreement = async (req, res, next) => {
	const transaction = await mariaDBSequelize.transaction();
	try {
		const decodedToken = verifyAdminToken(req);
		const writerAdminId = getWriterAdminId(decodedToken);

		const { roomEsntlId, agreementType, agreementContent } = req.body;

		if (!roomEsntlId) {
			errorHandler.errorThrow(400, 'roomEsntlId를 입력해주세요.');
		}

		const roomInfo = await room.findByPk(roomEsntlId);
		if (!roomInfo) {
			errorHandler.errorThrow(404, '방 정보를 찾을 수 없습니다.');
		}

		// 특약 타입 유효성 검사
		if (agreementType !== undefined) {
			const validTypes = ['GENERAL', 'GOSIWON', 'ROOM'];
			if (agreementType && !validTypes.includes(agreementType)) {
				errorHandler.errorThrow(
					400,
					'agreementType은 GENERAL, GOSIWON, ROOM 중 하나여야 합니다.'
				);
			}
		}

		const updateData = {};
		const changes = [];

		if (agreementType !== undefined) {
			updateData.agreementType = agreementType || 'GENERAL';
			changes.push(
				`특약 타입: ${roomInfo.agreementType || 'GENERAL'} → ${agreementType || 'GENERAL'}`
			);
		}

		if (agreementContent !== undefined) {
			updateData.agreementContent = agreementContent || null;
			const oldContent = roomInfo.agreementContent
				? roomInfo.agreementContent.substring(0, 50) + '...'
				: '없음';
			const newContent = agreementContent
				? agreementContent.substring(0, 50) + '...'
				: '없음';
			changes.push(`특약 내용: ${oldContent} → ${newContent}`);
		}

		// 변경사항이 있는 경우에만 업데이트 및 히스토리 생성
		if (Object.keys(updateData).length > 0) {
			await room.update(updateData, {
				where: { esntlId: roomEsntlId },
				transaction,
			});

			// 히스토리 생성
			try {
				const historyId = await generateHistoryId(transaction);
				const historyContent =
					changes.length > 0
						? `방 특약 내역이 수정되었습니다. 변경사항: ${changes.join(', ')}`
						: '방 특약 내역이 수정되었습니다.';

				await history.create(
					{
						esntlId: historyId,
						gosiwonEsntlId: roomInfo.gosiwonEsntlId,
						roomEsntlId: roomEsntlId,
						content: historyContent,
						category: 'ROOM',
						priority: 'NORMAL',
						publicRange: 0,
						writerAdminId: writerAdminId,
						writerType: 'ADMIN',
						deleteYN: 'N',
					},
					{ transaction }
				);
			} catch (historyError) {
				console.error('히스토리 생성 실패:', historyError);
				// 히스토리 생성 실패해도 방 정보 수정은 완료되도록 함
			}
		}

		await transaction.commit();

		// 업데이트된 방 정보 조회
		const updatedRoom = await room.findByPk(roomEsntlId, {
			attributes: ['esntlId', 'agreementType', 'agreementContent'],
		});

		errorHandler.successThrow(res, '방 특약 내역 수정 성공', {
			esntlId: updatedRoom.esntlId,
			agreementType: updatedRoom.agreementType,
			agreementContent: updatedRoom.agreementContent,
		});
	} catch (err) {
		await transaction.rollback();
		next(err);
	}
};

// 방 DP 여부 수정
exports.updateRoomDpAt = async (req, res, next) => {
	const transaction = await mariaDBSequelize.transaction();
	try {
		const decodedToken = verifyAdminToken(req);
		const writerAdminId = getWriterAdminId(decodedToken);

		const { roomEsntlId, rom_dp_at } = req.body;

		if (!roomEsntlId) {
			errorHandler.errorThrow(400, 'roomEsntlId를 입력해주세요.');
		}

		if (rom_dp_at === undefined) {
			errorHandler.errorThrow(400, 'rom_dp_at을 입력해주세요.');
		}

		// rom_dp_at 유효성 검사 (N 또는 Y만 허용)
		if (rom_dp_at !== 'N' && rom_dp_at !== 'Y') {
			errorHandler.errorThrow(400, 'rom_dp_at은 N 또는 Y 값만 허용됩니다.');
		}

		const roomInfo = await room.findByPk(roomEsntlId);
		if (!roomInfo) {
			errorHandler.errorThrow(404, '방 정보를 찾을 수 없습니다.');
		}

		// rom_dp_at은 첫 번째 문자만 사용 (기존 로직과 동일)
		const dpAtValue = String(rom_dp_at).substring(0, 1).toUpperCase();

		// 변경사항 확인
		const oldValue = roomInfo.rom_dp_at || 'N';
		const newValue = dpAtValue;

		// 업데이트
		await room.update(
			{ rom_dp_at: newValue },
			{
				where: { esntlId: roomEsntlId },
				transaction,
			}
		);

		// 히스토리 생성
		try {
			const historyId = await generateHistoryId(transaction);
			const historyContent = `방 DP 여부가 수정되었습니다. 변경사항: ${oldValue} → ${newValue}`;

			await history.create(
				{
					esntlId: historyId,
					gosiwonEsntlId: roomInfo.gosiwonEsntlId,
					roomEsntlId: roomEsntlId,
					content: historyContent,
					category: 'ROOM',
					priority: 'NORMAL',
					publicRange: 0,
					writerAdminId: writerAdminId,
					writerType: 'ADMIN',
					deleteYN: 'N',
				},
				{ transaction }
			);
		} catch (historyError) {
			console.error('히스토리 생성 실패:', historyError);
			// 히스토리 생성 실패해도 방 정보 수정은 완료되도록 함
		}

		await transaction.commit();

		// 업데이트된 방 정보 조회
		const updatedRoom = await room.findByPk(roomEsntlId, {
			attributes: ['esntlId', 'rom_dp_at'],
		});

		errorHandler.successThrow(res, '방 DP 여부 수정 성공', {
			esntlId: updatedRoom.esntlId,
			rom_dp_at: updatedRoom.rom_dp_at,
		});
	} catch (err) {
		await transaction.rollback();
		next(err);
	}
};

// 결제 요청 취소
exports.reserveCancel = async (req, res, next) => {
	const transaction = await mariaDBSequelize.transaction();
	try {
		const decodedToken = verifyAdminToken(req);
		const userSn = getWriterAdminId(decodedToken);

		const { roomEsntlId, isReserve } = req.body;

		// 필수 필드 검증
		if (!roomEsntlId) {
			errorHandler.errorThrow(400, 'roomEsntlId를 입력해주세요.');
		}

		// isReserve 값 처리 (기본값: false)
		const isReserveValue = isReserve === 'Y' || isReserve === true;

		// 1. 예약 상태를 CANCEL로 업데이트
		const updateReservationQuery = `
			UPDATE il_room_reservation 
			SET ror_status_cd = 'CANCEL',
				ror_update_dtm = NOW(),
				ror_updater_sn = ?
			WHERE rom_sn = ?
				AND ror_status_cd = 'WAIT'
		`;

		const updateResult = await mariaDBSequelize.query(updateReservationQuery, {
			replacements: [userSn, roomEsntlId],
			type: mariaDBSequelize.QueryTypes.UPDATE,
			transaction,
		});

		// 업데이트된 행이 없으면 예약이 없거나 이미 취소된 상태
		if (updateResult[1] === 0) {
			errorHandler.errorThrow(404, '취소할 예약을 찾을 수 없습니다. (WAIT 상태의 예약이 없습니다.)');
		}

		// 2. isReserve가 false인 경우에만 방 상태 업데이트
		if (!isReserveValue) {
			const updateRoomQuery = `
				UPDATE room 
				SET status = IF(customerEsntlId IS NOT NULL, 'CONTRACT', 'EMPTY')
				WHERE esntlId = ?
			`;

			await mariaDBSequelize.query(updateRoomQuery, {
				replacements: [roomEsntlId],
				type: mariaDBSequelize.QueryTypes.UPDATE,
				transaction,
			});
		}

		// 방 정보 조회하여 gosiwonEsntlId 가져오기 (히스토리 생성에 필요)
		const roomBasicInfo = await room.findByPk(roomEsntlId, {
			attributes: ['gosiwonEsntlId', 'status'],
			transaction,
		});

		if (!roomBasicInfo || !roomBasicInfo.gosiwonEsntlId) {
			errorHandler.errorThrow(404, '방 정보를 찾을 수 없거나 고시원 정보가 없습니다.');
		}

		// 3. 히스토리 생성
		try {
			const historyId = await generateHistoryId(transaction);
			const historyContent = isReserveValue
				? `결제 요청이 취소되었습니다. (예약만 취소)`
				: `결제 요청이 취소되었습니다. 방 상태: ${roomBasicInfo.status}`;

			await history.create(
				{
					esntlId: historyId,
					gosiwonEsntlId: roomBasicInfo.gosiwonEsntlId,
					roomEsntlId: roomEsntlId,
					content: historyContent,
					category: 'ROOM',
					priority: 'NORMAL',
					publicRange: 0,
					writerAdminId: userSn,
					writerType: 'ADMIN',
					deleteYN: 'N',
				},
				{ transaction }
			);
		} catch (historyError) {
			console.error('히스토리 생성 실패:', historyError);
			// 히스토리 생성 실패해도 취소 프로세스는 계속 진행
		}

		await transaction.commit();

		errorHandler.successThrow(res, '결제 요청 취소 성공', {
			roomEsntlId: roomEsntlId,
			isReserve: isReserveValue,
			roomStatus: roomBasicInfo.status,
		});
	} catch (err) {
		await transaction.rollback();
		next(err);
	}
};

// 방 정보 삭제
exports.deleteRoom = async (req, res, next) => {
	const transaction = await mariaDBSequelize.transaction();
	try {
		const decodedToken = verifyAdminToken(req);
		const writerAdminId = getWriterAdminId(decodedToken);

		const { esntlID } = req.query;

		if (!esntlID) {
			errorHandler.errorThrow(400, 'esntlID를 입력해주세요.');
		}

		const roomInfo = await room.findByPk(esntlID);
		if (!roomInfo) {
			errorHandler.errorThrow(404, '방 정보를 찾을 수 없습니다.');
		}

		// 외래키 제약 조건 때문에 관련된 자식 테이블 레코드들을 먼저 삭제
		// roomImage 테이블 삭제
		await mariaDBSequelize.query(
			`DELETE FROM roomImage WHERE roomEsntlId = ?`,
			{
				replacements: [esntlID],
				type: mariaDBSequelize.QueryTypes.DELETE,
				transaction,
			}
		);

		// roomStatus 테이블 삭제 (CASCADE로 설정되어 있어도 명시적으로 삭제)
		await mariaDBSequelize.query(
			`DELETE FROM roomStatus WHERE roomEsntlId = ?`,
			{
				replacements: [esntlID],
				type: mariaDBSequelize.QueryTypes.DELETE,
				transaction,
			}
		);

		// roomMemo 테이블 삭제
		await mariaDBSequelize.query(
			`DELETE FROM roomMemo WHERE roomEsntlId = ?`,
			{
				replacements: [esntlID],
				type: mariaDBSequelize.QueryTypes.DELETE,
				transaction,
			}
		);

		// roomContract 테이블 삭제 (있다면)
		await mariaDBSequelize.query(
			`DELETE FROM roomContract WHERE roomEsntlId = ?`,
			{
				replacements: [esntlID],
				type: mariaDBSequelize.QueryTypes.DELETE,
				transaction,
			}
		);

		// roomSee, roomLike 테이블 삭제 (있다면)
		await mariaDBSequelize.query(
			`DELETE FROM roomSee WHERE roomEsntlId = ?`,
			{
				replacements: [esntlID],
				type: mariaDBSequelize.QueryTypes.DELETE,
				transaction,
			}
		);

		await mariaDBSequelize.query(
			`DELETE FROM roomLike WHERE roomEsntlId = ?`,
			{
				replacements: [esntlID],
				type: mariaDBSequelize.QueryTypes.DELETE,
				transaction,
			}
		);

		const deleted = await room.destroy({
			where: {
				esntlId: esntlID,
			},
			transaction,
		});

		if (!deleted) {
			errorHandler.errorThrow(404, '방 정보를 찾을 수 없습니다.');
		}

		// 히스토리 생성
		try {
			const historyId = await generateHistoryId(transaction);
			const historyContent = `방 정보가 삭제되었습니다. 방번호: ${roomInfo.roomNumber || '미지정'}, 타입: ${roomInfo.roomType || '미지정'}, 상태: ${roomInfo.status || '없음'}`;

			await history.create(
				{
					esntlId: historyId,
					gosiwonEsntlId: roomInfo.gosiwonEsntlId,
					roomEsntlId: esntlID,
					content: historyContent,
					category: 'ROOM',
					priority: 'NORMAL',
					publicRange: 0,
					writerAdminId: writerAdminId,
					writerType: 'ADMIN',
					deleteYN: 'N',
				},
				{ transaction }
			);
		} catch (historyError) {
			console.error('히스토리 생성 실패:', historyError);
			// 히스토리 생성 실패해도 방 정보 삭제는 완료되도록 함
		}

		await transaction.commit();

		errorHandler.successThrow(res, '방 정보 삭제 성공');
	} catch (err) {
		await transaction.rollback();
		next(err);
	}
};

// 예약 성공 시 계약 링크 문자 발송 (receiver 번호로, messageSmsHistory 저장)
const sendContractLinkSMS = async (receiverPhone, roomEsntlId, writerAdminId, gosiwonEsntlId) => {
	if (!receiverPhone || !String(receiverPhone).trim()) return;
	try {
		const link = `https://doklipuser.likeweb.co.kr/v2?page=contract&rom_eid=${roomEsntlId}`;
		const title = '[독립생활] 계약 요청 안내';
		const message = `아래 링크에서 계약을 진행해주세요.\n${link}`;
		await aligoSMS.send({ receiver: receiverPhone.trim(), title, message });

		const historyEsntlId = await idsNext('messageSmsHistory');
		const firstReceiver = String(receiverPhone).trim().split(',')[0]?.trim() || String(receiverPhone).trim();
		const userRows = await mariaDBSequelize.query(
			`SELECT C.esntlId FROM customer C
			 INNER JOIN roomContract RC ON RC.customerEsntlId = C.esntlId AND RC.status = 'USED'
			 WHERE C.phone = :receiverPhone ORDER BY RC.contractDate DESC LIMIT 1`,
			{ replacements: { receiverPhone: firstReceiver }, type: mariaDBSequelize.QueryTypes.SELECT }
		);
		const resolvedUserEsntlId = Array.isArray(userRows) && userRows.length > 0 ? userRows[0].esntlId : null;
		await mariaDBSequelize.query(
			`INSERT INTO messageSmsHistory (esntlId, title, content, gosiwonEsntlId, userEsntlId, receiverPhone, createdBy, createdAt, updatedAt)
			 VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
			{
				replacements: [historyEsntlId, title, message, gosiwonEsntlId || null, resolvedUserEsntlId, firstReceiver, writerAdminId || null],
				type: mariaDBSequelize.QueryTypes.INSERT,
			}
		);
	} catch (err) {
		console.error('계약 링크 문자 발송 실패:', err);
	}
};

// 방 예약 및 결제 요청
exports.roomReserve = async (req, res, next) => {
	const transaction = await mariaDBSequelize.transaction();
	try {
		const decodedToken = verifyAdminToken(req);
		const userSn = getWriterAdminId(decodedToken);

		const {
			roomEsntlId,
			deposit,
			monthlyRent,
			receiver,
			checkInDate,
			paymentType,
			rorPeriod,
			rorContractStartDate,
			rorContractEndDate,
			rorPayMethod,
			memo: memoContent,
		} = req.body;

		// 필수 필드 검증
		if (!roomEsntlId) {
			errorHandler.errorThrow(400, 'roomEsntlId를 입력해주세요.');
		}
		if (!deposit) {
			errorHandler.errorThrow(400, 'deposit을 입력해주세요.');
		}
		if (!receiver) {
			errorHandler.errorThrow(400, 'receiver를 입력해주세요.');
		}
		if (!checkInDate) {
			errorHandler.errorThrow(400, 'checkInDate를 입력해주세요.');
		}
		if (!rorPeriod) {
			errorHandler.errorThrow(400, 'rorPeriod를 입력해주세요.');
		}
		// rorPeriod가 PART인 경우 계약 시작일과 종료일 필수
		if (rorPeriod === 'PART') {
			if (!rorContractStartDate) {
				errorHandler.errorThrow(400, 'rorPeriod가 PART인 경우 rorContractStartDate를 입력해주세요.');
			}
			if (!rorContractEndDate) {
				errorHandler.errorThrow(400, 'rorPeriod가 PART인 경우 rorContractEndDate를 입력해주세요.');
			}
		}

		// 오늘 날짜 확인 (YYYY-MM-DD 형식)
		const today = new Date();
		const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
		const isReserve = checkInDate !== todayStr;

		// 1. 예약 정보 INSERT
		const reservationIdQuery = `
			SELECT CONCAT('ROR', LPAD(CAST(SUBSTRING(IFNULL(MAX(T.ror_sn), '0000'), 4) AS UNSIGNED) + 1, 11, '0')) AS nextId
			FROM il_room_reservation AS T
		`;

		const [reservationIdResult] = await mariaDBSequelize.query(reservationIdQuery, {
			type: mariaDBSequelize.QueryTypes.SELECT,
			transaction,
		});

		const reservationId = reservationIdResult?.nextId || 'ROR00000000001';

		const insertReservationQuery = `
			INSERT INTO il_room_reservation (
				ror_sn,
				rom_sn,
				ror_deposit,
				ror_monthlyRent,
				ror_hp_no,
				ror_check_in_date,
				ror_status_cd,
				ror_regist_dtm,
				ror_registrant_sn,
				ror_update_dtm,
				ror_updater_sn,
				ror_period,
				ror_contract_start_date,
				ror_contract_end_date,
				ror_pay_method
			) VALUES (
				?,
				?,
				?,
				?,
				?,
				?,
				'WAIT',
				NOW(),
				?,
				NOW(),
				?,
				?,
				?,
				?,
				?
			)
		`;

		// monthlyRent는 room.monthlyRent와 동일하게 문자열로 저장 (0.5, 1 등 만원 단위)
		const monthlyRentToStore = (monthlyRent !== undefined && monthlyRent !== null && monthlyRent !== '') ? String(monthlyRent) : null;

		await mariaDBSequelize.query(insertReservationQuery, {
			replacements: [
				reservationId,
				roomEsntlId,
				deposit,
				monthlyRentToStore,
				receiver,
				checkInDate,
				userSn,
				userSn,
				rorPeriod,
				rorContractStartDate || null,
				rorContractEndDate || null,
				rorPayMethod || null,
			],
			type: mariaDBSequelize.QueryTypes.INSERT,
			transaction,
		});

		// 방 정보 조회하여 gosiwonEsntlId 가져오기 (room 업데이트, roomStatus 추가, 메모·history에 필요)
		const roomBasicInfo = await room.findByPk(roomEsntlId, {
			attributes: ['gosiwonEsntlId'],
			transaction,
		});

		if (!roomBasicInfo || !roomBasicInfo.gosiwonEsntlId) {
			errorHandler.errorThrow(404, '방 정보를 찾을 수 없거나 고시원 정보가 없습니다.');
		}

		// 2. room 테이블: 상태 RESERVE, 입실일·퇴실일 업데이트
		await room.update(
			{
				status: 'RESERVE',
				startDate: checkInDate || null,
				endDate: rorContractEndDate || null,
			},
			{
				where: {
					esntlId: roomEsntlId,
				},
				transaction,
			}
		);

		// 3. roomStatus 테이블: PENDING(입금대기중) 레코드 추가
		const newRoomStatusId = await idsNext('roomStatus', undefined, transaction);
		await mariaDBSequelize.query(
			`INSERT INTO roomStatus (
				esntlId,
				roomEsntlId,
				gosiwonEsntlId,
				status,
				reservationEsntlId,
				statusStartDate,
				statusEndDate,
				createdAt,
				updatedAt
			) VALUES (?, ?, ?, 'PENDING', ?, ?, ?, NOW(), NOW())`,
			{
				replacements: [
					newRoomStatusId,
					roomEsntlId,
					roomBasicInfo.gosiwonEsntlId,
					reservationId,
					checkInDate || null,
					rorContractEndDate || null,
				],
				type: mariaDBSequelize.QueryTypes.INSERT,
				transaction,
			}
		);

		// 4. History 기록 생성
		try {
			const historyId = await generateHistoryId(transaction);
			const historyContent = `방 예약 생성: 예약ID ${reservationId}, 입실일 ${checkInDate}, 계약기간 ${rorPeriod}${rorContractStartDate ? ` (${rorContractStartDate} ~ ${rorContractEndDate})` : ''}, 보증금 ${deposit}원${monthlyRentToStore ? `, 월세 ${monthlyRentToStore}` : ''}${rorPayMethod ? `, 결제방법 ${rorPayMethod}` : ''}`;

			await history.create(
				{
					esntlId: historyId,
					gosiwonEsntlId: roomBasicInfo.gosiwonEsntlId,
					roomEsntlId: roomEsntlId,
					etcEsntlId: reservationId,
					content: historyContent,
					category: 'ROOM',
					priority: 'NORMAL',
					publicRange: 0,
					writerAdminId: userSn,
					writerType: 'ADMIN',
					deleteYN: 'N',
				},
				{ transaction }
			);
		} catch (historyErr) {
			console.error('History 생성 실패:', historyErr);
			// History 생성 실패해도 예약 프로세스는 계속 진행
		}

		// 5. 메모 내용이 있으면 메모 생성
		if (memoContent) {

			// 메모 ID 생성
			const memoId = await generateMemoId(transaction);

			// 메모 생성
			await memo.create(
				{
					esntlId: memoId,
					gosiwonEsntlId: roomBasicInfo.gosiwonEsntlId,
					roomEsntlId: roomEsntlId,
					etcEsntlId: reservationId,
					memo: memoContent,
					category: 'ROOM',
					priority: 'NORMAL',
					publicRange: 0,
					writerAdminId: userSn,
					writerType: 'ADMIN',
					deleteYN: 'N',
				},
				{ transaction }
			);
		}

		// 예약일이 오늘이 아니면 예약만 하고 종료
		if (isReserve) {
			await transaction.commit();
			await sendContractLinkSMS(receiver, roomEsntlId, userSn, roomBasicInfo.gosiwonEsntlId);
			errorHandler.successThrow(
				res,
				`결제 요청 발송이 예약(${checkInDate})되었습니다.`,
				{
					reservationId: reservationId,
					checkInDate: checkInDate,
				}
			);
			return;
		}

		// 3. 예약이 오늘이면 방 정보 조회 및 알림톡 발송
		// gosiwonAdmin은 LEFT JOIN (관리자 정보 없어도 방·고시원 정보로 진행)
		const roomInfoQuery = `
			SELECT 
				g.name AS gsw_name,
				r.roomNumber AS rom_name,
				r.monthlyRent AS monthlyRent,
				CONCAT(REPLACE(CURDATE(), '-', '.'), ' ', '23:59') AS contractExpDateTime,
				IF(c.phone = ?, 'EXTENSION', 'NEW') AS req_type,
				IF((c.name LIKE '%kakao%' OR c.name IS NULL), '입실자', c.name) AS cus_name,
				ga.hp AS gosiwon_receiver,
				r.esntlId AS rom_eid
			FROM room AS r
			JOIN gosiwon AS g ON r.gosiwonEsntlId = g.esntlId
			LEFT JOIN gosiwonAdmin AS ga ON ga.esntlId = g.adminEsntlId
			LEFT JOIN customer AS c ON c.esntlId = r.customerEsntlId
			WHERE r.esntlId = ?
		`;

		const roomInfoResult = await mariaDBSequelize.query(roomInfoQuery, {
			replacements: [receiver, roomEsntlId],
			type: mariaDBSequelize.QueryTypes.SELECT,
			transaction,
		});

		const roomInfoData = Array.isArray(roomInfoResult) && roomInfoResult.length > 0 ? roomInfoResult[0] : null;

		if (!roomInfoData) {
			errorHandler.errorThrow(404, '방 정보를 찾을 수 없습니다.');
		}

		await transaction.commit();

		// 알림톡 발송 데이터 준비 (receiver 필수: YawnMessage.send() → _history() → yn_message_send_log.msl_send_tel_no)
		const receiverPhone = (receiver && String(receiver).trim()) || (roomInfoData.gosiwon_receiver && String(roomInfoData.gosiwon_receiver).trim()) || '';
		await sendContractLinkSMS(receiverPhone, roomEsntlId, userSn, roomBasicInfo.gosiwonEsntlId);
		const data = {
			...roomInfoData,
			receiver: receiverPhone,
			product: `${roomInfoData.gsw_name} ${roomInfoData.rom_name}`,
			paymentType: paymentType || 'accountPayment',
		};

		// TODO: 알림톡 발송 로직 구현
		// 기존 코드에서는 YawnMessage.ts 모듈을 사용했으나,
		// 현재 프로젝트 구조에 맞게 알림톡 모듈을 연동해야 합니다.
		/*
		const Kakao = require('../module/message/YawnMessage');
		
		let templateId;
		if (paymentType === 'accountPayment') {
			templateId = 'AL_P_PAYMENT_REQUEST_ACCOUNT_NEW';
			data.account_number = '기업 986-023615-04-015';
		} else if (data.req_type === 'NEW') {
			templateId = 'AL_U_PAYMENT_REQUEST_NEW';
		} else {
			templateId = 'AL_U_PAYMENT_REQUEST_EXTENSION';
		}

		data.tId = templateId;
		const result = await Kakao.send(templateId, [data]);

		if (result.sel_success_cnt === 1) {
			const gosiwonReceiverPhone = (data.gosiwon_receiver && String(data.gosiwon_receiver).trim()) || receiverPhone;
			await Kakao.send('AL_P_PAYMENT_REQUEST_ALERT', [{
				receiver: gosiwonReceiverPhone,
				product: data.product,
				req_number: receiverPhone
			}]);
		}
		*/

		errorHandler.successThrow(res, '결제 요청이 발송되었습니다.', data);
	} catch (err) {
		// 트랜잭션이 이미 완료되지 않은 경우에만 rollback
		try {
			await transaction.rollback();
		} catch (rollbackErr) {
			// 트랜잭션이 이미 완료된 경우 rollback 오류는 무시
			if (!rollbackErr.message || !rollbackErr.message.includes('finished')) {
				console.error('트랜잭션 rollback 오류:', rollbackErr);
			}
		}
		next(err);
	}
};

// 방 판매 시작
exports.startRoomSell = async (req, res, next) => {
	const transaction = await mariaDBSequelize.transaction();
	try {
		verifyAdminToken(req);

		const { rooms } = req.body;

		if (!rooms || !Array.isArray(rooms) || rooms.length === 0) {
			errorHandler.errorThrow(400, 'rooms 배열을 입력해주세요.');
		}

		const results = [];

		for (const roomData of rooms) {
			const {
				roomId,
				statusStartDate,
				statusEndDate,
				sameAsCheckinInfo,
				etcStartDate,
				etcEndDate,
			} = roomData;

			// 필수 필드 검증
			if (!roomId) {
				errorHandler.errorThrow(400, 'roomId를 입력해주세요.');
			}
			if (!statusStartDate) {
				errorHandler.errorThrow(400, 'statusStartDate를 입력해주세요.');
			}
			if (!statusEndDate) {
				errorHandler.errorThrow(400, 'statusEndDate를 입력해주세요.');
			}
			if (sameAsCheckinInfo === undefined) {
				errorHandler.errorThrow(400, 'sameAsCheckinInfo를 입력해주세요.');
			}

			// roomId가 콤마로 구분된 여러 개인 경우 분리
			const roomIdArray = typeof roomId === 'string' 
				? roomId.split(',').map(id => id.trim()).filter(id => id.length > 0)
				: [roomId];

			// 각 roomId에 대해 처리
			for (const singleRoomId of roomIdArray) {
				// 방 정보 조회 (고시원 ID 확인)
				const [roomInfo] = await mariaDBSequelize.query(
					`SELECT esntlId, gosiwonEsntlId FROM room WHERE esntlId = ? AND deleteYN = 'N'`,
					{
						replacements: [singleRoomId],
						type: mariaDBSequelize.QueryTypes.SELECT,
						transaction,
					}
				);

				if (!roomInfo) {
					errorHandler.errorThrow(404, `방을 찾을 수 없습니다. (roomId: ${singleRoomId})`);
				}

				// etcStartDate, etcEndDate, statusEndDate 계산
				let finalEtcStartDate = null;
				let finalEtcEndDate = null;
				let finalStatusEndDate = statusEndDate;

				if (sameAsCheckinInfo) {
					// sameAsCheckinInfo가 true인 경우
					// etcStartDate = statusStartDate
					finalEtcStartDate = statusStartDate;
					// etcEndDate = statusEndDate
					finalEtcEndDate = statusEndDate;
					// statusEndDate = etcEndDate (동일하게 설정)
					finalStatusEndDate = finalEtcEndDate;
				} else {
					// sameAsCheckinInfo가 false인 경우
					if (!etcStartDate) {
						errorHandler.errorThrow(400, 'sameAsCheckinInfo가 false인 경우 etcStartDate를 입력해주세요.');
					}
					if (!etcEndDate) {
						errorHandler.errorThrow(400, 'sameAsCheckinInfo가 false인 경우 etcEndDate를 입력해주세요.');
					}
					finalEtcStartDate = etcStartDate;
					finalEtcEndDate = etcEndDate;
				}

				// 기존 ON_SALE 레코드 확인 (해당 방의 ON_SALE 행만 대상)
				const [existingOnSale] = await mariaDBSequelize.query(
					`SELECT esntlId, status FROM roomStatus WHERE roomEsntlId = ? AND status = 'ON_SALE' LIMIT 1`,
					{
						replacements: [singleRoomId],
						type: mariaDBSequelize.QueryTypes.SELECT,
						transaction,
					}
				);

				if (existingOnSale) {
					// ON_SALE 업데이트: 판매 기간만 저장 (statusStartDate, statusEndDate / etc는 동일)
					await mariaDBSequelize.query(
						`UPDATE roomStatus 
						SET status = 'ON_SALE',
							gosiwonEsntlId = ?,
							statusStartDate = ?,
							statusEndDate = ?,
							etcStartDate = ?,
							etcEndDate = ?,
							updatedAt = NOW()
						WHERE roomEsntlId = ? AND status = 'ON_SALE'`,
						{
							replacements: [
								roomInfo.gosiwonEsntlId,
								statusStartDate,
								finalStatusEndDate,
								statusStartDate, // etcStartDate: ON_SALE은 판매 기간과 동일
								finalStatusEndDate, // etcEndDate
								singleRoomId,
							],
							type: mariaDBSequelize.QueryTypes.UPDATE,
							transaction,
						}
					);
					// CAN_CHECKIN: 입실가능 기간(기존 etc)으로 업데이트 또는 삽입
					const [existingCanCheckin] = await mariaDBSequelize.query(
						`SELECT esntlId FROM roomStatus WHERE roomEsntlId = ? AND status = 'CAN_CHECKIN' LIMIT 1`,
						{
							replacements: [singleRoomId],
							type: mariaDBSequelize.QueryTypes.SELECT,
							transaction,
						}
					);
					if (existingCanCheckin) {
						await mariaDBSequelize.query(
							`UPDATE roomStatus 
							SET gosiwonEsntlId = ?,
								statusStartDate = ?,
								statusEndDate = ?,
								etcStartDate = ?,
								etcEndDate = ?,
								updatedAt = NOW()
							WHERE roomEsntlId = ? AND status = 'CAN_CHECKIN'`,
							{
								replacements: [
									roomInfo.gosiwonEsntlId,
									finalEtcStartDate,
									finalEtcEndDate,
									finalEtcStartDate,
									finalEtcEndDate,
									singleRoomId,
								],
								type: mariaDBSequelize.QueryTypes.UPDATE,
								transaction,
							}
						);
					} else {
						const canCheckinId = await idsNext('roomStatus', undefined, transaction);
						await mariaDBSequelize.query(
							`INSERT INTO roomStatus (
								esntlId,
								roomEsntlId,
								gosiwonEsntlId,
								status,
								statusStartDate,
								statusEndDate,
								etcStartDate,
								etcEndDate,
								createdAt,
								updatedAt
							) VALUES (?, ?, ?, 'CAN_CHECKIN', ?, ?, ?, ?, NOW(), NOW())`,
							{
								replacements: [
									canCheckinId,
									singleRoomId,
									roomInfo.gosiwonEsntlId,
									finalEtcStartDate,
									finalEtcEndDate,
									finalEtcStartDate,
									finalEtcEndDate,
								],
								type: mariaDBSequelize.QueryTypes.INSERT,
								transaction,
							}
						);
					}
					// room 테이블 status를 OPEN으로 변경
					await mariaDBSequelize.query(
						`UPDATE room SET status = 'OPEN' WHERE esntlId = ? AND deleteYN = 'N'`,
						{
							replacements: [singleRoomId],
							type: mariaDBSequelize.QueryTypes.UPDATE,
							transaction,
						}
					);
					results.push({
						roomId: singleRoomId,
						action: 'updated',
						esntlId: existingOnSale.esntlId,
					});
				} else {
					// 해당 방에 ON_SALE이 없으면 판매 시작 불가 (BEFORE_SALES 등만 있는 경우)
					const [anyStatus] = await mariaDBSequelize.query(
						`SELECT status FROM roomStatus WHERE roomEsntlId = ? LIMIT 1`,
						{
							replacements: [singleRoomId],
							type: mariaDBSequelize.QueryTypes.SELECT,
							transaction,
						}
					);
					if (anyStatus) {
						errorHandler.errorThrow(400, `해당 방의 상태가 'ON_SALE'이 아니어서 판매 시작을 할 수 없습니다. (현재 상태: ${anyStatus.status}, roomId: ${singleRoomId})`);
					}
					// roomStatus가 아무 것도 없을 때: ON_SALE + CAN_CHECKIN 새로 생성
					const newStatusId = await idsNext('roomStatus', undefined, transaction);
					await mariaDBSequelize.query(
						`INSERT INTO roomStatus (
							esntlId,
							roomEsntlId,
							gosiwonEsntlId,
							status,
							statusStartDate,
							statusEndDate,
							etcStartDate,
							etcEndDate,
							createdAt,
							updatedAt
						) VALUES (?, ?, ?, 'ON_SALE', ?, ?, ?, ?, NOW(), NOW())`,
						{
							replacements: [
								newStatusId,
								singleRoomId,
								roomInfo.gosiwonEsntlId,
								statusStartDate,
								finalStatusEndDate,
								statusStartDate,
								finalStatusEndDate,
							],
							type: mariaDBSequelize.QueryTypes.INSERT,
							transaction,
						}
					);
					const canCheckinId = await idsNext('roomStatus', undefined, transaction);
					await mariaDBSequelize.query(
						`INSERT INTO roomStatus (
							esntlId,
							roomEsntlId,
							gosiwonEsntlId,
							status,
							statusStartDate,
							statusEndDate,
							etcStartDate,
							etcEndDate,
							createdAt,
							updatedAt
						) VALUES (?, ?, ?, 'CAN_CHECKIN', ?, ?, ?, ?, NOW(), NOW())`,
						{
							replacements: [
								canCheckinId,
								singleRoomId,
								roomInfo.gosiwonEsntlId,
								finalEtcStartDate,
								finalEtcEndDate,
								finalEtcStartDate,
								finalEtcEndDate,
							],
							type: mariaDBSequelize.QueryTypes.INSERT,
							transaction,
						}
					);
					// room 테이블 status를 OPEN으로 변경
					await mariaDBSequelize.query(
						`UPDATE room SET status = 'OPEN' WHERE esntlId = ? AND deleteYN = 'N'`,
						{
							replacements: [singleRoomId],
							type: mariaDBSequelize.QueryTypes.UPDATE,
							transaction,
						}
					);
					results.push({
						roomId: singleRoomId,
						action: 'created',
						esntlId: newStatusId,
					});
				}
			}
		}

		await transaction.commit();
		errorHandler.successThrow(res, '방 판매 시작이 완료되었습니다.', {
			totalCount: results.length,
			results,
		});
	} catch (err) {
		await transaction.rollback();
		next(err);
	}
};

// 빈 방 목록 조회 (ON_SALE, BEFORE_SALE 상태)
exports.getFreeRoomList = async (req, res, next) => {
	try {
		verifyAdminToken(req);

		const { goID } = req.query;

		if (!goID) {
			errorHandler.errorThrow(400, 'goID를 입력해주세요.');
		}

		// room 기준만 사용, roomStatus 조건 제거. room.status IN ('OPEN', 'EMPTY', 'LEAVE'), deleteYN = 'N'
		const query = `
			SELECT 
				R.esntlId,
				R.gosiwonEsntlId,
				R.roomType,
				R.roomCategory,
				R.deposit,
				R.monthlyRent,
				R.startDate,
				R.endDate,
				R.rom_checkout_expected_date,
				R.window,
				R.option,
				R.orderOption,
				R.roomNumber,
				R.floor,
				R.intro,
				R.empty,
				R.status,
				R.month,
				R.description,
				R.top,
				R.youtube,
				R.customerEsntlId,
				R.rom_successor_eid,
				R.rom_dp_at,
				R.deleteYN,
				R.orderNo,
				R.agreementType,
				R.agreementContent,
				R.availableGender
			FROM room R
			WHERE R.gosiwonEsntlId = :goID
				AND R.deleteYN = 'N'
				AND R.status IN ('OPEN', 'EMPTY', 'LEAVE')
			ORDER BY R.orderNo ASC
		`;

		const roomList = await mariaDBSequelize.query(query, {
			replacements: { goID: goID },
			type: mariaDBSequelize.QueryTypes.SELECT,
		});

		// 최종 조건: room.deleteYN = 'N'만 통과 (N이 아니면 아웃)
		const filteredRoomList = roomList.filter((room) => room.deleteYN === 'N');
		// monthlyRent는 DB에서 받은 값 그대로 반환
		const formattedRoomList = filteredRoomList;

		errorHandler.successThrow(res, '빈 방 목록 조회 성공', formattedRoomList);
	} catch (err) {
		next(err);
	}
};

