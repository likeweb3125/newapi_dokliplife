const moment = require('moment');
const { Op, Sequelize } = require('sequelize');
const bcrypt = require('bcryptjs');
const { i_member, i_member_level, i_board, i_board_comment, i_member_login, i_member_sec, customer } = require('../models');

const errorHandler = require('../middleware/error');
const enumConfig = require('../middleware/enum');
const isAuthControllers = require('../controllers/auth');
const db = require('../models');

const CUSTOMER_PREFIX = 'CUTR';
const CUSTOMER_PADDING = 10;

// 고객 ID 생성 함수
const generateCustomerId = async (transaction) => {
	const latest = await customer.findOne({
		attributes: ['esntlId'],
		order: [['esntlId', 'DESC']],
		transaction,
		lock: transaction ? transaction.LOCK.UPDATE : undefined,
	});

	if (!latest || !latest.esntlId) {
		return `${CUSTOMER_PREFIX}${String(1).padStart(CUSTOMER_PADDING, '0')}`;
	}

	const numberPart = parseInt(
		latest.esntlId.replace(CUSTOMER_PREFIX, ''),
		10
	);
	const nextNumber = Number.isNaN(numberPart) ? 1 : numberPart + 1;
	return `${CUSTOMER_PREFIX}${String(nextNumber).padStart(
		CUSTOMER_PADDING,
		'0'
	)}`;
};

const normalizeYn = (value) => {
	if (value === undefined || value === null) {
		return 'N';
	}
	if (typeof value === 'boolean') {
		return value ? 'Y' : 'N';
	}
	const normalized = String(value).trim().toUpperCase();
	if (['Y', 'YES', 'TRUE', '1'].includes(normalized)) {
		return 'Y';
	}
	if (['N', 'NO', 'FALSE', '0'].includes(normalized)) {
		return 'N';
	}
	return 'N';
};

const normalizeGender = (value) => {
	if (!value) {
		return null;
	}
	const lowerValue = String(value).trim().toLowerCase();
	if (['남', '남자', 'm', 'male'].includes(lowerValue)) {
		return 'M';
	}
	if (['여', '여자', 'f', 'female'].includes(lowerValue)) {
		return 'F';
	}
	return null;
};


// 회원 등록 (customer 테이블)
exports.postCustomerRegister = async (req, res, next) => {
	let transaction;
	try {
		transaction = await db.mariaDBSequelize.transaction();

		const {
			name,
			gender,
			phone,
			id,
			pass,
			byAdmin,
			cusCollectYn,
			cusLocationYn,
			cusPromotionYn,
		} = req.body;

		// 필수 필드 검증
		if (!name) {
			errorHandler.errorThrow(400, '이름을 입력해주세요.');
		}
		if (!phone) {
			errorHandler.errorThrow(400, '휴대폰 번호를 입력해주세요.');
		}
		if (typeof phone !== 'string') {
			errorHandler.errorThrow(400, '휴대폰 번호는 문자열 형태(예: 01012345678)로 입력해주세요.');
		}
		if (!id) {
			errorHandler.errorThrow(400, '이메일을 입력해주세요.');
		}
		if (!pass) {
			errorHandler.errorThrow(400, '비밀번호를 입력해주세요.');
		}

		// 이메일 중복 확인
		const existingCustomer = await customer.findOne({
			where: { id: id },
			raw: true,
			transaction,
		});

		if (existingCustomer) {
			errorHandler.errorThrow(400, '이미 등록된 이메일입니다.');
		}

		// esntlId 생성 (CUTR0000000001 형식)
		const esntlId = await generateCustomerId(transaction);

		// 등록일 생성
		const regDate = moment().format('YYYY-MM-DD HH:mm:ss');

		// isByAdmin 처리: byAdmin이 true이면 1, 아니면 0 또는 NULL
		const isByAdminValue = byAdmin === true ? 1 : null;

		// 회원 등록
		const hashedPass = await bcrypt.hash(pass, 12);

		const newCustomer = await customer.create(
			{
				esntlId: esntlId,
				id: id,
				pass: hashedPass,
				name: name,
				phone: phone,
				gender: normalizeGender(gender),
				regDate: regDate,
				isByAdmin: isByAdminValue,
				point: '0',
				withdrawal: '',
				withdrawalDate: '',
				cus_collect_yn: normalizeYn(cusCollectYn),
				cus_location_yn: normalizeYn(cusLocationYn),
				cus_promotion_yn: normalizeYn(cusPromotionYn),
				cus_status: 'USED',
			},
			{ transaction }
		);

		await transaction.commit();

		errorHandler.successThrow(res, '회원 등록 성공', {
			esntlId: newCustomer.esntlId,
			id: newCustomer.id,
			name: newCustomer.name,
		});
	} catch (err) {
		if (transaction) {
			await transaction.rollback();
		}
		next(err);
	}
};

// 회원 정보 수정 (customer 테이블)
exports.putCustomerUpdate = async (req, res, next) => {
	let transaction;
	try {
		transaction = await db.mariaDBSequelize.transaction();

		const {
			esntlId,
			name,
			gender,
			phone,
			id,
			pass,
			cusCollectYn,
			cusLocationYn,
			cusPromotionYn,
			cus_collect_yn,
			cus_location_yn,
			cus_promotion_yn,
		} = req.body;

		if (!esntlId) {
			errorHandler.errorThrow(400, 'esntlId를 입력해주세요.');
		}

		const existingCustomer = await customer.findOne({
			where: { esntlId },
			transaction,
		});

		if (!existingCustomer) {
			errorHandler.errorThrow(404, '회원 정보를 찾을 수 없습니다.');
		}

		const updateFields = {};

		if (name !== undefined) {
			updateFields.name = name;
		}
		if (gender !== undefined) {
			updateFields.gender = normalizeGender(gender);
		}
		if (phone !== undefined) {
			if (typeof phone !== 'string') {
				errorHandler.errorThrow(400, '휴대폰 번호는 문자열 형태(예: 01012345678)로 입력해주세요.');
			}
			updateFields.phone = phone;
		}
		if (id !== undefined) {
			updateFields.id = id;
		}
		if (pass !== undefined) {
			if (!pass) {
				errorHandler.errorThrow(400, '비밀번호를 입력해주세요.');
			}
			updateFields.pass = await bcrypt.hash(pass, 12);
		}
		const collectYnInput =
			cusCollectYn !== undefined ? cusCollectYn : cus_collect_yn;
		const locationYnInput =
			cusLocationYn !== undefined ? cusLocationYn : cus_location_yn;
		const promotionYnInput =
			cusPromotionYn !== undefined ? cusPromotionYn : cus_promotion_yn;

		if (collectYnInput !== undefined) {
			updateFields.cus_collect_yn = normalizeYn(collectYnInput);
		}
		if (locationYnInput !== undefined) {
			updateFields.cus_location_yn = normalizeYn(locationYnInput);
		}
		if (promotionYnInput !== undefined) {
			updateFields.cus_promotion_yn = normalizeYn(promotionYnInput);
		}

		if (Object.keys(updateFields).length === 0) {
			errorHandler.successThrow(res, '수정할 항목이 없습니다.', { esntlId });
			return;
		}

		await customer.update(updateFields, { where: { esntlId }, transaction });
		await transaction.commit();

		errorHandler.successThrow(res, '회원 정보 수정 성공', {
			esntlId,
			updatedFields: Object.keys(updateFields),
		});
	} catch (err) {
		if (transaction) {
			await transaction.rollback();
		}
		next(err);
	}
};

// 회원 로그인 (customer 테이블)
exports.postCustomerLogin = async (req, res, next) => {
	try {
		const { id, pass } = req.body;

		if (!id || !pass) {
			errorHandler.errorThrow(400, '아이디와 비밀번호를 모두 입력해주세요.');
		}

		const existingCustomer = await customer.findOne({
			where: { id },
		});

		if (!existingCustomer) {
			errorHandler.errorThrow(404, '회원 정보를 찾을 수 없습니다.');
		}

		const isValidPassword = await bcrypt.compare(pass, existingCustomer.pass);

		if (!isValidPassword) {
			errorHandler.errorThrow(401, '비밀번호가 일치하지 않습니다.');
		}

		errorHandler.successThrow(res, '로그인 성공', {
			esntlId: existingCustomer.esntlId,
			id: existingCustomer.id,
			name: existingCustomer.name,
		});
	} catch (err) {
		next(err);
	}
};
