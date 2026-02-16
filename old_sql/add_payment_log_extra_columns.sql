-- =============================================
-- paymentLog 테이블에 추가 결제 관련 컬럼 추가 SQL
-- =============================================

-- 추가 결제 관련 컬럼 추가
ALTER TABLE `paymentLog` 
ADD COLUMN IF NOT EXISTS `extraCostName` VARCHAR(200) NULL COMMENT '추가비용명칭 (주차비, 추가 입실료, 직접 입력 등)' AFTER `pyl_contract_data`,
ADD COLUMN IF NOT EXISTS `memo` TEXT NULL COMMENT '메모 (ex. 2인 추가 / 정가 계산 등)' AFTER `extraCostName`,
ADD COLUMN IF NOT EXISTS `optionInfo` VARCHAR(200) NULL COMMENT '옵션정보 (주차비의 경우 차량정보, 직접 입력의 경우 옵션명 등)' AFTER `memo`,
ADD COLUMN IF NOT EXISTS `useStartDate` DATE NULL COMMENT '이용 시작 일자 (주차비, 직접 입력의 경우)' AFTER `optionInfo`,
ADD COLUMN IF NOT EXISTS `optionName` VARCHAR(200) NULL COMMENT '옵션명 (직접 입력의 경우)' AFTER `useStartDate`,
ADD COLUMN IF NOT EXISTS `extendWithPayment` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '연장시 함께 결제 여부 (0: 미사용, 1: 사용)' AFTER `optionName`,
ADD COLUMN IF NOT EXISTS `isExtra` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '추가 결제 여부 (0: 일반 연장 결제, 1: 옵션에서 발생한 추가 결제)' AFTER `extendWithPayment`;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS `idx_paymentLog_extraCostName` ON `paymentLog` (`extraCostName`);
CREATE INDEX IF NOT EXISTS `idx_paymentLog_extendWithPayment` ON `paymentLog` (`extendWithPayment`);
CREATE INDEX IF NOT EXISTS `idx_paymentLog_isExtra` ON `paymentLog` (`isExtra`);
CREATE INDEX IF NOT EXISTS `idx_paymentLog_contract_extend` ON `paymentLog` (`contractEsntlId`, `extendWithPayment`, `withdrawalStatus`);
CREATE INDEX IF NOT EXISTS `idx_paymentLog_contract_isExtra` ON `paymentLog` (`contractEsntlId`, `isExtra`, `withdrawalStatus`);
