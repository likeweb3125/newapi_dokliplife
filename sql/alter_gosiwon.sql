-- =============================================
-- gosiwon 테이블 수정 스크립트 (통합)
-- 적용 순서대로 실행하세요.
-- =============================================

-- ---------------------------------------------
-- 1. is_favorite, use_settlement, settlementReason 등 컬럼 추가
-- ---------------------------------------------
ALTER TABLE `gosiwon` ADD COLUMN `is_favorite` INT(11) NULL DEFAULT NULL COMMENT '즐겨찾기 0/1' AFTER `district`;
CREATE INDEX `idx_gosiwon_is_favorite` ON `gosiwon` (`is_favorite`);

ALTER TABLE `gosiwon` ADD COLUMN `use_deposit` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '보증금 사용 여부' AFTER `is_controlled`;
ALTER TABLE `gosiwon` ADD COLUMN `use_sale_commision` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '할인 수수료 적용 여부' AFTER `use_deposit`;
ALTER TABLE `gosiwon` ADD COLUMN `saleCommisionStartDate` VARCHAR(20) NULL DEFAULT NULL COMMENT '할인수수료 시작일' AFTER `use_sale_commision`;
ALTER TABLE `gosiwon` ADD COLUMN `saleCommisionEndDate` VARCHAR(20) NULL DEFAULT NULL COMMENT '할인수수료 끝나는날' AFTER `saleCommisionStartDate`;
ALTER TABLE `gosiwon` ADD COLUMN `saleCommision` INT(2) NULL DEFAULT NULL COMMENT '할인 수수료 숫자' AFTER `saleCommisionEndDate`;
ALTER TABLE `gosiwon` ADD COLUMN `use_settlement` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '정산 사용유무' AFTER `is_favorite`;
ALTER TABLE `gosiwon` ADD COLUMN `settlementReason` VARCHAR(100) NULL DEFAULT NULL COMMENT '정상사용유무 사유' AFTER `use_settlement`;
ALTER TABLE `gosiwon` ADD COLUMN `penaltyRate` INT(3) NULL COMMENT '위약금 비율' AFTER `settlementReason`;
ALTER TABLE `gosiwon` ADD COLUMN `penaltyMin` INT NULL DEFAULT 0 COMMENT '최소 위약금' AFTER `penaltyRate`;
CREATE INDEX `idx_gosiwon_use_deposit` ON `gosiwon` (`use_deposit`);
CREATE INDEX `idx_gosiwon_use_sale_commision` ON `gosiwon` (`use_sale_commision`);
CREATE INDEX `idx_gosiwon_use_settlement` ON `gosiwon` (`use_settlement`);

-- ---------------------------------------------
-- 2. 인덱스 추가 (고시원 리스트 조회 최적화)
-- ---------------------------------------------
CREATE INDEX IF NOT EXISTS `idx_gosiwon_acceptDate` ON `gosiwon` (`acceptDate`);
CREATE INDEX IF NOT EXISTS `idx_gosiwon_status` ON `gosiwon` (`status`);
CREATE INDEX IF NOT EXISTS `idx_gosiwon_search` ON `gosiwon` (`esntlId`, `name`, `address`, `phone`);
CREATE INDEX IF NOT EXISTS `idx_gosiwon_status_acceptDate` ON `gosiwon` (`status`, `acceptDate`);
CREATE INDEX IF NOT EXISTS `idx_gosiwon_is_controlled` ON `gosiwon` (`is_controlled`);
CREATE INDEX IF NOT EXISTS `idx_gosiwon_commision` ON `gosiwon` (`commision`);
CREATE INDEX IF NOT EXISTS `idx_gosiwon_controlled_acceptDate` ON `gosiwon` (`is_controlled`, `acceptDate`);
CREATE INDEX IF NOT EXISTS `idx_gosiwon_settlement_acceptDate` ON `gosiwon` (`use_settlement`, `acceptDate`);
CREATE INDEX IF NOT EXISTS `idx_gosiwon_commision_acceptDate` ON `gosiwon` (`commision`, `acceptDate`);
