module.exports = (sequelize, DataTypes) => {
	return sequelize.define(
		'depositRefund',
		{
			esntlId: {
				type: DataTypes.STRING(50),
				allowNull: false,
				primaryKey: true,
				field: 'esntlId',
				comment: '보증금 환불 고유아이디',
			},
			contractEsntlId: {
				type: DataTypes.STRING(50),
				allowNull: false,
				field: 'contractEsntlId',
				comment: '방계약 고유아이디',
			},
			roomEsntlId: {
				type: DataTypes.STRING(50),
				allowNull: true,
				field: 'roomEsntlId',
				comment: '방 고유아이디',
			},
			bank: {
				type: DataTypes.STRING(100),
				allowNull: true,
				field: 'bank',
				comment: '환불 받을 은행명',
			},
			bankAccount: {
				type: DataTypes.STRING(100),
				allowNull: true,
				field: 'bankAccount',
				comment: '환불 받을 계좌번호',
			},
			accountHolder: {
				type: DataTypes.STRING(100),
				allowNull: true,
				field: 'accountHolder',
				comment: '계좌소유자 이름',
			},
			refundItems: {
				type: DataTypes.JSON,
				allowNull: true,
				field: 'refundItems',
				comment: '환불 항목 배열 (JSON 형식)',
			},
			totalDepositAmount: {
				type: DataTypes.INTEGER(11),
				allowNull: false,
				defaultValue: 0,
				field: 'totalDepositAmount',
				comment: '전체 예약금 금액',
			},
			refundAmount: {
				type: DataTypes.INTEGER(11),
				allowNull: false,
				defaultValue: 0,
				field: 'refundAmount',
				comment: '환불 항목 합계 금액',
			},
			remainAmount: {
				type: DataTypes.INTEGER(11),
				allowNull: false,
				defaultValue: 0,
				field: 'remainAmount',
				comment: '최종 환불 금액',
			},
			status: {
				type: DataTypes.STRING(50),
				allowNull: false,
				defaultValue: 'PARTIAL',
				field: 'status',
				comment: '환불 상태 (COMPLETED: 전액환불, PARTIAL: 부분환불)',
			},
			manager: {
				type: DataTypes.STRING(100),
				allowNull: true,
				field: 'manager',
				comment: '작성자 ID',
			},
			deleteYN: {
				type: DataTypes.CHAR(1),
				allowNull: false,
				defaultValue: 'N',
				field: 'deleteYN',
				comment: '삭제여부',
			},
			deletedBy: {
				type: DataTypes.STRING(50),
				allowNull: true,
				field: 'deletedBy',
				comment: '삭제한 관리자 ID',
			},
			deletedAt: {
				type: DataTypes.DATE,
				allowNull: true,
				field: 'deletedAt',
				comment: '삭제 시간',
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
			timestamps: true,
			freezeTableName: true,
		}
	);
};

