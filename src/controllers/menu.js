const moment = require('moment');
const { Op, Sequelize } = require('sequelize');
const { i_category, sequelize, mariaDBSequelize } = require('../models');
const errorHandler = require('../middleware/error');
const enumConfig = require('../middleware/enum');
const multerMiddleware = require('../middleware/multer');

// Get Menu List
// 2023.08.31 ash
exports.getCategoryList = async (req, res, next) => {
	try {
		const categoryListY = await i_category.findAll({
			where: [{ c_use_yn: enumConfig.useType.Y[0] }],
			order: [
				['c_depth', 'ASC'],
				['c_num', 'ASC'],
			],
			attributes: [
				'id',
				'c_depth',
				'c_depth_parent',
				'c_num',
				'c_name',
				'c_use_yn',
				'c_main_banner',
				'c_main_banner_file',
				'c_menu_ui',
				'c_menu_on_img',
				'c_menu_off_img',
				'c_content_type',
			],
		});

		if (!categoryListY) {
			errorHandler.errorThrow(404, '');
		}

		const categoryListN = await i_category.findAll({
			where: [{ c_use_yn: enumConfig.useType.N[0] }],
			order: [
				['c_depth', 'ASC'],
				['c_num', 'ASC'],
			],
			attributes: [
				'id',
				'c_depth',
				'c_depth_parent',
				'c_num',
				'c_name',
				'c_use_yn',
				'c_main_banner',
				'c_main_banner_file',
				'c_menu_ui',
				'c_menu_on_img',
				'c_menu_off_img',
				'c_content_type',
			],
		});

		const categoryListNResult = categoryListN.map((list) => {
			const listObj = {
				id: list.id,
				c_depth: list.c_depth,
				c_depth_parent: list.c_depth_parent,
				c_num: list.c_num,
				c_name: list.c_name,
				c_main_banner: list.c_main_banner,
				c_main_banner_file: list.c_main_banner_file,
				c_menu_ui: list.c_menu_ui,
				c_menu_on_img: list.c_menu_on_img,
				c_menu_off_img: list.c_menu_off_img,
				c_content_type: mapContentType(list.c_content_type),
			};
			return listObj;
		});

		const buildMenu = (menuItems, parentId) => {
			return menuItems
				.filter((item) => item.c_depth_parent === parentId)
				.map((item) => {
					const submenu = buildMenu(
						menuItems,
						item.id
					);

					if (submenu.length > 0) {
						return {
							id: item.id,
							c_depth: item.c_depth,
							c_depth_parent:
								item.c_depth_parent,
							c_num: item.c_num,
							c_name: item.c_name,
							c_main_banner:
								item.c_main_banner,
							c_main_banner_file:
								item.c_main_banner_file,
							c_menu_ui: item.c_menu_ui,
							c_menu_on_img:
								item.c_menu_on_img,
							c_menu_off_img:
								item.c_menu_off_img,
							c_content_type: mapContentType(
								item.c_content_type
							),
							submenu,
						};
					} else {
						return {
							id: item.id,
							c_depth: item.c_depth,
							c_depth_parent:
								item.c_depth_parent,
							c_num: item.c_num,
							c_name: item.c_name,
							c_main_banner:
								item.c_main_banner,
							c_main_banner_file:
								item.c_main_banner_file,
							c_menu_ui: item.c_menu_ui,
							c_menu_on_img:
								item.c_menu_on_img,
							c_menu_off_img:
								item.c_menu_off_img,
							c_content_type: mapContentType(
								item.c_content_type
							),
						};
					}
				});
		};

		const hierarchicalMenu = buildMenu(categoryListY, 0);

		hierarchicalMenu.push({
			id: '0',
			c_depth: '1',
			c_depth_parent: '0',
			c_num: '0',
			c_name: '미사용 카테고리',
			submenu: categoryListNResult,
		});

		//res.status(200).json(hierarchicalMenu);
		errorHandler.successThrow(res, '', hierarchicalMenu);
	} catch (err) {
		next(err);
	}
};

// Get Menu Create
// 2023.08.31 ash
exports.postCategoryCreate = async (req, res, next) => {
	const {
		c_depth,
		c_depth_parent,
		c_num,
		c_name,
		c_main_banner,
		c_main_banner_file,
		c_menu_ui,
		c_menu_on_img,
		c_menu_off_img,
		c_contents_type,
		c_use_yn,
	} = req.body;

	try {
		let calculatedCNum = c_num;

		if (!c_num) {
			const categoryCount = await i_category.count({
				attributes: [
					[Sequelize.literal('count(*) + 1'), 'count'],
				],
				where: {
					c_depth: c_depth,
					c_depth_parent: c_depth_parent,
					c_use_yn:
						c_use_yn || enumConfig.useType.Y[0],
				},
			});

			calculatedCNum = categoryCount;
		}

		const mainBannerFile = req.files['c_main_banner_file'];
		const menuOnImg = req.files['c_menu_on_img'];
		const menuOffImg = req.files['c_menu_off_img'];

		let mainBannerFilePath = null;
		let menuOnImgPath = null;
		let menuOffImgPath = null;

		if (mainBannerFile && mainBannerFile[0]) {
			mainBannerFilePath = mainBannerFile[0].path;
		}

		if (menuOnImg && menuOnImg[0]) {
			menuOnImgPath = menuOnImg[0].path;
		}

		if (menuOffImg && menuOffImg[0]) {
			menuOffImgPath = menuOffImg[0].path;
		}

		const categoryCreate = await i_category.create({
			c_depth: c_depth,
			c_depth_parent: c_depth_parent,
			c_num: calculatedCNum,
			c_name: c_name,
			c_main_banner: c_main_banner,
			c_main_banner_file: mainBannerFilePath,
			c_menu_ui: c_menu_ui,
			c_menu_on_img: menuOnImgPath,
			c_menu_off_img: menuOffImgPath,
			c_contents_type: c_contents_type,
			c_use_yn: c_use_yn || enumConfig.useType.Y[0],
		});

		if (!categoryCreate) {
			errorHandler.errorThrow(404, '');
		}

		errorHandler.successThrow(res, '', '');
	} catch (err) {
		next(err);
	}
};

// Post Menu View
// 2023.09.04 ash
exports.getCategoryView = async (req, res, next) => {
	const { id } = req.params;

	try {
		const menuView = await i_category.findByPk(id);

		if (!menuView) {
			errorHandler.errorThrow(404, '');
		}

		const menuObj = {
			id: menuView.id,
			c_depth: menuView.c_depth,
			c_depth_parent: menuView.c_depth_parent,
			c_num: menuView.c_num,
			c_name: menuView.c_name,
			c_main_banner:
				menuView.c_main_banner ===
				enumConfig.bannerSizeType.COVER[0]
					? enumConfig.bannerSizeType.COVER
					: menuView.c_main_banner ===
					  enumConfig.bannerSizeType.ORIGINAL[0]
					? enumConfig.bannerSizeType.ORIGINAL
					: null,
			c_main_banner_file: menuView.c_main_banner_file,
			c_menu_ui:
				menuView.c_menu_ui === enumConfig.menuUiType.TXT[0]
					? enumConfig.menuUiType.TXT
					: menuView.c_menu_ui ===
					  enumConfig.menuUiType.IMG[0]
					? enumConfig.menuUiType.IMG
					: null,
			c_menu_on_img: menuView.c_menu_on_img,
			c_menu_off_img: menuView.c_menu_off_img,
			c_content_type: menuView.c_content_type,
			c_use_yn: menuView.c_nuc_use_ynm,
		};

		//res.status(200).json(menuObj);
		errorHandler.successThrow(res, '', menuObj);
	} catch (err) {
		next(err);
	}
};

// Put Menu Update
// 2023.09.04 ash
exports.putCategoryUpdate = async (req, res, next) => {
	const {
		id,
		c_depth,
		c_depth_parent,
		c_num,
		c_name,
		c_main_banner,
		c_main_banner_file,
		c_menu_ui,
		c_menu_on_img,
		c_menu_off_img,
		c_contents_type,
		c_use_yn,
	} = req.body;

	try {
		const menuView = await i_category.findByPk(id);

		if (!menuView) {
			errorHandler.errorThrow(404, '');
		}

		const mainBannerFile = req.files['c_main_banner_file'];
		const menuOnImg = req.files['c_menu_on_img'];
		const menuOffImg = req.files['c_menu_off_img'];

		let mainBannerFilePath = null;
		let menuOnImgPath = null;
		let menuOffImgPath = null;

		if (mainBannerFile && mainBannerFile[0]) {
			if (
				menuView.c_main_banner_file !==
					mainBannerFile[0].path &&
				menuView.c_main_banner_file !== null
			) {
				clearFile(menuView.c_main_banner_file);
			}
			mainBannerFilePath = mainBannerFile[0].path;
		} else {
			mainBannerFilePath = menuView.c_main_banner_file;
		}

		if (menuOnImg && menuOnImg[0]) {
			if (
				menuView.c_menu_on_img !== menuOnImg[0].path &&
				menuView.c_menu_on_img !== null
			) {
				clearFile(menuView.c_menu_on_img);
			}
			menuOnImgPath = menuOnImg[0].path;
		} else {
			menuOnImgPath = menuView.c_menu_on_img;
		}

		if (menuOffImg && menuOffImg[0]) {
			if (
				menuView.c_menu_off_img !== menuOffImg[0].path &&
				menuView.c_menu_off_img !== null
			) {
				clearFile(menuView.c_menu_off_img);
			}
			menuOffImgPath = menuOffImg[0].path;
		} else {
			menuOffImgPath = menuView.c_menu_off_img;
		}

		const menuUpdate = await i_category.update(
			{
				c_name: c_name,
				c_main_banner: c_main_banner,
				c_main_banner_file: mainBannerFilePath,
				c_menu_ui: c_menu_ui,
				c_menu_on_img: menuOnImgPath,
				c_menu_off_img: menuOffImgPath,
			},
			{
				where: {
					id: id,
				},
			}
		);

		if (!menuUpdate) {
			errorHandler.errorThrow(404, '');
		}

		errorHandler.successThrow(res, '', '');
	} catch (err) {
		next(err);
	}
};

// Delete Menu
// 2023.09.04 ash
exports.deleteCategoryDestroy = async (req, res, next) => {
	const { id } = req.body;

	try {
		const menuView = await i_category.findByPk(id);

		if (!menuView) {
			errorHandler.errorThrow(404, '');
		}

		// if (menuView.c_main_banner_file) {
		//    multerMiddleware.clearFile(menuView.c_main_banner_file);
		// }

		// if (menuView.c_menu_on_img) {
		//    multerMiddleware.clearFile(menuView.c_menu_on_img);
		// }

		// if (menuView.c_menu_off_img) {
		//    multerMiddleware.clearFile(menuView.c_menu_off_img);
		// }

		// const menuDelete = await i_category.destroy({
		//    where: {
		//       id: id,
		//    },
		// });

		const menuDelete = await i_category.update(
			{
				c_use_yn: enumConfig.useType.D[0],
			},
			{
				where: {
					id: id,
				},
			}
		);

		if (!menuDelete) {
			errorHandler.errorThrow(404, '');
		}

		errorHandler.successThrow(res, '', '');
	} catch (err) {
		console.error(err);

		next(err);
	}
};

// Put Menu Move
// 2023.09.04 ash
exports.putMoveCategory = async (req, res, next) => {
	const { id, c_depth, c_depth_parent, c_num } = req.body;

	let transaction;

	try {
		transaction = await mariaDBSequelize.transaction();

		const menuView = await i_category.findByPk(id);

		if (!menuView) {
			errorHandler.errorThrow(204, '메뉴 id 가 없습니다.');
		}

		if (menuView.c_depth !== parseInt(c_depth)) {
			errorHandler.errorThrow(
				404,
				'depth 가 다르면 이동이 안됩니다.'
			);
		}

		let moveDirection;
		if (c_num < menuView.c_num) {
			moveDirection = 'UP';
		}

		if (c_num > menuView.c_num) {
			moveDirection = 'DOWN';
		}

		if (moveDirection === 'UP') {
			await i_category.update(
				{
					c_num: Sequelize.literal('c_num + 1'),
				},
				{
					where: {
						c_num: {
							[Op.gte]: c_num,
							[Op.lt]: menuView.c_num,
						},
						c_depth_parent: c_depth_parent,
						c_use_yn: enumConfig.useType.Y[0],
					},
				}
			);
		}

		if (moveDirection === 'DOWN') {
			await i_category.update(
				{
					c_num: Sequelize.literal('c_num - 1'),
				},
				{
					where: {
						c_num: {
							[Op.gt]: menuView.c_num,
							[Op.lte]: c_num,
						},
						c_depth_parent: c_depth_parent,
						c_use_yn: enumConfig.useType.Y[0],
					},
				}
			);
		}

		await i_category.update(
			{
				c_num: c_num,
			},
			{
				where: {
					id: id,
				},
			}
		);

		await transaction.commit();

		errorHandler.successThrow(res, '', '');
	} catch (err) {
		if (transaction) {
			await transaction.rollback();
		}

		next(err);
	}
};

// 2023-12-12 카테고리이동시 마지막 번호로
exports.putMoveLastCategory = async (req, res, next) => {
	const { id, c_depth, c_depth_parent } = req.body;

	let transaction;

	try {
		transaction = await mariaDBSequelize.transaction();

		const menuView = await i_category.findByPk(id);

		if (!menuView) {
			errorHandler.errorThrow(204, '메뉴 id 가 없습니다.');
		}

		if (menuView.c_depth !== parseInt(c_depth)) {
			errorHandler.errorThrow(
				404,
				'depth 가 다르면 이동이 안됩니다.'
			);
		}

		const maxNumResult = await i_category.findOne({
			attributes: [
				[
					Sequelize.fn('MAX', Sequelize.col('c_num')),
					'maxNum',
				],
			],
			where: [
				{
					c_use_yn: enumConfig.useType.Y[0],
					c_depth_parent: c_depth_parent,
				},
			],
		});

		await i_category.update(
			{
				c_num: maxNumResult.maxNum,
			},
			{
				where: {
					id: id,
				},
			}
		);

		await transaction.commit();

		errorHandler.successThrow(res, '', '');
	} catch (err) {
		if (transaction) {
			await transaction.rollback();
		}

		next(err);
	}
};

function mapContentType(contentType) {
	switch (contentType) {
		case 1:
			return enumConfig.contentType.HTML;
		case 2:
			return enumConfig.contentType.EMPTY;
		case 3:
			return enumConfig.contentType.CUSTOM;
		case 4:
			return enumConfig.contentType.BOARD;
		case 5:
			return enumConfig.contentType.GALLERY;
		case 6:
			return enumConfig.contentType.FAQ;
		case 7:
			return enumConfig.contentType.QNA;
		default:
			return null;
	}
}

//카테고리 맵핑
exports.putMappingCategory = async (req, res, next) => {
	const { id, c_use_yn } = req.body;

	let transaction;

	try {
		transaction = await mariaDBSequelize.transaction();

		const menuView = await i_category.findByPk(id);

		if (!menuView) {
			errorHandler.errorThrow(204, '메뉴 id 가 없습니다.');
		}

		if (menuView.c_depth === 1) {
			errorHandler.errorThrow(
				404,
				'1 depth 메뉴는 매핑이 안됩니다.'
			);
		}

		const menuMapping = await i_category.update(
			{
				c_use_yn: c_use_yn,
			},
			{
				where: {
					c_depth: { [Op.ne]: 1 },
					id: id,
				},
			}
		);

		if (!menuMapping) {
			errorHandler.errorThrow(404, '');
		}

		await transaction.commit();

		errorHandler.successThrow(res, '', menuMapping);
	} catch (err) {
		next(err);
	}
};
