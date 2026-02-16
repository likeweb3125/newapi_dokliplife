-- =============================================
-- parkStatus 테이블에 parkType, parkNumber 컬럼 추가 SQL
-- =============================================

-- parkType 컬럼 추가 (자동차, 오토바이)
-- 주의: 이미 컬럼이 존재하는 경우 오류가 발생할 수 있습니다.
ALTER TABLE `parkStatus` 
ADD COLUMN `parkType` VARCHAR(50) NULL COMMENT '주차 유형 (자동차, 오토바이)' 
AFTER `useEndDate`;

-- parkNumber 컬럼 추가 (번호판)
-- 주의: 이미 컬럼이 존재하는 경우 오류가 발생할 수 있습니다.
ALTER TABLE `parkStatus` 
ADD COLUMN `parkNumber` VARCHAR(500) NULL COMMENT '번호판 (기존 memo에서 마이그레이션)' 
AFTER `parkType`;

-- 기존 memo 데이터를 parkNumber로 마이그레이션
-- memo에 값이 있는 경우 parkNumber로 복사
UPDATE `parkStatus` 
SET `parkNumber` = `memo` 
WHERE `memo` IS NOT NULL AND `memo` != '';

-- parkType 인덱스 추가 (성능 최적화)
-- 주의: 이미 인덱스가 존재하는 경우 오류가 발생할 수 있습니다.
CREATE INDEX `idx_parkStatus_parkType` ON `parkStatus` (`parkType`);

-- parkNumber 인덱스 추가 (성능 최적화)
-- 주의: 이미 인덱스가 존재하는 경우 오류가 발생할 수 있습니다.
CREATE INDEX `idx_parkStatus_parkNumber` ON `parkStatus` (`parkNumber`);

-- =============================================
-- 참고사항
-- =============================================

-- parkType: 주차 유형을 구분합니다.
--   - '자동차': 자동차 주차
--   - '오토바이': 오토바이 주차
--
-- parkNumber: 차량 번호판을 저장합니다.
--   - 기존 memo 컬럼의 값이 parkNumber로 마이그레이션됩니다.
--   - 예) "12가3456", "서울12가3456" 등
--
-- memo 컬럼은 기존 호환성을 위해 유지되지만, 
-- 새로운 데이터는 parkType과 parkNumber를 사용하도록 변경되었습니다.
