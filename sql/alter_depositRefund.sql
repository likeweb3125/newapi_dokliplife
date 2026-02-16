-- =============================================
-- depositRefund 테이블 수정 스크립트 (통합)
-- =============================================

-- ---------------------------------------------
-- 1. roomEsntlId 컬럼 및 인덱스
-- ---------------------------------------------
ALTER TABLE `depositRefund` ADD COLUMN `roomEsntlId` VARCHAR(50) NULL COMMENT '방 고유아이디' AFTER `contractEsntlId`;
CREATE INDEX `idx_depositRefund_roomEsntlId` ON `depositRefund` (`roomEsntlId`);

-- ---------------------------------------------
-- 2. 컬럼명 변경 (totalRefundAmount → refundAmount, finalRefundAmount → remainAmount)
-- ---------------------------------------------
ALTER TABLE `depositRefund` CHANGE COLUMN `totalRefundAmount` `refundAmount` INT(11) NOT NULL DEFAULT 0 COMMENT '환불 항목 합계 금액';
ALTER TABLE `depositRefund` CHANGE COLUMN `finalRefundAmount` `remainAmount` INT(11) NOT NULL DEFAULT 0 COMMENT '최종 환불 금액';
