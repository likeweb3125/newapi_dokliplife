// 타임존 확인 유틸리티 함수
// 디버깅용으로 사용

module.exports = {
	// 현재 타임존 정보 확인
	getTimezoneInfo: () => {
		const now = new Date();
		return {
			// 시스템 타임존
			systemTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
			// 환경 변수
			envTZ: process.env.TZ,
			// 현재 시간 (로컬)
			localTime: now.toString(),
			// 현재 시간 (ISO)
			isoTime: now.toISOString(),
			// UTC 오프셋 (분)
			utcOffset: -now.getTimezoneOffset(),
			// 한국 시간으로 변환한 시간
			koreaTime: new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' })).toString(),
			// 현재 시간의 각 구성 요소
			components: {
				year: now.getFullYear(),
				month: now.getMonth() + 1,
				day: now.getDate(),
				hours: now.getHours(),
				minutes: now.getMinutes(),
				seconds: now.getSeconds(),
			},
		};
	},

	// 한국 시간으로 변환
	getKoreaTime: () => {
		const now = new Date();
		const koreaFormatter = new Intl.DateTimeFormat('en-US', {
			timeZone: 'Asia/Seoul',
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hour12: false,
		});
		
		const parts = koreaFormatter.formatToParts(now);
		return {
			year: parts.find(p => p.type === 'year').value,
			month: parts.find(p => p.type === 'month').value,
			day: parts.find(p => p.type === 'day').value,
			hours: parts.find(p => p.type === 'hour').value,
			minutes: parts.find(p => p.type === 'minute').value,
			seconds: parts.find(p => p.type === 'second').value,
		};
	},
};
