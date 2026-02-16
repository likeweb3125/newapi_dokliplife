-- =============================================
-- gosiwonParking 테이블 수정 스크립트 (통합)
-- =============================================

-- ---------------------------------------------
-- 1. autoUse, bikeUse 컬럼 추가
-- ---------------------------------------------
ALTER TABLE `gosiwonParking` ADD COLUMN `autoUse` INT(11) DEFAULT 0 COMMENT '자동차 사용 중인 대수' AFTER `autoPrice`;
ALTER TABLE `gosiwonParking` ADD COLUMN `bikeUse` INT(11) DEFAULT 0 COMMENT '오토바이 사용 중인 대수' AFTER `bikePrice`;
