module.exports = (sequelize, DataTypes) => {
	return sequelize.define(
		'history',
		{
			esntlId: {
				type: DataTypes.STRING(50),
				allowNull: false,
				primaryKey: true,
				field: 'esntlId',
				comment: '히스토리 고유아이디 (HISTORY0000000001 형식)',
			},
			gosiwonEsntlId: {
				type: DataTypes.STRING(50),
				allowNull: true,
				field: 'gosiwonEsntlId',
				comment: '고시원 고유아이디',
			},
			roomEsntlId: {
				type: DataTypes.STRING(50),
				allowNull: true,
				field: 'roomEsntlId',
				comment: '방 고유아이디',
			},
			contractEsntlId: {
				type: DataTypes.STRING(50),
				allowNull: true,
				field: 'contractEsntlId',
				comment: '방계약 고유아이디',
			},
			depositEsntlId: {
				type: DataTypes.STRING(50),
				allowNull: true,
				field: 'depositEsntlId',
				comment: '보증금 고유아이디',
			},
			etcEsntlId: {
				type: DataTypes.STRING(50),
				allowNull: true,
				field: 'etcEsntlId',
				comment: '기타 고유아이디 (그 외의 id 값)',
			},
			content: {
				type: DataTypes.TEXT,
				allowNull: true,
				field: 'content',
				comment: '히스토리 내용',
			},
			category: {
				type: DataTypes.STRING(50),
				allowNull: true,
				field: 'category',
				comment: '히스토리 카테고리 (GOSIWON, ROOM, CONTRACT, DEPOSIT, CUSTOMER, ETC 등)',
			},
			priority: {
				type: DataTypes.STRING(20),
				allowNull: true,
				defaultValue: 'NORMAL',
				field: 'priority',
				comment: '중요도 (LOW, NORMAL, HIGH, URGENT)',
			},
			publicRange: {
				type: DataTypes.TINYINT(1),
				allowNull: true,
				defaultValue: 0,
				field: 'publicRange',
				comment: '공개범위 (0: 비공개, 1: 공개)',
			},
			writerAdminId: {
				type: DataTypes.STRING(50),
				allowNull: true,
				field: 'writerAdminId',
				comment: '작성한 관리자 ID',
			},
			writerCustomerId: {
				type: DataTypes.STRING(50),
				allowNull: true,
				field: 'writerCustomerId',
				comment: '작성한 고객 고유아이디',
			},
			writerType: {
				type: DataTypes.STRING(20),
				allowNull: true,
				field: 'writerType',
				comment: '작성자 타입 (ADMIN, PARTNER)',
			},
			tags: {
				type: DataTypes.STRING(500),
				allowNull: true,
				field: 'tags',
				comment: '태그 (쉼표로 구분)',
			},
			isPinned: {
				type: DataTypes.TINYINT(1),
				allowNull: true,
				defaultValue: 0,
				field: 'isPinned',
				comment: '고정 여부 (0: 일반, 1: 고정)',
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
			tableName: 'history',
			timestamps: true,
			freezeTableName: true,
		}
	);
};
