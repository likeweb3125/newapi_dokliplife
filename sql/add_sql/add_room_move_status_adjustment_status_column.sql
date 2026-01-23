-- =============================================
-- roomMoveStatus 테이블에 adjustmentStatus 컬럼 추가 SQL
-- =============================================

-- adjustmentStatus 컬럼 추가
-- 조정 처리 상태를 저장하는 컬럼 (PENDING: 대기, COMPLETED: 완료, CANCELLED: 취소, NULL: 해당없음)
-- 주의: 이미 컬럼이 존재하는 경우 오류가 발생할 수 있습니다.
ALTER TABLE `roomMoveStatus` 
ADD COLUMN `adjustmentStatus` VARCHAR(50) NULL DEFAULT NULL COMMENT '조정 처리 상태 (PENDING: 대기, COMPLETED: 완료, CANCELLED: 취소, NULL: 해당없음)' 
AFTER `adjustmentType`;

-- 기존 데이터 업데이트 (adjustmentAmount가 0이 아닌 경우 PENDING으로 설정)
UPDATE `roomMoveStatus`
SET `adjustmentStatus` = 'PENDING'
WHERE `adjustmentAmount` != 0 AND `adjustmentStatus` IS NULL;

