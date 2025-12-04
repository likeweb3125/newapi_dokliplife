const { Op } = require('sequelize');
const { gosiwon, mariaDBSequelize } = require('../models');
const jwt = require('jsonwebtoken');
const errorHandler = require('../middleware/error');
const enumConfig = require('../middleware/enum');

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

	console.log('👤 관리자 ID:', decodedToken.admin);
	return decodedToken;
};

const GOSIWON_PREFIX = 'GOSI';
const GOSIWON_PADDING = 10;

const generateGosiwonId = async (transaction) => {
	const latest = await gosiwon.findOne({
		attributes: ['esntlId'],
		order: [['esntlId', 'DESC']],
		transaction,
		lock: transaction ? transaction.LOCK.UPDATE : undefined,
	});

	if (!latest || !latest.esntlId) {
		return `${GOSIWON_PREFIX}${String(1).padStart(GOSIWON_PADDING, '0')}`;
	}

	const numberPart = parseInt(
		latest.esntlId.replace(GOSIWON_PREFIX, ''),
		10
	);
	const nextNumber = Number.isNaN(numberPart) ? 1 : numberPart + 1;
	return `${GOSIWON_PREFIX}${String(nextNumber).padStart(
		GOSIWON_PADDING,
		'0'
	)}`;
};

// 고시원 정보 조회
// 토큰에서 관리자 아이디 확인 후, 검색 종류와 검색어로 고시원 정보 조회
exports.getGosiwonInfo = async (req, res, next) => {
	try {
		// 토큰 검증
		verifyAdminToken(req);

		// 요청 파라미터 확인
		const { esntlId } = req.query;

		if (!esntlId) {
			errorHandler.errorThrow(400, 'esntlId 입력해주세요.');
		}

		const whereCondition = {
			esntlId: esntlId,
		};

		// 고시원 정보 조회
		// 실제 테이블의 컬럼명을 확인하기 위해 attributes를 사용하지 않고 조회
		const gosiwonInfo = await gosiwon.findOne({
			where: whereCondition,
			raw: true,
			logging: console.log, // 실제 SQL 쿼리 확인용
		});

		if (!gosiwonInfo) {
			errorHandler.errorThrow(404, '고시원 정보를 찾을 수 없습니다.');
		}

		// 결과 반환
		errorHandler.successThrow(res, '고시원 정보 조회 성공', gosiwonInfo);
	} catch (err) {
		next(err);
	}
};

// 고시원 이름 목록 조회
exports.getGosiwonNames = async (req, res, next) => {
	try {
		verifyAdminToken(req);

		const { searchValue, limit } = req.query;

		if (!searchValue) {
			errorHandler.errorThrow(400, '검색어를 입력해주세요.');
		}

		const take = limit && parseInt(limit, 10) > 0 ? parseInt(limit, 10) : 10;

		const gosiwonNames = await gosiwon.findAll({
			where: {
				name: {
					[Op.like]: `%${searchValue}%`,
				},
			},
			attributes: ['name', 'esntlId', 'address', 'is_controlled'],
			limit: take,
			order: [['name', 'ASC']],
			raw: true,
		});

		const names = gosiwonNames.map((item) => ({
			name: item.name,
			esntID: item.esntlId,
			address: item.address || '',
			isControlled: Number(item.is_controlled) === 1 ? '관제' : '',
			deposit: '보증급 관리',
			settle: '정산지급',
		}));

		errorHandler.successThrow(res, '고시원 이름 목록 조회 성공', names);
	} catch (err) {
		next(err);
	}
};

// 고시원 즐겨찾기 토글
exports.toggleFavorite = async (req, res, next) => {
	try {
		verifyAdminToken(req);

		const { esntlId } = req.body;

		if (!esntlId) {
			errorHandler.errorThrow(400, 'esntlId 입력해주세요.');
		}

		// 고시원 정보 조회
		const gosiwonInfo = await gosiwon.findOne({
			where: {
				esntlId: esntlId,
			},
			raw: true,
		});

		if (!gosiwonInfo) {
			errorHandler.errorThrow(404, '고시원 정보를 찾을 수 없습니다.');
		}

		// 현재 즐겨찾기 상태 확인 및 토글
		const currentFavorite = gosiwonInfo.is_favorite || 0;
		const newFavorite = currentFavorite === 1 ? 0 : 1;

		// 즐겨찾기 상태 업데이트
		await gosiwon.update(
			{
				is_favorite: newFavorite,
			},
			{
				where: {
					esntlId: esntlId,
				},
			}
		);

		// 업데이트된 정보 반환
		const updatedInfo = await gosiwon.findOne({
			where: {
				esntlId: esntlId,
			},
			attributes: ['esntlId', 'name', 'is_favorite'],
			raw: true,
		});

		errorHandler.successThrow(
			res,
			`즐겨찾기 ${newFavorite === 1 ? '추가' : '제거'} 성공`,
			{
				esntlId: updatedInfo.esntlId,
				name: updatedInfo.name,
				isFavorite: updatedInfo.is_favorite === 1,
			}
		);
	} catch (err) {
		next(err);
	}
};

// 고시원 정보 등록
exports.createGosiwon = async (req, res, next) => {
	const transaction = await mariaDBSequelize.transaction();
	try {
		const decodedToken = verifyAdminToken(req);

		const {
			name,
			address,
			address2,
			address3,
			longitude,
			latitude,
			gsw_grade,
			numOfRooms,
			homepage,
			blog,
			youtube,
			gsw_metaport,
			keeperName,
			keeperHp,
			phone,
			tag,
			email,
			subway,
			college,
			corpNumber,
			bank,
			bankAccount,
			commision,
			description,
			manager,
			point,
			acceptDate,
			gsw_signup_path_cd,
			gsw_signup_path_etc,
			alarmTalk,
			alarmEmail,
			status,
			process,
			rejectText,
			contractText,
			monthCalculate,
			accountHolder,
			contract,
			contractFile,
			contractFileOrgName,
			serviceNumber,
			district,
			is_controlled,
		} = req.body;

		if (!name) {
			errorHandler.errorThrow(400, '고시원 이름을 입력해주세요.');
		}

		if (!decodedToken.admin) {
			errorHandler.errorThrow(400, '관리자 정보가 필요합니다.');
		}

		const esntlId = await generateGosiwonId(transaction);

		await gosiwon.create(
			{
				esntlId: esntlId,
				name: name || null,
				address: address || null,
				address2: address2 || null,
				address3: address3 || null,
				longitude: longitude || null,
				latitude: latitude || null,
				gsw_grade: gsw_grade || '',
				numOfRooms: numOfRooms || null,
				homepage: homepage || null,
				blog: blog || null,
				youtube: youtube || null,
				gsw_metaport: gsw_metaport || null,
				keeperName: keeperName || null,
				keeperHp: keeperHp || null,
				phone: phone || null,
				tag: tag || null,
				email: email || null,
				subway: subway || null,
				college: college || null,
				corpNumber: corpNumber || null,
				bank: bank || null,
				bankAccount: bankAccount || null,
				commision: commision || '7',
				description: description || null,
				manager: manager || null,
				point: point !== undefined ? parseInt(point, 10) : 0,
				acceptDate: acceptDate || null,
				gsw_signup_path_cd: gsw_signup_path_cd || null,
				gsw_signup_path_etc: gsw_signup_path_etc || '',
				alarmTalk: alarmTalk || null,
				alarmEmail: alarmEmail || null,
				status: status || null,
				process: process || null,
				rejectText: rejectText || null,
				contractText: contractText || null,
				monthCalculate: monthCalculate || null,
				accountHolder: accountHolder || null,
				contract: contract || null,
				contractFile: contractFile || null,
				contractFileOrgName: contractFileOrgName || null,
				serviceNumber: serviceNumber || null,
				district: district || null,
				adminEsntlId: decodedToken.admin,
				is_controlled: is_controlled !== undefined ? (is_controlled ? 1 : 0) : 0,
			},
			{ transaction }
		);

		await transaction.commit();

		errorHandler.successThrow(res, '고시원 정보 등록 성공', { esntlId: esntlId });
	} catch (err) {
		await transaction.rollback();
		next(err);
	}
};

// 고시원 정보 수정
exports.updateGosiwon = async (req, res, next) => {
	const transaction = await mariaDBSequelize.transaction();
	try {
		verifyAdminToken(req);

		const { esntlId } = req.body;

		if (!esntlId) {
			errorHandler.errorThrow(400, 'esntlId를 입력해주세요.');
		}

		const gosiwonInfo = await gosiwon.findByPk(esntlId);
		if (!gosiwonInfo) {
			errorHandler.errorThrow(404, '고시원 정보를 찾을 수 없습니다.');
		}

		const updateData = {};

		// 요청된 필드만 업데이트
		if (req.body.name !== undefined) updateData.name = req.body.name;
		if (req.body.address !== undefined) updateData.address = req.body.address;
		if (req.body.address2 !== undefined) updateData.address2 = req.body.address2;
		if (req.body.address3 !== undefined) updateData.address3 = req.body.address3;
		if (req.body.longitude !== undefined) updateData.longitude = req.body.longitude;
		if (req.body.latitude !== undefined) updateData.latitude = req.body.latitude;
		if (req.body.gsw_grade !== undefined) updateData.gsw_grade = req.body.gsw_grade;
		if (req.body.numOfRooms !== undefined) updateData.numOfRooms = req.body.numOfRooms;
		if (req.body.homepage !== undefined) updateData.homepage = req.body.homepage;
		if (req.body.blog !== undefined) updateData.blog = req.body.blog;
		if (req.body.youtube !== undefined) updateData.youtube = req.body.youtube;
		if (req.body.gsw_metaport !== undefined) updateData.gsw_metaport = req.body.gsw_metaport;
		if (req.body.keeperName !== undefined) updateData.keeperName = req.body.keeperName;
		if (req.body.keeperHp !== undefined) updateData.keeperHp = req.body.keeperHp;
		if (req.body.phone !== undefined) updateData.phone = req.body.phone;
		if (req.body.tag !== undefined) updateData.tag = req.body.tag;
		if (req.body.email !== undefined) updateData.email = req.body.email;
		if (req.body.subway !== undefined) updateData.subway = req.body.subway;
		if (req.body.college !== undefined) updateData.college = req.body.college;
		if (req.body.corpNumber !== undefined) updateData.corpNumber = req.body.corpNumber;
		if (req.body.bank !== undefined) updateData.bank = req.body.bank;
		if (req.body.bankAccount !== undefined) updateData.bankAccount = req.body.bankAccount;
		if (req.body.commision !== undefined) updateData.commision = req.body.commision;
		if (req.body.description !== undefined) updateData.description = req.body.description;
		if (req.body.manager !== undefined) updateData.manager = req.body.manager;
		if (req.body.point !== undefined) updateData.point = parseInt(req.body.point, 10);
		if (req.body.acceptDate !== undefined) updateData.acceptDate = req.body.acceptDate;
		if (req.body.gsw_signup_path_cd !== undefined) updateData.gsw_signup_path_cd = req.body.gsw_signup_path_cd;
		if (req.body.gsw_signup_path_etc !== undefined) updateData.gsw_signup_path_etc = req.body.gsw_signup_path_etc;
		if (req.body.alarmTalk !== undefined) updateData.alarmTalk = req.body.alarmTalk;
		if (req.body.alarmEmail !== undefined) updateData.alarmEmail = req.body.alarmEmail;
		if (req.body.status !== undefined) updateData.status = req.body.status;
		if (req.body.process !== undefined) updateData.process = req.body.process;
		if (req.body.rejectText !== undefined) updateData.rejectText = req.body.rejectText;
		if (req.body.contractText !== undefined) updateData.contractText = req.body.contractText;
		if (req.body.monthCalculate !== undefined) updateData.monthCalculate = req.body.monthCalculate;
		if (req.body.accountHolder !== undefined) updateData.accountHolder = req.body.accountHolder;
		if (req.body.contract !== undefined) updateData.contract = req.body.contract;
		if (req.body.contractFile !== undefined) updateData.contractFile = req.body.contractFile;
		if (req.body.contractFileOrgName !== undefined) updateData.contractFileOrgName = req.body.contractFileOrgName;
		if (req.body.serviceNumber !== undefined) updateData.serviceNumber = req.body.serviceNumber;
		if (req.body.district !== undefined) updateData.district = req.body.district;
		if (req.body.is_controlled !== undefined) updateData.is_controlled = req.body.is_controlled ? 1 : 0;
		if (req.body.update_dtm !== undefined) updateData.update_dtm = new Date();

		await gosiwon.update(updateData, {
			where: { esntlId: esntlId },
			transaction,
		});

		await transaction.commit();

		errorHandler.successThrow(res, '고시원 정보 수정 성공');
	} catch (err) {
		await transaction.rollback();
		next(err);
	}
};

// 고시원 정보 삭제
exports.deleteGosiwon = async (req, res, next) => {
	const transaction = await mariaDBSequelize.transaction();
	try {
		verifyAdminToken(req);

		const { esntlId } = req.query;

		if (!esntlId) {
			errorHandler.errorThrow(400, 'esntlId를 입력해주세요.');
		}

		const gosiwonInfo = await gosiwon.findByPk(esntlId);
		if (!gosiwonInfo) {
			errorHandler.errorThrow(404, '고시원 정보를 찾을 수 없습니다.');
		}

		const deleted = await gosiwon.destroy({
			where: {
				esntlId: esntlId,
			},
			transaction,
		});

		await transaction.commit();

		if (!deleted) {
			errorHandler.errorThrow(404, '고시원 정보를 찾을 수 없습니다.');
		}

		errorHandler.successThrow(res, '고시원 정보 삭제 성공');
	} catch (err) {
		await transaction.rollback();
		next(err);
	}
};

