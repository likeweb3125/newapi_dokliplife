-- il_room_refund_request 테이블에 귀책사유 컬럼 추가
-- rrr_process_reason 바로 아래에 rrr_liability_reason(OWNER, OCCUPANT)을 추가합니다.

ALTER TABLE `il_room_refund_request`
ADD COLUMN `rrr_liability_reason` VARCHAR(50) NULL
	COMMENT '귀책사유 (OWNER: 사장님, OCCUPANT: 입실자)'
	AFTER `rrr_process_reason`;

