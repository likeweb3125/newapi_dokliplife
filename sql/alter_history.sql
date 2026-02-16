-- =============================================
-- history 테이블 수정 스크립트 (통합)
-- =============================================

-- ---------------------------------------------
-- 1. deletedBy, deletedAt 컬럼 및 인덱스
-- ---------------------------------------------
ALTER TABLE `history` ADD COLUMN `deletedBy` VARCHAR(50) NULL COMMENT '삭제한 관리자 ID' AFTER `deleteYN`;
ALTER TABLE `history` ADD COLUMN `deletedAt` DATETIME NULL COMMENT '삭제 시간' AFTER `deletedBy`;
CREATE INDEX `idx_history_deletedBy` ON `history` (`deletedBy`);
CREATE INDEX `idx_history_deletedAt` ON `history` (`deletedAt`);
