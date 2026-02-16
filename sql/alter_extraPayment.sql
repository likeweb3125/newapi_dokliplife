-- =============================================
-- extraPayment 테이블 수정 스크립트 (통합)
-- =============================================

-- ---------------------------------------------
-- 1. uniqueId 컬럼 및 인덱스
-- ---------------------------------------------
ALTER TABLE `extraPayment` ADD COLUMN IF NOT EXISTS `uniqueId` VARCHAR(50) NULL COMMENT '고유 식별자' AFTER `customerEsntlId`;
CREATE INDEX IF NOT EXISTS `idx_extraPayment_uniqueId` ON `extraPayment` (`uniqueId`);

-- ---------------------------------------------
-- 2. paymentStatus 컬럼 및 인덱스
-- ---------------------------------------------
ALTER TABLE `extraPayment` ADD COLUMN IF NOT EXISTS `paymentStatus` VARCHAR(50) NOT NULL DEFAULT 'PENDING' COMMENT '결제 상태 (PENDING, COMPLETED, CANCELLED, FAILED)' AFTER `imp_uid`;
CREATE INDEX IF NOT EXISTS `idx_extraPayment_paymentStatus` ON `extraPayment` (`paymentStatus`);
CREATE INDEX IF NOT EXISTS `idx_extraPayment_status_type` ON `extraPayment` (`contractEsntlId`, `paymentStatus`, `paymentType`, `deleteYN`);
