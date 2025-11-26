module.exports = (sequelize, DataTypes) => {
	return sequelize.define(
		'roomCategory',
		{
			esntlId: {
				type: DataTypes.STRING(50),
				allowNull: false,
				primaryKey: true,
				field: 'esntlId',
				comment: '카테고리 고유아이디',
			},
			gosiwonEsntlId: {
				type: DataTypes.STRING(50),
				allowNull: false,
				field: 'gosiwonEsntlId',
				comment: '고시원 고유아이디',
			},
			name: {
				type: DataTypes.STRING(50),
				allowNull: false,
				field: 'name',
				comment: '카테고리명',
			},
			base_price: {
				type: DataTypes.INTEGER,
				allowNull: false,
				field: 'base_price',
				comment: '정가 (단위: 원)',
			},
			memo: {
				type: DataTypes.TEXT,
				allowNull: true,
				field: 'memo',
				comment: '메모',
			},
			created_at: {
				type: DataTypes.DATE,
				allowNull: true,
				field: 'created_at',
				defaultValue: DataTypes.NOW,
				comment: '생성일시',
			},
		},
		{
			timestamps: false,
			freezeTableName: true,
		}
	);
};


