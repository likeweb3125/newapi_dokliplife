-- =============================================
-- paymentLog 테이블에 isExtra 컬럼 추가 SQL
-- 추가 결제인지 방 연장 결제인지 확인하는 컬럼
-- =============================================

-- isExtra 컬럼 추가
-- 0: 방 연장 결제 (일반 연장 결제)
-- 1: 추가 결제 (옵션에서 발생한 추가 결제, 예: 주차비, 추가 입실료 등)
ALTER TABLE `paymentLog` 
ADD COLUMN IF NOT EXISTS `isExtra` TINYINT(1) NOT NULL DEFAULT 0 
COMMENT '결제 유형 구분 (0: 방 연장 결제, 1: 추가 결제)' 
AFTER `pyl_contract_data`;

-- 인덱스 추가 (조회 성능 최적화)
CREATE INDEX IF NOT EXISTS `idx_paymentLog_isExtra` ON `paymentLog` (`isExtra`);
CREATE INDEX IF NOT EXISTS `idx_paymentLog_contract_isExtra` ON `paymentLog` (`contractEsntlId`, `isExtra`, `withdrawalStatus`);

-- =============================================
-- 기존 데이터 업데이트 (선택사항)
-- 기존 데이터 중 추가 결제인 경우 업데이트하려면 아래 쿼리 실행
-- =============================================

-- extraPayment 테이블과 조인하여 추가 결제인 경우 isExtra를 1로 업데이트
-- UPDATE paymentLog pl
-- INNER JOIN extraPayment ep ON pl.contractEsntlId = ep.contractEsntlId 
--     AND pl.pDate = ep.pDate 
--     AND pl.paymentAmount = ep.paymentAmount
-- SET pl.isExtra = 1
-- WHERE pl.isExtra = 0;

