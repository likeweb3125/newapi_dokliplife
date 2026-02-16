-- =============================================
-- parkStatus 테이블 수정 스크립트 (통합)
-- 적용 순서대로 실행하세요.
-- =============================================

-- ---------------------------------------------
-- 1. memo 컬럼 추가
-- ---------------------------------------------
ALTER TABLE `parkStatus` ADD COLUMN `memo` VARCHAR(500) NULL COMMENT '메모 (차량번호, 차종 등)' AFTER `useEndDate`;

-- ---------------------------------------------
-- 2. parkType, parkNumber 컬럼 추가 및 memo → parkNumber 마이그레이션
-- ---------------------------------------------
ALTER TABLE `parkStatus` ADD COLUMN `parkType` VARCHAR(50) NULL COMMENT '주차 유형 (자동차, 오토바이)' AFTER `useEndDate`;
ALTER TABLE `parkStatus` ADD COLUMN `parkNumber` VARCHAR(500) NULL COMMENT '번호판' AFTER `parkType`;
UPDATE `parkStatus` SET `parkNumber` = `memo` WHERE `memo` IS NOT NULL AND `memo` != '';
CREATE INDEX `idx_parkStatus_parkType` ON `parkStatus` (`parkType`);
CREATE INDEX `idx_parkStatus_parkNumber` ON `parkStatus` (`parkNumber`);

-- ---------------------------------------------
-- 3. cost 컬럼 추가
-- ---------------------------------------------
ALTER TABLE `parkStatus` ADD COLUMN `cost` INT(11) NULL DEFAULT 0 COMMENT '주차비' AFTER `parkNumber`;
CREATE INDEX `idx_parkStatus_cost` ON `parkStatus` (`cost`);

-- ---------------------------------------------
-- 4. deletedBy, deletedAt 컬럼 및 인덱스
-- ---------------------------------------------
ALTER TABLE `parkStatus` ADD COLUMN `deletedBy` VARCHAR(50) NULL COMMENT '삭제한 관리자 ID' AFTER `deleteYN`;
ALTER TABLE `parkStatus` ADD COLUMN `deletedAt` DATETIME NULL COMMENT '삭제 시간' AFTER `deletedBy`;
CREATE INDEX `idx_parkStatus_deletedBy` ON `parkStatus` (`deletedBy`);
CREATE INDEX `idx_parkStatus_deletedAt` ON `parkStatus` (`deletedAt`);
