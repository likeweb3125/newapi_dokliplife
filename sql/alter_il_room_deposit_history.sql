-- =============================================
-- il_room_deposit_history 테이블 수정 스크립트 (통합)
-- 적용 순서대로 실행하세요.
-- =============================================

SET NAMES utf8mb3 COLLATE utf8mb3_general_ci;

-- ---------------------------------------------
-- 1. unpaidAmount 컬럼 추가
-- ---------------------------------------------
ALTER TABLE `il_room_deposit_history`
  ADD COLUMN `unpaidAmount` INT(11) NULL DEFAULT 0 COMMENT '미납액 (계약 보증금 - 그동안 입금 합계, DEPOSIT 입력 시)' AFTER `status`;

-- ---------------------------------------------
-- 2. contractEsntlId 컬럼 및 인덱스 추가
-- ---------------------------------------------
ALTER TABLE `il_room_deposit_history`
  ADD COLUMN `contractEsntlId` VARCHAR(50) NULL COMMENT '방계약 고유아이디 (계약서 기준 조회용)' AFTER `roomEsntlId`;
CREATE INDEX `idx_contractEsntlId` ON `il_room_deposit_history` (`contractEsntlId`);
