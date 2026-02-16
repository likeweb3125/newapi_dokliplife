-- =============================================
-- deposit 테이블에서 depositAmount 컬럼 제거 및 type 컬럼 추가 SQL
-- =============================================
-- 주의: 이 스크립트를 실행하기 전에 백업을 권장합니다.

-- 1. depositAmount 컬럼 제거
ALTER TABLE `deposit` 
DROP COLUMN IF EXISTS `depositAmount`;

-- 2. type 컬럼 추가 (contractEsntlId 뒤에)
ALTER TABLE `deposit` 
ADD COLUMN `type` VARCHAR(50) NULL COMMENT '타입 (RESERVATION: 예약금, DEPOSIT: 보증금)' 
AFTER `contractEsntlId`;

-- 3. type 컬럼에 인덱스 추가
CREATE INDEX IF NOT EXISTS `idx_type` ON `deposit` (`type`);

-- 4. 기존 데이터 마이그레이션 (depositAmount가 있던 경우 DEPOSIT으로 설정)
-- 주의: 이 부분은 기존 데이터가 있는 경우에만 실행
-- UPDATE `deposit`
-- SET `type` = 'DEPOSIT'
-- WHERE `type` IS NULL AND `amount` > 0;

-- =============================================
-- 완료
-- =============================================

