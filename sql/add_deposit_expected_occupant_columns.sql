-- =============================================
-- deposit 테이블에 입실예정자 이름과 연락처 컬럼 추가
-- =============================================
-- type이 RESERVATION일 때 입실예정자 정보를 저장하기 위한 컬럼

-- 1. expectedOccupantName 컬럼 추가 (입실예정자명)
ALTER TABLE `deposit`
  ADD COLUMN `expectedOccupantName` VARCHAR(100) NULL COMMENT '입실예정자명 (type이 RESERVATION일 때 사용)' 
  AFTER `accountHolder`;

-- 2. expectedOccupantPhone 컬럼 추가 (입실예정자연락처)
ALTER TABLE `deposit`
  ADD COLUMN `expectedOccupantPhone` VARCHAR(50) NULL COMMENT '입실예정자연락처 (type이 RESERVATION일 때 사용)' 
  AFTER `expectedOccupantName`;

-- 3. 인덱스 추가 (검색 성능 향상)
CREATE INDEX `idx_expectedOccupantPhone` ON `deposit` (`expectedOccupantPhone`);

