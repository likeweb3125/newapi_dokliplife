module.exports = (sequelize, DataTypes) => {
	return sequelize.define(
		'deposit',
		{
			esntlId: {
				type: DataTypes.STRING(50),
				allowNull: false,
				primaryKey: true,
				field: 'esntlId',
				comment: '보증금 고유아이디',
			},
			roomEsntlId: {
				type: DataTypes.STRING(50),
				allowNull: false,
				field: 'roomEsntlId',
				comment: '방 고유아이디',
			},
			gosiwonEsntlId: {
				type: DataTypes.STRING(50),
				allowNull: false,
				field: 'gosiwonEsntlId',
				comment: '고시원 고유아이디',
			},
			customerEsntlId: {
				type: DataTypes.STRING(50),
				allowNull: true,
				field: 'customerEsntlId',
				comment: '예약자/입실자 고유아이디',
			},
			contractorEsntlId: {
				type: DataTypes.STRING(50),
				allowNull: true,
				field: 'contractorEsntlId',
				comment: '계약자 고유아이디',
			},
			contractEsntlId: {
				type: DataTypes.STRING(50),
				allowNull: true,
				field: 'contractEsntlId',
				comment: '방계약 고유아이디',
			},
			type: {
				type: DataTypes.STRING(50),
				allowNull: true,
				field: 'type',
				comment: '타입 (RESERVATION: 예약금, DEPOSIT: 보증금)',
			},
			amount: {
				type: DataTypes.INTEGER(11),
				allowNull: false,
				defaultValue: 0,
				field: 'amount',
				comment: '금액 (예약금 또는 보증금)',
			},
			paidAmount: {
				type: DataTypes.INTEGER(11),
				allowNull: true,
				defaultValue: 0,
				field: 'paidAmount',
				comment: '입금액',
			},
			unpaidAmount: {
				type: DataTypes.INTEGER(11),
				allowNull: true,
				defaultValue: 0,
				field: 'unpaidAmount',
				comment: '미납금액',
			},
			accountBank: {
				type: DataTypes.STRING(50),
				allowNull: true,
				field: 'accountBank',
				comment: '은행명',
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
			status: {
				type: DataTypes.STRING(50),
				allowNull: false,
				defaultValue: 'PENDING',
				field: 'status',
				comment: '입금상태 (PENDING: 입금대기, PARTIAL: 부분입금, COMPLETED: 입금완료, RETURN_COMPLETED: 반환완료, DELETED: 삭제됨)',
			},
			manager: {
				type: DataTypes.STRING(100),
				allowNull: true,
				field: 'manager',
				comment: '담당자',
			},
			depositDate: {
				type: DataTypes.DATE,
				allowNull: true,
				field: 'depositDate',
				comment: '입금일자',
			},
			depositorName: {
				type: DataTypes.STRING(100),
				allowNull: true,
				field: 'depositorName',
				comment: '입금자명',
			},
			depositorPhone: {
				type: DataTypes.STRING(50),
				allowNull: true,
				field: 'depositorPhone',
				comment: '입금자 전화번호',
			},
			virtualAccountNumber: {
				type: DataTypes.STRING(100),
				allowNull: true,
				field: 'virtualAccountNumber',
				comment: '가상계좌번호',
			},
			virtualAccountExpiryDate: {
				type: DataTypes.DATE,
				allowNull: true,
				field: 'virtualAccountExpiryDate',
				comment: '가상계좌 만료일시',
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
			tableName: 'deposit',
			timestamps: true,
			freezeTableName: true,
		}
	);
};

