const { Op } = require('sequelize');
const { room, mariaDBSequelize } = require('../models');
const jwt = require('jsonwebtoken');
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
				r.deposit / 10000 AS rom_deposit,
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
		verifyAdminToken(req);

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
		verifyAdminToken(req);

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

		if (roomNumber !== undefined) updateData.roomNumber = roomNumber;
		if (roomType !== undefined) updateData.roomType = roomType;
		if (roomCategory !== undefined) updateData.roomCategory = roomCategory;
		if (deposit !== undefined) updateData.deposit = parseInt(deposit, 10);
		if (monthlyRent !== undefined) updateData.monthlyRent = monthlyRent;
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
		if (status !== undefined) updateData.status = status;
		if (month !== undefined) updateData.month = month;
		if (description !== undefined) updateData.description = description;
		if (top !== undefined) updateData.top = top;
		if (youtube !== undefined) updateData.youtube = youtube;
		if (customerEsntlId !== undefined)
			updateData.customerEsntlId = customerEsntlId;
		if (rom_successor_eid !== undefined)
			updateData.rom_successor_eid = rom_successor_eid;
		if (rom_dp_at !== undefined) updateData.rom_dp_at = rom_dp_at;
		if (deleteYN !== undefined) updateData.deleteYN = deleteYN;
		if (orderNo !== undefined) updateData.orderNo = parseInt(orderNo, 10);
		if (agreementType !== undefined) updateData.agreementType = agreementType;
		if (agreementContent !== undefined) updateData.agreementContent = agreementContent;

		await room.update(updateData, {
			where: { esntlId: esntlID },
			transaction,
		});

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
		verifyAdminToken(req);

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

		await transaction.commit();

		if (!deleted) {
			errorHandler.errorThrow(404, '방 정보를 찾을 수 없습니다.');
		}

		errorHandler.successThrow(res, '방 정보 삭제 성공');
	} catch (err) {
		await transaction.rollback();
		next(err);
	}
};

