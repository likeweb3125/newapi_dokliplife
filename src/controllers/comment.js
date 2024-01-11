const moment = require('moment');
const { Op, Sequelize } = require('sequelize');
const { i_board, i_board_comment, i_category } = require('../models');

const errorHandler = require('../middleware/error');
const enumConfig = require('../middleware/enum');
const db = require('../models');

// 관리자 댓글 리스트
exports.getCommentListAdmin = async (req, res, next) => {
   const { getLimit } = req.params;
   const page = parseInt(req.query.page) || 1;
   const searchQuery = req.query.search;
   const searchTxtQuery = req.query.searchtxt;

   try {
      const whereCondition = {
         idx: { [Op.gt]: 0 },
      };

      if (searchQuery && searchTxtQuery) {
         if (searchQuery === 'c_contents') {
            whereCondition.c_contents = {
               [Op.like]: `%${searchTxtQuery}%`,
            };
         }
      }

      let orderField;

      orderField = [['idx', 'DESC']];

      const subQuery = `(SELECT b_title FROM i_board WHERE i_board.idx = i_board_comment.parent_idx)`;
      const subQuery2 = `(SELECT c_name FROM i_category WHERE id = (SELECT category FROM i_board WHERE i_board.idx = i_board_comment.parent_idx))`;

      const limit = parseInt(getLimit) || 10;

      const offset = (page - 1) * limit;

      const commentList = await i_board_comment.findAndCountAll({
         offset: offset,
         limit: limit,
         where: whereCondition,
         order: orderField,
         attributes: [
            'idx',
            'c_contents',
            'm_name',
            'c_reg_date',
            [Sequelize.literal(subQuery), 'boardTitle'],
            [Sequelize.literal(subQuery2), 'boardName'],
         ],
      });

      const lastPage = Math.ceil(commentList.count / limit);
      const maxPage = 10;
      const startPage = Math.max(
         1,
         Math.floor((page - 1) / maxPage) * maxPage + 1
      );
      const endPage = Math.min(lastPage, startPage + maxPage - 1);

      const listResult = commentList.rows.map((list) => ({
         idx: list.idx,
         c_contents: list.c_contents,
         boardName: list.getDataValue('boardName'),
         boardTitle: list.getDataValue('boardTitle'),
         m_name: list.m_name,
         c_reg_date: moment.utc(list.c_reg_date).format('YYYY.MM.DD hh:mm'),
      }));

      errorHandler.successThrow(res, '', {
         limit: limit,
         current_page: page,
         start_page: startPage,
         max_page: maxPage,
         last_page: lastPage,
         end_page: endPage,
         total_count: commentList.count,
         comment_list: listResult,
      });
   } catch (err) {
      next(err);
   }
};

// 댓글 리스트
// exports.postCommentList = async (req, res, next) => {
//    const board_idx = req.params.board_idx;
//    //console.log(req.params);
//    try {
//       const parentBoard = await i_board_comment
//          .findAll({
//             where: { board_idx: board_idx, parent_idx: null },
//             order: [
//                [
//                   Sequelize.fn(
//                      'IFNULL',
//                      Sequelize.col('parent_idx'),
//                      Sequelize.col('idx')
//                   ),
//                   'DESC',
//                ],
//                ['parent_idx', 'ASC'],
//                ['idx', 'DESC'],
//             ],
//             attributes: [
//                'idx',
//                'board_idx',
//                'parent_idx',
//                'depth',
//                'm_email',
//                'm_name',
//                'c_contents',
//                'c_reg_date',
//             ],
//          })

//       if (!parentBoard) {
//          errorHandler.errorThrow(404, '');
//       }

//       const parentResult = parentBoard.map((main) => ({
//          idx: main.idx,
//          board_idx: main.board_idx,
//          parent_idx: main.parent_idx,
//          depth: main.depth,
//          m_email: main.m_email,
//          m_name: main.m_name,
//          c_contents: main.c_contents,
//          c_reg_date: moment.utc(main.c_reg_date).format('YYYY.MM.DD hh:mm:ss'),
//       }));

//       errorHandler.successThrow(res, '', parentResult);
//    } catch (err) {
//       next(err);
//    }
// };

// 댓글 리스트
exports.postCommentList = async (req, res, next) => {
   const { category, board_idx } = req.params;

   try {
      const allComments = await i_board_comment.findAll({
         where: { board_idx: category, parent_idx: board_idx },
         order: [['idx', 'DESC']],
         attributes: [
            'idx',
            'board_idx',
            'parent_idx',
            'depth',
            'm_email',
            'm_name',
            'c_contents',
            'c_reg_date',
         ],
      });

      if (!allComments) {
         errorHandler.errorThrow(404, '');
      }
console.log(allComments)
      const commentTree = buildCommentTree(allComments);

      errorHandler.successThrow(res, '', commentTree);
   } catch (err) {
      next(err);
   }
};

function buildCommentTree(allComments, parentIdx = null, currentDepth = 0) {
   const result = [];

   for (const comment of allComments) {
      if (comment.parent_idx === parentIdx && comment.depth === currentDepth) {
         const children = buildCommentTree(
            allComments,
            comment.idx,
            currentDepth + 1
         );

         result.push({
            idx: comment.idx,
            board_idx: comment.board_idx,
            parent_idx: comment.parent_idx,
            depth: comment.depth,
            m_email: comment.m_email,
            m_name: comment.m_name,
            c_contents: comment.c_contents,
            c_reg_date: moment
               .utc(comment.c_reg_date)
               .format('YYYY.MM.DD hh:mm:ss'),
            children: children,
         });
      }
   }

   return result;
}

// 댓글 등록
exports.postCommentCreate = async (req, res, next) => {
   const { category, parent_idx, depth, m_email, m_name, m_pwd, c_contents } =
      req.body;

   let transaction;

   try {
      transaction = await db.mariaDBSequelize.transaction();

      const parentBoard = await i_board.findOne({
         where: {
            idx: parent_idx,
         },
         attributes: ['idx'],
      });

      if (!parentBoard) {
         errorHandler.errorThrow(404, '부모 게시물이 없습니다.');
      }

      const commentCreate = await i_board_comment.create({
         board_idx: category,
         parent_idx: parent_idx,
         depth: depth,
         m_email: m_email,
         m_name: m_name,
         m_pwd: m_pwd,
         c_contents: c_contents,
      });

      if (!commentCreate) {
         errorHandler.errorThrow(404, '');
      }

      await transaction.commit();

      errorHandler.successThrow(res, '', commentCreate);
   } catch (err) {
      if (transaction) {
         await transaction.rollback();
      }

      next(err);
   }
};

// 댓글 수정
exports.postCommentUpdate = async (req, res, next) => {
   const { idx, c_contents } = req.body;

   try {
      const commentView = await i_board_comment.findOne({
         where: {
            idx: idx,
         },
         attributes: ['m_email'],
      });

      if (!commentView) {
         errorHandler.errorThrow(404, '');
      }

      if (req.user !== commentView.m_email) {
         errorHandler.errorThrow(403, '');
      }

      const commentUpdate = await i_board_comment.update(
         {
            c_contents: c_contents,
            //c_reg_date: c_reg_date,
         },
         {
            where: {
               idx: idx,
            },
         }
      );

      if (!commentUpdate) {
         errorHandler.errorThrow(404, '');
      }

      errorHandler.successThrow(res, '', commentUpdate);
   } catch (err) {
      next(err);
   }
};

// 댓글 삭제
exports.deleteCommentDestroy = async (req, res, next) => {
   const { idx } = req.body;

   let transaction;

   try {
      transaction = await db.mariaDBSequelize.transaction();

      const whereCondition = {
         idx: Array.isArray(idx) ? { [Op.in]: idx } : idx,
      };

      const commentViews = await i_board_comment.findAll({
         where: whereCondition,
         attributes: ['m_email'],
      });

      if (!commentViews || commentViews.length === 0) {
         errorHandler.errorThrow(404, '');
      }

      for (const commentView of commentViews) {
         if (
            req.user !== commentView.m_email &&
            req.level !== enumConfig.userLevel.USER_LV9
         ) {
            errorHandler.errorThrow(403, '');
         }
      }

      const commentDelete = await i_board_comment.destroy({
         where: whereCondition,
      });

      if (!commentDelete) {
         errorHandler.errorThrow(404, '');
      }

      await transaction.commit();

      errorHandler.successThrow(res, '', commentUpdate);
   } catch (err) {
      if (transaction) {
         await transaction.rollback();
      }

      next(err);
   }
};
