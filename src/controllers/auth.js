const {
   i_member,
   i_member_level,
   i_member_login,
   i_member_sec,
} = require('../models');
const bcrypt = require('bcryptjs');
const jwt = require('../middleware/jwt');
const nodemailer = require('nodemailer');
const errorHandler = require('../middleware/error');
const enumConfig = require('../middleware/enum');
const db = require('../models');

const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '/config/env/.env') });
const formData = require('form-data');
const Mailgun = require('mailgun.js');
const mailgun = new Mailgun(formData);

// 회원가입
exports.postSignup = async (req, res, next) => {
   const { m_email, m_password, m_name, m_mobile, m_sms_yn, m_mail_yn } =
      req.body;

   try {
      const hashedPw = await bcrypt.hash(m_password, 12);

      if (!hashedPw) {
         errorHandler.errorThrow(
            enumConfig.statusErrorCode._404_ERROR[0],
            'Password Hashed Error'
         );
      }

      const signupLv = await i_member_level.findOne({
         where: { signup_lv: 'Y' },
         attributes: ['l_level'],
      });

      if (!signupLv) {
         errorHandler.errorThrow(
            enumConfig.statusErrorCode._404_ERROR[0],
            'Non Signup Lv'
         );
      }

      const [user, created] = await i_member.findOrCreate({
         where: { m_email: m_email },
         defaults: {
            m_email: m_email,
            m_password: hashedPw,
            m_name: m_name,
            m_mobile: m_mobile,
            m_sms_yn: m_sms_yn,
            m_mail_yn: m_mail_yn,
            m_level: signupLv.l_level,
         },
      });

      if (!created) {
         errorHandler.errorThrow(enumConfig.statusErrorCode._404_ERROR[0], '');
      }

      errorHandler.successThrow(res, '', '');
   } catch (err) {
      next(err);
   }
};

// 로그인
exports.postLogin = async (req, res, next) => {
   const { m_email, m_password, m_level } = req.body;

   try {
      const emailResult = await i_member.findOne({
         where: {
            m_email: m_email,
            m_level: m_level,
         },
      });

      if (!emailResult) {
         errorHandler.errorThrow(
            enumConfig.statusErrorCode._404_ERROR[0],
            'Email Error'
         );
      }

      const isEqual = await bcrypt.compare(m_password, emailResult.m_password);

      if (!isEqual) {
         errorHandler.errorThrow(
            enumConfig.statusErrorCode._404_ERROR[0],
            'Password Error'
         );
      }

      const accessToken = jwt.access(
         emailResult.m_email,
         emailResult.m_level,
         emailResult.m_name
      );

      if (!accessToken) {
         errorHandler.errorThrow(
            enumConfig.statusErrorCode._404_ERROR[0],
            'accessToken Error'
         );
      }

      const created = await i_member_login.create({
         m_email: m_email,
      });

      if (!created) {
         errorHandler.errorThrow(enumConfig.statusErrorCode._404_ERROR[0], '');
      }

      errorHandler.successThrow(res, '', {
         accessToken: accessToken,
         m_email: emailResult.m_email,
         m_level: emailResult.m_level,
         m_name: emailResult.m_name,
      });
   } catch (err) {
      next(err);
   }
};

// 이메일 중복 확인
exports.postEmailDoubleCheck = async (req, res, next) => {
   const { flag, m_email, m_level } = req.body;

   try {
      const emailResult = await i_member.findOne({
         where: {
            m_email: m_email,
            m_level: m_level,
         },
         attributes: ['m_email'],
      });

      if (emailResult) {
         errorHandler.errorThrow(
            enumConfig.statusErrorCode._404_ERROR[0],
            '이미 등록된 이메일 주소 입니다.',
            ''
         );
      }

      errorHandler.successThrow(res, '등록 가능한 이메일 주소 입니다', '');
   } catch (err) {
      next(err);
   }
};

//비밀번호 재설정 이메일 전송
exports.postPasswordEmailSendGmail = async (req, res, next) => {
   const { m_email, m_level } = req.body;

   try {
      const emailResult = await i_member.findOne({
         where: {
            m_email: m_email,
            m_level: m_level,
         },
         attributes: ['m_email'],
      });

      if (!emailResult) {
         errorHandler.errorThrow(
            enumConfig.statusErrorCode._404_ERROR[0],
            '등록된 이메일 주소가 없습니다.'
         );
      }

      const accessToken = jwt.access(m_email, m_level);

      if (!accessToken) {
         errorHandler.errorThrow(
            enumConfig.statusErrorCode._404_ERROR[0],
            'accessToken Error'
         );
      }

      // 이메일 보내기
      const transporter = nodemailer.createTransport({
         service: 'Gmail', // 예: Gmail
         auth: {
            user: 'your-email', // 보내는 이메일 주소
            pass: 'your-password', // 보내는 이메일 비밀번호
         },
      });

      const mailOptions = {
         from: 'your-email',
         to: m_email,
         subject: '비밀번호 재설정 링크',
         text: `비밀번호를 재설정하려면 다음 링크를 클릭하세요: http://example.com/reset-password/${accessToken}`,
      };

      transporter.sendMail(mailOptions, (error, info) => {
         if (error) {
            console.log('이메일 전송 오류:', error);
            errorHandler.errorThrow(
               enumConfig.statusErrorCode._500_ERROR[0],
               '이메일 전송 오류.'
            );
         } else {
            console.log('이메일 전송 완료:', info.response);
            errorHandler.successThrow(res, '이메일이 전송되었습니다.', '');
         }
      });
   } catch (err) {
      next(err);
   }
};

//비밀번호 재설정 이메일 전송 mailGun
exports.postPasswordEmailSendGun = async (req, res, next) => {
   const { m_email, m_level, from_email } = req.body;

   try {
      const emailResult = await i_member.findOne({
         where: {
            m_email: m_email,
            m_level: m_level,
         },
         attributes: ['m_email'],
      });

      if (!emailResult) {
         errorHandler.errorThrow(
            enumConfig.statusErrorCode._404_ERROR[0],
            '등록된 이메일 주소가 없습니다.'
         );
      }

      const accessToken = jwt.access(m_email, m_level);

      if (!accessToken) {
         errorHandler.errorThrow(
            enumConfig.statusErrorCode._404_ERROR[0],
            'accessToken Error'
         );
      }

      const mg = mailgun.client({
         username: 'api',
         key: process.env.MAILGUN_API_KEY,
      });

      const data = {
         from: from_email,
         to: m_email,
         subject: '비밀번호 재설정 링크',
         html: `비밀번호를 재설정하려면 다음 링크를 클릭하세요: http://example.com/reset-password/${accessToken}`,
      };

      const email_result = await mg.messages
         .create(process.env.MAILER_HOST, data)
         .then((msg) => {
            console.log('이메일 전송 완료:', data);
            errorHandler.successThrow(res, '이메일이 전송되었습니다.', '');
         })
         .catch((error) => {
            console.log('이메일 전송 오류:', error);
            errorHandler.errorThrow(error.status, '이메일 전송 오류.');
         });
      //return email_result;
   } catch (err) {
      next(err);
   }
};

// 비밀번호 재설정
exports.postResetPassword = async (req, res, next) => {
   const { old_password, new_password } = req.body;

   try {
      const emailResult = await i_member.findOne({
         where: {
            m_email: req.user,
         },
         attributes: ['m_password'],
      });

      if (!emailResult) {
         errorHandler.errorThrow(enumConfig.statusErrorCode._404_ERROR[0], '');
      }

      if (old_password) {
         const isEqual = await bcrypt.compare(
            old_password,
            emailResult.m_password
         );

         if (!isEqual) {
            errorHandler.errorThrow(
               enumConfig.statusErrorCode._404_ERROR[0],
               '기존 비빌번호가 다릅니다.'
            );
         }
      }

      const hashedPw = await bcrypt.hash(new_password, 12);

      const pwdUpdate = await i_member.update(
         {
            m_password: hashedPw,
         },
         {
            where: {
               m_email: req.user,
            },
         }
      );

      if (!pwdUpdate) {
         errorHandler.errorThrow(enumConfig.statusErrorCode._404_ERROR[0], '');
      }

      errorHandler.successThrow(res, '비밀번호 변경 되었습니다.', pwdUpdate);
   } catch (err) {
      next(err);
   }
};

// 회원 정보 수정
exports.putUserUpdate = async (req, res, next) => {
   const { m_mobile, m_sms_yn, m_mail_yn } = req.body;
   try {
      const memberView = await i_member.findOne({
         where: { m_email: req.user },
      });

      if (!memberView) {
         errorHandler.errorThrow(404, '');
      }

      const memberUpdate = await i_member.update(
         {
            m_mobile: m_mobile,
            m_sms_yn: m_sms_yn,
            m_mail_yn: m_mail_yn,
         },
         {
            where: {
               m_email: req.user,
            },
         }
      );

      if (!memberUpdate) {
         errorHandler.errorThrow(404, '');
      }

      errorHandler.successThrow(res, '', memberUpdate);
   } catch (err) {
      next(err);
   }
};

// 회원 탈퇴
exports.deleteUserDestroy = async (req, res, next) => {
   let transaction;

   try {
      transaction = await db.sequelize.transaction();

      const secCreate = await i_member_sec.create({
         m_email: req.user,
         memo: '사용자 탈퇴',
      });

      if (!secCreate) {
         errorHandler.errorThrow(404, '삭제로그 등록 실패.');
      }

      const memberDelete = await i_member.destroy({
         where: {
            m_email: req.user,
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
