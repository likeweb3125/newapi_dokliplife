const { Op, Sequelize } = require('sequelize');
const {
   i_board,
   i_board_comment,
   i_category,
   i_category_board,
} = require('../models');

const errorHandler = require('./error');
const enumConfig = require('../middleware/enum');

const authorizeUser = async (category, boardAuthType, userLv) => {
   if (userLv === undefined) {
      userLv = 0;
   }
   const boardConfigLv = await i_category_board.findOne({
      where: { parent_id: category },
      attributes: ['b_read_lv', 'b_write_lv', 'b_reply_lv', 'b_comment_lv'],
   });

   if (!boardConfigLv) {
      return { statusCode: 404, message: '게시판 권한 설정이 없습니다.' };
   }
   console.log(boardAuthType);
   switch (boardAuthType) {
      case enumConfig.boardAuthType.READ:
         if (userLv < boardConfigLv.b_read_lv) {
            return {
               statusCode: 403,
               message: enumConfig.boardAuthType.READ + ' 권한이 없습니다',
            };
         }
         break;
      case enumConfig.boardAuthType.CREATE:
         if (userLv < boardConfigLv.b_write_lv) {
            return {
               statusCode: 403,
               message: enumConfig.boardAuthType.CREATE + ' 권한이 없습니다',
            };
         }
         break;
      case enumConfig.boardAuthType.REPLY:
         if (userLv < boardConfigLv.b_reply_lv) {
            return {
               statusCode: 403,
               message: enumConfig.boardAuthType.REPLY + ' 권한이 없습니다',
            };
         }
         break;
      case enumConfig.boardAuthType.COMMENT:
         if (userLv < boardConfigLv.b_comment_lv) {
            return {
               statusCode: 403,
               message: enumConfig.boardAuthType.COMMENT + ' 권한이 없습니다',
            };
         }
         break;
      default:
         return { statusCode: 404, message: '요청 권한이 null' };
   }

   return null;
};

const boardListItem = async (category) => {
   const boardItem = await i_category_board.findOne({
      where: { parent_id: category, use_yn: enumConfig.useType.Y[0] },
      attributes: [
         [
            Sequelize.literal(
               `(SELECT c_content_type FROM i_category WHERE i_category.id = i_category_board.parent_id)`
            ),
            'c_content_type',
         ],
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
         'b_write_sms',
         'b_alarm',
         'b_alarm_phone',
         'b_top_html',
         'b_template',
         'b_template_text',
      ],
   });

   if (!boardItem) {
      return { statusCode: 404, message: '게시판 권한 설정이 없습니다.' };
   }

   const boardItemArray = [];

   if (boardItem.b_column_title === enumConfig.useType.Y[0]) {
      boardItemArray.push('b_title');
   }
   if (boardItem.b_column_date === enumConfig.useType.Y[0]) {
      boardItemArray.push('b_reg_date');
   }
   if (boardItem.b_column_view === enumConfig.useType.Y[0]) {
      boardItemArray.push('b_view');
   }
   if (boardItem.b_column_recom === enumConfig.useType.Y[0]) {
      boardItemArray.push('b_recom');
   }
   if (boardItem.b_column_file === enumConfig.useType.Y[0]) {
      boardItemArray.push('b_file');
   }

   return {
      c_content_type: boardItem.getDataValue('c_content_type'),
      b_list_cnt: boardItem.b_list_cnt,
      b_column_title: boardItem.b_column_title,
      b_column_date: boardItem.b_column_date,
      b_column_view: boardItem.b_column_view,
      b_column_recom: boardItem.b_column_recom,
      b_column_file: boardItem.b_column_file,
      b_thumbnail_with: boardItem.b_thumbnail_with,
      b_thumbnail_height: boardItem.b_thumbnail_height,
      b_read_lv: boardItem.b_read_lv,
      b_write_lv: boardItem.b_write_lv,
      b_group: boardItem.b_group,
      b_secret: boardItem.b_secret,
      b_reply: boardItem.b_reply,
      b_reply_lv: boardItem.b_reply_lv,
      b_comment: boardItem.b_comment,
      b_comment_lv: boardItem.b_comment_lv,
      b_write_alarm: boardItem.b_write_alarm,
      b_write_send: boardItem.b_write_send,
      b_write_sms: boardItem.b_write_sms,
      b_alarm: boardItem.b_alarm,
      b_alarm_phone: boardItem.b_alarm_phone,
      b_top_html: boardItem.b_top_html,
      b_template: boardItem.b_template,
      b_template_text: boardItem.b_template_text,
      boardItem: boardItemArray,
   };
};

module.exports = { authorizeUser, boardListItem };
