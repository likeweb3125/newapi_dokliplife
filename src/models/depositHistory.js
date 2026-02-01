module.exports = (sequelize, DataTypes) => {
	return sequelize.define(
		'depositHistory',
		{
			esntlId: {
				type: DataTypes.STRING(50),
				allowNull: false,
				primaryKey: true,
				field: 'esntlId',
				comment: '이력 고유아이디',
			},
			depositEsntlId: {
				type: DataTypes.STRING(50),
				allowNull: false,
				field: 'depositEsntlId',
				comment: '보증금 고유아이디',
			},
			roomEsntlId: {
				type: DataTypes.STRING(50),
				allowNull: false,
				field: 'roomEsntlId',
				comment: '방 고유아이디',
			},
			contractEsntlId: {
				type: DataTypes.STRING(50),
				allowNull: true,
				field: 'contractEsntlId',
				comment: '방계약 고유아이디',
			},
			type: {
				type: DataTypes.STRING(50),
				allowNull: false,
				field: 'type',
				comment: '타입 (DEPOSIT: 입금, RETURN: 반환)',
			},
			amount: {
				type: DataTypes.INTEGER(11),
				allowNull: false,
				defaultValue: 0,
				field: 'amount',
				comment: '금액',
			},
			status: {
				type: DataTypes.STRING(50),
				allowNull: false,
				field: 'status',
				comment: '상태 (PENDING: 입금대기, PARTIAL_DEPOSIT: 부분입금, DEPOSIT_COMPLETED: 입금완료, RETURN_COMPLETED: 반환완료, DEPOSIT_RE_REQUEST: 입금재요청, VIRTUAL_ACCOUNT_ISSUED: 가상계좌 발급, VIRTUAL_ACCOUNT_EXPIRED: 가상계좌 만료)',
			},
			depositorName: {
				type: DataTypes.STRING(100),
				allowNull: true,
				field: 'depositorName',
				comment: '입금자명',
			},
			deductionAmount: {
				type: DataTypes.INTEGER(11),
				allowNull: true,
				defaultValue: 0,
				field: 'deductionAmount',
				comment: '차감금액 (반환시)',
			},
			refundAmount: {
				type: DataTypes.INTEGER(11),
				allowNull: true,
				defaultValue: 0,
				field: 'refundAmount',
				comment: '반환금액',
			},
			accountBank: {
				type: DataTypes.STRING(50),
				allowNull: true,
				field: 'accountBank',
				comment: '계좌 은행명',
			},
			accountNumber: {
				type: DataTypes.STRING(50),
				allowNull: true,
				field: 'accountNumber',
				comment: '계좌번호',
			},
			accountHolder: {
				type: DataTypes.STRING(100),
				allowNull: true,
				field: 'accountHolder',
				comment: '예금주명',
			},
			manager: {
				type: DataTypes.STRING(100),
				allowNull: true,
				field: 'manager',
				comment: '담당자',
			},
			memo: {
				type: DataTypes.TEXT,
				allowNull: true,
				field: 'memo',
				comment: '메모',
			},
			depositDate: {
				type: DataTypes.DATE,
				allowNull: true,
				field: 'depositDate',
				comment: '입금일시',
			},
			refundDate: {
				type: DataTypes.DATE,
				allowNull: true,
				field: 'refundDate',
				comment: '반환일시',
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
			tableName: 'depositHistory',
			timestamps: true,
			freezeTableName: true,
		}
	);
};

