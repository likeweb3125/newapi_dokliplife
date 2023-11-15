const moment = require('moment');
const { Op, Sequelize } = require('sequelize');
const {
   i_category,
   i_category_board_group,
   sequelize,
   i_category_board,
} = require('../models');
const errorHandler = require('../middleware/error');
const enumConfig = require('../middleware/enum');
const multerMiddleware = require('../middleware/multer');
const db = require('../models');

// Get Category Group List
// 2023.09.06 ash
exports.getBoardGroupList = async (req, res, next) => {
   const { parent_id } = req.params;
   try {
      const categoryGroupListY = await i_category_board_group.findAll({
         where: [{ parent_id: parent_id, use_yn: enumConfig.useType.Y[0] }],
         order: [['g_num', 'ASC']],
         attributes: [
            'id',
            'parent_id',
            'g_num',
            'all_board',
            'g_name',
            'g_menu_ui',
            'g_img_on',
            'g_img_off',
            'use_yn',
         ],
      });

      if (!categoryGroupListY) {
         errorHandler.errorThrow(404, '');
      }

      const categoryGroupListYResult = categoryGroupListY.map((list) => {
         const listObj = {
            id: list.id,
            parent_id: list.parent_id,
            g_num: list.g_num,
            all_board: list.all_board,
            g_name: list.g_name,
            g_menu_ui: list.g_menu_ui,
            g_img_on: list.g_img_on,
            g_img_off: list.g_img_off,
            use_yn: list.use_yn,
         };
         return listObj;
      });

      const categorGroupListN = await i_category_board_group.findAll({
         where: [{ parent_id: parent_id, use_yn: enumConfig.useType.N[0] }],
         order: [['g_num', 'ASC']],
         attributes: [
            'id',
            'parent_id',
            'g_num',
            'g_name',
            'all_board',
            'g_menu_ui',
            'g_img_on',
            'g_img_off',
            'use_yn',
         ],
      });

      const categoryGroupListNResult = categorGroupListN.map((list) => {
         const listObj = {
            id: list.id,
            parent_id: list.parent_id,
            g_num: list.g_num,
            all_board: list.all_board,
            g_name: list.g_name,
            g_menu_ui: list.g_menu_ui,
            g_img_on: list.g_img_on,
            g_img_off: list.g_img_off,
            use_yn: list.use_yn,
         };
         return listObj;
      });

      const hierarchicalMenu = categoryGroupListYResult;

      hierarchicalMenu.push({
         id: '',
         parent_id: parent_id,
         g_num: '0',
         all_board: '',
         g_name: '숨긴분류',
         g_menu_ui: '',
         g_img_on: '',
         g_img_off: '',
         use_yn: enumConfig.useType.N[0],
         submenu: categoryGroupListNResult,
      });

      //res.status(200).json(hierarchicalMenu);
      errorHandler.successThrow(res, '', hierarchicalMenu);
   } catch (err) {
      next(err);
   }
};

// Post Board Group Create
// 2023.09.06 ash
exports.postBoardGroupCreate = async (req, res, next) => {
   const {
      parent_id,
      g_num,
      all_board,
      g_name,
      g_menu_ui,
      g_img_on,
      g_img_off,
      use_yn,
   } = req.body;

   try {
      const groupParent = await i_category.findOne({
         where: [
            {
               id: parent_id,
               [Op.or]: [
                  { c_content_type: enumConfig.contentType.FAQ[0] },
                  { c_content_type: enumConfig.contentType.QNA[0] },
               ],
            },
         ],
      });

      if (!groupParent) {
         errorHandler.errorThrow(404, 'Parent Not Content.');
      }

      let calculatedCNum = g_num;

      if (!g_num) {
         const categoryCount = await i_category_board_group.count({
            attributes: [[Sequelize.literal('count(*) + 1'), 'count']],
            where: {
               parent_id: parent_id,
               use_yn: use_yn || enumConfig.useType.Y[0],
            },
         });

         calculatedCNum = categoryCount;
      }

      const groupOnImg = req.files['g_img_on'];
      const groupOffImg = req.files['g_img_off'];

      const groupOnImgPath =
         groupOnImg && groupOnImg[0] ? groupOnImg[0].path : null;
      const groupOffImgPath =
         groupOffImg && groupOffImg[0] ? groupOffImg[0].path : null;

      const groupCreate = await i_category_board_group.create({
         parent_id: parent_id,
         g_num: calculatedCNum,
         all_board: all_board,
         g_name: g_name,
         g_menu_ui: g_menu_ui,
         g_img_on: groupOnImgPath,
         g_img_off: groupOffImgPath,
         use_yn: use_yn || enumConfig.useType.Y[0],
      });

      if (!groupCreate) {
         errorHandler.errorThrow(404, '');
      }

      errorHandler.successThrow(res, '', '');
   } catch (err) {
      next(err);
   }
};

// Post Board Group View
// 2023.09.07 ash
exports.getBoardGroupView = async (req, res, next) => {
   const { id } = req.params;

   try {
      const groupView = await i_category_board_group.findOne({
         where: {
            id: id,
            use_yn: enumConfig.useType.Y[0],
         },
         attributes: [
            'id',
            'parent_id',
            'g_num',
            'all_board',
            'g_name',
            'g_menu_ui',
            'g_img_on',
            'g_img_off',
            'use_yn',
         ],
      });

      if (!groupView) {
         errorHandler.errorThrow(404, '');
      }

      const groupObj = {
         id: groupView.id,
         parent_id: groupView.parent_id,
         g_num: groupView.g_num,
         all_board: groupView.all_board,
         g_name: groupView.g_name,
         g_menu_ui: groupView.g_menu_ui,
         g_img_on: groupView.g_img_on,
         g_img_off: groupView.g_img_off,
         use_yn: groupView.use_yn,
      };

      res.status(200).json(groupObj);
   } catch (err) {
      next(err);
   }
};

// Post Board Group Update
// 2023.09.07 ash
exports.putBoardGroupUpdate = async (req, res, next) => {
   const { id, all_board, g_name, g_menu_ui, g_img_on, g_img_off, use_yn } =
      req.body;

   try {
      const groupOnImg = req.files['g_img_on'];
      const groupOffImg = req.files['g_img_off'];

      const groupOnImgPath =
         groupOnImg && groupOnImg[0] ? groupOnImg[0].path : null;
      const groupOffImgPath =
         groupOffImg && groupOffImg[0] ? groupOffImg[0].path : null;
      console.log(groupOnImgPath);
      const groupCreate = await i_category_board_group.update(
         {
            all_board: all_board,
            g_name: g_name,
            g_menu_ui: g_menu_ui,
            g_img_on: groupOnImgPath,
            g_img_off: groupOffImgPath,
            use_yn: use_yn,
         },
         {
            where: {
               id: id,
               use_yn: enumConfig.useType.Y[0],
            },
         }
      );

      if (!groupCreate) {
         errorHandler.errorThrow(404, '');
      }

      errorHandler.successThrow(res, '', '');
   } catch (err) {
      next(err);
   }
};

// Delete Board Group
// 2023.09.07 ash
exports.deleteBoardGroupDestroy = async (req, res, next) => {
   const { id } = req.body;

   try {
      const groupView = await i_category_board_group.findByPk(id);

      if (!groupView) {
         errorHandler.errorThrow(404, '');
      }

      //   if (groupView.g_img_on) {
      //      multerMiddleware.clearFile(groupView.g_img_on);
      //   }

      //   if (groupView.g_img_off) {
      //      multerMiddleware.clearFile(groupView.g_img_off);
      //   }

      //   const groupDelete = await i_category_board_group.destroy({
      //      where: {
      //         id: id,
      //      },
      //   });

      const groupDelete = await i_category_board_group.update(
         {
            use_yn: enumConfig.useType.D[0],
         },
         {
            where: {
               id: id,
            },
         }
      );

      if (!groupDelete) {
         errorHandler.errorThrow(404, '');
      }

      errorHandler.successThrow(res, '', '');
   } catch (err) {
      next(err);
   }
};

// Put Board Group Move
// 2023.09.07 ash
exports.putBoardGroupMove = async (req, res, next) => {
   const { id, parent_id, g_num } = req.body;

   let transaction;

   try {
      transaction = await db.mariaDBSequelize.transaction();

      const groupNum = await i_category_board_group.findOne({
         where: {
            id: id,
            use_yn: enumConfig.useType.Y[0],
         },
         attributes: ['g_num'],
      });

      if (!groupNum) {
         errorHandler.errorThrow(404, '');
      }

      let moveDirection;
      if (g_num < groupNum.g_num) {
         moveDirection = 'UP';
      }

      if (g_num > groupNum.g_num) {
         moveDirection = 'DOWN';
      }

      if (moveDirection === 'UP') {
         await i_category_board_group.update(
            {
               g_num: Sequelize.literal('g_num + 1'),
            },
            {
               where: {
                  g_num: { [Op.gte]: g_num, [Op.lt]: groupNum.g_num },
                  parent_id: parent_id,
                  use_yn: enumConfig.useType.Y[0],
               },
            }
         );
      }

      if (moveDirection === 'DOWN') {
         await i_category_board_group.update(
            {
               g_num: Sequelize.literal('g_num - 1'),
            },
            {
               where: {
                  g_num: { [Op.gt]: groupNum.g_num, [Op.lte]: g_num },
                  parent_id: parent_id,
                  use_yn: enumConfig.useType.Y[0],
               },
            }
         );
      }

      await i_category_board_group.update(
         {
            g_num: g_num,
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
