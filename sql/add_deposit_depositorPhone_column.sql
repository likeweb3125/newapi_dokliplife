-- =============================================
-- deposit 테이블에 depositorPhone 컬럼 추가 SQL
-- =============================================
-- 입금자 전화번호를 저장하는 컬럼
-- 주의: 이미 컬럼이 존재하는 경우 오류가 발생할 수 있습니다.

-- depositorPhone 컬럼 추가 (depositorName 컬럼 아래)
ALTER TABLE `deposit` 
ADD COLUMN `depositorPhone` VARCHAR(50) NULL COMMENT '입금자 전화번호' 
AFTER `depositorName`;

-- 인덱스 추가 (성능 최적화)
CREATE INDEX `idx_depositorPhone` ON `deposit` (`depositorPhone`);

-- =============================================
-- 완료
-- =============================================

