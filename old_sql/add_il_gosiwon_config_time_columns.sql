-- =============================================
-- il_gosiwon_config 테이블 체크인/체크아웃 시간 컬럼 추가 SQL
-- =============================================

-- 체크인/체크아웃 시간 컬럼 추가
-- 주의: 이미 컬럼이 존재하는 경우 오류가 발생할 수 있습니다.
ALTER TABLE `il_gosiwon_config`
  ADD COLUMN `gsc_checkInTimeStart` VARCHAR(30) DEFAULT NULL COMMENT '체크인 가능 시작시간 (ex - AM|9|00)',
  ADD COLUMN `gsc_checkInTimeEnd`   VARCHAR(30) DEFAULT NULL COMMENT '체크인 가능 종료시간  (ex - PM|9|00)',
  ADD COLUMN `gsc_checkOutTime`     VARCHAR(30) DEFAULT NULL COMMENT '퇴실시간 (ex - AM|11|00)';

-- =============================================
-- il_gosiwon_config 테이블 입실/판매 가능 기간 컬럼 추가 SQL
-- =============================================

-- 입실 가능 시작일 컬럼 추가
-- 퇴실 후 설정일 수를 더한 날짜부터 입실 가능
-- 주의: 이미 컬럼이 존재하는 경우 오류가 발생할 수 있습니다.
ALTER TABLE `il_gosiwon_config`
  ADD COLUMN `gsc_checkin_able_date` INT(3) DEFAULT 0 COMMENT '입실 가능 시작일 (퇴실 후+설정일 부터)';

-- 판매 가능 기간 컬럼 추가
-- 입실 가능일로부터 설정일 수를 더한 기간 동안 판매 가능
-- 주의: 이미 컬럼이 존재하는 경우 오류가 발생할 수 있습니다.
ALTER TABLE `il_gosiwon_config`
  ADD COLUMN `gsc_sell_able_period` INT(3) DEFAULT 0 COMMENT '판매가능기간 (입실가능일 + 설정일)';

