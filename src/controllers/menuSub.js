const moment = require('moment');
const { Op, Sequelize } = require('sequelize');
const {
   i_category,
   i_category_html,
   i_category_empty,
   i_category_custom,
   i_category_board,
   sequelize,
} = require('../models');
const errorHandler = require('../middleware/error');
const enumConfig = require('../middleware/enum');
const multerMiddleware = require('../middleware/multer');
const db = require('../models');

// Get SubMenu Create
// 2023.09.04 ash
exports.postSubCategoryCreate = async (req, res, next) => {
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
      c_content_type,
      c_use_yn,

      content,

      c_type,
      file_path,
      admin_file_path,
      sms,
      email,

      b_list_cnt,
      b_column_title,
      b_column_date,
      b_column_view,
      b_column_recom,
      b_column_file,
      b_thumbnail_with,
      b_thumbnail_height,
      b_read_lv,
      b_write_lv,
      b_group,
      b_secret,
      b_reply,
      b_reply_lv,
      b_comment,
      b_comment_lv,
      b_alarm,
      b_alarm_phone,
      b_top_html,
      b_template,
      b_template_text,
   } = req.body;

   let transaction;

   try {
      transaction = await db.mariaDBSequelize.transaction();

      let calculatedCNum = c_num;

      if (!c_num) {
         const categoryCount = await i_category.count({
            attributes: [[Sequelize.literal('count(*) + 1'), 'count']],
            where: {
               c_depth: c_depth,
               c_depth_parent: c_depth_parent,
               c_use_yn: c_use_yn || enumConfig.useType.Y[0],
            },
         });

         calculatedCNum = categoryCount;
      }

      const mainBannerFile = req.files['c_main_banner_file'];
      const menuOnImg = req.files['c_menu_on_img'];
      const menuOffImg = req.files['c_menu_off_img'];

      const mainBannerFilePath =
         mainBannerFile && mainBannerFile[0] ? mainBannerFile[0].path : null;
      const menuOnImgPath =
         menuOnImg && menuOnImg[0] ? menuOnImg[0].path : null;
      const menuOffImgPath =
         menuOffImg && menuOffImg[0] ? menuOffImg[0].path : null;

      const newCategory = await i_category.create({
         c_depth: c_depth,
         c_depth_parent: c_depth_parent,
         c_num: calculatedCNum,
         c_name: c_name,
         c_main_banner: c_main_banner,
         c_main_banner_file: mainBannerFilePath,
         c_menu_ui: c_menu_ui,
         c_menu_on_img: menuOnImgPath,
         c_menu_off_img: menuOffImgPath,
         c_content_type: c_content_type,
         c_use_yn: c_use_yn || enumConfig.useType.Y[0],
      });

      let subCategory;

      switch (parseInt(c_content_type)) {
         case enumConfig.contentType.HTML[0]:
            subCategory = await i_category_html.findOrCreate({
               where: {
                  parent_id: newCategory.id,
                  use_yn: enumConfig.useType.Y[0],
               },
               defaults: {
                  parent_id: newCategory.id,
                  content: content,
               },
            });
            break;
         case enumConfig.contentType.EMPTY[0]:
            subCategory = await i_category_empty.findOrCreate({
               where: {
                  parent_id: newCategory.id,
                  use_yn: enumConfig.useType.Y[0],
               },
               defaults: {
                  parent_id: newCategory.id,
               },
            });
            break;
         case enumConfig.contentType.CUSTOM[0]:
            subCategory = await i_category_custom.findOrCreate({
               where: {
                  parent_id: newCategory.id,
                  use_yn: enumConfig.useType.Y[0],
               },
               defaults: {
                  parent_id: newCategory.id,
                  c_type: c_type,
                  file_path: file_path,
                  admin_file_path: admin_file_path,
                  sms: sms,
                  email: email,
               },
            });
            break;
         case enumConfig.contentType.BOARD[0]:
         case enumConfig.contentType.GALLERY[0]:
         case enumConfig.contentType.FAQ[0]:
         case enumConfig.contentType.QNA[0]:
            subCategory = await i_category_board.findOrCreate({
               where: {
                  parent_id: newCategory.id,
                  use_yn: enumConfig.useType.Y[0],
               },
               defaults: {
                  parent_id: newCategory.id,
                  b_list_cnt: b_list_cnt,
                  b_column_title: b_column_title,
                  b_column_date: b_column_date,
                  b_column_view: b_column_view,
                  b_column_recom: b_column_recom,
                  b_column_file: b_column_file,
                  b_thumbnail_with: b_thumbnail_with,
                  b_thumbnail_height: b_thumbnail_height,
                  b_read_lv: b_read_lv,
                  b_write_lv: b_write_lv,
                  b_group: b_group,
                  b_secret: b_secret,
                  b_reply: b_reply,
                  b_reply_lv: b_reply_lv,
                  b_comment: b_comment,
                  b_comment_lv: b_comment_lv,
                  b_alarm: b_alarm,
                  b_alarm_phone: b_alarm_phone,
                  b_top_html: b_top_html,
                  b_template: b_template,
                  b_template_text: b_template_text,
               },
            });
            break;
         default:
            errorHandler.errorThrow(404, 'Invalid c_contents_type');
      }

      if (!subCategory) {
         errorHandler.errorThrow(404, '이미 지정된 메뉴가 있습니다.');
      }

      await transaction.commit();

      errorHandler.successThrow(res, '', '');
   } catch (err) {
      if (transaction) {
         await transaction.rollback();
      }

      next(err);
   }
};

// Post Sub Menu View
// 2023.09.04 ash
exports.getSubCategoryView = async (req, res, next) => {
   const { id } = req.params;

   try {
      const menuView = await i_category.findByPk(id);

      if (!menuView) {
         errorHandler.errorThrow(402, '');
      }

      const menuObj = {
         id: menuView.id,
         c_depth: menuView.c_depth,
         c_depth_parent: menuView.c_depth_parent,
         c_num: menuView.c_num,
         c_name: menuView.c_name,
         c_main_banner: menuView.c_main_banner,
         c_main_banner_file: menuView.c_main_banner_file,
         c_menu_ui:
            menuView.c_menu_ui === enumConfig.menuUiType.TXT[0]
               ? enumConfig.menuUiType.TXT
               : menuView.c_menu_ui === enumConfig.menuUiType.IMG[0]
               ? enumConfig.menuUiType.IMG
               : null,
         c_menu_on_img: menuView.c_menu_on_img,
         c_menu_off_img: menuView.c_menu_off_img,
         c_content_type: (() => {
            switch (menuView.c_content_type) {
               case enumConfig.contentType.HTML[0]:
                  return enumConfig.contentType.HTML;
               case enumConfig.contentType.EMPTY[0]:
                  return enumConfig.contentType.EMPTY;
               case enumConfig.contentType.CUSTOM[0]:
                  return enumConfig.contentType.CUSTOM;
               case enumConfig.contentType.BOARD[0]:
                  return enumConfig.contentType.BOARD;
               case enumConfig.contentType.GALLERY[0]:
                  return enumConfig.contentType.GALLERY;
               case enumConfig.contentType.FAQ[0]:
                  return enumConfig.contentType.FAQ;
               case enumConfig.contentType.QNA[0]:
                  return enumConfig.contentType.QNA;
               default:
                  return null;
            }
         })(),
         c_use_yn: menuView.c_nuc_use_ynm,
      };

      let subView;

      switch (menuView.c_content_type) {
         case enumConfig.contentType.HTML[0]:
            subView = await i_category_html.findOne({
               where: {
                  parent_id: id,
               },
               attributes: ['parent_id', 'content'],
            });
            break;
         case enumConfig.contentType.EMPTY[0]:
            subView = await i_category_empty.findOne({
               where: {
                  parent_id: id,
               },
               attributes: ['parent_id'],
            });
            break;
         case enumConfig.contentType.CUSTOM[0]:
            subView = await i_category_custom.findOne({
               where: {
                  parent_id: id,
               },
               attributes: ['parent_id'],
            });
            break;
         case enumConfig.contentType.BOARD[0]:
         case enumConfig.contentType.GALLERY[0]:
         case enumConfig.contentType.FAQ[0]:
         case enumConfig.contentType.QNA[0]:
            subView = await i_category_board.findOne({
               where: {
                  parent_id: id,
               },
               attributes: [
                  'parent_id',
                  'b_list_cnt',
                  'b_column_title',
                  'b_column_date',
                  'b_column_view',
                  'b_column_recom',
                  'b_column_file',
                  'b_thumbnail_with',
                  'b_thumbnail_height',
                  'b_read_lv',
                  'b_write_lv',
                  'b_group',
                  'b_secret',
                  'b_reply',
                  'b_reply_lv',
                  'b_comment',
                  'b_comment_lv',
                  'b_write_alarm',
                  'b_write_send',
                  'b_alarm',
                  'b_alarm_phone',
                  'b_top_html',
                  'b_template',
                  'b_template_text',
               ],
            });
            break;
         default:
            errorHandler.errorThrow(404, 'Invalid c_contents_type');
      }

      if (!subView) {
         errorHandler.errorThrow(404, '');
      }

      switch (menuView.c_content_type) {
         case enumConfig.contentType.HTML[0]:
            menuObj.parent_id = subView.parent_id;
            menuObj.content = subView.content;
            break;
         case enumConfig.contentType.EMPTY[0]:
            menuObj.parent_id = subView.parent_id;
            break;
         case enumConfig.contentType.CUSTOM[0]:
            menuObj.parent_id = subView.parent_id;
            menuObj.c_type = subView.c_type;
            menuObj.file_path = subView.file_path;
            menuObj.admin_file_path = subView.admin_file_path;
            menuObj.sms = subView.sms;
            menuObj.email = subView.email;
            break;
         case enumConfig.contentType.BOARD[0]:
         case enumConfig.contentType.GALLERY[0]:
         case enumConfig.contentType.FAQ[0]:
         case enumConfig.contentType.QNA[0]:
            menuObj.parent_id = subView.parent_id;
            menuObj.b_list_cnt = subView.b_list_cnt;
            menuObj.b_column_title = subView.b_column_title;
            menuObj.b_column_date = subView.b_column_date;
            menuObj.b_column_view = subView.b_column_view;
            menuObj.b_column_recom = subView.b_column_recom;
            menuObj.b_column_file = subView.b_column_file;
            menuObj.b_thumbnail_with = subView.b_thumbnail_with;
            menuObj.b_thumbnail_height = subView.b_thumbnail_height;
            menuObj.b_read_lv = subView.b_read_lv;
            menuObj.b_write_lv = subView.b_write_lv;
            menuObj.b_group = subView.b_group;
            menuObj.b_secret = subView.b_secret;
            menuObj.b_reply = subView.b_reply;
            menuObj.b_reply_lv = subView.b_reply_lv;
            menuObj.b_comment = subView.b_comment;
            menuObj.b_comment_lv = subView.b_comment_lv;
            menuObj.b_write_alarm = subView.b_write_alarm;
            menuObj.b_write_send = subView.b_write_send;
            menuObj.b_alarm = subView.b_alarm;
            menuObj.b_alarm_phone = subView.b_alarm_phone;
            menuObj.b_top_html = subView.b_top_html;
            menuObj.b_template = subView.b_template;
            menuObj.b_template_text = subView.b_template_text;
            break;
         default:
            errorHandler.errorThrow(404, 'Invalid c_contents_type');
      }

      //res.status(200).json(menuObj);
      errorHandler.successThrow(res, '', menuObj);
   } catch (err) {
      next(err);
   }
};

// Get SubMenu Update
// 2023.09.04 ash
exports.putSubCategoryUpdate = async (req, res, next) => {
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
      c_content_type,
      c_use_yn,

      content,

      c_type,
      file_path,
      admin_file_path,
      sms,
      email,

      b_list_cnt,
      b_column_title,
      b_column_date,
      b_column_view,
      b_column_recom,
      b_column_file,
      b_thumbnail_with,
      b_thumbnail_height,
      b_read_lv,
      b_write_lv,
      b_group,
      b_secret,
      b_reply,
      b_reply_lv,
      b_comment,
      b_comment_lv,
      b_alarm,
      b_alarm_phone,
      b_top_html,
      b_template,
      b_template_text,
   } = req.body;

   let transaction;

   try {
      transaction = await sequelize.transaction();

      const menuView = await i_category.findByPk(id);

      if (!menuView) {
         errorHandler.errorThrow(402, '');
      }

      const getFile = (fieldName, currentPath) => {
         const file = req.files[fieldName];
         return file && file[0]
            ? currentPath !== file[0].path && currentPath !== null
               ? (multerMiddleware.clearFile(currentPath), file[0].path)
               : file[0].path
            : currentPath;
      };

      const mainBannerFilePath = getFile(
         'c_main_banner_file',
         menuView.c_main_banner_file
      );
      const menuOnImgPath = getFile('c_menu_on_img', menuView.c_menu_on_img);
      const menuOffImgPath = getFile('c_menu_off_img', menuView.c_menu_off_img);

      await i_category.update(
         {
            c_depth: c_depth,
            c_depth_parent: c_depth_parent,
            c_num: c_num,
            c_name: c_name,
            c_main_banner: c_main_banner,
            c_main_banner_file: mainBannerFilePath,
            c_menu_ui: c_menu_ui,
            c_menu_on_img: menuOnImgPath,
            c_menu_off_img: menuOffImgPath,
            c_contents_type: c_content_type,
            c_use_yn: c_use_yn || enumConfig.useType.Y[0],
         },
         {
            where: {
               id: id,
            },
         }
      );

      let subCatetory;

      switch (parseInt(c_content_type)) {
         case enumConfig.contentType.HTML[0]:
            subCatetory = await i_category_html.update(
               {
                  content: content,
               },
               {
                  where: {
                     parent_id: id,
                  },
               }
            );
            break;
         case enumConfig.contentType.EMPTY[0]:
            subCatetory = await i_category_empty.update(
               {
                  parent_id: id,
               },
               {
                  where: {
                     parent_id: id,
                  },
               }
            );
            break;
         case enumConfig.contentType.CUSTOM[0]:
            subCatetory = await i_category_custom.update(
               {
                  c_type: c_type,
                  file_path: file_path,
                  admin_file_path: admin_file_path,
                  sms: sms,
                  email: email,
               },
               {
                  where: {
                     parent_id: id,
                  },
               }
            );
            break;
         case enumConfig.contentType.BOARD[0]:
         case enumConfig.contentType.GALLERY[0]:
         case enumConfig.contentType.FAQ[0]:
         case enumConfig.contentType.QNA[0]:
            subCatetory = await i_category_board.update(
               {
                  b_list_cnt: b_list_cnt,
                  b_column_title: b_column_title,
                  b_column_date: b_column_date,
                  b_column_view: b_column_view,
                  b_column_recom: b_column_recom,
                  b_column_file: b_column_file,
                  b_thumbnail_with: b_thumbnail_with,
                  b_thumbnail_height: b_thumbnail_height,
                  b_read_lv: b_read_lv,
                  b_write_lv: b_write_lv,
                  b_group: b_group,
                  b_secret: b_secret,
                  b_reply: b_reply,
                  b_reply_lv: b_reply_lv,
                  b_comment: b_comment,
                  b_comment_lv: b_comment_lv,
                  b_alarm: b_alarm,
                  b_alarm_phone: b_alarm_phone,
                  b_top_html: b_top_html,
                  b_template: b_template,
                  b_template_text: b_template_text,
               },
               {
                  where: {
                     parent_id: id,
                  },
               }
            );
            break;
         default:
            errorHandler.errorThrow(404, 'Invalid c_contents_type');
      }

      if (!subCatetory) {
         errorHandler.errorThrow(404, '');
      }

      await transaction.commit();

      errorHandler.successThrow(res, '', '');
   } catch (err) {
      if (transaction) {
         await transaction.rollback();
      }

      next(err);
   }
};

// Delete SubMenu
// 2023.09.04 ash
exports.deleteSubCategoryDestroy = async (req, res, next) => {
   const { id } = req.body;

   let transaction;

   try {
      transaction = await sequelize.transaction();

      const menuView = await i_category.findByPk(id);

      if (!menuView) {
         errorHandler.errorThrow(402, '');
      }

      switch (menuView.dataValues.c_content_type) {
         case enumConfig.contentType.HTML[0]:
            await i_category_html.update(
               {
                  use_yn: enumConfig.useType.D[0],
               },
               {
                  where: {
                     parent_id: id,
                  },
               },
               { transaction }
            );
         case enumConfig.contentType.EMPTY[0]:
            await i_category_empty.destroy(
               {
                  where: {
                     parent_id: id,
                  },
               },
               { transaction }
            );
         case enumConfig.contentType.CUSTOM[0]:
            await i_category_custom.destroy(
               {
                  where: {
                     parent_id: id,
                  },
               },
               { transaction }
            );
         case enumConfig.contentType.BOARD[0]:
         case enumConfig.contentType.GALLERY[0]:
         case enumConfig.contentType.FAQ[0]:
         case enumConfig.contentType.QNA[0]:
            await i_category_board.destroy(
               {
                  where: {
                     parent_id: id,
                  },
               },
               { transaction }
            );
         default:
            errorHandler.errorThrow(404, 'Invalid c_contents_type');
      }

      await transaction.commit();

      errorHandler.successThrow(res, '', '');
   } catch (err) {
      if (transaction) {
         await transaction.rollback();
      }

      next(err);
   }
};
