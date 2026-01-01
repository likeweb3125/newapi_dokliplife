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

	// 한국 시간으로 변환한 Date 객체 반환 (DB 저장용)
	getKoreaDate: () => {
		const now = new Date();
		// UTC 시간에 9시간을 더해서 한국 시간으로 변환
		const koreaTime = new Date(now.getTime() + (9 * 60 * 60 * 1000) - (now.getTimezoneOffset() * 60 * 1000));
		return koreaTime;
	},

	// 한국 시간을 MySQL/MariaDB DATETIME 형식 문자열로 반환 (YYYY-MM-DD HH:mm:ss)
	getKoreaDateTimeString: () => {
		const now = new Date();
		// 한국 시간대로 변환
		const koreaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
		
		const year = koreaTime.getFullYear();
		const month = String(koreaTime.getMonth() + 1).padStart(2, '0');
		const day = String(koreaTime.getDate()).padStart(2, '0');
		const hours = String(koreaTime.getHours()).padStart(2, '0');
		const minutes = String(koreaTime.getMinutes()).padStart(2, '0');
		const seconds = String(koreaTime.getSeconds()).padStart(2, '0');
		
		return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
	},
};
