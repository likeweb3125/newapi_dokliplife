-- =============================================
-- gosiwonParking 테이블 컬럼 추가 SQL
-- =============================================

-- autoUse 컬럼 추가
-- 자동차 사용 중인 대수를 저장하는 컬럼
-- 주의: 이미 컬럼이 존재하는 경우 오류가 발생할 수 있습니다.
ALTER TABLE `gosiwonParking` 
ADD COLUMN `autoUse` INT(11) DEFAULT 0 COMMENT '자동차 사용 중인 대수' 
AFTER `autoPrice`;

-- bikeUse 컬럼 추가
-- 오토바이 사용 중인 대수를 저장하는 컬럼
-- 주의: 이미 컬럼이 존재하는 경우 오류가 발생할 수 있습니다.
ALTER TABLE `gosiwonParking` 
ADD COLUMN `bikeUse` INT(11) DEFAULT 0 COMMENT '오토바이 사용 중인 대수' 
AFTER `bikePrice`;

-- =============================================
-- 참고사항
-- =============================================

-- autoUse: 자동차 주차 가능 대수 중 현재 사용 중인 대수
-- bikeUse: 오토바이 주차 가능 대수 중 현재 사용 중인 대수
-- 남아있는 자리수 = auto - autoUse, bike - bikeUse 로 계산할 수 있습니다.
-- 초기값은 0으로 설정됩니다.
