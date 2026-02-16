-- =============================================
-- il_room_deposit_history 에 unpaidAmount(미납액) 컬럼 추가
-- DEPOSIT type 입력 시 계약 보증금 - 그동안 입금 합계 로 저장
-- ※ 이미 create_il_room_deposit_history_table.sql 로 테이블을 만들었다면
--   unpaidAmount 는 포함되어 있으므로 이 스크립트는 생략 가능
-- ※ 기존 테이블에 컬럼이 없을 때만 실행 (컬럼이 있으면 ALTER 실패)
-- =============================================

SET NAMES utf8mb3 COLLATE utf8mb3_general_ci;

ALTER TABLE `il_room_deposit_history`
  ADD COLUMN `unpaidAmount` INT(11) NULL DEFAULT 0 COMMENT '미납액 (계약 보증금 - 그동안 입금 합계, DEPOSIT 입력 시)' AFTER `status`;
