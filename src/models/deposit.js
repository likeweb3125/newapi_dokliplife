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
				allowNull: false,
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
			reservationDepositAmount: {
				type: DataTypes.INTEGER(11),
				allowNull: true,
				defaultValue: 0,
				field: 'reservationDepositAmount',
				comment: '예약금 금액 (하위 호환성, 사용 중단 예정)',
			},
			depositAmount: {
				type: DataTypes.INTEGER(11),
				allowNull: true,
				defaultValue: 0,
				field: 'depositAmount',
				comment: '보증금 금액 (하위 호환성, 사용 중단 예정)',
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
			moveInDate: {
				type: DataTypes.DATEONLY,
				allowNull: true,
				field: 'moveInDate',
				comment: '입실일',
			},
			moveOutDate: {
				type: DataTypes.DATEONLY,
				allowNull: true,
				field: 'moveOutDate',
				comment: '퇴실일',
			},
			contractStatus: {
				type: DataTypes.STRING(50),
				allowNull: true,
				field: 'contractStatus',
				comment: '계약상태 (이용중, 결제대기중, 체납상대, 퇴실확정 등)',
			},
			status: {
				type: DataTypes.STRING(50),
				allowNull: false,
				defaultValue: 'DEPOSIT_PENDING',
				field: 'status',
				comment: '입금상태 (DEPOSIT_PENDING: 입금대기, PARTIAL_DEPOSIT: 부분입금, DEPOSIT_COMPLETED: 입금완료, RETURN_COMPLETED: 반환완료, DELETED: 삭제됨)',
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
			tableName: 'deposit',
			timestamps: true,
			freezeTableName: true,
		}
	);
};

