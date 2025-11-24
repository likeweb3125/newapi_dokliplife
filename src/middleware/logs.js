const requestIp = require('request-ip');
const parseurl = require('parseurl');

// i_logs 테이블 저장 기능 제거
// const { Op } = require('sequelize');
// const { i_logs } = require('../models');
// const { accessVerify } = require('../middleware/jwt');

exports.logs = async (req, res, next) => {
   // 로그 정보 수집 (DB 저장 없이 콘솔만 출력)
   const previousUrl = parseurl(req).path;
   const clientIp = requestIp.getClientIp(req);
   const userAgent = req.get('user-agent');

   const normalizedClientIp = clientIp.includes(':')
      ? clientIp.split(':').pop()
      : clientIp;

   // 콘솔 로그만 출력 (DB 저장 제거)
   console.log('previousUrl:', clientIp);
   console.log('clientIp:', normalizedClientIp);
   // console.log('userAgent:', userAgent);

   // DB 저장 로직 제거
   // try {
   //    const log = await i_logs.create({
   //       user: decodedTokenUser,
   //       clientIp: normalizedClientIp,
   //       userAgent: userAgent,
   //       previousUrl: previousUrl,
   //    });
   // } catch (err) {
   //    next(err);
   // }

   next();
};
