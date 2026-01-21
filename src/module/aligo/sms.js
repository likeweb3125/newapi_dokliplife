const axios = require('axios');
const querystring = require('querystring');

// Aligo SMS 발송
// params: { receiver: '01012345678', message: '내용', title?: '제목' }
async function send({ receiver, message, title }) {
	// 함수 내부에서 환경 변수 읽기 (dotenv 로드 후)
	const VENDER = process.env.MESSAGE_VENDER || 'ALIGO';
	const API_KEY = process.env.MESSAGE_APIKEY;
	const USER_ID = process.env.MESSAGE_USERID;
	const SENDER = process.env.MESSAGE_SENDER_TEL_USER;

	if (!API_KEY || !USER_ID || !SENDER) {
		throw new Error('MESSAGE_APIKEY / MESSAGE_USERID / MESSAGE_SENDER_TEL_USER 환경변수를 확인하세요.');
	}

	if (!receiver) {
		throw new Error('수신 번호(receiver)가 없습니다.');
	}
	if (!message) {
		throw new Error('메시지 내용(message)이 없습니다.');
	}

	const payload = {
		key: API_KEY,
		user_id: USER_ID,
		sender: SENDER,
		receiver, // 콤마로 복수 가능
		msg: message,
		title: title || '알림',
		testmode_yn: 'N',
	};

	const url =
		VENDER === 'ALIGO_SMS'
			? 'https://apis.aligo.in/send_sms/'
			: 'https://apis.aligo.in/send/';

	const res = await axios.post(url, querystring.stringify(payload), {
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		timeout: 10000,
	});

	if (res.data?.result_code !== '1' && res.data?.result_code !== 1) {
		const errMsg = res.data?.message || '알리고 전송 실패';
		throw new Error(errMsg);
	}

	return res.data;
}

module.exports = { send };
