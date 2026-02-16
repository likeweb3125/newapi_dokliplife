-- =============================================
-- depositHistory 테이블 수정 스크립트 (통합)
-- 적용 순서대로 실행하세요.
-- =============================================

-- ---------------------------------------------
-- 1. contractEsntlId 컬럼 및 인덱스, FK (create_deposit_tables 에서)
-- ---------------------------------------------
-- ALTER TABLE `depositHistory` ADD COLUMN `contractEsntlId` VARCHAR(50) NULL COMMENT '방계약 고유아이디' AFTER `roomEsntlId`;
-- CREATE INDEX `idx_contractEsntlId` ON `depositHistory` (`contractEsntlId`);
-- ALTER TABLE `depositHistory` ADD CONSTRAINT `fk_depositHistory_roomContract` FOREIGN KEY (`contractEsntlId`) REFERENCES `roomContract` (`esntlId`) ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------
-- 2. roomEsntlId 컬럼 및 데이터 채우기, 인덱스, FK
-- ---------------------------------------------
-- ALTER TABLE `depositHistory` ADD COLUMN `roomEsntlId` VARCHAR(50) NULL COMMENT '방 고유아이디' AFTER `depositEsntlId`;
-- UPDATE `depositHistory` dh INNER JOIN `deposit` d ON dh.`depositEsntlId` = d.`esntlId` SET dh.`roomEsntlId` = d.`roomEsntlId` WHERE dh.`roomEsntlId` IS NULL;
-- ALTER TABLE `depositHistory` MODIFY COLUMN `roomEsntlId` VARCHAR(50) NOT NULL COMMENT '방 고유아이디';
-- CREATE INDEX `idx_roomEsntlId` ON `depositHistory` (`roomEsntlId`);
-- ALTER TABLE `depositHistory` ADD CONSTRAINT `fk_depositHistory_room` FOREIGN KEY (`roomEsntlId`) REFERENCES `room` (`esntlId`) ON DELETE CASCADE ON UPDATE CASCADE;
