module.exports = (sequelize, DataTypes) => {
	return sequelize.define(
		'depositDeduction',
		{
			esntlId: {
				type: DataTypes.STRING(50),
				allowNull: false,
				primaryKey: true,
				field: 'esntlId',
				comment: '차감 항목 고유아이디',
			},
			depositHistoryEsntlId: {
				type: DataTypes.STRING(50),
				allowNull: false,
				field: 'depositHistoryEsntlId',
				comment: '입금/반환 이력 고유아이디',
			},
			deductionName: {
				type: DataTypes.STRING(200),
				allowNull: false,
				field: 'deductionName',
				comment: '차감명 (예: 고정청소비, 차감청소비 등)',
			},
			deductionAmount: {
				type: DataTypes.INTEGER(11),
				allowNull: false,
				defaultValue: 0,
				field: 'deductionAmount',
				comment: '차감금액',
			},
			createdAt: {
				type: DataTypes.DATE,
				allowNull: false,
				field: 'createdAt',
				defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
				comment: '생성일',
			},
		},
		{
			tableName: 'depositDeduction',
			timestamps: true,
			freezeTableName: true,
		}
	);
};

