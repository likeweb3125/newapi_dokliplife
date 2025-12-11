-- =============================================
-- il_gosiwon_config 테이블 체크인/체크아웃 시간 컬럼 추가 SQL
-- =============================================

-- 체크인/체크아웃 시간 컬럼 추가
-- 주의: 이미 컬럼이 존재하는 경우 오류가 발생할 수 있습니다.
ALTER TABLE `il_gosiwon_config`
  ADD COLUMN `gsc_checkInTimeStart` VARCHAR(30) DEFAULT NULL COMMENT '체크인 가능 시작시간 (ex - AM|9|00)',
  ADD COLUMN `gsc_checkInTimeEnd`   VARCHAR(30) DEFAULT NULL COMMENT '체크인 가능 종료시간  (ex - PM|9|00)',
  ADD COLUMN `gsc_checkOutTime`     VARCHAR(30) DEFAULT NULL COMMENT '퇴실시간 (ex - AM|11|00)';

