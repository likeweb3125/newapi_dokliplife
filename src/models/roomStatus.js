module.exports = (sequelize, DataTypes) => {
	return sequelize.define(
		'roomStatus',
		{
			esntlId: {
				type: DataTypes.STRING(50),
				allowNull: false,
				primaryKey: true,
				field: 'esntlId',
				comment: '방 상태 고유아이디',
			},
			roomEsntlId: {
				type: DataTypes.STRING(50),
				allowNull: false,
				field: 'roomEsntlId',
				comment: '방 고유아이디',
			},
			status: {
				type: DataTypes.STRING(50),
				allowNull: false,
				field: 'status',
				comment: '방 상태 (BEFORE_SALES: 판매신청전, ON_SALE: 판매중, DEPOSIT_PENDING: 입금대기중, RESERVED: 예약중, IN_USE: 이용중, OVERDUE: 체납상태, CHECKOUT_REQUESTED: 퇴실요청, CHECKOUT_CONFIRMED: 퇴실확정, ROOM_MOVE: 방이동)',
			},
			customerEsntlId: {
				type: DataTypes.STRING(50),
				allowNull: true,
				field: 'customerEsntlId',
				comment: '입실자 고유아이디',
			},
			customerName: {
				type: DataTypes.STRING(100),
				allowNull: true,
				field: 'customerName',
				comment: '입실자 이름',
			},
			contractStartDate: {
				type: DataTypes.DATE,
				allowNull: true,
				field: 'contractStartDate',
				comment: '계약 시작일',
			},
			contractEndDate: {
				type: DataTypes.DATE,
				allowNull: true,
				field: 'contractEndDate',
				comment: '계약 종료일',
			},
			memo: {
				type: DataTypes.TEXT,
				allowNull: true,
				field: 'memo',
				comment: '메모',
			},
			createdAt: {
				type: DataTypes.DATE,
				allowNull: false,
				field: 'createdAt',
				defaultValue: DataTypes.NOW,
				comment: '생성일',
			},
			updatedAt: {
				type: DataTypes.DATE,
				allowNull: false,
				field: 'updatedAt',
				defaultValue: DataTypes.NOW,
				comment: '수정일',
			},
		},
		{
			tableName: 'roomStatus',
			timestamps: true,
			freezeTableName: true,
		}
	);
};

