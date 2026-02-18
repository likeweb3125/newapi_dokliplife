-- =============================================
-- paymentLog 테이블 수정 스크립트 (통합)
-- 적용 순서대로 실행하세요.
-- =============================================

-- ---------------------------------------------
-- 1. extrapayEsntlId 컬럼 및 인덱스
-- ---------------------------------------------
ALTER TABLE `paymentLog` ADD COLUMN IF NOT EXISTS `extrapayEsntlId` VARCHAR(50) NULL COMMENT '추가 결제 고유아이디 (extraPayment.esntlId 참조)' AFTER `customerEsntlId`;
CREATE INDEX IF NOT EXISTS `idx_paymentLog_extrapayEsntlId` ON `paymentLog` (`extrapayEsntlId`);
CREATE INDEX IF NOT EXISTS `idx_paymentLog_contract_extrapay` ON `paymentLog` (`contractEsntlId`, `extrapayEsntlId`, `withdrawalStatus`);

-- ---------------------------------------------
-- 2. isExtra 컬럼 및 인덱스
-- ---------------------------------------------
ALTER TABLE `paymentLog` ADD COLUMN IF NOT EXISTS `isExtra` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '결제 유형 구분 (0: 방 연장 결제, 1: 추가 결제)' AFTER `pyl_contract_data`;
CREATE INDEX IF NOT EXISTS `idx_paymentLog_isExtra` ON `paymentLog` (`isExtra`);
CREATE INDEX IF NOT EXISTS `idx_paymentLog_contract_isExtra` ON `paymentLog` (`contractEsntlId`, `isExtra`, `withdrawalStatus`);

-- ---------------------------------------------
-- 3. 추가 결제 관련 컬럼 (extraCostName, memo, optionInfo 등)
-- ---------------------------------------------
ALTER TABLE `paymentLog`
ADD COLUMN IF NOT EXISTS `extraCostName` VARCHAR(200) NULL COMMENT '추가비용명칭' AFTER `pyl_contract_data`,
ADD COLUMN IF NOT EXISTS `memo` TEXT NULL COMMENT '메모' AFTER `extraCostName`,
ADD COLUMN IF NOT EXISTS `optionInfo` VARCHAR(200) NULL COMMENT '옵션정보' AFTER `memo`,
ADD COLUMN IF NOT EXISTS `useStartDate` DATE NULL COMMENT '이용 시작 일자' AFTER `optionInfo`,
ADD COLUMN IF NOT EXISTS `optionName` VARCHAR(200) NULL COMMENT '옵션명' AFTER `useStartDate`,
ADD COLUMN IF NOT EXISTS `extendWithPayment` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '연장시 함께 결제 여부' AFTER `optionName`,
ADD COLUMN IF NOT EXISTS `isExtra` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '추가 결제 여부' AFTER `extendWithPayment`;
CREATE INDEX IF NOT EXISTS `idx_paymentLog_extraCostName` ON `paymentLog` (`extraCostName`);
CREATE INDEX IF NOT EXISTS `idx_paymentLog_extendWithPayment` ON `paymentLog` (`extendWithPayment`);
CREATE INDEX IF NOT EXISTS `idx_paymentLog_contract_extend` ON `paymentLog` (`contractEsntlId`, `extendWithPayment`, `withdrawalStatus`);
CREATE INDEX IF NOT EXISTS `idx_paymentLog_contract_isExtra` ON `paymentLog` (`contractEsntlId`, `isExtra`, `withdrawalStatus`);

-- ---------------------------------------------
-- 4. 인덱스 추가 (고시원 리스트 조회 최적화)
-- ---------------------------------------------
CREATE INDEX IF NOT EXISTS `idx_paymentLog_contractEsntlId` ON `paymentLog` (`contractEsntlId`);
CREATE INDEX IF NOT EXISTS `idx_paymentLog_contract_pTime` ON `paymentLog` (`contractEsntlId`, `pTime`);

-- ---------------------------------------------
-- 5. isExtra 컬럼 타입 변경 (0/1 → extraPayment.esntlId, EXTR 접두어)
-- ---------------------------------------------
-- 5-1. isExtra 관련 인덱스 제거 (컬럼 타입 변경 전)
DROP INDEX IF EXISTS `idx_paymentLog_isExtra` ON `paymentLog`;
DROP INDEX IF EXISTS `idx_paymentLog_contract_isExtra` ON `paymentLog`;

-- 5-2. isExtra 컬럼을 TINYINT(0/1) → VARCHAR(50) NULL 로 변경 (값: extraPayment.esntlId, 미해당 시 NULL)
ALTER TABLE `paymentLog`
MODIFY COLUMN `isExtra` VARCHAR(50) NULL DEFAULT NULL COMMENT '추가 결제 시 extraPayment.esntlId (EXTR 접두어), 미해당 시 NULL';

-- 5-3. 기존 0/1 데이터 정리 (신규 스키마에서는 EXTR id만 저장하므로 과거 데이터는 NULL 처리)
UPDATE `paymentLog` SET `isExtra` = NULL WHERE `isExtra` IN ('0', '1', 0, 1);

-- 5-4. isExtra 관련 인덱스 재생성
CREATE INDEX IF NOT EXISTS `idx_paymentLog_isExtra` ON `paymentLog` (`isExtra`);
CREATE INDEX IF NOT EXISTS `idx_paymentLog_contract_isExtra` ON `paymentLog` (`contractEsntlId`, `isExtra`, `withdrawalStatus`);
