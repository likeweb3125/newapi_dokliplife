const requestIp = require('request-ip');

const { Op } = require('sequelize');
const { i_logs } = require('../models');
const { accessVerify } = require('../middleware/jwt');

exports.logs = async (req, res, next) => {
   const authHeader = req.get('Authorization') || ' ';

   let decodedTokenUser = null;
   if (!authHeader) {
      const token = authHeader.split(' ')[1];
      let decodedToken = null;
      decodedToken = accessVerify(token);
      if (decodedToken.decoded !== null) {
         decodedTokenUser = decodedToken.decoded.user;
      }
   }

   const previousUrl = req.headers.referer;
   const clientIp = requestIp.getClientIp(req);
   const userAgent = req.get('user-agent');

   //const normalizedClientIp = clientIp.substring(clientIp.lastIndexOf(':') + 1);
   const normalizedClientIp = clientIp.includes(':')
      ? clientIp.split(':').pop()
      : clientIp;

   console.log('previousUrl:', clientIp);
   console.log('clientIp:', normalizedClientIp);
   //    console.log('userAgent:', userAgent);

   try {
      const log = await i_logs.create({
         user: decodedTokenUser,
         clientIp: normalizedClientIp,
         userAgent: userAgent,
         previousUrl: previousUrl,
      });

      //console.log('Log inserted successfully:', log.toJSON());
      //   res.sendStatus(200);
   } catch (err) {
      next(err);
   }
};
