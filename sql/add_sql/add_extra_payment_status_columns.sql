-- =============================================
-- extraPayment 테이블에 결제 상태 및 결제 방식 컬럼 추가 SQL
-- =============================================

-- 결제 상태 컬럼 추가
ALTER TABLE `extraPayment` 
ADD COLUMN IF NOT EXISTS `paymentStatus` VARCHAR(50) NOT NULL DEFAULT 'PENDING' COMMENT '결제 상태 (PENDING: 결제대기, COMPLETED: 결제완료, CANCELLED: 결제취소, FAILED: 결제실패)' AFTER `imp_uid`;

-- paymentType 컬럼 설명 업데이트 (이미 존재하는 경우)
-- 주의: 컬럼이 이미 존재하는 경우 COMMENT만 업데이트하려면 아래 쿼리를 사용하세요.
-- ALTER TABLE `extraPayment` MODIFY COLUMN `paymentType` VARCHAR(50) NULL COMMENT '결제 방식 (accountPayment: 계좌 결제, cardPayment: 카드 결제, appPayment: 앱 결제, manualPayment: 수동 결제)';

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS `idx_extraPayment_paymentStatus` ON `extraPayment` (`paymentStatus`);
CREATE INDEX IF NOT EXISTS `idx_extraPayment_status_type` ON `extraPayment` (`contractEsntlId`, `paymentStatus`, `paymentType`, `deleteYN`);

