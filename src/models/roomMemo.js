module.exports = (sequelize, DataTypes) => {
	return sequelize.define(
		'roomMemo',
		{
			esntlId: {
				type: DataTypes.STRING(50),
				allowNull: false,
				primaryKey: true,
				field: 'esntlId',
				comment: '방 메모 고유아이디',
			},
			roomEsntlId: {
				type: DataTypes.STRING(50),
				allowNull: false,
				field: 'roomEsntlId',
				comment: '방 고유아이디',
			},
			memo: {
				type: DataTypes.TEXT,
				allowNull: true,
				field: 'memo',
				comment: '메모내용',
			},
			publicRange: {
				type: DataTypes.TINYINT(1),
				allowNull: true,
				defaultValue: 0,
				field: 'publicRange',
				comment: '공개범위 (0: 비공개, 1: 공개)',
			},
			created_at: {
				type: DataTypes.DATE,
				allowNull: true,
				field: 'created_at',
				defaultValue: DataTypes.NOW,
				comment: '메모 생성일',
			},
		},
		{
			tableName: 'roomMemo',
			timestamps: false,
			freezeTableName: true,
		}
	);
};

