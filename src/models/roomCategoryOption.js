module.exports = (sequelize, DataTypes) => {
	return sequelize.define(
		'roomCategoryOption',
		{
			esntlId: {
				type: DataTypes.STRING(50),
				allowNull: false,
				primaryKey: true,
				field: 'esntlId',
				comment: '옵션 고유아이디',
			},
			categoryEsntlId: {
				type: DataTypes.STRING(50),
				allowNull: false,
				field: 'categoryEsntlId',
				comment: '카테고리 고유아이디',
			},
			option_name: {
				type: DataTypes.STRING(50),
				allowNull: false,
				field: 'option_name',
				comment: '옵션명',
			},
			option_amount: {
				type: DataTypes.DECIMAL(10, 1),
				allowNull: false,
				field: 'option_amount',
				comment: '옵션 금액 (단위: 만원)',
			},
			sort_order: {
				type: DataTypes.INTEGER,
				allowNull: false,
				defaultValue: 0,
				field: 'sort_order',
				comment: '정렬순서',
			},
			created_at: {
				type: DataTypes.DATE,
				allowNull: true,
				field: 'created_at',
				defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
				comment: '생성일시',
			},
		},
		{
			timestamps: false,
			freezeTableName: true,
		}
	);
};


