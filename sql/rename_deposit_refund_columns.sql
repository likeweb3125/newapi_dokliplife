-- =============================================
-- depositRefund 테이블 컬럼명 변경 SQL
-- =============================================
-- totalRefundAmount → refundAmount
-- finalRefundAmount → remainAmount

-- totalRefundAmount를 refundAmount로 변경
ALTER TABLE `depositRefund` 
CHANGE COLUMN `totalRefundAmount` `refundAmount` INT(11) NOT NULL DEFAULT 0 COMMENT '환불 항목 합계 금액';

-- finalRefundAmount를 remainAmount로 변경
ALTER TABLE `depositRefund` 
CHANGE COLUMN `finalRefundAmount` `remainAmount` INT(11) NOT NULL DEFAULT 0 COMMENT '최종 환불 금액';

-- =============================================
-- 완료
-- =============================================

