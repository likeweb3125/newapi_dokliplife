/**
 * il_room_deposit 테이블 (실제 DB 스키마 기준)
 * - rdp_eid (PK), gsw_eid, rom_eid, rdp_customer_name, rdp_customer_phone, rdp_price,
 *   rdp_check_in_date, rdp_completed_dtm, rdp_return_dtm, rdp_regist_dtm, rdp_registrant_id,
 *   rdp_update_dtm, rdp_updater_id, rdp_delete_dtm, rdp_deleter_id
 * - status 없음: rdp_completed_dtm IS NULL → PENDING, NOT NULL → COMPLETED
 * - deleteYN 없음: rdp_delete_dtm IS NULL → 미삭제
 */
module.exports = (sequelize, DataTypes) => {
	return sequelize.define(
		'ilRoomDeposit',
		{
			esntlId: {
				type: DataTypes.STRING(14),
				allowNull: false,
				primaryKey: true,
				field: 'rdp_eid',
				comment: '보증금 고유아이디',
			},
			roomEsntlId: {
				type: DataTypes.STRING(14),
				allowNull: true,
				field: 'rom_eid',
				comment: '방 고유아이디',
			},
			gosiwonEsntlId: {
				type: DataTypes.STRING(14),
				allowNull: true,
				field: 'gsw_eid',
				comment: '고시원 고유아이디',
			},
			customerName: {
				type: DataTypes.STRING(50),
				allowNull: true,
				field: 'rdp_customer_name',
				comment: '입금자/고객명',
			},
			customerPhone: {
				type: DataTypes.STRING(50),
				allowNull: true,
				field: 'rdp_customer_phone',
				comment: '입금자/고객 연락처',
			},
			amount: {
				type: DataTypes.INTEGER(11),
				allowNull: true,
				field: 'rdp_price',
				comment: '금액(보증금)',
			},
			checkInDate: {
				type: DataTypes.DATEONLY,
				allowNull: true,
				field: 'rdp_check_in_date',
				comment: '입실예정일',
			},
			completedDtm: {
				type: DataTypes.DATE,
				allowNull: true,
				field: 'rdp_completed_dtm',
				comment: '입금완료일시 (NULL=미완료=PENDING, NOT NULL=COMPLETED)',
			},
			returnDtm: {
				type: DataTypes.DATE,
				allowNull: true,
				field: 'rdp_return_dtm',
				comment: '반환일시',
			},
			registDtm: {
				type: DataTypes.DATE,
				allowNull: false,
				field: 'rdp_regist_dtm',
				defaultValue: DataTypes.NOW,
				comment: '등록일시',
			},
			registrantId: {
				type: DataTypes.STRING(14),
				allowNull: false,
				field: 'rdp_registrant_id',
				comment: '등록자ID',
			},
			updateDtm: {
				type: DataTypes.DATE,
				allowNull: false,
				field: 'rdp_update_dtm',
				defaultValue: DataTypes.NOW,
				comment: '수정일시',
			},
			updaterId: {
				type: DataTypes.STRING(14),
				allowNull: false,
				field: 'rdp_updater_id',
				comment: '수정자ID',
			},
			deleteDtm: {
				type: DataTypes.DATE,
				allowNull: true,
				field: 'rdp_delete_dtm',
				comment: '삭제일시 (NULL=미삭제)',
			},
			deleterId: {
				type: DataTypes.STRING(14),
				allowNull: true,
				field: 'rdp_deleter_id',
				comment: '삭제자ID',
			},
		},
		{
			tableName: 'il_room_deposit',
			timestamps: false,
			freezeTableName: true,
		}
	);
};
