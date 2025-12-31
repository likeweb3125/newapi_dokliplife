-- =============================================
-- deposit 테이블에 입금 관련 컬럼 추가 SQL
-- =============================================
-- 주의: 이미 컬럼이 존재하는 경우 오류가 발생할 수 있습니다.

-- 1. 입금액 컬럼 추가 (depositAmount 아래)
ALTER TABLE `deposit` 
ADD COLUMN `paidAmount` INT(11) NULL DEFAULT 0 COMMENT '입금액' 
AFTER `depositAmount`;

-- 2. 미납금액 컬럼 추가 (paidAmount 아래)
ALTER TABLE `deposit` 
ADD COLUMN `unpaidAmount` INT(11) NULL DEFAULT 0 COMMENT '미납금액' 
AFTER `paidAmount`;

-- 3. 입금일자 컬럼 추가
ALTER TABLE `deposit` 
ADD COLUMN `depositDate` DATETIME NULL COMMENT '입금일자' 
AFTER `status`;

-- 4. 입금자명 컬럼 추가
ALTER TABLE `deposit` 
ADD COLUMN `depositorName` VARCHAR(100) NULL COMMENT '입금자명' 
AFTER `depositDate`;

-- 5. 인덱스 추가 (성능 최적화)
CREATE INDEX `idx_depositDate` ON `deposit` (`depositDate`);
CREATE INDEX `idx_depositorName` ON `deposit` (`depositorName`);

-- =============================================
-- 완료
-- =============================================

