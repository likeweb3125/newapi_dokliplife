const axios = require('axios');
const querystring = require('querystring');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// Aligo SMS/LMS/MMS 발송
// params: { receiver, message, title?, imagePath? } — imagePath 있으면 MMS로 multipart 전송
async function send({ receiver, message, title, imagePath }) {
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

	const url =
		VENDER === 'ALIGO_SMS'
			? 'https://apis.aligo.in/send_sms/'
			: 'https://apis.aligo.in/send/';

	// 이미지가 있으면 MMS: multipart/form-data로 전송 (ALIGO_SMS 제외)
	if (imagePath && VENDER !== 'ALIGO_SMS') {
		const absolutePath = path.isAbsolute(imagePath) ? imagePath : path.join(process.cwd(), imagePath);
		if (!fs.existsSync(absolutePath)) {
			throw new Error('첨부 이미지 파일을 찾을 수 없습니다.');
		}
		const form = new FormData();
		form.append('key', API_KEY);
		form.append('user_id', USER_ID);
		form.append('sender', SENDER);
		form.append('receiver', receiver);
		form.append('msg', message);
		form.append('title', title || '알림');
		form.append('testmode_yn', 'N');
		form.append('image', fs.createReadStream(absolutePath), {
			filename: path.basename(absolutePath),
		});
		const res = await axios.post(url, form, {
			headers: form.getHeaders(),
			timeout: 15000,
			maxContentLength: Infinity,
			maxBodyLength: Infinity,
		});
		if (res.data?.result_code !== '1' && res.data?.result_code !== 1) {
			const errMsg = res.data?.message || '알리고 MMS 전송 실패';
			throw new Error(errMsg);
		}
		return res.data;
	}

	const payload = {
		key: API_KEY,
		user_id: USER_ID,
		sender: SENDER,
		receiver,
		msg: message,
		title: title || '알림',
		testmode_yn: 'N',
	};

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
