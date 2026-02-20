/**
 * 설정 예시 파일.
 * 배포 시 이 파일을 config.js로 복사한 뒤 .env 값을 채워 사용한다.
 * config.js는 .gitignore에 있어 저장소에 올라가지 않는다.
 */

const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../../.env') });

module.exports = {
	// MariaDB 설정 (development)
	development: {
		host: process.env.DB_HOST || 'localhost',
		port: process.env.DB_PORT || 3306,
		database: process.env.DB_DATABASE || 'database_name',
		username: process.env.DB_USERNAME || 'root',
		password: process.env.DB_PASSWORD || '',
		dialect: 'mariadb',
		timezone: '+09:00', // 한국 시간대 (읽기/쓰기 해석)
		dialectOptions: {
			charset: 'utf8mb3',
			// 연결 시 세션 타임존을 한국 시간으로 고정 → NOW(), CURRENT_TIMESTAMP가 KST
			initSql: "SET time_zone = 'Asia/Seoul'",
			// DATETIME을 Date 객체가 아닌 문자열로 반환 → 드라이버가 UTC로 해석해 서버에서 +9 나오는 문제 방지
			dateStrings: true,
		},
		pool: {
			max: 5,
			min: 0,
			acquire: 30000,
			idle: 10000,
		},
		logging: process.env.NODE_ENV === 'development' ? console.log : false,
	},

	// MSSQL 설정 (maintenance)
	maintenance: {
		host: process.env.MSSQL_HOST || 'localhost',
		port: process.env.MSSQL_PORT || 1433,
		database: process.env.MSSQL_DATABASE || 'maintenance_db',
		username: process.env.MSSQL_USERNAME || 'sa',
		password: process.env.MSSQL_PASSWORD || '',
		dialect: 'mssql',
		dialectOptions: {
			options: {
				encrypt: false,
				trustServerCertificate: true,
			},
		},
		pool: {
			max: 5,
			min: 0,
			acquire: 30000,
			idle: 10000,
		},
		logging: process.env.NODE_ENV === 'development' ? console.log : false,
	},

	// JWT 설정
	jwToken: {
		secretkey: process.env.JWT_SECRET_KEY || 'your-secret-key-change-this',
		refreshSecretkey:
			process.env.JWT_REFRESH_SECRET_KEY || 'your-refresh-secret-key-change-this',
		option: {
			algorithm: 'HS256',
			expiresIn: process.env.JWT_EXPIRES_IN || '7d',
			refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
		},
	},
};
