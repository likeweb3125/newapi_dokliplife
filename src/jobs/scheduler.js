/**
 * 앱 내 스케줄러
 * - 매일 자정(00:00) KST에 일일 매출 마감 잡 실행
 * - 서버 타임존이 Asia/Seoul이면 자정에 실행됨 (models에서 SET time_zone = 'Asia/Seoul' 사용)
 */

const cron = require('node-cron');
const dailySellingClosing = require('./dailySellingClosing');

/** 매일 00:00 (자정) 실행 — 크론 표현식: 0 0 * * * */
const DAILY_MIDNIGHT = '0 0 * * *';

function start() {
	cron.schedule(DAILY_MIDNIGHT, async () => {
		try {
			const result = await dailySellingClosing.run();
			// eslint-disable-next-line no-console
			console.log(`[${dailySellingClosing.JOB_NAME}] 자정 실행 완료`, result);
		} catch (err) {
			// eslint-disable-next-line no-console
			console.error(`[${dailySellingClosing.JOB_NAME}] 자정 실행 실패`, err.message, err.stack);
		}
	}, {
		scheduled: true,
		timezone: 'Asia/Seoul',
	});
	// eslint-disable-next-line no-console
	console.log(`[scheduler] 일일 매출 마감 잡 등록됨: 매일 00:00 (Asia/Seoul)`);
}

module.exports = { start };
