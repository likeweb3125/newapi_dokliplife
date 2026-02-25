/**
 * 앱 내 스케줄러
 * - 매일 자정(00:00) KST: 일일 매출 마감, 방이동 잡
 * - 매일 00:05 KST: 방상태 종료·체납 정리 잡
 * - 매일 09:00 KST: 예약 리마인더(계약 링크 문자) 잡
 * - 서버 타임존이 Asia/Seoul이면 해당 시각에 실행됨 (models에서 SET time_zone = 'Asia/Seoul' 사용)
 */

const cron = require('node-cron');
const dailySellingClosing = require('./dailySellingClosing');
const dailyRoomMove = require('./dailyRoomMove');
const dailyStatusEnd = require('./dailyStatusEnd');
const dailyReserveReminder = require('./dailyReserveReminder');

/** 매일 00:00 (자정) 실행 — 크론 표현식: 0 0 * * * */
const DAILY_MIDNIGHT = '0 0 * * *';
/** 매일 00:05 실행 — 크론 표현식: 5 0 * * * */
const DAILY_00_05 = '5 0 * * *';
/** 매일 09:00 (오전 9시) 실행 — 크론 표현식: 0 9 * * * */
const DAILY_9AM = '0 9 * * *';

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
		try {
			const result = await dailyRoomMove.run();
			// eslint-disable-next-line no-console
			console.log(`[${dailyRoomMove.JOB_NAME}] 자정 실행 완료`, result);
		} catch (err) {
			// eslint-disable-next-line no-console
			console.error(`[${dailyRoomMove.JOB_NAME}] 자정 실행 실패`, err.message, err.stack);
		}
	}, {
		scheduled: true,
		timezone: 'Asia/Seoul',
	});

	cron.schedule(DAILY_00_05, async () => {
		try {
			const result = await dailyStatusEnd.run();
			// eslint-disable-next-line no-console
			console.log(`[${dailyStatusEnd.JOB_NAME}] 00:05 실행 완료`, result);
		} catch (err) {
			// eslint-disable-next-line no-console
			console.error(`[${dailyStatusEnd.JOB_NAME}] 00:05 실행 실패`, err.message, err.stack);
		}
	}, {
		scheduled: true,
		timezone: 'Asia/Seoul',
	});

	cron.schedule(DAILY_9AM, async () => {
		try {
			const result = await dailyReserveReminder.run();
			// eslint-disable-next-line no-console
			console.log(`[${dailyReserveReminder.JOB_NAME}] 오전 9시 실행 완료`, result);
		} catch (err) {
			// eslint-disable-next-line no-console
			console.error(`[${dailyReserveReminder.JOB_NAME}] 오전 9시 실행 실패`, err.message, err.stack);
		}
	}, {
		scheduled: true,
		timezone: 'Asia/Seoul',
	});

	// eslint-disable-next-line no-console
	console.log(`[scheduler] 일일 매출 마감·방이동 잡 등록됨: 매일 00:00 (Asia/Seoul)`);
	// eslint-disable-next-line no-console
	console.log(`[scheduler] 방상태 종료·체납 정리 잡 등록됨: 매일 00:05 (Asia/Seoul)`);
	// eslint-disable-next-line no-console
	console.log(`[scheduler] 예약 리마인더 잡 등록됨: 매일 09:00 (Asia/Seoul)`);
}

module.exports = { start };
