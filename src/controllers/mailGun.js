const { i_mailGun } = require('../models');
const { accessVerify } = require('../middleware/jwt');
const errorHandler = require('../middleware/error');
const bcrypt = require('bcryptjs');
const jwt = require('../middleware/jwt');
const enumConfig = require('../middleware/enum');
const db = require('../models');

const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '/config/env/.env') });
const formData = require('form-data');
const Mailgun = require('mailgun.js');
const mailgun = new Mailgun(formData);

//이메일 전송 계정 생성
exports.postMailGunSingUp = async (req, res, next) => {
	const { user_id, user_pw, user_name } = req.body;

	try {
		const hashedPw = await bcrypt.hash(user_pw, 12);

		if (!hashedPw) {
			errorHandler.errorThrow(
				enumConfig.statusErrorCode._404_ERROR[0],
				'Password Hashed Error'
			);
		}

		const [user, created] = await i_mailGun.findOrCreate({
			where: { user_id: user_id },
			defaults: {
				user_id: user_id,
				user_pw: hashedPw,
				user_name: user_name,
				user_level: '1',
			},
		});

		if (!created) {
			errorHandler.errorThrow(
				enumConfig.statusErrorCode._404_ERROR[0],
				''
			);
		}

		errorHandler.successThrow(res, '', user);
	} catch (err) {
		next(err);
	}
};

//이메일 전송 토큰 생성
exports.postMailGunToken = async (req, res, next) => {
	const { user_id, user_pw } = req.body;

	try {
		const mailGunResult = await i_mailGun.findOne({
			where: {
				user_id: user_id,
			},
		});

		if (!mailGunResult) {
			errorHandler.errorThrow(
				enumConfig.statusErrorCode._404_ERROR[0],
				'사용자가 없습니다.'
			);
		}

		const isEqual = await bcrypt.compare(
			user_pw,
			mailGunResult.user_pw
		);

		if (!isEqual) {
			errorHandler.errorThrow(
				enumConfig.statusErrorCode._404_ERROR[0],
				'비밀번호가 다릅니다.'
			);
		}

		const accessToken = jwt.access(
			mailGunResult.user_id,
			mailGunResult.user_level,
			mailGunResult.user_name
		);

		errorHandler.successThrow(res, '', {
			accessToken: accessToken,
		});
	} catch (err) {
		next(err);
	}
};

//이메일 전송 mailGun
exports.postMailGunSend = async (req, res, next) => {
	const { from_email, to_email, subject, content } = req.body;

	try {
		const authHeader = req.get('Authorization');

		if (!authHeader) {
			errorHandler.errorThrow(
				enumConfig.statusErrorCode._401_ERROR[0],
				'No token in header.'
			);
		}

		const token = authHeader.split(' ')[1];
		let decodedToken = null;

		decodedToken = accessVerify(token);
		if (decodedToken.decoded !== null) {
			req.user = decodedToken.decoded.user;
			req.level = decodedToken.decoded.level;
		}

		if (!decodedToken.decoded) {
			errorHandler.errorThrow(
				enumConfig.statusErrorCode._401_ERROR[0],
				'Access token authentication failed.'
			);

			if (decodedToken.err.name === 'TokenExpiredError') {
				errorHandler.errorThrow(
					enumConfig.statusErrorCode._401_ERROR[0],
					'Access token authentication expiration.'
				);
			}
		}

		const mg = mailgun.client({
			username: 'api',
			key: process.env.MAILGUN_API_KEY,
		});

		const data = {
			from: from_email,
			to: to_email,
			subject: subject,
			html: content,
		};

		const email_result = await mg.messages
			.create(process.env.MAILER_HOST, data)
			.then((msg) => {
				console.log('이메일 전송 완료:', data);
				errorHandler.successThrow(
					res,
					'이메일이 전송되었습니다.',
					''
				);
			})
			.catch((error) => {
				console.log('이메일 전송 오류:', error);
				errorHandler.errorThrow(
					error.status,
					'이메일 전송 오류.'
				);
			});
	} catch (err) {
		next(err);
	}
};
