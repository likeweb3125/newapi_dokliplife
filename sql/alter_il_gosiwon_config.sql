-- =============================================
-- il_gosiwon_config 테이블 수정 스크립트 (통합)
-- 적용 순서대로 실행하세요.
-- =============================================

-- ---------------------------------------------
-- 1. 체크인/체크아웃 시간 사용 여부 컬럼
-- ---------------------------------------------
ALTER TABLE `il_gosiwon_config`
  ADD COLUMN `gsc_use_checkInTime` TINYINT(1) DEFAULT 0 COMMENT '체크인 시간 사용 여부 (0: 미사용, 1: 사용)';
ALTER TABLE `il_gosiwon_config`
  ADD COLUMN `gsc_use_checkOutTime` TINYINT(1) DEFAULT 0 COMMENT '체크아웃 시간 사용 여부 (0: 미사용, 1: 사용)';

-- ---------------------------------------------
-- 2. 체크인/체크아웃 시간 및 입실·판매 기간 컬럼
-- ---------------------------------------------
ALTER TABLE `il_gosiwon_config`
  ADD COLUMN `gsc_checkInTimeStart` VARCHAR(30) DEFAULT NULL COMMENT '체크인 가능 시작시간 (ex - AM|9|00)',
  ADD COLUMN `gsc_checkInTimeEnd`   VARCHAR(30) DEFAULT NULL COMMENT '체크인 가능 종료시간  (ex - PM|9|00)',
  ADD COLUMN `gsc_checkOutTime`     VARCHAR(30) DEFAULT NULL COMMENT '퇴실시간 (ex - AM|11|00)';

ALTER TABLE `il_gosiwon_config`
  ADD COLUMN `gsc_checkin_able_date` INT(3) DEFAULT 0 COMMENT '입실 가능 시작일 (퇴실 후+설정일 부터)';

ALTER TABLE `il_gosiwon_config`
  ADD COLUMN `gsc_sell_able_period` INT(3) DEFAULT 0 COMMENT '판매가능기간 (입실가능일 + 설정일)';
