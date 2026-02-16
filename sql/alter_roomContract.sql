-- =============================================
-- roomContract 테이블 수정 스크립트 (통합)
-- 적용 순서대로 실행하세요. 이미 적용된 구간은 주석 처리하거나 건너뛰세요.
-- =============================================

SET NAMES utf8mb3 COLLATE utf8mb3_general_ci;

-- ---------------------------------------------
-- 1. contractDay 컬럼 추가
-- ---------------------------------------------
ALTER TABLE `roomContract`
  ADD COLUMN `contractDay` INT(11) NULL COMMENT '계약 일수' AFTER `month`;

-- ---------------------------------------------
-- 2. 인덱스 추가 (고시원 리스트 조회 최적화)
-- ---------------------------------------------
CREATE INDEX IF NOT EXISTS `idx_roomContract_gosiwonEsntlId` ON `roomContract` (`gosiwonEsntlId`);
CREATE INDEX IF NOT EXISTS `idx_roomContract_gosiwon_dates` ON `roomContract` (`gosiwonEsntlId`, `startDate`, `endDate`);

-- ---------------------------------------------
-- 3. 데이터 수정 (esntlId 접두사 RCON → RCTT)
-- ---------------------------------------------
-- 주의: 외래키 관계가 있는 다른 테이블도 함께 업데이트해야 합니다. 한 번만 실행.
-- UPDATE `roomContract` SET `esntlId` = CONCAT('RCTT', SUBSTRING(`esntlId`, 5)) WHERE `esntlId` LIKE 'RCON%';
-- UPDATE `roomStatus` SET `contractEsntlId` = CONCAT('RCTT', SUBSTRING(`contractEsntlId`, 5)) WHERE `contractEsntlId` LIKE 'RCON%';
-- UPDATE `paymentLog` SET `contractEsntlId` = CONCAT('RCTT', SUBSTRING(`contractEsntlId`, 5)) WHERE `contractEsntlId` LIKE 'RCON%';
-- UPDATE `il_room_refund_request` SET `ctt_eid` = CONCAT('RCTT', SUBSTRING(`ctt_eid`, 5)) WHERE `ctt_eid` LIKE 'RCON%';
-- UPDATE `extraPayment` SET `contractEsntlId` = CONCAT('RCTT', SUBSTRING(`contractEsntlId`, 5)) WHERE `contractEsntlId` LIKE 'RCON%';
-- UPDATE `deposit` SET `contractEsntlId` = CONCAT('RCTT', SUBSTRING(`contractEsntlId`, 5)) WHERE `contractEsntlId` LIKE 'RCON%';
-- UPDATE `history` SET `contractEsntlId` = CONCAT('RCTT', SUBSTRING(`contractEsntlId`, 5)) WHERE `contractEsntlId` LIKE 'RCON%';
-- UPDATE `roomMoveStatus` SET `contractEsntlId` = CONCAT('RCTT', SUBSTRING(`contractEsntlId`, 5)) WHERE `contractEsntlId` LIKE 'RCON%';
