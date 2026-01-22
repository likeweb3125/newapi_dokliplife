-- =============================================
-- extraPayment 테이블에 uniqueId 컬럼 추가 SQL
-- =============================================

-- uniqueId 컬럼 추가 (customerEsntlId 뒤에 추가)
ALTER TABLE `extraPayment` 
ADD COLUMN IF NOT EXISTS `uniqueId` VARCHAR(50) NULL COMMENT '고유 식별자' AFTER `customerEsntlId`;

-- 인덱스 추가 (선택사항)
CREATE INDEX IF NOT EXISTS `idx_extraPayment_uniqueId` ON `extraPayment` (`uniqueId`);
