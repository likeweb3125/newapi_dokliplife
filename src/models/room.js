module.exports = (sequelize, DataTypes) => {
	return sequelize.define(
		'room',
		{
			esntlId: {
				type: DataTypes.STRING(50),
				allowNull: false,
				primaryKey: true,
				field: 'esntlId',
				comment: '고유아이디',
			},
			gosiwonEsntlId: {
				type: DataTypes.STRING(50),
				allowNull: false,
				field: 'gosiwonEsntlId',
				comment: '고시원고유아이디',
			},
			roomType: {
				type: DataTypes.STRING(255),
				allowNull: true,
				comment: '방타입',
			},
			roomCategory: {
				type: DataTypes.STRING(50),
				allowNull: true,
				comment: '방 카테고리',
			},
			useRoomRentFee: {
				type: DataTypes.CHAR(1),
				allowNull: true,
				defaultValue: null,
				field: 'useRoomRentFee',
				comment: '방 월비용 사용 YN',
			},
			deposit: {
				type: DataTypes.INTEGER(11),
				allowNull: true,
				comment: '보증금',
			},
			monthlyRent: {
				type: DataTypes.STRING(255),
				allowNull: true,
				comment: '입실료',
			},
			startDate: {
				type: DataTypes.STRING(255),
				allowNull: true,
				comment: '입실일',
			},
			endDate: {
				type: DataTypes.STRING(255),
				allowNull: true,
				comment: '퇴실일',
			},
			rom_checkout_expected_date: {
				type: DataTypes.STRING(255),
				allowNull: true,
				comment: '예정 퇴실일',
			},
			window: {
				type: DataTypes.STRING(255),
				allowNull: true,
				comment: '창타입',
			},
			option: {
				type: DataTypes.STRING(255),
				allowNull: true,
				comment: '방옵션',
			},
			orderOption: {
				type: DataTypes.STRING(50),
				allowNull: true,
			},
			roomNumber: {
				type: DataTypes.STRING(255),
				allowNull: true,
				comment: '방번호(이름)',
			},
			floor: {
				type: DataTypes.STRING(255),
				allowNull: true,
			},
			intro: {
				type: DataTypes.STRING(255),
				allowNull: true,
			},
			empty: {
				type: DataTypes.STRING(50),
				allowNull: false,
				defaultValue: '1',
			},
			status: {
				type: DataTypes.STRING(50),
				allowNull: false,
				defaultValue: 'EMPTY',
				comment: '방상태',
			},
			month: {
				type: DataTypes.STRING(50),
				allowNull: true,
			},
			description: {
				type: DataTypes.STRING(1000),
				allowNull: true,
				comment: '방설명',
			},
			top: {
				type: DataTypes.STRING(50),
				allowNull: true,
			},
			youtube: {
				type: DataTypes.STRING(300),
				allowNull: true,
				comment: 'VR룸투어',
			},
			customerEsntlId: {
				type: DataTypes.STRING(14),
				allowNull: true,
				field: 'customerEsntlId',
				comment: '입실자아이디',
			},
			rom_successor_eid: {
				type: DataTypes.STRING(14),
				allowNull: true,
				field: 'rom_successor_eid',
				comment: '승계방고유아이디',
			},
			rom_dp_at: {
				type: DataTypes.CHAR(1),
				allowNull: true,
				defaultValue: 'N',
				field: 'rom_dp_at',
				comment: 'DP방 여부',
			},
			deleteYN: {
				type: DataTypes.CHAR(1),
				allowNull: false,
				defaultValue: 'N',
				field: 'deleteYN',
				comment: '삭제여부',
			},
			orderNo: {
				type: DataTypes.INTEGER(11),
				allowNull: true,
				defaultValue: 1,
				field: 'orderNo',
				comment: '정렬순서',
			},
			rdp_eid: {
				type: DataTypes.STRING(14),
				allowNull: true,
				field: 'rdp_eid',
				comment: '예약금(보증금)아이디',
			},
			org_rom_eid: {
				type: DataTypes.STRING(14),
				allowNull: true,
				field: 'org_rom_eid',
				comment: '이전방고유아이디',
			},
			agreementType: {
				type: DataTypes.STRING(50),
				allowNull: true,
				defaultValue: 'GENERAL',
				field: 'agreementType',
				comment: '특약타입 (GENERAL: 독립생활 일반 규정 11항 적용, GOSIWON: 현재 고시원 특약사항 적용, ROOM: 해당 방만 특약사항 수정)',
			},
			agreementContent: {
				type: DataTypes.TEXT,
				allowNull: true,
				field: 'agreementContent',
				comment: '특약내용',
			},
			availableGender: {
				type: DataTypes.STRING(50),
				allowNull: true,
				defaultValue: 'DEFAULT',
				field: 'availableGender',
				comment: '이용 가능 성별 (DEFAULT: 제한없음, MALE: 남성, FEMALE: 여성)',
			},
		},
		{
			timestamps: false,
			freezeTableName: true,
		}
	);
};

