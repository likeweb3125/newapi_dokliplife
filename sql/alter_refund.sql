-- =============================================
-- refund 테이블 수정 스크립트 (통합)
-- =============================================

-- ---------------------------------------------
-- 1. deletedBy, deletedAt 컬럼 및 인덱스
-- ---------------------------------------------
ALTER TABLE `refund` ADD COLUMN `deletedBy` VARCHAR(50) NULL COMMENT '삭제한 관리자 ID' AFTER `deleteYN`;
ALTER TABLE `refund` ADD COLUMN `deletedAt` DATETIME NULL COMMENT '삭제 시간' AFTER `deletedBy`;
CREATE INDEX `idx_refund_deletedBy` ON `refund` (`deletedBy`);
CREATE INDEX `idx_refund_deletedAt` ON `refund` (`deletedAt`);
