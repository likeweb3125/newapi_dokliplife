module.exports = (sequelize, DataTypes) => {
	return sequelize.define(
		'parking',
		{
			esntlId: {
				type: DataTypes.STRING(50),
				allowNull: false,
				primaryKey: true,
				field: 'esntlId',
				comment: '주차장 고유아이디',
			},
			gosiwonEsntlId: {
				type: DataTypes.STRING(50),
				allowNull: false,
				field: 'gosiwonEsntlId',
				comment: '고시원 고유아이디',
			},
			structure: {
				type: DataTypes.STRING(255),
				allowNull: true,
				field: 'structure',
				comment: '주차장 구조',
			},
			auto: {
				type: DataTypes.INTEGER(11),
				allowNull: true,
				defaultValue: 0,
				field: 'auto',
				comment: '자동차 주차 가능 대수',
			},
			autoPrice: {
				type: DataTypes.INTEGER(11),
				allowNull: true,
				defaultValue: 0,
				field: 'autoPrice',
				comment: '자동차 한달 주차비',
			},
			autoUse: {
				type: DataTypes.INTEGER(11),
				allowNull: true,
				defaultValue: 0,
				field: 'autoUse',
				comment: '자동차 사용 중인 대수',
			},
			bike: {
				type: DataTypes.INTEGER(11),
				allowNull: true,
				defaultValue: 0,
				field: 'bike',
				comment: '오토바이 주차 가능 대수',
			},
			bikePrice: {
				type: DataTypes.INTEGER(11),
				allowNull: true,
				defaultValue: 0,
				field: 'bikePrice',
				comment: '오토바이 한달 주차비',
			},
			bikeUse: {
				type: DataTypes.INTEGER(11),
				allowNull: true,
				defaultValue: 0,
				field: 'bikeUse',
				comment: '오토바이 사용 중인 대수',
			},
			created_at: {
				type: DataTypes.DATE,
				allowNull: true,
				field: 'created_at',
				defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
				comment: '등록일',
			},
		},
		{
			tableName: 'gosiwonParking',
			timestamps: false,
			freezeTableName: true,
		}
	);
};

