const moment = require('moment');
const { Op, Sequelize } = require('sequelize');
const {
   i_board,
   i_board_comment,
   i_board_file,
   i_category,
   i_category_board,
} = require('../models');
const multerMiddleware = require('../middleware/multer');
const errorHandler = require('../middleware/error');
const enumConfig = require('../middleware/enum');
const boardAuth = require('../middleware/boardAuth');
const utilMiddleware = require('../middleware/util');
const db = require('../models');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const { clearScreenDown } = require('readline');

// 게시글 메인 리스트
// 2023.08.30 ash
exports.getBoardMain = async (req, res, next) => {
   const { category, limit } = req.params;

   try {
      const boardMain = await i_board.findAll({
         limit: parseInt(limit) || 5,
         where: {
            category: category,
         },
         order: [['idx', 'DESC']],
         attributes: [
            'idx',
            'category',
            'b_title',
            'b_reg_date',
            'b_notice',
            'b_contents',
            'b_file',
         ],
      });

      const mainResult = boardMain.map((main) => ({
         idx: main.idx,
         category: main.category,
         b_title: main.b_title,
         b_reg_date: moment.utc(main.b_reg_date).format('YYYY.MM.DD'),
         b_notice: main.b_notice,
         b_contents: main.b_contents.replace(/<[^>]*>/g, ''),
         b_file: main.b_file,
      }));

      //res.status(200).json(mainResult);
      errorHandler.successThrow(res, '', mainResult);
   } catch (err) {
      next(err);
   }
};

// 게시글 리스트
// 2023.08.30 ash
exports.getBoardList = async (req, res, next) => {
   const { category, getLimit } = req.params;
   const page = parseInt(req.query.page) || 1;
   const searchQuery = req.query.search;
   const searchTxtQuery = req.query.searchtxt;

   const orderBy = req.query.orderBy;

   try {
      const whereCondition = {
         category: category,
      };

      if (searchQuery && searchTxtQuery) {
         if (searchQuery === 'title') {
            whereCondition.b_title = {
               [Op.like]: `%${searchTxtQuery}%`,
            };
         }

         if (searchQuery === 'contents') {
            whereCondition.b_contents = {
               [Op.like]: `%${searchTxtQuery}%`,
            };
         }

         if (searchQuery === 'name') {
            whereCondition.m_name = {
               [Op.like]: `%${searchTxtQuery}%`,
            };
         }

         if (searchQuery === 'titlecontents') {
            whereCondition.b_title = {
               [Op.like]: `%${searchTxtQuery}%`,
            };
            whereCondition.b_contents = {
               [Op.like]: `%${searchTxtQuery}%`,
            };
         }
      }

      let orderField;
      if (orderBy === 'title') {
         orderField = [['b_title', 'ASC']];
      } else if (orderBy === 'view') {
         orderField = [['b_view', 'ASC']];
      } else {
         orderField = [
            ['b_notice', 'DESC'],
            [
               Sequelize.fn(
                  'IFNULL',
                  Sequelize.col('parent_id'),
                  Sequelize.col('idx')
               ),
               'DESC',
            ],
            ['parent_id', 'ASC'],
            ['idx', 'DESC'],
         ];
      }

      const subQuery = `(SELECT COUNT(*) FROM i_board_comment WHERE i_board_comment.board_idx = i_board.idx)`;
      const subQuery2 = `(SELECT c_content_type FROM i_category WHERE i_category.id = i_board.category)`;
      const subQuery3 =
         `(SELECT COUNT(*) FROM i_board_file WHERE i_board_file.parent_idx = i_board.idx and i_board_file.kind = '` +
         enumConfig.boardFileType.B[0] +
         `')`;

      // const subQuery2 = Sequelize.literal(`
      //    (SELECT c_name FROM i_category WHERE i_category.id = i_board.category)
      // `);

      const boardItemResult = await boardAuth.boardListItem(category);

      if (boardItemResult) {
         if (boardItemResult.statusCode) {
            return errorHandler.errorThrow(
               boardItemResult.statusCode,
               boardItemResult.message
            );
         }
      }
      //console.log(boardItemResult);

      const limit = parseInt(getLimit) || boardItemResult.b_list_cnt;

      const offset = (page - 1) * limit;

      const boardList = await i_board.findAndCountAll({
         offset: offset,
         limit: limit,
         where: whereCondition,
         order: orderField,
         attributes: [
            'idx',
            'category',
            'b_depth',
            'b_notice',
            'b_secret',
            'm_name',
            [Sequelize.literal(subQuery), 'comment_count'],
            [Sequelize.literal(subQuery2), 'c_content_type'],
            [Sequelize.literal(subQuery3), 'file_count'],
            ...boardItemResult.boardItem,
         ],
         include: [
            {
               model: i_category,
               as: 'icategory',
               attributes: ['c_name'],
               required: true,
            },
         ],
      });

      const lastPage = Math.ceil(boardList.count / limit);
      const maxPage = 10;
      const startPage = Math.max(
         1,
         Math.floor((page - 1) / maxPage) * maxPage + 1
      );
      const endPage = Math.min(lastPage, startPage + maxPage - 1);

      const listResult = boardList.rows.map((list) => ({
         idx: list.idx,
         category: list.category,
         b_depth: list.b_depth,
         b_title: list.b_title,
         m_name: list.m_name,
         b_reg_date: moment.utc(list.w_date).format('YYYY.MM.DD'),
         b_notice: list.b_notice,
         b_view: list.b_view,
         b_file: list.getDataValue('file_count'),
         b_recom: list.b_recom,
         b_secret: list.b_secret,
         comment_count: list.getDataValue('comment_count'),
         c_content_type: list.getDataValue('c_content_type'),
         c_name: list.icategory.c_name,
      }));

      const BoardName = await i_category.findAll({
         where: {
            id: { [Op.ne]: [category] },
            c_use_yn: enumConfig.useType.Y[0],
            c_content_type: boardItemResult.c_content_type,
         },
         attributes: [
            'id',
            'c_depth',
            'c_name',
            'c_reg_date',
            'c_content_type',
         ],
         order: [['id', 'ASC']],
      });

      const boardNameResult = BoardName.map((main) => {
         const listObj = {
            category: main.id,
            c_depth: main.c_depth,
            c_name: main.c_name,
            c_content_type: main.c_content_type,
         };
         return listObj;
      });

      errorHandler.successThrow(res, '', {
         limit: limit,
         current_page: page,
         start_page: startPage,
         max_page: maxPage,
         last_page: lastPage,
         end_page: endPage,
         total_count: boardList.count,
         c_content_type: boardItemResult.c_content_type, //게시판 유형
         b_column_title: boardItemResult.b_column_title, //제목 노출 여부
         b_column_date: boardItemResult.b_column_date, //등록일자 노출 여부
         b_column_view: boardItemResult.b_column_view, //조회수 노출 여부
         b_column_recom: boardItemResult.b_column_recom, //추천수 노출 여부
         b_column_file: boardItemResult.b_column_file, //파일 노출 여부
         b_thumbnail_with: boardItemResult.b_thumbnail_with, //갤러리 게시판 썸네일 가로 사이즈
         b_thumbnail_height: boardItemResult.b_thumbnail_height, // 썸네일 세로 사이즈
         b_read_lv: boardItemResult.b_read_lv, //읽기권한
         b_write_lv: boardItemResult.b_write_lv, //쓰기권한
         b_group: boardItemResult.b_group, //게시판 분류 사용 여부
         b_secret: boardItemResult.b_secret, //비밀글 설정
         b_reply: boardItemResult.b_reply, //답변사용 여부
         b_reply_lv: boardItemResult.b_reply_lv, //답변사용권한
         b_comment: boardItemResult.b_comment, //댓글사용 여부
         b_comment_lv: boardItemResult.b_comment_lv, //댓글사용권한
         b_write_alarm: boardItemResult.b_write_alarm, //작성자 답변 알림 여부
         b_write_send: boardItemResult.b_write_send, //작성자 답변 알림 전송 구분 (이메일, 문자)
         b_alarm: boardItemResult.b_alarm, //게시 알림 여부
         b_alarm_phone: boardItemResult.b_alarm_phone, //게시 알림 전송 휴대폰 번호
         b_top_html: boardItemResult.b_top_html, //게시판 상단 HTML 내용
         b_template: boardItemResult.b_template, // 게시글 템플릿 적용
         b_template_text: boardItemResult.b_template_text, //템플릿 내용
         board_Name: boardNameResult,
         board_list: listResult,
      });
   } catch (err) {
      next(err);
   }
};

//게시글 내용 보기
// 2023.08.30 ash
exports.getBoardView = async (req, res, next) => {
   const { category, idx } = req.params;

   try {
      //게시판 보기 권한 확인
      // const authorizationResult = await boardAuth.authorizeUser(
      //    category,
      //    enumConfig.boardAuthType.READ,
      //    req.level
      // );

      // if (authorizationResult) {
      //    return errorHandler.errorThrow(
      //       authorizationResult.statusCode,
      //       authorizationResult.message
      //    );
      // }

      const viewUpdate = await i_board.update(
         {
            b_view: Sequelize.literal('b_view + 1'),
         },
         {
            where: {
               category: category,
               idx: idx,
            },
         }
      );

      const boardView = await i_board.findOne({
         where: {
            category: category,
            idx: idx,
         },
         attributes: [
            'idx',
            'category',
            'm_email',
            'm_name',
            'm_pwd',
            'b_title',
            'b_contents',
            'b_reg_date',
            'parent_id',
            'b_depth',
            'b_notice',
            'b_view',
            'b_img',
            'b_file',
            'b_sms_yn',
            'b_sms_phone',
            'b_email_yn',
            'b_email',
            'b_secret',
            'b_status',
         ],
      });

      if (!boardView) {
         errorHandler.errorThrow(404, '');
      }

      if (boardView.b_secret) {
         if (
            res.user !== boardView.m_email ||
            res.level !== enumConfig.userLevel.USER_LV9
         ) {
            errorHandler.errorThrow(404, '비밀글 입니다.');
         }
      }

      const [prevBoard, nextBoard] = await Promise.all([
         i_board.findOne({
            where: {
               category: category,
               b_depth: { [Op.eq]: 0 },
               idx: { [Op.lt]: idx },
            },
            order: [['idx', 'DESC']],
            attributes: ['idx', 'b_title'],
         }),
         i_board.findOne({
            where: {
               category: category,
               b_depth: { [Op.eq]: 0 },
               idx: { [Op.gt]: idx },
            },
            order: [['idx', 'DESC']],
            attributes: ['idx', 'b_title'],
         }),
      ]);

      const boardFileViews = await i_board_file.findAll({
         where: { parent_idx: idx, kind: enumConfig.boardFileType.B[0] },
         attributes: ['idx', 'parent_idx', 'file_name', 'original_name'],
      });

      const boardObj = {
         idx: boardView.idx,
         category: boardView.category,
         m_email: boardView.m_email,
         m_name: boardView.m_name,
         m_pwd: boardView.m_pwd,
         b_title: boardView.b_title,
         b_contents: boardView.b_contents,
         b_reg_date: moment.utc(boardView.b_reg_date).format('YYYY.MM.DD'),
         parent_id: boardView.parent_id,
         b_depth: boardView.b_depth,
         b_notice: boardView.b_notice,
         b_view: boardView.b_view,
         b_img: boardView.b_img,
         b_file: boardFileViews,
         b_sms_yn: boardView.b_sms_yn,
         b_sms_phone: boardView.b_sms_phone,
         b_email_yn: boardView.b_email_yn,
         b_email: boardView.b_email,
         b_secret: boardView.b_secret,
         b_status: boardView.b_status,
         prev_board: prevBoard !== null ? prevBoard : false,
         next_board: nextBoard !== null ? nextBoard : false,
      };

      //res.status(200).json(boardObj);
      errorHandler.successThrow(res, '', boardObj);
   } catch (err) {
      next(err);
   }
};

//게시글 등록
// 2023.08.30 ash
exports.postBoardCreate = async (req, res, next) => {
   const {
      category,
      m_name,
      m_pwd,
      b_title,
      b_contents,
      parent_id,
      b_depth,
      b_notice,
      b_img,
      b_file,
      b_sms_yn,
      b_sms_phone,
      b_email_yn,
      b_secret,
      b_status,
   } = req.body;

   try {
      let hashedPw;
      if (m_pwd !== '') {
         hashedPw = await bcrypt.hash(m_pwd, 12);
      } else {
         hashedPw = m_pwd;
      }

      const board_b_file = req.files['b_file'];
      const board_b_img = req.files['b_img'];

      const processedContents = await utilMiddleware.base64ToImagesPath(
         b_contents
      );

      const boardCreate = await i_board.create({
         category: category,
         m_email: req.user,
         m_name: m_name,
         m_pwd: hashedPw,
         b_title: b_title,
         b_contents: processedContents.temp_contents,
         parent_id: parent_id,
         b_depth: b_depth,
         b_notice: b_notice,
         b_img: board_b_img ? board_b_img[0].path : null,
         b_sms_yn: b_sms_yn,
         b_sms_phone: b_sms_phone,
         b_email_yn: b_email_yn,
         b_secret: b_secret,
         b_status: b_status,
      });

      if (!boardCreate) {
         errorHandler.errorThrow(404, '');
      }
      //console.log(board_b_file);

      if (board_b_file) {
         for (let index = 0; index < board_b_file.length; index++) {
            //console.log(board_b_file[index].originalname);
            const boardFileCreate = await i_board_file.create({
               parent_idx: boardCreate.getDataValue('idx'),
               file_name: board_b_file[index].path,
               // original_name: Buffer.from(
               //    board_b_file[index].originalname,
               //    'latin1'
               // ).toString('utf8'),
               original_name: board_b_file[index].originalname,
               kind: enumConfig.boardFileType.B[0],
            });
            if (!boardFileCreate) {
               errorHandler.errorThrow(404, '');
            }
         }
      }

      //에디터 이미지 경로 저장
      if (processedContents.imagePaths) {
         for (const editFile of processedContents.imagePaths) {
            const editFileCreate = await i_board_file.create({
               parent_idx: boardCreate.getDataValue('idx'),
               file_name: editFile,
               kind: enumConfig.boardFileType.E[0],
            });
         }
      }

      // 게시판 설정 땡겨유~
      const boardItem = await boardAuth.boardListItem(category);

      //console.log(boardItem);
      //게시판 등록 알림 일 경우 등록된 번호로 SMS 발송
      if (boardItem.b_alarm === 'Y') {
         // boardItem.b_alarm_phone
      }

      //답변 게시물
      if (boardItem.b_write_alarm === 'Y') {
         if (b_depth > 0) {
            // boardItem.b_write_send 작성자 이메일 or 문자 발송
         }
      }

      errorHandler.successThrow(res, '', boardCreate);
   } catch (err) {
      next(err);
   }
};

//게시글 수정
// 2023.08.30 ash
exports.putBoardUpdate = async (req, res, next) => {
   const {
      idx,
      category,
      m_email,
      m_name,
      m_pwd,
      b_title,
      b_contents,
      b_depth,
      b_notice,
      b_img,
      b_file,
      b_sms_yn,
      b_sms_phone,
      b_email_yn,
      b_status,
   } = req.body;

   let transaction;

   try {
      transaction = await db.mariaDBSequelize.transaction();

      const boardView = await i_board.findOne({
         where: {
            category: category,
            idx: idx,
         },
         attributes: ['idx', 'category', 'm_email', 'b_file', 'b_img'],
      });

      if (!boardView) {
         errorHandler.errorThrow(404, '');
      }

      if (
         req.user !== boardView.m_email &&
         req.level !== enumConfig.userLevel.USER_LV9
      ) {
         errorHandler.errorThrow(403, '');
      }

      const board_b_file = req.files['b_file'];
      const board_b_img = req.files['b_img'];

      //console.log(board_b_file.length);

      // if (board_b_file) {
      //    if (
      //       boardView.b_file !== null &&
      //       boardView.b_file !== board_b_file[0].path
      //    ) {
      //       multerMiddleware.clearFile(boardView.b_file);
      //    }
      // }

      if (board_b_file) {
         for (let index = 0; index < board_b_file.length; index++) {
            //console.log(board_b_file[index].originalname);
            const boardFileCreate = await i_board_file.create({
               parent_idx: idx,
               file_name: board_b_file[index].path,
               //original_name: Buffer.from(
               //   board_b_file[index].originalname,
               //   'latin1'
               //).toString('utf8'),
               original_name: board_b_file[index].originalname,
               kind: enumConfig.boardFileType.B[0],
            });
            if (!boardFileCreate) {
               errorHandler.errorThrow(404, '');
            }
         }
      }

      if (board_b_img) {
         if (
            boardView.b_img !== null &&
            boardView.b_img !== board_b_img[0].path
         ) {
            multerMiddleware.clearFile(boardView.b_img);
         }
      }

      const processedContents = await utilMiddleware.base64ToImagesPath(
         b_contents
      );

      //에디터 이미지 경로 저장
      if (processedContents.imagePaths) {
         for (const editFile of processedContents.imagePaths) {
            const editFileCreate = await i_board_file.create({
               parent_idx: idx,
               file_name: editFile,
               kind: enumConfig.boardFileType.E[0],
            });
         }
      }

      const boardUpdate = await i_board.update(
         {
            m_email: m_email,
            m_name: m_name,
            m_pwd: m_pwd,
            b_title: b_title,
            b_contents: processedContents.temp_contents,
            b_depth: b_depth,
            b_notice: b_notice,
            b_img: board_b_img
               ? board_b_img[0].path
               : boardView
               ? boardView.b_img
               : null,
            b_sms_yn: b_sms_yn,
            b_sms_phone: b_sms_phone,
            b_email_yn: b_email_yn,
            b_status: b_status,
         },
         {
            where: {
               category: category,
               idx: idx,
            },
         }
      );

      if (!boardUpdate) {
         errorHandler.errorThrow(404, '');
      }

      await transaction.commit();

      errorHandler.successThrow(res, '', boardUpdate);
   } catch (err) {
      if (transaction) {
         await transaction.rollback();
      }

      next(err);
   }
};

//게시글 삭제
// 2023.09.08 ash
exports.deleteBoardDestroy = async (req, res, next) => {
   const { idx, category } = req.body;

   let transaction;

   try {
      transaction = await db.mariaDBSequelize.transaction();

      const whereCondition = {
         category: category,
         idx: Array.isArray(idx) ? { [Op.in]: idx } : idx,
      };

      const boardViews = await i_board.findAll({
         where: whereCondition,
         attributes: ['idx', 'category', 'm_email', 'b_file', 'b_img'],
      });

      if (!boardViews || boardViews.length === 0) {
         errorHandler.errorThrow(404, 'No boards found');
      }

      for (const boardView of boardViews) {
         if (
            req.user !== boardView.m_email &&
            req.level !== enumConfig.userLevel.USER_LV9
         ) {
            errorHandler.errorThrow(403, 'No authorization');
         }

         //if (boardView.b_file) {
         //   multerMiddleware.clearFile(boardView.b_file);
         //}

         if (boardView.b_img) {
            multerMiddleware.clearFile(boardView.b_img);
         }
      }

      const boardDelete = await i_board.destroy({
         where: whereCondition,
      });

      if (!boardDelete) {
         errorHandler.errorThrow(404, '삭제 할 게시물이 없습니다.');
      }

      //첨부파일 삭제
      const boardFileViews = await i_board_file.findAll({
         where: { parent_idx: Array.isArray(idx) ? { [Op.in]: idx } : idx },
         attributes: ['file_name'],
      });

      for (const boardFile of boardFileViews) {
         if (boardFile.file_name) {
            multerMiddleware.clearFile(boardFile.file_name);
         }
      }

      const boardFileDelete = await i_board_file.destroy({
         where: { parent_idx: Array.isArray(idx) ? { [Op.in]: idx } : idx },
      });

      await transaction.commit();

      errorHandler.successThrow(res, '', boardDelete);
   } catch (err) {
      if (transaction) {
         await transaction.rollback();
      }

      next(err);
   }
};

// 게시글 첨부파일 삭제
exports.deleteBoardFileDestroy = async (req, res, next) => {
   const { idx, parent_idx } = req.body;

   try {
      const whereCondition = {
         idx: Array.isArray(idx) ? { [Op.in]: idx } : idx,
      };

      const boardFileViews = await i_board_file.findAll({
         where: whereCondition,
         attributes: ['idx', 'parent_idx', 'file_name'],
      });

      if (!boardFileViews || boardFileViews.length === 0) {
         errorHandler.errorThrow(404, 'No boards File found');
      }

      for (const boardFile of boardFileViews) {
         if (boardFile.file_name) {
            multerMiddleware.clearFile(boardFile.file_name);
         }
      }

      const boardFileDelete = await i_board_file.destroy({
         where: whereCondition,
      });

      errorHandler.successThrow(res, '', boardFileDelete);
   } catch (err) {
      next(err);
   }
};

// 게시글 비밀번호 확인
exports.postBoardPassword = async (req, res, next) => {
   const { idx, password } = req.body;

   try {
      const boardView = await i_board.findOne({
         where: {
            idx: idx,
         },
         attributes: ['idx', 'm_pwd'],
      });

      if (!boardView) {
         errorHandler.errorThrow(404, '');
      }

      const isEqual = await bcrypt.compare(password, boardView.m_pwd);

      if (!isEqual) {
         errorHandler.errorThrow(
            enumConfig.statusErrorCode._404_ERROR[0],
            '비밀번호가 다릅니다.'
         );
      }

      errorHandler.successThrow(res, '', '');
   } catch (err) {
      next(err);
   }
};

// 게시글 이동
// 2023.09.08 ash
exports.putBoardMove = async (req, res, next) => {
   const { idx, category } = req.body;

   let transaction;

   try {
      transaction = await db.mariaDBSequelize.transaction();

      const whereCondition = {
         //category: category,
         idx: Array.isArray(idx) ? { [Op.in]: idx } : idx,
      };

      const boardMoves = await i_board.update(
         {
            category: category,
         },
         {
            where: whereCondition,
         }
      );

      if (!boardMoves) {
         errorHandler.errorThrow(404, '이동 할 게시물이 없습니다.');
      }

      await transaction.commit();

      errorHandler.successThrow(res, '', boardMoves);
   } catch (err) {
      if (transaction) {
         await transaction.rollback();
      }

      next(err);
   }
};

// 게시글 공지 설정
// 2023.09.11 ash
exports.putBoardNotice = async (req, res, next) => {
   const { notice, idx, category } = req.body;

   let transaction;

   try {
      transaction = await db.mariaDBSequelize.transaction();

      const whereCondition = {
         category: category,
         idx: Array.isArray(idx) ? { [Op.in]: idx } : idx,
      };

      const boardNotice = await i_board.update(
         {
            b_notice: notice || 1,
         },
         {
            where: whereCondition,
         }
      );

      if (!boardNotice) {
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

// 게시글 첨부파일 다운로드
exports.getFileDownload = async (req, res, next) => {
   const { parent_idx, idx } = req.params;

   try {
      const boardFile = await i_board_file.findOne({
         where: {
            parent_idx: parent_idx,
            idx: idx,
         },
         attributes: ['file_name', 'original_name'],
      });

      if (!boardFile) {
         errorHandler.errorThrow(404, '');
      }

      const originalFileName = boardFile.original_name;
      const changedFileName = boardFile.file_name;

      const filePath = path.join(__dirname, '../../', changedFileName);

      if (fs.existsSync(filePath)) {
         res.setHeader(
            'Content-Disposition',
            'attachment; filename=' + encodeURI(originalFileName)
         );
         res.setHeader('Content-Type', 'application/octet-stream');

         const fileStream = fs.createReadStream(filePath);
         fileStream.pipe(res);
      } else {
         errorHandler.errorThrow(404, 'File not found');
      }
   } catch (err) {
      next(err);
   }
};
