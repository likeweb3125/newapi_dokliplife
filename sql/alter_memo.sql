-- =============================================
-- memo 테이블 수정 스크립트 (통합)
-- =============================================

-- ---------------------------------------------
-- 1. deletedBy, deletedAt 컬럼 및 인덱스
-- ---------------------------------------------
ALTER TABLE `memo` ADD COLUMN `deletedBy` VARCHAR(50) NULL COMMENT '삭제한 관리자 ID' AFTER `deleteYN`;
ALTER TABLE `memo` ADD COLUMN `deletedAt` DATETIME NULL COMMENT '삭제 시간' AFTER `deletedBy`;
CREATE INDEX `idx_memo_deletedBy` ON `memo` (`deletedBy`);
CREATE INDEX `idx_memo_deletedAt` ON `memo` (`deletedAt`);
