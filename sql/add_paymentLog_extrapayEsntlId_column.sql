-- =============================================
-- paymentLog 테이블에 extrapayEsntlId 컬럼 추가 SQL
-- extraPayment 테이블과의 연결을 위한 컬럼
-- =============================================

-- extrapayEsntlId 컬럼 추가
-- extraPayment 테이블의 esntlId를 참조하는 컬럼
ALTER TABLE `paymentLog` 
ADD COLUMN IF NOT EXISTS `extrapayEsntlId` VARCHAR(50) NULL 
COMMENT '추가 결제 고유아이디 (extraPayment.esntlId 참조)' 
AFTER `customerEsntlId`;

-- 인덱스 추가 (조회 성능 최적화)
CREATE INDEX IF NOT EXISTS `idx_paymentLog_extrapayEsntlId` ON `paymentLog` (`extrapayEsntlId`);
CREATE INDEX IF NOT EXISTS `idx_paymentLog_contract_extrapay` ON `paymentLog` (`contractEsntlId`, `extrapayEsntlId`, `withdrawalStatus`);
