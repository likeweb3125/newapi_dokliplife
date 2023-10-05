const { body } = require('express-validator');
const { i_member } = require('../models');

exports.singUpValidator = [
   body('m_email')
      .isEmail()
      .withMessage('이메일주소를 입력해 주세요.')
      .custom((value, { req }) => {
         return i_member
            .findOne({
               where: {
                  m_email: m_email,
               },
            })
            .then((userDoc) => {
               if (userDoc) {
                  return Promise.reject('이미 등록된 E-mail 주소 입니다.');
               }
            });
      })
      .normalizeEmail(),
   body('m_password')
      .trim()
      .matches(
         /^(?=.*[a-zA-Z])(?=.*[0-9])(?=.*[!@#$%^&*()_+])[A-Za-z0-9!@#$%^&*()_+]{8,12}$/
      )
      .withMessage(
         '영문, 숫자, 특수문자를 모두 포함하여 8~12자의 비밀번호를 입력해주세요.'
      ),
   body('m_name').trim().notEmpty(),
   body('m_mobile')
      .notEmpty()
      .withMessage('휴대폰 번호를 입력해주세요.')
      .isLength({ max: 13 })
      .withMessage('휴대폰 번호는 최대 13자까지 입력 가능합니다.'),
];
