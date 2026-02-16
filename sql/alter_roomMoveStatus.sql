-- =============================================
-- roomMoveStatus 테이블 수정 스크립트 (통합)
-- 적용 순서대로 실행하세요.
-- =============================================

-- ---------------------------------------------
-- 1. adjustmentType 컬럼 추가
-- ---------------------------------------------
ALTER TABLE `roomMoveStatus` ADD COLUMN `adjustmentType` VARCHAR(50) NULL COMMENT '조정타입 (ADDITION: 추가, REFUND: 환불)' AFTER `adjustmentAmount`;

-- ---------------------------------------------
-- 2. adjustmentStatus 컬럼 추가
-- ---------------------------------------------
ALTER TABLE `roomMoveStatus` ADD COLUMN `adjustmentStatus` VARCHAR(50) NULL DEFAULT NULL COMMENT '조정 처리 상태 (PENDING, COMPLETED, CANCELLED, NULL)' AFTER `adjustmentType`;
-- UPDATE `roomMoveStatus` SET `adjustmentStatus` = 'PENDING' WHERE `adjustmentAmount` != 0 AND `adjustmentStatus` IS NULL;

-- ---------------------------------------------
-- 3. deletedBy, deletedAt 컬럼 및 인덱스
-- ---------------------------------------------
ALTER TABLE `roomMoveStatus` ADD COLUMN `deletedBy` VARCHAR(50) NULL COMMENT '삭제한 관리자 ID' AFTER `deleteYN`;
ALTER TABLE `roomMoveStatus` ADD COLUMN `deletedAt` DATETIME NULL COMMENT '삭제 시간' AFTER `deletedBy`;
CREATE INDEX `idx_roomMoveStatus_deletedBy` ON `roomMoveStatus` (`deletedBy`);
CREATE INDEX `idx_roomMoveStatus_deletedAt` ON `roomMoveStatus` (`deletedAt`);
