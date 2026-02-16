-- =============================================
-- customer 테이블 수정 스크립트 (통합)
-- =============================================

-- ---------------------------------------------
-- 1. cus_location_yn, cus_promotion_yn 컬럼 및 인덱스
-- ---------------------------------------------
ALTER TABLE `customer` ADD COLUMN `cus_location_yn` CHAR(1) NOT NULL DEFAULT 'N' COMMENT '위치 정보 약관 동의' AFTER `cus_collect_yn`;
ALTER TABLE `customer` ADD COLUMN `cus_promotion_yn` CHAR(1) NOT NULL DEFAULT 'N' COMMENT '프로모션 정보 동의' AFTER `cus_location_yn`;
CREATE INDEX `idx_customer_cus_location_yn` ON `customer` (`cus_location_yn`);
CREATE INDEX `idx_customer_cus_promotion_yn` ON `customer` (`cus_promotion_yn`);
