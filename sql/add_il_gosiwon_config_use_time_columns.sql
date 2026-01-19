-- =============================================
-- il_gosiwon_config 테이블 체크인/체크아웃 시간 사용 여부 컬럼 추가 SQL
-- =============================================

-- 체크인 시간 사용 여부 컬럼 추가
-- true/false로 체크인 시간 설정 사용 여부를 저장
-- 주의: 이미 컬럼이 존재하는 경우 오류가 발생할 수 있습니다.
ALTER TABLE `il_gosiwon_config`
  ADD COLUMN `gsc_use_checkInTime` TINYINT(1) DEFAULT 0 COMMENT '체크인 시간 사용 여부 (0: 미사용, 1: 사용)';

-- 체크아웃 시간 사용 여부 컬럼 추가
-- true/false로 체크아웃 시간 설정 사용 여부를 저장
-- 주의: 이미 컬럼이 존재하는 경우 오류가 발생할 수 있습니다.
ALTER TABLE `il_gosiwon_config`
  ADD COLUMN `gsc_use_checkOutTime` TINYINT(1) DEFAULT 0 COMMENT '체크아웃 시간 사용 여부 (0: 미사용, 1: 사용)';

-- =============================================
-- 참고사항
-- =============================================
-- gsc_use_checkInTime: 체크인 시간 설정(gsc_checkInTimeStart, gsc_checkInTimeEnd) 사용 여부
-- gsc_use_checkOutTime: 체크아웃 시간 설정(gsc_checkOutTime) 사용 여부
-- 기본값은 0(false)으로 설정됩니다.
