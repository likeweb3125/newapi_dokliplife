module.exports = (sequelize, DataTypes) => {
	return sequelize.define(
		'customer',
		{
			esntlId: {
				type: DataTypes.STRING(50),
				allowNull: false,
				primaryKey: true,
				field: 'esntlId',
			},
			id: {
				type: DataTypes.STRING(50),
				allowNull: true,
				field: 'id',
			},
			pass: {
				type: DataTypes.STRING(50),
				allowNull: true,
				field: 'pass',
			},
			name: {
				type: DataTypes.STRING(50),
				allowNull: true,
				field: 'name',
			},
			phone: {
				type: DataTypes.STRING(50),
				allowNull: true,
				field: 'phone',
			},
			birth: {
				type: DataTypes.STRING(50),
				allowNull: true,
				field: 'birth',
			},
			cus_sns: {
				type: DataTypes.STRING(30),
				allowNull: true,
				field: 'cus_sns',
			},
			cus_sns_id: {
				type: DataTypes.STRING(255),
				allowNull: true,
				field: 'cus_sns_id',
			},
			cus_sns_nick: {
				type: DataTypes.STRING(255),
				allowNull: true,
				field: 'cus_sns_nick',
			},
			cus_manner_grade: {
				type: DataTypes.TINYINT(1),
				allowNull: true,
				defaultValue: 0,
				field: 'cus_manner_grade',
			},
			kakaoId: {
				type: DataTypes.STRING(50),
				allowNull: true,
				field: 'kakaoId',
			},
			naverId: {
				type: DataTypes.STRING(50),
				allowNull: true,
				field: 'naverId',
			},
			googleId: {
				type: DataTypes.STRING(50),
				allowNull: true,
				field: 'googleId',
			},
			facebookId: {
				type: DataTypes.STRING(50),
				allowNull: true,
				field: 'facebookId',
			},
			appleId: {
				type: DataTypes.STRING(50),
				allowNull: true,
				field: 'appleId',
			},
			Field: {
				type: DataTypes.STRING(50),
				allowNull: true,
				field: 'Field',
			},
			bankAccount: {
				type: DataTypes.STRING(50),
				allowNull: true,
				field: 'bankAccount',
			},
			bank: {
				type: DataTypes.STRING(50),
				allowNull: true,
				field: 'bank',
			},
			point: {
				type: DataTypes.STRING(50),
				allowNull: false,
				defaultValue: '0',
				field: 'point',
			},
			nick: {
				type: DataTypes.STRING(50),
				allowNull: true,
				field: 'nick',
			},
			di: {
				type: DataTypes.STRING(64),
				allowNull: true,
				field: 'di',
			},
			gender: {
				type: DataTypes.STRING(50),
				allowNull: true,
				field: 'gender',
			},
			regDate: {
				type: DataTypes.STRING(50),
				allowNull: true,
				field: 'regDate',
			},
			fcmToken: {
				type: DataTypes.STRING(200),
				allowNull: true,
				field: 'fcmToken',
			},
			usedRecommendCode: {
				type: DataTypes.STRING(50),
				allowNull: true,
				field: 'usedRecommendCode',
			},
			recommendCode: {
				type: DataTypes.STRING(50),
				allowNull: true,
				field: 'recommendCode',
			},
			withdrawalDate: {
				type: DataTypes.STRING(50),
				allowNull: false,
				defaultValue: '',
				field: 'withdrawalDate',
			},
			withdrawal: {
				type: DataTypes.STRING(50),
				allowNull: false,
				defaultValue: '',
				field: 'withdrawal',
			},
			mbr_withdrawal_reason_cd: {
				type: DataTypes.STRING(20),
				allowNull: true,
				field: 'mbr_withdrawal_reason_cd',
			},
			mbr_withdrawal_feedback: {
				type: DataTypes.STRING(255),
				allowNull: true,
				field: 'mbr_withdrawal_feedback',
			},
			cus_collect_yn: {
				type: DataTypes.CHAR(1),
				allowNull: false,
				defaultValue: 'N',
				field: 'cus_collect_yn',
			},
			cus_location_yn: {
				type: DataTypes.CHAR(1),
				allowNull: false,
				defaultValue: 'N',
				field: 'cus_location_yn',
			},
			cus_promotion_yn: {
				type: DataTypes.CHAR(1),
				allowNull: false,
				defaultValue: 'N',
				field: 'cus_promotion_yn',
			},
			cus_login_date: {
				type: DataTypes.DATE,
				allowNull: true,
				field: 'cus_login_date',
			},
			cus_logout_date: {
				type: DataTypes.DATE,
				allowNull: true,
				field: 'cus_logout_date',
			},
			cus_status: {
				type: DataTypes.STRING(30),
				allowNull: true,
				defaultValue: 'USED',
				field: 'cus_status',
			},
			isByAdmin: {
				type: DataTypes.INTEGER(11),
				allowNull: true,
				field: 'isByAdmin',
			},
		},
		{
			timestamps: false,
			freezeTableName: true,
		}
	);
};

