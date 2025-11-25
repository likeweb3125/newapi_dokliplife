module.exports = (sequelize, DataTypes) => {
	return sequelize.define(
		'gosiwon',
		{
			esntlId: {
				type: DataTypes.STRING(50),
				allowNull: false,
				primaryKey: true,
				field: 'esntlId',
				comment: '고유아이디',
			},
			address: {
				type: DataTypes.STRING(255),
				allowNull: true,
			},
			address2: {
				type: DataTypes.STRING(255),
				allowNull: true,
			},
			address3: {
				type: DataTypes.STRING(255),
				allowNull: true,
			},
			name: {
				type: DataTypes.STRING(255),
				allowNull: true,
				comment: '고시원명',
			},
			longitude: {
				type: DataTypes.STRING(255),
				allowNull: true,
				comment: '경도',
			},
			latitude: {
				type: DataTypes.STRING(255),
				allowNull: true,
				comment: '위도',
			},
			gsw_grade: {
				type: DataTypes.STRING(50),
				allowNull: true,
				defaultValue: '',
				comment: '등급',
			},
			numOfRooms: {
				type: DataTypes.STRING(50),
				allowNull: true,
				comment: '보유방수',
			},
			homepage: {
				type: DataTypes.STRING(100),
				allowNull: true,
				comment: '홈페이지주소',
			},
			blog: {
				type: DataTypes.STRING(100),
				allowNull: true,
				comment: '블로그주소',
			},
			youtube: {
				type: DataTypes.STRING(300),
				allowNull: true,
				comment: '유튜브주소',
			},
			gsw_metaport: {
				type: DataTypes.STRING(255),
				allowNull: true,
				comment: '룸투어URL',
			},
			keeperName: {
				type: DataTypes.STRING(50),
				allowNull: true,
				comment: '총무이름',
			},
			keeperHp: {
				type: DataTypes.STRING(50),
				allowNull: true,
				comment: '총무연락처',
			},
			phone: {
				type: DataTypes.STRING(50),
				allowNull: true,
				comment: '고시원연락처',
			},
			qrHash: {
				type: DataTypes.STRING(50),
				allowNull: true,
			},
			gosooQrPoint: {
				type: DataTypes.STRING(50),
				allowNull: true,
			},
			qrPoint: {
				type: DataTypes.STRING(50),
				allowNull: true,
			},
			tag: {
				type: DataTypes.STRING(50),
				allowNull: true,
				comment: '검색태그',
			},
			email: {
				type: DataTypes.STRING(50),
				allowNull: true,
				comment: '이메일주소',
			},
			subway: {
				type: DataTypes.STRING(50),
				allowNull: true,
				comment: '주변지하철',
			},
			college: {
				type: DataTypes.STRING(50),
				allowNull: true,
			},
			corpNumber: {
				type: DataTypes.STRING(50),
				allowNull: true,
				comment: '사업자번호',
			},
			bank: {
				type: DataTypes.STRING(50),
				allowNull: true,
				comment: '은행명',
			},
			bankAccount: {
				type: DataTypes.STRING(50),
				allowNull: true,
				comment: '계좌번호',
			},
			commision: {
				type: DataTypes.STRING(50),
				allowNull: false,
				defaultValue: '7',
				comment: '수수료율',
			},
			description: {
				type: DataTypes.STRING(2000),
				allowNull: true,
				comment: '고시원설명',
			},
			image: {
				type: DataTypes.STRING(255),
				allowNull: true,
				comment: '미사용',
			},
			manager: {
				type: DataTypes.STRING(50),
				allowNull: true,
				comment: '영업담당자',
			},
			point: {
				type: DataTypes.INTEGER(50),
				allowNull: false,
				defaultValue: 0,
			},
			acceptDate: {
				type: DataTypes.STRING(50),
				allowNull: true,
				comment: '가입일시',
			},
			gsw_signup_path_cd: {
				type: DataTypes.STRING(30),
				allowNull: true,
				field: 'gsw_signup_path_cd',
				comment: '가입경로코드',
			},
			gsw_signup_path_etc: {
				type: DataTypes.STRING(100),
				allowNull: true,
				field: 'gsw_signup_path_etc',
				defaultValue: '',
				comment: '가입경로(기타)',
			},
			alarmTalk: {
				type: DataTypes.STRING(50),
				allowNull: true,
			},
			alarmEmail: {
				type: DataTypes.STRING(50),
				allowNull: true,
			},
			status: {
				type: DataTypes.STRING(50),
				allowNull: true,
				comment: '고시원상태',
			},
			process: {
				type: DataTypes.STRING(50),
				allowNull: true,
				comment: '운영여부',
			},
			rejectText: {
				type: DataTypes.STRING(50),
				allowNull: true,
			},
			contractText: {
				type: DataTypes.STRING(50),
				allowNull: true,
			},
			monthCalculate: {
				type: DataTypes.STRING(50),
				allowNull: true,
			},
			accountHolder: {
				type: DataTypes.STRING(50),
				allowNull: true,
				comment: '예금주명',
			},
			adminEsntlId: {
				type: DataTypes.STRING(50),
				allowNull: false,
				field: 'adminEsntlId',
				comment: '관리자고유아이디',
			},
			contract: {
				type: DataTypes.STRING(10000),
				allowNull: true,
				comment: '계약서일반',
			},
			contractFile: {
				type: DataTypes.STRING(500),
				allowNull: true,
			},
			contractFileOrgName: {
				type: DataTypes.STRING(500),
				allowNull: true,
				field: 'contractFileOrgName',
			},
			serviceNumber: {
				type: DataTypes.STRING(20),
				allowNull: true,
				comment: '050번호',
			},
			terminate_reason: {
				type: DataTypes.STRING(50),
				allowNull: true,
				comment: '종료사유',
			},
			terminate_date: {
				type: DataTypes.DATE,
				allowNull: true,
				comment: '종료일자',
			},
			gsw_successor_eid: {
				type: DataTypes.STRING(14),
				allowNull: true,
				comment: '승계고시원아이디',
			},
			updater_sn: {
				type: DataTypes.STRING(14),
				allowNull: true,
				comment: '수정자아이디',
			},
			update_dtm: {
				type: DataTypes.DATE,
				allowNull: true,
				comment: '수정일시',
			},
			is_controlled: {
				type: DataTypes.TINYINT(1),
				allowNull: true,
				defaultValue: 0,
				comment: '관제서비스 이용 여부',
			},
			is_favorite: {
				type: DataTypes.TINYINT(1),
				allowNull: true,
				defaultValue: 0,
				field: 'is_favorite',
				comment: '즐겨찾기 여부',
			},
			district: {
				type: DataTypes.STRING(50),
				allowNull: true,
			},
		},
		{
			timestamps: false,
			freezeTableName: true,
		}
	);
};

