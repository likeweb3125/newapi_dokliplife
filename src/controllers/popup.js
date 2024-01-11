const moment = require('moment');
const { Op, Sequelize } = require('sequelize');
const { i_popup } = require('../models');
const multerMiddleware = require('../middleware/multer');
const utilMiddleware = require('../middleware/util');
const errorHandler = require('../middleware/error');
const enumConfig = require('../middleware/enum');
const db = require('../models');

// 팝업 생성 ash
// 2023.09.15 rainy
exports.postPopupCreate = async (req, res, next) => {
   const {
      p_type,
      p_open,
      p_title,
      p_s_date,
      p_e_date,
      p_one_day,
      p_layer_pop,
      p_width_size,
      p_height_size,
      p_left_point,
      p_top_point,
      p_scroll,
      p_link_target,
      p_link_url,
      p_content,
   } = req.body;

   console.log(req.body);
   try {
      const processedContents = await utilMiddleware.base64ToImagesPath(
         p_content
      );

      const popupCreate = await i_popup.create({
         p_type: p_type,
         p_open: p_open,
         p_title: p_title,
         p_s_date: p_s_date,
         p_e_date: p_e_date,
         p_one_day: p_one_day,
         p_layer_pop: p_layer_pop,
         p_width_size: p_width_size,
         p_height_size: p_height_size,
         p_left_point: p_left_point,
         p_top_point: p_top_point,
         p_scroll: p_scroll,
         p_link_target: p_link_target,
         p_link_url: p_link_url,
         p_content: processedContents.temp_contents,
      });

      if (!popupCreate) {
         errorHandler.errorThrow(404, '');
      }

      errorHandler.successThrow(res, '', popupCreate);
   } catch (err) {
      next(err);
   }
};

// 팝업 리스트 ash
// 2023.09.15 cold
exports.getPopupList = async (req, res, next) => {
   const limit = req.query.limit || 10;
   const page = parseInt(req.query.page) || 1;
   const offset = (page - 1) * limit;
   const p_type = req.query.p_type || 'P';
   const searchTxtQuery = req.query.searchtxt;

   try {
      const whereCondition = {
         p_type: p_type,
      };

      if (searchTxtQuery) {
         whereCondition.p_title = {
            [Op.like]: `%${searchTxtQuery}%`,
         };
      }

      const popupList = await i_popup.findAndCountAll({
         offset: offset,
         limit: limit,
         where: whereCondition,
         order: [['idx', 'DESC']],
         attributes: [
            'idx',
            'p_type',
            'p_title',
            'p_s_date',
            'p_e_date',
            'p_width_size',
            'p_height_size',
            'p_one_day',
            'p_left_point',
            'p_top_point',
            'p_open',
            'p_layer_pop',
            'p_link_url',
         ],
      });

      const lastPage = Math.ceil(popupList.count / limit);
      const maxPage = 10;
      const startPage = Math.max(
         1,
         Math.floor((page - 1) / maxPage) * maxPage + 1
      );
      const endPage = Math.min(lastPage, startPage + maxPage - 1);

      const popupResult = popupList.rows.map((list) => ({
         idx: list.idx,
         p_type:
            list.p_type === enumConfig.bannerType.PC[0]
               ? enumConfig.bannerType.PC
               : list.p_type === enumConfig.bannerType.MOBILE[0]
               ? enumConfig.bannerType.MOBILE
               : null,
         p_title: list.p_title,
         p_s_date: list.p_s_date,
         p_e_date: list.p_e_date,
         p_width_size: list.p_width_size,
         p_height_size: list.p_height_size,
         p_one_day: list.p_one_day,
         p_left_point: list.p_left_point,
         p_top_point: list.p_top_point,
         p_open:
            list.p_open === enumConfig.bannerOpenType.Y[0]
               ? enumConfig.bannerOpenType.Y
               : list.p_open === enumConfig.bannerOpenType.N[0]
               ? enumConfig.bannerOpenType.N
               : null,
         p_layer_pop:
            list.p_layer_pop === enumConfig.popupType.LAYER[0]
               ? enumConfig.popupType.LAYER
               : list.p_layer_pop === enumConfig.popupType.POPUP[0]
               ? enumConfig.popupType.POPUP
               : null,
         p_link_url: list.p_link_url,
      }));

      errorHandler.successThrow(res, '', {
         limit: limit,
         current_page: page,
         start_page: startPage,
         max_page: maxPage,
         last_page: lastPage,
         end_page: endPage,
         total_count: popupList.count,
         popup_list: popupResult,
      });
   } catch (err) {
      next(err);
   }
};

// 팝업 내용 보기 ash
// 2023.09.15 so so
exports.getPopupView = async (req, res, next) => {
   const { idx } = req.params;

   try {
      const popupView = await i_popup.findOne({
         where: {
            idx: idx,
         },
         attributes: [
            'idx',
            'p_type',
            'p_open',
            'p_title',
            'p_s_date',
            'p_e_date',
            'p_one_day',
            'p_layer_pop',
            'p_width_size',
            'p_height_size',
            'p_left_point',
            'p_top_point',
            'p_scroll',
            'p_link_target',
            'p_link_rul',
            'p_content',
         ],
      });

      if (!popupView) {
         errorHandler.errorThrow(404, '');
      }
      console.log(popupView.p_type);
      console.log(enumConfig.bannerLinkType.PARENT[0]);
      const popupObj = {
         idx: idx,
         p_type:
            popupView.p_type === enumConfig.bannerType.PC[0]
               ? enumConfig.bannerType.PC
               : popupView.p_type === enumConfig.bannerType.MOBILE[0]
               ? enumConfig.bannerType.MOBILE
               : null,
         p_open:
            popupView.p_open === enumConfig.bannerOpenType.Y[0]
               ? enumConfig.bannerOpenType.Y
               : popupView.p_open === enumConfig.bannerOpenType.N[0]
               ? enumConfig.bannerOpenType.N
               : null,
         p_title: popupView.p_title,
         p_s_date: popupView.p_s_date,
         p_e_date: popupView.p_e_date,
         p_one_day:
            popupView.p_one_day === enumConfig.useType.Y[0]
               ? enumConfig.useType.Y
               : popupView.p_one_day === enumConfig.useType.N[0]
               ? enumConfig.useType.N
               : null,
         p_layer_pop:
            popupView.p_layer_pop === enumConfig.popupType.LAYER[0]
               ? enumConfig.popupType.LAYER
               : popupView.p_layer_pop === enumConfig.popupType.POPUP[0]
               ? enumConfig.popupType.POPUP
               : null,
         p_width_size: popupView.p_width_size,
         p_height_size: popupView.p_height_size,
         p_left_point: popupView.p_left_point,
         p_top_point: popupView.p_top_point,
         p_scroll:
            popupView.p_scroll === enumConfig.useType.Y[0]
               ? enumConfig.useType.Y
               : popupView.p_scroll === enumConfig.useType.N[0]
               ? enumConfig.useType.N
               : null,
         p_link_target:
            popupView.p_link_target === enumConfig.bannerLinkType.PARENT[0]
               ? enumConfig.bannerLinkType.PARENT
               : popupView.p_link_target === enumConfig.bannerLinkType.BLANK[0]
               ? enumConfig.bannerLinkType.BLANK
               : null,
         p_link_url: popupView.p_link_url,
         p_content: popupView.p_content,
      };

      errorHandler.successThrow(res, '', popupObj);
   } catch (err) {
      next(err);
   }
};

// 팝업 수정 ash
// 2023.09.15 hurry
exports.putBannerUpdate = async (req, res, next) => {
   const {
      idx,
      p_type,
      p_open,
      p_title,
      p_s_date,
      p_e_date,
      p_one_day,
      p_layer_pop,
      p_width_size,
      p_height_size,
      p_left_point,
      p_top_point,
      p_scroll,
      p_link_target,
      p_link_url,
      p_content,
   } = req.body;

   try {
      const popupView = await i_popup.findOne({
         where: {
            idx: idx,
         },
         attributes: ['idx'],
      });

      if (!popupView) {
         errorHandler.errorThrow(404, '');
      }

      const processedContents = await utilMiddleware.base64ToImagesPath(
         p_content
      );

      const popupUpdate = await i_popup.update(
         {
            p_type: p_type,
            p_open: p_open,
            p_title: p_title,
            p_s_date: p_s_date,
            p_e_date: p_e_date,
            p_one_day: p_one_day,
            p_layer_pop: p_layer_pop,
            p_width_size: p_width_size,
            p_height_size: p_height_size,
            p_left_point: p_left_point,
            p_top_point: p_top_point,
            p_scroll: p_scroll,
            p_link_target: p_link_target,
            p_link_url: p_link_url,
            p_content: processedContents.temp_contents,
         },
         {
            where: {
               idx: idx,
            },
         }
      );

      if (!popupUpdate) {
         errorHandler.errorThrow(404, '');
      }

      errorHandler.successThrow(res, 'Update Success', popupUpdate);
   } catch (err) {
      next(err);
   }
};

// 팝업 삭제 ash
// 2023.09.15
exports.deletePopupDestroy = async (req, res, next) => {
   const { idx } = req.body;

   let transaction;

   try {
      transaction = await db.mariaDBSequelize.transaction();

      const whereCondition = {
         idx: Array.isArray(idx) ? { [Op.in]: idx } : idx,
      };

      const popupViews = await i_popup.findAll({
         where: whereCondition,
         attributes: ['idx'],
      });

      if (!popupViews || popupViews.length === 0) {
         errorHandler.errorThrow(404, 'No popup found');
      }

      const popupDelete = await i_popup.destroy({
         where: whereCondition,
      });

      if (!popupDelete) {
         errorHandler.errorThrow(404, '삭제 할 게시물이 없습니다.');
      }

      await transaction.commit();

      errorHandler.successThrow(res, '', popupDelete);
   } catch (err) {
      if (transaction) {
         await transaction.rollback();
      }

      next(err);
   }
};

// 팝업 노출, 중단 ash
// 2023.09.15 dirty
exports.postPopupOpen = async (req, res, next) => {
   const { idx, p_open } = req.body;

   let transaction;

   try {
      transaction = await db.mariaDBSequelize.transaction();

      const whereCondition = {
         idx: Array.isArray(idx) ? { [Op.in]: idx } : idx,
      };

      const popupViews = await i_popup.findAll({
         where: whereCondition,
         attributes: ['idx'],
      });

      if (!popupViews || popupViews.length === 0) {
         errorHandler.errorThrow(404, 'No boards found');
      }

      const popupOpen = await i_popup.update(
         {
            p_open: p_open,
         },
         {
            where: whereCondition,
         }
      );

      if (!popupOpen) {
         errorHandler.errorThrow(404, '게시물이 없습니다.');
      }

      await transaction.commit();

      errorHandler.successThrow(res, '', popupOpen);
   } catch (err) {
      if (transaction) {
         await transaction.rollback();
      }

      next(err);
   }
};
