-- =============================================
-- deposit 테이블에서 type 및 기타 컬럼 제거 SQL
-- =============================================
-- 주의: 이 스크립트를 실행하기 전에 백업을 권장합니다.

-- 1. type 컬럼과 관련된 인덱스 삭제
-- 복합 인덱스 삭제
DROP INDEX IF EXISTS `idx_type_amount` ON `deposit`;
DROP INDEX IF EXISTS `idx_deposit_type_status` ON `deposit`;

-- 단일 인덱스 삭제
DROP INDEX IF EXISTS `idx_type` ON `deposit`;

-- 2. 기타 컬럼과 관련된 인덱스 삭제
DROP INDEX IF EXISTS `idx_expectedOccupantPhone` ON `deposit`;
DROP INDEX IF EXISTS `idx_contractStatus` ON `deposit`;
DROP INDEX IF EXISTS `idx_moveInDate` ON `deposit`;
DROP INDEX IF EXISTS `idx_moveOutDate` ON `deposit`;

-- 3. 컬럼 삭제
ALTER TABLE `deposit` 
DROP COLUMN IF EXISTS `type`,
DROP COLUMN IF EXISTS `reservationDepositAmount`,
DROP COLUMN IF EXISTS `expectedOccupantName`,
DROP COLUMN IF EXISTS `expectedOccupantPhone`,
DROP COLUMN IF EXISTS `moveInDate`,
DROP COLUMN IF EXISTS `moveOutDate`,
DROP COLUMN IF EXISTS `contractStatus`;

-- =============================================
-- 완료
-- =============================================

