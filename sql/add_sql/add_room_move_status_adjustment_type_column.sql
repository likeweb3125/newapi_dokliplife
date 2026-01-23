-- =============================================
-- roomMoveStatus 테이블에 adjustmentType 컬럼 추가 SQL
-- =============================================

-- adjustmentType 컬럼 추가
-- 조정타입을 저장하는 컬럼 (ADDITION: 추가, REFUND: 환불, 0일 경우 NULL)
-- 주의: 이미 컬럼이 존재하는 경우 오류가 발생할 수 있습니다.
ALTER TABLE `roomMoveStatus` 
ADD COLUMN `adjustmentType` VARCHAR(50) NULL COMMENT '조정타입 (ADDITION: 추가, REFUND: 환불, adjustmentAmount가 0일 경우 NULL)' 
AFTER `adjustmentAmount`;

-- 기존 데이터 업데이트 (adjustmentAmount가 양수인 경우만 ADDITION으로 설정, 음수는 없어야 하므로 추가 처리 불필요)
-- adjustmentAmount는 양수만 허용하므로, 0보다 큰 값은 ADDITION으로 설정 (기존 데이터가 있다면)
-- 주의: 기존 데이터가 음수로 저장되어 있다면 먼저 수정해야 합니다.
-- UPDATE `roomMoveStatus`
-- SET `adjustmentType` = CASE
--     WHEN `adjustmentAmount` > 0 THEN 'ADDITION'
--     ELSE NULL
-- END
-- WHERE `adjustmentType` IS NULL;

