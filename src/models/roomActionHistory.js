module.exports = (sequelize, DataTypes) => {
	return sequelize.define(
		'roomActionHistory',
		{
			esntlId: {
				type: DataTypes.STRING(50),
				allowNull: false,
				primaryKey: true,
				field: 'esntlId',
				comment: '액션 이력 고유아이디',
			},
			roomEsntlId: {
				type: DataTypes.STRING(50),
				allowNull: false,
				field: 'roomEsntlId',
				comment: '방 고유아이디',
			},
			actionType: {
				type: DataTypes.STRING(50),
				allowNull: false,
				field: 'actionType',
				comment:
					'액션 타입 (RESERVE, PAYMENT, DEPOSIT, REFUND, STATUS_CHANGE, MEMO, FILE_UPLOAD, CHECKIN, CHECKOUT_REQUEST, CHECKOUT_CONFIRM 등)',
			},
			statusFrom: {
				type: DataTypes.STRING(50),
				allowNull: true,
				field: 'statusFrom',
				comment: '변경 전 상태 (상태 변경 시)',
			},
			statusTo: {
				type: DataTypes.STRING(50),
				allowNull: true,
				field: 'statusTo',
				comment: '변경 후 상태 (상태 변경 시)',
			},
			actorAdminId: {
				type: DataTypes.STRING(50),
				allowNull: true,
				field: 'actorAdminId',
				comment: '처리한 관리자 ID',
			},
			actorCustomerId: {
				type: DataTypes.STRING(50),
				allowNull: true,
				field: 'actorCustomerId',
				comment: '처리한 고객 고유아이디',
			},
			amount: {
				type: DataTypes.DECIMAL(12, 2),
				allowNull: true,
				field: 'amount',
				comment: '금액 (결제/보증금/환불 등)',
			},
			currency: {
				type: DataTypes.STRING(10),
				allowNull: true,
				defaultValue: 'KRW',
				field: 'currency',
				comment: '통화 (기본 KRW)',
			},
			paymentMethod: {
				type: DataTypes.STRING(30),
				allowNull: true,
				field: 'paymentMethod',
				comment: '결제수단 (CARD/BANK/CASH 등)',
			},
			reservationId: {
				type: DataTypes.STRING(50),
				allowNull: true,
				field: 'reservationId',
				comment: '예약 식별자(필요 시)',
			},
			memo: {
				type: DataTypes.TEXT,
				allowNull: true,
				field: 'memo',
				comment: '비고/메모',
			},
			metadata: {
				type: DataTypes.TEXT,
				allowNull: true,
				field: 'metadata',
				comment: '추가 정보(JSON 문자열 보관)',
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
			tableName: 'roomActionHistory',
			timestamps: true,
			freezeTableName: true,
		}
	);
};

