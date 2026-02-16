-- =============================================
-- il_room_refund_request 테이블 수정 스크립트 (통합)
-- =============================================

-- ---------------------------------------------
-- 1. rrr_liability_reason 컬럼 추가 (귀책사유)
-- ---------------------------------------------
ALTER TABLE `il_room_refund_request`
ADD COLUMN `rrr_liability_reason` VARCHAR(50) NULL COMMENT '귀책사유 (OWNER: 사장님, OCCUPANT: 입실자)' AFTER `rrr_process_reason`;
