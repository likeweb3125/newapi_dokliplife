-- =============================================
-- depositRefund 테이블에 roomEsntlId 컬럼 추가 SQL
-- =============================================
-- 주의: 이미 컬럼이 존재하는 경우 오류가 발생할 수 있습니다.

-- roomEsntlId 컬럼 추가 (contractEsntlId 컬럼 아래)
ALTER TABLE `depositRefund` 
ADD COLUMN `roomEsntlId` VARCHAR(50) NULL COMMENT '방 고유아이디' 
AFTER `contractEsntlId`;

-- 인덱스 추가 (성능 최적화)
CREATE INDEX `idx_depositRefund_roomEsntlId` ON `depositRefund` (`roomEsntlId`);

-- =============================================
-- 완료
-- =============================================

