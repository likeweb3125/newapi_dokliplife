module.exports = (sequelize, DataTypes) => {
	return sequelize.define(
		'parkStatus',
		{
			esntlId: {
				type: DataTypes.STRING(50),
				allowNull: false,
				primaryKey: true,
				field: 'esntlId',
				comment: '주차 상태 고유아이디 (PKST0000000001 형식)',
			},
			gosiwonEsntlId: {
				type: DataTypes.STRING(50),
				allowNull: false,
				field: 'gosiwonEsntlId',
				comment: '고시원 고유아이디',
			},
			contractEsntlId: {
				type: DataTypes.STRING(50),
				allowNull: true,
				field: 'contractEsntlId',
				comment: '방계약 고유아이디',
			},
			customerEsntlId: {
				type: DataTypes.STRING(50),
				allowNull: true,
				field: 'customerEsntlId',
				comment: '고객 고유아이디',
			},
			status: {
				type: DataTypes.STRING(50),
				allowNull: false,
				defaultValue: 'AVAILABLE',
				field: 'status',
				comment: '주차 상태 (AVAILABLE: 사용가능, CONTRACT: 사용중, RESERVED: 예약됨, EXPIRED: 만료됨)',
			},
			useStartDate: {
				type: DataTypes.DATEONLY,
				allowNull: true,
				field: 'useStartDate',
				comment: '사용 시작일',
			},
			useEndDate: {
				type: DataTypes.DATEONLY,
				allowNull: true,
				field: 'useEndDate',
				comment: '사용 종료일',
			},
			parkType: {
				type: DataTypes.STRING(50),
				allowNull: true,
				field: 'parkType',
				comment: '주차 유형 (자동차, 오토바이)',
			},
			parkNumber: {
				type: DataTypes.STRING(500),
				allowNull: true,
				field: 'parkNumber',
				comment: '번호판',
			},
			cost: {
				type: DataTypes.INTEGER(11),
				allowNull: true,
				defaultValue: 0,
				field: 'cost',
				comment: '주차비',
			},
			memo: {
				type: DataTypes.STRING(500),
				allowNull: true,
				field: 'memo',
				comment: '메모 (차량번호, 차종 등)',
			},
			deleteYN: {
				type: DataTypes.CHAR(1),
				allowNull: false,
				defaultValue: 'N',
				field: 'deleteYN',
				comment: '삭제여부',
			},
			createdAt: {
				type: DataTypes.DATE,
				allowNull: false,
				field: 'createdAt',
				defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
				comment: '생성일',
			},
			updatedAt: {
				type: DataTypes.DATE,
				allowNull: false,
				field: 'updatedAt',
				defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
				comment: '수정일',
			},
		},
		{
			tableName: 'parkStatus',
			timestamps: true,
			freezeTableName: true,
		}
	);
};
