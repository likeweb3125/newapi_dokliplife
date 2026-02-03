const { roomCategory, roomCategoryOption, history, mariaDBSequelize } = require('../models');
const jwt = require('jsonwebtoken');
const errorHandler = require('../middleware/error');
const { getWriterAdminId } = require('../utils/auth');
const { next: idsNext } = require('../utils/idsNext');

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

const OPTION_PREFIX = 'COPT';
const OPTION_PADDING = 10;

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

const generateOptionId = async (transaction) => {
	const latest = await roomCategoryOption.findOne({
		attributes: ['esntlId'],
		order: [['esntlId', 'DESC']],
		transaction,
		lock: transaction ? transaction.LOCK.UPDATE : undefined,
	});

	if (!latest || !latest.esntlId) {
		return `${OPTION_PREFIX}${String(1).padStart(OPTION_PADDING, '0')}`;
	}

	const numberPart = parseInt(latest.esntlId.replace(OPTION_PREFIX, ''), 10);
	const nextNumber = Number.isNaN(numberPart) ? 1 : numberPart + 1;
	return `${OPTION_PREFIX}${String(nextNumber).padStart(
		OPTION_PADDING,
		'0'
	)}`;
};

// 카테고리 목록 조회
exports.getCategoryList = async (req, res, next) => {
	try {
		verifyAdminToken(req);

		const { goID } = req.query;

		if (!goID) {
			errorHandler.errorThrow(400, 'goID를 입력해주세요.');
		}

		const categories = await roomCategory.findAll({
			where: {
				gosiwonEsntlId: goID,
			},
			order: [['created_at', 'ASC']],
			include: [
				{
					model: roomCategoryOption,
					as: 'options',
					required: false,
					separate: true,
					order: [
						['sort_order', 'ASC'],
						['created_at', 'ASC'],
					],
				},
			],
		});

		const response = categories.map((category) => ({
			categoryID: category.esntlId,
			goID: category.gosiwonEsntlId,
			categoryName: category.name,
			basePrice: category.base_price,
			memo: category.memo || '',
			options: (category.options || []).map((option) => ({
				esntlID: option.esntlId,
				optionName: option.option_name,
				optionAmount: Number(option.option_amount),
				sortOrder: option.sort_order,
			})),
			createdAt: category.created_at,
		}));

		errorHandler.successThrow(res, '카테고리 목록 조회 성공', response);
	} catch (err) {
		next(err);
	}
};

// 카테고리 등록
exports.createCategory = async (req, res, next) => {
	const transaction = await mariaDBSequelize.transaction();
	try {
		const decodedToken = verifyAdminToken(req);
		const writerAdminId = getWriterAdminId(decodedToken);

		const { goID, categoryName, basePrice, memo, options } = req.body;

		if (!goID || !categoryName || basePrice === undefined) {
			errorHandler.errorThrow(400, '필수 값을 모두 입력해주세요.');
		}

		// IDS 테이블 기준 카테고리 ID 생성 (tableName: roomCategory, prefix: ROOM)
		const categoryId = await idsNext('roomCategory', 'ROOM', transaction);
		const basePriceValue = basePrice !== undefined && basePrice !== null ? String(basePrice) : '0';

		await roomCategory.create(
			{
				esntlId: categoryId,
				gosiwonEsntlId: goID,
				name: categoryName,
				base_price: basePriceValue,
				memo: memo || null,
			},
			{ transaction }
		);

		if (Array.isArray(options)) {
			for (const [index, option] of options.entries()) {
				if (!option?.optionName) {
					continue;
				}
				await roomCategoryOption.create(
					{
						esntlId: await generateOptionId(transaction),
						categoryEsntlId: categoryId,
						option_name: option.optionName,
						option_amount: option.optionAmount ?? 0,
						sort_order:
							option.sortOrder !== undefined ? option.sortOrder : index,
					},
					{ transaction }
				);
			}
		}

		// History 기록 생성
		try {
			const historyId = await generateHistoryId(transaction);
			const historyContent = `방 카테고리 생성: ${categoryName}, 기본가격 ${basePriceValue}원${memo ? `, 메모: ${memo}` : ''}${options && options.length > 0 ? `, 옵션 ${options.length}개` : ''}`;

			await history.create(
				{
					esntlId: historyId,
					gosiwonEsntlId: goID,
					etcEsntlId: categoryId,
					content: historyContent,
					category: 'ROOM_CATEGORY',
					priority: 'NORMAL',
					publicRange: 0,
					writerAdminId: writerAdminId,
					writerType: 'ADMIN',
					deleteYN: 'N',
				},
				{ transaction }
			);
		} catch (historyErr) {
			console.error('History 생성 실패:', historyErr);
			// History 생성 실패해도 카테고리 생성 프로세스는 계속 진행
		}

		await transaction.commit();

		errorHandler.successThrow(res, '카테고리 등록 성공', { categoryID: categoryId });
	} catch (err) {
		await transaction.rollback();
		next(err);
	}
};

// 카테고리 수정
exports.updateCategory = async (req, res, next) => {
	const transaction = await mariaDBSequelize.transaction();
	try {
		const decodedToken = verifyAdminToken(req);
		const writerAdminId = getWriterAdminId(decodedToken);

		const { categoryID, categoryName, basePrice, memo, options } = req.body;

		if (!categoryID) {
			errorHandler.errorThrow(400, 'categoryID를 입력해주세요.');
		}

		const category = await roomCategory.findByPk(categoryID);
		if (!category) {
			errorHandler.errorThrow(404, '카테고리를 찾을 수 없습니다.');
		}

		const basePriceValue =
			basePrice !== undefined && basePrice !== null
				? String(basePrice)
				: category.base_price;

		await roomCategory.update(
			{
				name: categoryName || category.name,
				base_price: basePriceValue,
				memo: memo !== undefined ? memo : category.memo,
			},
			{
				where: { esntlId: categoryID },
				transaction,
			}
		);

		const optionList = Array.isArray(options) ? options : [];

		const deleteTargets = optionList
			.filter((opt) => opt.isDeleted && opt.esntlID)
			.map((opt) => opt.esntlID);

		if (deleteTargets.length > 0) {
			await roomCategoryOption.destroy({
				where: {
					esntlId: deleteTargets,
					categoryEsntlId: categoryID,
				},
				transaction,
			});
		}

		for (const [index, option] of optionList.entries()) {
			if (option.isDeleted) {
				continue;
			}

			const payload = {
				option_name: option.optionName,
				option_amount: option.optionAmount ?? 0,
				sort_order:
					option.sortOrder !== undefined ? option.sortOrder : index,
			};

			if (option.esntlID) {
				await roomCategoryOption.update(payload, {
					where: {
						esntlId: option.esntlID,
						categoryEsntlId: categoryID,
					},
					transaction,
				});
			} else if (option.optionName) {
				await roomCategoryOption.create(
					{
						esntlId: await generateOptionId(transaction),
						categoryEsntlId: categoryID,
						...payload,
					},
					{ transaction }
				);
			}
		}

		// History 기록 생성 (변경사항 추적)
		try {
			const historyId = await generateHistoryId(transaction);
			const changes = [];
			if (categoryName && categoryName !== category.name) {
				changes.push(`이름: ${category.name} → ${categoryName}`);
			}
			if (basePrice !== undefined && basePriceValue !== category.base_price) {
				changes.push(`기본가격: ${category.base_price}원 → ${basePriceValue}원`);
			}
			if (memo !== undefined && memo !== category.memo) {
				changes.push(`메모 변경`);
			}
			if (options && options.length > 0) {
				const newOptions = options.filter(opt => !opt.isDeleted && !opt.esntlID);
				const deletedOptions = options.filter(opt => opt.isDeleted && opt.esntlID);
				if (newOptions.length > 0) {
					changes.push(`옵션 추가 ${newOptions.length}개`);
				}
				if (deletedOptions.length > 0) {
					changes.push(`옵션 삭제 ${deletedOptions.length}개`);
				}
			}

			if (changes.length > 0) {
				const historyContent = `방 카테고리 수정: ${changes.join(', ')}`;

				await history.create(
					{
						esntlId: historyId,
						gosiwonEsntlId: category.gosiwonEsntlId,
						etcEsntlId: categoryID,
						content: historyContent,
						category: 'ROOM_CATEGORY',
						priority: 'NORMAL',
						publicRange: 0,
						writerAdminId: writerAdminId,
						writerType: 'ADMIN',
						deleteYN: 'N',
					},
					{ transaction }
				);
			}
		} catch (historyErr) {
			console.error('History 생성 실패:', historyErr);
			// History 생성 실패해도 카테고리 수정 프로세스는 계속 진행
		}

		await transaction.commit();

		errorHandler.successThrow(res, '카테고리 수정 성공');
	} catch (err) {
		await transaction.rollback();
		next(err);
	}
};

// 카테고리 삭제
exports.deleteCategory = async (req, res, next) => {
	const transaction = await mariaDBSequelize.transaction();
	try {
		const decodedToken = verifyAdminToken(req);
		const writerAdminId = getWriterAdminId(decodedToken);

		const { categoryID } = req.query;

		if (!categoryID) {
			errorHandler.errorThrow(400, 'categoryID를 입력해주세요.');
		}

		// 삭제 전 카테고리 정보 조회 (history 기록용)
		const category = await roomCategory.findByPk(categoryID, {
			transaction,
		});

		if (!category) {
			errorHandler.errorThrow(404, '카테고리를 찾을 수 없습니다.');
		}

		await roomCategoryOption.destroy({
			where: {
				categoryEsntlId: categoryID,
			},
			transaction,
		});

		const deleted = await roomCategory.destroy({
			where: {
				esntlId: categoryID,
			},
			transaction,
		});

		if (!deleted) {
			errorHandler.errorThrow(404, '카테고리를 찾을 수 없습니다.');
		}

		// History 기록 생성
		try {
			const historyId = await generateHistoryId(transaction);
			const historyContent = `방 카테고리 삭제: ${category.name} (기본가격 ${category.base_price}원)`;

			await history.create(
				{
					esntlId: historyId,
					gosiwonEsntlId: category.gosiwonEsntlId,
					etcEsntlId: categoryID,
					content: historyContent,
					category: 'ROOM_CATEGORY',
					priority: 'NORMAL',
					publicRange: 0,
					writerAdminId: writerAdminId,
					writerType: 'ADMIN',
					deleteYN: 'N',
				},
				{ transaction }
			);
		} catch (historyErr) {
			console.error('History 생성 실패:', historyErr);
			// History 생성 실패해도 카테고리 삭제 프로세스는 계속 진행
		}

		await transaction.commit();

		errorHandler.successThrow(res, '카테고리 삭제 성공');
	} catch (err) {
		await transaction.rollback();
		next(err);
	}
};


