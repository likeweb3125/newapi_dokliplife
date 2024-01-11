const moment = require('moment');
const { Op, Sequelize } = require('sequelize');
const {
   i_member,
   i_member_level,
   i_board,
   i_board_comment,
   i_member_login,
   i_member_sec,
} = require('../models');

const errorHandler = require('../middleware/error');
const enumConfig = require('../middleware/enum');
const isAuthControllers = require('../controllers/auth');
const db = require('../models');

// 회원 리스트
// 2023.09.11 ash
exports.getMemberList = async (req, res, next) => {
   const { m_level } = req.params;
   const page = parseInt(req.query.page) || 1;

   const currentDate = new Date();
   const lastMonth = new Date(currentDate);

   const startDate =
      parseInt(req.query.sdate) ||
      moment
         .utc(lastMonth.setMonth(currentDate.getMonth() - 1))
         .format('YYYY.MM.DD');
   const endDate =
      parseInt(req.query.edate) || moment.utc(currentDate).format('YYYY.MM.DD');

   const limit = parseInt(req.query.limit) || 10;
   const offset = (page - 1) * limit;

   const searchQuery = req.query.search;
   const searchTxtQuery = req.query.searchtxt;

   const orderBy = req.query.orderBy;

   try {
      const whereCondition = {
         m_level: m_level,
      };

      if (searchQuery && searchTxtQuery) {
         if (searchQuery === 'email') {
            whereCondition.m_email = {
               [Op.like]: `%${searchTxtQuery}%`,
            };
         }

         if (searchQuery === 'name') {
            whereCondition.m_name = {
               [Op.like]: `%${searchTxtQuery}%`,
            };
         }

         if (searchQuery === 'phone') {
            whereCondition.m_mobile = {
               [Op.like]: `%${searchTxtQuery}%`,
            };
         }
      }

      if (startDate && endDate) {
         whereCondition.reg_date = {
            [Op.between]: [startDate, endDate],
         };
      }

      let orderField;
      if (orderBy === 'email') {
         orderField = [['m_email', 'ASC']];
      } else if (orderBy === 'name') {
         orderField = [['m_name', 'ASC']];
      } else {
         orderField = [['reg_date', 'DESC']];
      }

      const subQuery1 = `(SELECT COUNT(*) FROM i_member_login WHERE i_member_login.m_email = i_member.m_email)`;
      const subQuery2 = `(SELECT COUNT(*) FROM i_board WHERE i_board.m_email = i_member.m_email)`;
      const subQuery3 = `(SELECT COUNT(*) FROM i_board_comment WHERE i_board_comment.m_email = i_member.m_email)`;

      const memberList = await i_member.findAndCountAll({
         offset: offset,
         limit: limit,
         where: whereCondition,
         order: orderField,
         attributes: [
            'idx',
            'm_email',
            'm_name',
            'm_level',
            'reg_date',
            'm_mobile',
            [Sequelize.literal(subQuery1), 'log_cnt'],
            [Sequelize.literal(subQuery2), 'board_cnt'],
            [Sequelize.literal(subQuery3), 'comment_cnt'],
         ],
      });

      const lastPage = Math.ceil(memberList.count / limit);
      const maxPage = 10;
      const startPage = Math.max(
         1,
         Math.floor((page - 1) / maxPage) * maxPage + 1
      );
      const endPage = Math.min(lastPage, startPage + maxPage - 1);

      const memberResult = memberList.rows.map((list) => ({
         idx: list.idx,
         m_email: list.m_email,
         m_name: list.m_name,
         m_level: list.m_level,
         reg_date: moment.utc(list.reg_date).format('YYYY.MM.DD hh:mm'),
         m_mobile: list.m_mobile,
         log_cnt: list.getDataValue('log_cnt'),
         board_cnt: list.getDataValue('board_cnt'),
         comment_cnt: list.getDataValue('comment_cnt'),
      }));

      errorHandler.successThrow(res, '', {
         limit: limit,
         current_page: page,
         start_page: startPage,
         max_page: maxPage,
         last_page: lastPage,
         end_page: endPage,
         total_count: memberList.count,
         member_list: memberResult,
      });
   } catch (err) {
      next(err);
   }
};

//회원 레벨 불러오기
// 2023.09.11 ash
exports.getMemberLevel = async (req, res, next) => {
   try {
      const memberLv = await i_member_level.findAll({
         attributes: ['l_level', 'l_name', 'signup_lv'],
         order: [['l_level', 'ASC']],
      });

      if (!memberLv) {
         errorHandler.errorThrow(404, '');
      }

      const lvObj = memberLv.map((list) => ({
         l_level: list.l_level,
         l_name: list.l_name,
         signup_lv: list.signup_lv,
      }));

      errorHandler.successThrow(res, '', lvObj);
   } catch (err) {
      next(err);
   }
};

//회원 내용 보기
// 2023.09.11 ash
exports.getMemberView = async (req, res, next) => {
   const idx = req.params.idx;

   try {
      const memberView = await i_member.findByPk(idx);

      if (!memberView) {
         errorHandler.errorThrow(404, '');
      }

      const memberObj = {
         idx: memberView.idx,
         m_email: memberView.m_email,
         m_name: memberView.m_name,
         m_level: memberView.m_level,
         m_mobile: memberView.m_mobile,
         m_sms_yn:
            memberView.m_sms_yn === enumConfig.receiptType.Y[0]
               ? enumConfig.receiptType.Y
               : memberView.m_sms_yn === enumConfig.receiptType.N[0]
               ? enumConfig.receiptType.N
               : null,
         m_mail_yn:
            memberView.m_mail_yn === enumConfig.receiptType.Y[0]
               ? enumConfig.receiptType.Y
               : memberView.m_mail_yn === enumConfig.receiptType.N[0]
               ? enumConfig.receiptType.N
               : null,
         m_menu_auth: memberView.m_menu_auth,
         m_memo: memberView.m_memo,
         reg_date: moment.utc(memberView.reg_date).format('YYYY.MM.DD hh:mm'),
      };

      errorHandler.successThrow(res, '', memberObj);
   } catch (err) {
      next(err);
   }
};

//회원 수정
// 2023.09.11 ash
exports.putMemberUpdate = async (req, res, next) => {
   const {
      m_email,
      m_name,
      m_mobile,
      m_level,
      m_menu_auth,
      m_memo,
      m_sms_yn,
      m_mail_yn,
   } = req.body;

   try {
      const memberView = await i_member.findOne({
         where: { m_email: m_email },
      });

      if (!memberView) {
         errorHandler.errorThrow(404, '');
      }

      const memberUpdate = await i_member.update(
         {
            m_name: m_name,
            m_mobile: m_mobile,
            m_level: m_level,
            m_menu_auth: m_menu_auth,
            m_memo: m_memo,
            m_sms_yn: m_sms_yn,
            m_mail_yn: m_mail_yn,
         },
         {
            where: {
               m_email: m_email,
            },
         }
      );

      if (!memberUpdate) {
         errorHandler.errorThrow(404, '');
      }

      errorHandler.successThrow(res, '', '');
   } catch (err) {
      next(err);
   }
};

//회원 탈퇴
// 2023.09.11 ash
exports.deleteMemberDestroy = async (req, res, next) => {
   const { idx } = req.body;

   let transaction;

   try {
      transaction = await db.sequelize.transaction();

      const whereCondition = {
         idx: Array.isArray(idx) ? { [Op.in]: idx } : idx,
      };
      //console.log(whereCondition);
      const memberViews = await i_member.findAll({
         where: whereCondition,
         attributes: ['m_email'],
      });

      if (!memberViews || memberViews.length === 0) {
         errorHandler.errorThrow(404, 'No member found');
      }

      for (const member of memberViews) {
         //console.log(member.m_email);
         const secCreate = await i_member_sec.create({
            m_email: member.m_email,
            memo: '관리자 탈퇴',
         });

         if (!secCreate) {
            errorHandler.errorThrow(404, '삭제로그 등록 실패.');
         }
      }

      const memberDelete = await i_member.destroy({
         where: {
            idx: idx,
         },
      });

      if (!memberDelete) {
         errorHandler.errorThrow(404, '삭제 할 회원이 없습니다.');
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

// SMS 전송 리스트
// 2023.09.25 ash
exports.getSmsList = async (req, res, next) => {
   const page = parseInt(req.query.page) || 1;
   const limit = parseInt(req.query.limit) || 5;
   const offset = (page - 1) * limit;

   const searchQuery = req.query.search;
   const searchTxtQuery = req.query.searchtxt;

   const orderBy = req.query.orderBy;

   try {
      const whereCondition = {
         idx: { [Op.gt]: 6 },
      };

      if (searchQuery && searchTxtQuery) {
         if (searchQuery === 'email') {
            whereCondition.m_email = {
               [Op.like]: `%${searchTxtQuery}%`,
            };
         }

         if (searchQuery === 'name') {
            whereCondition.m_name = {
               [Op.like]: `%${searchTxtQuery}%`,
            };
         }

         if (searchQuery === 'phone') {
            whereCondition.m_mobile = {
               [Op.like]: `%${searchTxtQuery}%`,
            };
         }
      }

      let orderField;
      if (orderBy === 'email') {
         orderField = [['m_email', 'ASC']];
      } else if (orderBy === 'name') {
         orderField = [['m_name', 'ASC']];
      } else {
         orderField = [['reg_date', 'DESC']];
      }

      const memberList = await i_member.findAndCountAll({
         offset: offset,
         limit: limit,
         where: whereCondition,
         order: orderField,
         attributes: [
            'idx',
            'm_email',
            'm_name',
            'm_level',
            'reg_date',
            'm_mobile',
         ],
      });

      const lastPage = Math.ceil(memberList.count / limit);
      const maxPage = 10;
      const startPage = Math.max(
         1,
         Math.floor((page - 1) / maxPage) * maxPage + 1
      );
      const endPage = Math.min(lastPage, startPage + maxPage - 1);

      const memberResult = memberList.rows.map((list) => ({
         idx: list.idx,
         m_email: list.m_email,
         m_name: list.m_name,
         m_level: list.m_level,
         reg_date: moment.utc(list.reg_date).format('YYYY.MM.DD hh:mm'),
         m_mobile: list.m_mobile,
      }));

      errorHandler.successThrow(res, '', {
         limit: limit,
         current_page: page,
         start_page: startPage,
         max_page: maxPage,
         last_page: lastPage,
         end_page: endPage,
         total_count: memberList.count,
         member_list: memberResult,
      });
   } catch (err) {
      next(err);
   }
};

// sms 문구
exports.getSmsTextList = async (req, res, next) => {
   try {
      const smsList = await db.i_sms_txt.findAll({
         order: [['idx', 'ASC']],
         attributes: ['idx', 'send_txt'],
      });

      errorHandler.successThrow(res, '', smsList);
   } catch (err) {
      next(err);
   }
};

// sms 문구 수정
exports.putSmsTextUpdate = async (req, res, next) => {
   const { idx, send_txt } = req.body;

   try {
      const smsUpdate = await db.i_sms_txt.update(
         {
            send_txt: send_txt,
         },
         {
            where: {
               idx: idx,
            },
         }
      );

      if (!smsUpdate) {
         errorHandler.errorThrow(404, '');
      }

      errorHandler.successThrow(res, '', smsUpdate);
   } catch (err) {
      next(err);
   }
};

// 탈퇴회원 리스트
// 2023.09.12 ash
exports.getSecessionList = async (req, res, next) => {
   const page = parseInt(req.query.page) || 1;

   const limit = parseInt(req.query.limit) || 10;
   const offset = (page - 1) * limit;

   const searchTxtQuery = req.query.searchtxt;

   try {
      const whereCondition = {
         id: { [Op.gt]: 0 },
      };

      if (searchTxtQuery) {
         if (searchQuery === 'email') {
            whereCondition.m_email = {
               [Op.like]: `%${searchTxtQuery}%`,
            };
         }
      }

      let orderField;
      orderField = [['sec_date', 'DESC']];

      const secessionList = await i_member_sec.findAndCountAll({
         offset: offset,
         limit: limit,
         where: whereCondition,
         order: orderField,
         attributes: ['id', 'm_email', 'sec_date'],
      });

      const lastPage = Math.ceil(secessionList.count / limit);
      const maxPage = 10;
      const startPage = Math.max(
         1,
         Math.floor((page - 1) / maxPage) * maxPage + 1
      );
      const endPage = Math.min(lastPage, startPage + maxPage - 1);

      const secessionResult = secessionList.rows.map((list) => ({
         id: list.id,
         m_email: list.m_email,
         sec_date: moment.utc(list.sec_date).format('YYYY.MM.DD hh:mm'),
      }));

      errorHandler.successThrow(res, '', {
         limit: limit,
         current_page: page,
         start_page: startPage,
         max_page: maxPage,
         last_page: lastPage,
         end_page: endPage,
         total_count: secessionList.count,
         secession_list: secessionResult,
      });
   } catch (err) {
      next(err);
   }
};

//회원 탈퇴 정보 영구 삭제
// 2023.09.12 ash
exports.postSecessionDestroy = async (req, res, next) => {
   const { id } = req.body;

   let transaction;

   try {
      transaction = await db.sequelize.transaction();

      const whereCondition = {
         id: Array.isArray(id) ? { [Op.in]: id } : id,
      };
      //console.log(whereCondition);
      const secessionViews = await i_member_sec.findAll({
         where: whereCondition,
         attributes: ['id', 'm_email', 'sec_date'],
      });
      console.log(secessionViews);
      if (!secessionViews || secessionViews.length === 0) {
         errorHandler.errorThrow(404, 'No member found');
      }

      for (const member of secessionViews) {
         const secessionDelete = await i_member_sec.destroy({
            where: {
               id: member.id,
            },
            transaction: transaction,
         });

         if (!secessionDelete) {
            errorHandler.errorThrow(404, '탈퇴 로그 삭제 실패.');
         }
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
