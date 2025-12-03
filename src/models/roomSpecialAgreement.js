module.exports = (sequelize, DataTypes) => {
	return sequelize.define(
		'roomSpecialAgreement',
		{
			esntlId: {
				type: DataTypes.STRING(50),
				allowNull: false,
				primaryKey: true,
				field: 'esntlId',
				comment: '특약 고유아이디',
			},
			roomEsntlId: {
				type: DataTypes.STRING(50),
				allowNull: false,
				field: 'roomEsntlId',
				comment: '방 고유아이디',
			},
			agreementType: {
				type: DataTypes.STRING(50),
				allowNull: false,
				field: 'agreementType',
				comment: '특약타입 (GENERAL: 독립생활 일반 규정 11항 적용, GOSIWON: 현재 고시원 특약사항 적용, ROOM: 해당 방만 특약사항 수정)',
			},
			agreementContent: {
				type: DataTypes.TEXT,
				allowNull: true,
				field: 'agreementContent',
				comment: '특약내용',
			},
			created_at: {
				type: DataTypes.DATE,
				allowNull: true,
				field: 'created_at',
				defaultValue: DataTypes.NOW,
				comment: '생성시간',
			},
		},
		{
			tableName: 'roomSpecialAgreement',
			timestamps: false,
			freezeTableName: true,
		}
	);
};

