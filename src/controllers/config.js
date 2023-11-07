const moment = require('moment');
const { Op } = require('sequelize');
const { i_config, i_member_level, i_policy } = require('../models');
const errorHandler = require('../middleware/error');
const enumConfig = require('../middleware/enum');
const utilMiddleware = require('../middleware/util');

exports.getConfigSite = async (req, res, next) => {
   const site_id = req.params;

   try {
      const configView = await i_config.findOne(
         {
            attributes: [
               'c_site_name',
               'c_web_title',
               'c_ceo',
               'c_tel',
               'c_num',
               'c_num2',
               'c_email',
               'c_address',
               'c_fax',
               'c_manager',
               'c_b_title',
               'c_meta',
               'c_meta_tag',
               'c_meta_type',
            ],
         },
         {
            where: {
               site_id: site_id,
            },
         }
      );

      if (!configView) {
         errorHandler.errorThrow(404, '');
      }

      const configObj = {
         c_site_name: configView.c_site_name,
         c_web_title: configView.c_web_title,
         c_ceo: configView.c_ceo,
         c_tel: configView.c_tel,
         c_num: configView.c_num,
         c_num2: configView.c_num2,
         c_email: configView.c_email,
         c_address: configView.c_address,
         c_fax: configView.c_fax,
         c_manager: configView.c_manager,
         c_b_title: configView.c_b_title,
         c_meta: configView.c_meta,
         c_meta_tag: configView.c_meta_tag,
         c_meta_type: configView.c_meta_type,
      };
      console.log(configObj);
      //res.status(200).json(configObj);
      errorHandler.successThrow(res, '', configObj);
   } catch (err) {
      next(err);
   }
};

exports.putConfigSiteUpdate = async (req, res, next) => {
   const {
      site_id,
      c_site_name,
      c_web_title,
      c_ceo,
      c_tel,
      c_num,
      c_num2,
      c_email,
      c_address,
      c_fax,
      c_manager,
      c_b_title,
      c_meta,
      c_meta_tag,
      c_meta_type,
   } = req.body;

   try {
      const configUpdate = await i_config.update(
         {
            c_site_name: c_site_name,
            c_web_title: c_web_title,
            c_ceo: c_ceo,
            c_tel: c_tel,
            c_num: c_num,
            c_num2: c_num2,
            c_email: c_email,
            c_address: c_address,
            c_fax: c_fax,
            c_manager: c_manager,
            c_b_title: c_b_title,
            c_meta: c_meta,
            c_meta_tag: c_meta_tag,
            c_meta_type: c_meta_type,
         },
         {
            where: {
               site_id: site_id,
            },
         }
      );

      if (!configUpdate) {
         errorHandler.errorThrow(404, '');
      }

      errorHandler.successThrow(res, '', '');
   } catch (err) {
      next(err);
   }
};

exports.getConfigPolicy = async (req, res, next) => {
   const page = parseInt(req.query.page) || 1;
   const limit = parseInt(req.query.limit) || 10;
   const offset = (page - 1) * limit;

   const searchQuery = req.query.search;
   const searchTxtQuery = req.query.searchtxt;

   try {
      const whereCondition = {
         idx: { [Op.gt]: 0 },
      };

      if (searchQuery && searchTxtQuery) {
         if (searchQuery === 'title') {
            whereCondition.p_title = {
               [Op.like]: `%${searchTxtQuery}%`,
            };
         }

         if (searchQuery === 'contents') {
            whereCondition.p_contents = {
               [Op.like]: `%${searchTxtQuery}%`,
            };
         }
      }

      const policyList = await i_policy.findAndCountAll({
         offset: offset,
         limit: limit,
         where: whereCondition,
         order: [['idx', 'ASC']],
         attributes: ['idx', 'p_title', 'p_contents', 'p_reg_date', 'p_use_yn'],
      });

      const lastPage = Math.ceil(policyList.count / limit);
      const maxPage = 10;
      const startPage = Math.max(
         1,
         Math.floor((page - 1) / maxPage) * maxPage + 1
      );
      const endPage = Math.min(lastPage, startPage + maxPage - 1);

      const policyResult = policyList.rows.map((list) => {
         const boardDate = moment.utc(list.p_reg_date).format('YYYY.MM.DD');
         const listObj = {
            idx: list.idx,
            p_title: list.p_title,
            p_reg_date: boardDate,
            p_use_yn: list.p_use_yn,
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
         total_count: policyList.count,
         policy_list: policyResult,
      });
   } catch (err) {
      next(err);
   }
};

exports.postConfigPolicyCreate = async (req, res, next) => {
   const { p_title, p_contents, p_use_yn } = req.body;

   try {
      const processedContents = await utilMiddleware.base64ToImagesPath(
         p_contents
      );

      const policyCreate = await i_policy.create({
         p_title: p_title,
         p_contents: processedContents.temp_contents,
         p_use_yn: p_use_yn,
      });

      if (!policyCreate) {
         errorHandler.errorThrow(404, '');
      }

      errorHandler.successThrow(res, '', '');
   } catch (err) {
      next(err);
   }
};

exports.postConfigPolicyView = async (req, res, next) => {
   const { idx } = req.params;

   try {
      const policyView = await i_policy.findOne({
         where: {
            idx: idx,
         },
         attributes: ['idx', 'p_title', 'p_contents', 'p_use_yn'],
      });

      if (!policyView) {
         errorHandler.errorThrow(404, '');
      }

      const policyObj = {
         idx: policyView.idx,
         p_title: policyView.p_title,
         p_contents: policyView.p_contents,
         p_use_yn: policyView.p_use_yn,
      };

      //res.status(200).json(policyObj);
      errorHandler.successThrow(res, '', policyObj);
   } catch (err) {
      next(err);
   }
};

exports.putConfigPolicyUpdate = async (req, res, next) => {
   const { idx, p_title, p_contents, p_use_yn } = req.body;

   try {
      const policyView = await i_policy.findOne({
         where: {
            idx: idx,
         },
         attributes: ['idx'],
      });

      if (!policyView) {
         errorHandler.errorThrow(404, '');
      }

      const processedContents = await utilMiddleware.base64ToImagesPath(
         p_contents
      );

      const policyUpdate = await i_policy.update(
         {
            p_title: p_title,
            p_contents: processedContents.temp_contents,
            p_use_yn: p_use_yn,
         },
         {
            where: {
               idx: idx,
            },
         }
      );

      if (!policyUpdate) {
         errorHandler.errorThrow(404, '');
      }

      errorHandler.successThrow(res, '', '');
   } catch (err) {
      next(err);
   }
};

exports.deleteConfigPolicyDestroy = async (req, res, next) => {
   const { idx } = req.body;

   try {
      const policyView = await i_policy.findOne({
         where: {
            idx: idx,
         },
         attributes: ['idx'],
      });

      if (!policyView) {
         errorHandler.errorThrow(404, '');
      }

      const policyDelete = await i_policy.destroy({
         where: {
            idx: idx,
         },
      });

      if (!policyDelete) {
         errorHandler.errorThrow(404, '');
      }

      errorHandler.successThrow(res, '', '');
   } catch (err) {
      next(err);
   }
};

exports.postConfigPolicyUseYn = async (req, res, next) => {
   const { idx, p_use_yn } = req.body;

   console.log(req.body.idx);
   try {
      const policyUpdate = await i_policy.update(
         {
            p_use_yn: p_use_yn,
         },
         {
            where: {
               idx: { [Op.in]: idx },
            },
         }
      );

      if (!policyUpdate) {
         errorHandler.errorThrow(404, '');
      }

      errorHandler.successThrow(res, '', '');
   } catch (err) {
      next(err);
   }
};

exports.getConfigLevel = async (req, res, next) => {
   try {
      const levelView = await i_member_level.findAll({
         attributes: ['l_level', 'signup_lv', 'l_name'],
         order: [['l_level', 'DESC']],
      });

      if (!levelView) {
         errorHandler.errorThrow(404, '');
      }

      const levelResult = levelView.map((list) => {
         const listObj = {
            l_level: list.l_level,
            signup_lv: list.signup_lv,
            l_name: list.l_name,
         };
         return listObj;
      });

      //res.status(200).json(levelResult);
      errorHandler.successThrow(res, '', levelResult);
   } catch (err) {
      next(err);
   }
};

exports.putConfigLevelUpdate = async (req, res, next) => {
   const { l_name, l_level, signup_lv } = req.body;

   try {
      if (signup_lv) {
         const signupLvUpdate = await i_member_level.update(
            {
               signup_lv: null,
            },
            {
               where: {
                  signup_lv: signup_lv,
               },
            }
         );

         if (!signupLvUpdate) {
            errorHandler.errorThrow(404, '');
         }
      }

      const configUpdate = await i_member_level.update(
         {
            l_name: l_name,
            signup_lv: signup_lv,
         },
         {
            where: {
               l_level: l_level,
            },
         }
      );

      if (!configUpdate) {
         errorHandler.errorThrow(404, '');
      }

      errorHandler.successThrow(res, '', '');
   } catch (err) {
      next(err);
   }
};
