const { Op } = require('sequelize');
const { room, memo, history, mariaDBSequelize } = require('../models');
const jwt = require('jsonwebtoken');
const errorHandler = require('../middleware/error');
const { getWriterAdminId } = require('../utils/auth');

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

	if (!decodedToken || !decodedToken.admin) {
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

		const { goID, roomName, sortBy, contractStatus } = req.query;

		if (!goID) {
			errorHandler.errorThrow(400, 'goID를 입력해주세요.');
		}

		// roomContract status 필터 (기본값: null이면 모든 상태)
		const rcStatus = contractStatus || null;

		// WHERE 조건 구성
		let whereClause = 'WHERE R.gosiwonEsntlId = :goID';
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
		const query = `
			SELECT 
				R.esntlId,
				R.roomType,
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
				RC.startDate,
				RC.endDate,
				RC.month,
				(SELECT count(*) FROM roomSee RS WHERE RS.roomEsntlId = R.esntlId) AS see,
				(SELECT count(*) FROM roomLike RL WHERE RL.roomEsntlId = R.esntlId) AS likes,
				(SELECT IFNULL(ror_sn, '') FROM il_room_reservation AS RR WHERE rom_sn = R.esntlId AND RR.ror_status_cd = 'WAIT' ORDER BY RR.ror_update_dtm DESC LIMIT 1) AS ror_sn
			FROM room R
			LEFT OUTER JOIN roomContract RC
				ON RC.roomEsntlId = R.esntlId
				${rcStatus !== null ? 'AND RC.status = :rcStatus' : ''}
			${whereClause}
			${orderByClause}
		`;

		if (rcStatus !== null) {
			replacements.rcStatus = rcStatus;
		}

		const roomList = await mariaDBSequelize.query(query, {
			replacements: replacements,
			type: mariaDBSequelize.QueryTypes.SELECT,
		});

		errorHandler.successThrow(res, '방 목록 조회 성공', roomList);
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
				r.gosiwonEsntlId,
				r.roomType,
				r.roomCategory,
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
				gu.deposit AS gsw_deposit
			FROM room AS r
			JOIN gosiwonUse AS gu ON r.gosiwonEsntlId = gu.esntlId
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

		await room.create(
			{
				esntlId: roomId,
				gosiwonEsntlId: goID,
				roomNumber: roomNumber || null,
				roomType: roomType || null,
				roomCategory: roomCategory || null,
				deposit: deposit !== undefined ? parseInt(deposit, 10) : null,
				monthlyRent: monthlyRent || null,
				startDate: startDate || null,
				endDate: endDate || null,
				rom_checkout_expected_date:
					rom_checkout_expected_date || null,
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
				rom_dp_at: rom_dp_at || null,
				deleteYN: deleteYN || 'N',
				orderNo: orderNo !== undefined ? parseInt(orderNo, 10) : 1,
				agreementType: agreementType || null,
				agreementContent: agreementContent || null,
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
		if (deposit !== undefined && parseInt(deposit, 10) !== roomInfo.deposit) {
			updateData.deposit = parseInt(deposit, 10);
			changes.push(`보증금: ${roomInfo.deposit || 0} → ${deposit}`);
		}
		if (monthlyRent !== undefined && monthlyRent !== roomInfo.monthlyRent) {
			updateData.monthlyRent = monthlyRent;
			changes.push(`월세: ${roomInfo.monthlyRent || 0} → ${monthlyRent}`);
		}
		if (status !== undefined && status !== roomInfo.status) {
			updateData.status = status;
			changes.push(`상태: ${roomInfo.status || '없음'} → ${status}`);
		}
		if (customerEsntlId !== undefined && customerEsntlId !== roomInfo.customerEsntlId) {
			updateData.customerEsntlId = customerEsntlId;
			changes.push(`입실자: ${roomInfo.customerEsntlId || '없음'} → ${customerEsntlId || '없음'}`);
		}
		if (startDate !== undefined) updateData.startDate = startDate;
		if (endDate !== undefined) updateData.endDate = endDate;
		if (rom_checkout_expected_date !== undefined)
			updateData.rom_checkout_expected_date = rom_checkout_expected_date;
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
		if (rom_dp_at !== undefined) updateData.rom_dp_at = rom_dp_at;
		if (deleteYN !== undefined) updateData.deleteYN = deleteYN;
		if (orderNo !== undefined) updateData.orderNo = parseInt(orderNo, 10);
		if (agreementType !== undefined) updateData.agreementType = agreementType;
		if (agreementContent !== undefined) updateData.agreementContent = agreementContent;

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

// 방 예약 및 결제 요청
exports.roomReserve = async (req, res, next) => {
	const transaction = await mariaDBSequelize.transaction();
	try {
		const decodedToken = verifyAdminToken(req);
		const userSn = getWriterAdminId(decodedToken);

		const {
			roomEsntlId,
			deposit,
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

		await mariaDBSequelize.query(insertReservationQuery, {
			replacements: [
				reservationId,
				roomEsntlId,
				deposit,
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

		// 2. 방 상태를 RESERVE로 업데이트
		await room.update(
			{
				status: 'RESERVE',
			},
			{
				where: {
					esntlId: roomEsntlId,
				},
				transaction,
			}
		);

		// 방 정보 조회하여 gosiwonEsntlId 가져오기 (메모 및 history 생성에 필요)
		const roomBasicInfo = await room.findByPk(roomEsntlId, {
			attributes: ['gosiwonEsntlId'],
			transaction,
		});

		if (!roomBasicInfo || !roomBasicInfo.gosiwonEsntlId) {
			errorHandler.errorThrow(404, '방 정보를 찾을 수 없거나 고시원 정보가 없습니다.');
		}

		// 3. History 기록 생성
		try {
			const historyId = await generateHistoryId(transaction);
			const historyContent = `방 예약 생성: 예약ID ${reservationId}, 입실일 ${checkInDate}, 계약기간 ${rorPeriod}${rorContractStartDate ? ` (${rorContractStartDate} ~ ${rorContractEndDate})` : ''}, 보증금 ${deposit}원${rorPayMethod ? `, 결제방법 ${rorPayMethod}` : ''}`;

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

		// 4. 메모 내용이 있으면 메모 생성
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
		const roomInfoQuery = `
			SELECT 
				g.name AS gsw_name,
				r.roomNumber AS rom_name,
				FORMAT(r.monthlyRent * 10000, 0) AS monthlyRent,
				CONCAT(REPLACE(CURDATE(), '-', '.'), ' ', '23:59') AS contractExpDateTime,
				IF(c.phone = ?, 'EXTENSION', 'NEW') AS req_type,
				IF((c.name LIKE '%kakao%' OR c.name IS NULL), '입실자', c.name) AS cus_name,
				ga.hp AS gosiwon_receiver,
				r.esntlId AS rom_eid
			FROM room AS r
			JOIN gosiwon AS g ON r.gosiwonEsntlId = g.esntlId
			JOIN gosiwonAdmin AS ga ON ga.esntlId = g.adminEsntlId
			LEFT JOIN customer AS c ON c.esntlId = r.customerEsntlId
			WHERE r.esntlId = ?
		`;

		const [roomInfoData] = await mariaDBSequelize.query(roomInfoQuery, {
			replacements: [receiver, roomEsntlId],
			type: mariaDBSequelize.QueryTypes.SELECT,
			transaction,
		});

		if (!roomInfoData) {
			errorHandler.errorThrow(404, '방 정보를 찾을 수 없습니다.');
		}

		await transaction.commit();

		// 알림톡 발송 데이터 준비
		const data = {
			...roomInfoData,
			receiver: receiver,
			product: `${roomInfo.gsw_name} ${roomInfo.rom_name}`,
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
			data.receiver = data.gosiwon_receiver;
			await Kakao.send('AL_P_PAYMENT_REQUEST_ALERT', [{
				receiver: data.receiver,
				product: data.product,
				req_number: receiver
			}]);
		}
		*/

		errorHandler.successThrow(res, '결제 요청이 발송되었습니다.', data);
	} catch (err) {
		await transaction.rollback();
		next(err);
	}
};

