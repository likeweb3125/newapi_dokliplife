const moment = require('moment');
const { Op, Sequelize } = require('sequelize');
const { i_banner } = require('../models');
const multerMiddleware = require('../middleware/multer');
const errorHandler = require('../middleware/error');
const enumConfig = require('../middleware/enum');
const db = require('../models');

// 배너 등록
// 2023.09.13 ash
exports.postBannerCreate = async (req, res, next) => {
   const {
      b_type,
      b_open,
      b_title,
      b_s_date,
      b_e_date,
      b_size,
      b_width_size,
      b_height_size,
      b_c_type,
      b_file,
      b_url,
      b_url_target,
      b_mov_type,
      b_mov_play,
      b_mov_sound,
      b_content,
   } = req.body;

   try {
      const bannerCreate = await i_banner.create({
         b_type: b_type,
         b_open: b_open,
         b_title: b_title,
         b_s_date: b_s_date,
         b_e_date: b_e_date,
         b_size: b_size,
         b_width_size: b_width_size,
         b_height_size: b_height_size,
         b_c_type: b_c_type,
         b_file: req.file ? req.file.path : null,
         b_url: b_url,
         b_url_target: b_url_target,
         b_mov_type: b_mov_type,
         b_mov_play: b_mov_play,
         b_mov_sound: b_mov_sound,
         b_content: b_content,
      });

      if (!bannerCreate) {
         errorHandler.errorThrow(404, '');
      }

      errorHandler.successThrow(res, '', '');
   } catch (err) {
      next(err);
   }
};

// 배너 리스트
// 2023.09.14 ash
exports.getBannerList = async (req, res, next) => {
   const limit = req.query.limit || 10;
   const page = parseInt(req.query.page) || 1;
   const offset = (page - 1) * limit;
   const b_type = req.query.b_type || 'P';
   const searchTxtQuery = req.query.searchtxt;

   try {
      const whereCondition = {
         b_type: b_type,
      };

      if (searchTxtQuery) {
         whereCondition.b_title = {
            [Op.like]: `%${searchTxtQuery}%`,
         };
      }

      const bannerList = await i_banner.findAndCountAll({
         offset: offset,
         limit: limit,
         where: whereCondition,
         order: [['idx', 'DESC']],
         attributes: [
            'idx',
            'b_type',
            'b_file',
            'b_title',
            'b_s_date',
            'b_e_date',
            'b_size',
            'b_open',
         ],
      });

      const lastPage = Math.ceil(bannerList.count / limit);
      const maxPage = 10;
      const startPage = Math.max(
         1,
         Math.floor((page - 1) / maxPage) * maxPage + 1
      );
      const endPage = Math.min(lastPage, startPage + maxPage - 1);

      const bannerResult = bannerList.rows.map((list) => ({
         idx: list.idx,
         b_type:
            list.b_type === enumConfig.bannerType.PC[0]
               ? enumConfig.bannerType.PC
               : list.b_type === enumConfig.bannerType.MOBILE[0]
               ? enumConfig.bannerType.MOBILE
               : null,
         b_file: list.b_file,
         b_title: list.b_title,
         b_s_date: list.b_s_date,
         b_e_date: list.b_e_date,
         b_size:
            list.b_size === enumConfig.bannerSizeType.COVER[0]
               ? enumConfig.bannerSizeType.COVER
               : list.b_size === enumConfig.bannerSizeType.ORIGINAL[0]
               ? enumConfig.bannerSizeType.ORIGINAL
               : null,
         b_open:
            list.b_open === enumConfig.bannerOpenType.Y[0]
               ? enumConfig.bannerOpenType.Y
               : list.b_open === enumConfig.bannerOpenType.N[0]
               ? enumConfig.bannerOpenType.N
               : null,
      }));

      errorHandler.successThrow(res, '', {
         limit: limit,
         current_page: page,
         start_page: startPage,
         max_page: maxPage,
         last_page: lastPage,
         end_page: endPage,
         total_count: bannerList.count,
         banner_list: bannerResult,
      });
   } catch (err) {
      next(err);
   }
};

// 배너 내용 보기
// 2023.09.14 ash
exports.getBannerView = async (req, res, next) => {
   const { idx } = req.params;

   try {
      const bannerView = await i_banner.findOne({
         where: {
            idx: idx,
         },
         attributes: [
            'b_type',
            'b_open',
            'b_title',
            'b_s_date',
            'b_e_date',
            'b_size',
            'b_width_size',
            'b_height_size',
            'b_c_type',
            'b_file',
            'b_url',
            'b_url_target',
            'b_mov_type',
            'b_mov_play',
            'b_mov_sound',
            'b_content',
         ],
      });

      if (!bannerView) {
         errorHandler.errorThrow(404, '');
      }

      const banerObj = {
         b_type:
            bannerView.b_type === enumConfig.bannerType.PC[0]
               ? enumConfig.bannerType.PC
               : bannerView.b_type === enumConfig.bannerType.MOBILE[0]
               ? enumConfig.bannerType.MOBILE
               : null,
         b_open:
            bannerView.b_open === enumConfig.bannerOpenType.Y[0]
               ? enumConfig.bannerOpenType.Y
               : bannerView.b_open === enumConfig.bannerOpenType.N[0]
               ? enumConfig.bannerOpenType.N
               : null,
         b_title: bannerView.b_title,
         b_s_date: bannerView.b_s_date,
         b_e_date: bannerView.b_e_date,
         b_size:
            bannerView.b_size === enumConfig.bannerSizeType.COVER[0]
               ? enumConfig.bannerSizeType.COVER
               : bannerView.b_size === enumConfig.bannerSizeType.ORIGINAL[0]
               ? enumConfig.bannerSizeType.ORIGINAL
               : null,
         b_width_size: bannerView.b_width_size,
         b_height_size: bannerView.b_height_size,
         b_c_type:
            bannerView.b_c_type === enumConfig.bannerCategoryType.IMG[0]
               ? enumConfig.bannerCategoryType.IMG
               : bannerView.b_c_type === enumConfig.bannerCategoryType.MOV[0]
               ? enumConfig.bannerCategoryType.MOV
               : bannerView.b_c_type === enumConfig.bannerCategoryType.HTML[0]
               ? enumConfig.bannerCategoryType.HTML
               : null,
         b_file: bannerView.b_file,
         b_url: bannerView.b_url,
         b_url_target:
            bannerView.b_url_target === enumConfig.bannerLinkType.PARENT[0]
               ? enumConfig.bannerLinkType.PARENT
               : bannerView.b_url_target === enumConfig.bannerLinkType.BLANK[0]
               ? enumConfig.bannerLinkType.BLANK
               : null,
         b_mov_type:
            bannerView.b_mov_type === enumConfig.bannerMovType.DIRECT[0]
               ? enumConfig.bannerMovType.DIRECT
               : bannerView.b_mov_type === enumConfig.bannerMovType.URL[0]
               ? enumConfig.bannerMovType.URL
               : null,
         b_mov_play: bannerView.b_mov_play,
         b_mov_sound: bannerView.b_mov_sound,
         b_content: bannerView.b_content,
      };

      //res.status(200).json(boardObj);
      errorHandler.successThrow(res, '', banerObj);
   } catch (err) {
      next(err);
   }
};

// 배너 수정
// 2023.09.14 ash
exports.postBannerUpdate = async (req, res, next) => {
   const {
      idx,
      b_type,
      b_open,
      b_title,
      b_s_date,
      b_e_date,
      b_size,
      b_width_size,
      b_height_size,
      b_c_type,
      b_file,
      b_url,
      b_url_target,
      b_mov_type,
      b_mov_play,
      b_mov_sound,
      b_content,
   } = req.body;

   try {
      const bannerView = await i_banner.findOne({
         where: {
            idx: idx,
         },
         attributes: ['idx', 'b_file'],
      });

      if (!bannerView) {
         errorHandler.errorThrow(404, '');
      }

      if (req.file) {
         if (bannerView.b_file !== req.file.path) {
            multerMiddleware.clearFile(bannerView.b_file);
         }
      }

      const bannerUpdate = await i_banner.update(
         {
            b_type: b_type,
            b_open: b_open,
            b_title: b_title,
            b_s_date: b_s_date,
            b_e_date: b_e_date,
            b_size: b_size,
            b_width_size: b_width_size,
            b_height_size: b_height_size,
            b_c_type: b_c_type,
            b_file: req.file
               ? req.file.path
               : bannerView
               ? bannerView.b_file
               : null,
            b_url: b_url,
            b_url_target: b_url_target,
            b_mov_type: b_mov_type,
            b_mov_play: b_mov_play,
            b_mov_sound: b_mov_sound,
            b_content: b_content,
         },
         {
            where: {
               idx: idx,
            },
         }
      );

      if (!bannerUpdate) {
         errorHandler.errorThrow(404, '');
      }

      errorHandler.successThrow(res, '', '');
   } catch (err) {
      next(err);
   }
};

// 배너 삭제
// 2023.09.14 ash
exports.deleteBannerDestroy = async (req, res, next) => {
   const { idx } = req.body;

   let transaction;

   try {
      transaction = await db.sequelize.transaction();

      const whereCondition = {
         idx: Array.isArray(idx) ? { [Op.in]: idx } : idx,
      };

      const bannerViews = await i_banner.findAll({
         where: whereCondition,
         attributes: ['idx', 'b_file'],
      });

      if (!bannerViews || bannerViews.length === 0) {
         errorHandler.errorThrow(404, 'No boards found');
      }

      for (const bannerView of bannerViews) {
         if (bannerView.b_file) {
            multerMiddleware.clearFile(bannerView.b_file);
         }
      }

      const bannerDelete = await i_banner.destroy({
         where: whereCondition,
      });

      if (!bannerDelete) {
         errorHandler.errorThrow(404, '삭제 할 게시물이 없습니다.');
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

// 배너 노출, 중단
// 2023.09.14 ash
exports.postBannerOpen = async (req, res, next) => {
   const { idx, b_open } = req.body;

   let transaction;

   try {
      transaction = await db.sequelize.transaction();

      const whereCondition = {
         idx: Array.isArray(idx) ? { [Op.in]: idx } : idx,
      };

      const bannerViews = await i_banner.findAll({
         where: whereCondition,
         attributes: ['idx'],
      });

      if (!bannerViews || bannerViews.length === 0) {
         errorHandler.errorThrow(404, 'No boards found');
      }

      const bannerOpen = await i_banner.update(
         {
            b_open: b_open,
         },
         {
            where: whereCondition,
         }
      );

      if (!bannerOpen) {
         errorHandler.errorThrow(404, '게시물이 없습니다.');
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
