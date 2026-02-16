-- =============================================
-- roomStatus 테이블 수정 스크립트 (통합)
-- 적용 순서대로 실행하세요.
-- =============================================

-- ---------------------------------------------
-- 1. roomContract 외래키 제거 (선택)
-- ---------------------------------------------
-- ALTER TABLE `roomStatus` DROP FOREIGN KEY `fk_roomStatus_roomContract`;

-- ---------------------------------------------
-- 2. subStatus, statusMemo 컬럼 추가
-- ---------------------------------------------
ALTER TABLE `roomStatus` ADD COLUMN `subStatus` VARCHAR(50) NULL COMMENT '서브 방상태' AFTER `status`;
ALTER TABLE `roomStatus` ADD COLUMN `statusMemo` TEXT NULL COMMENT '상태 메모' AFTER `subStatus`;

-- ---------------------------------------------
-- 3. gosiwonEsntlId 컬럼 추가 및 데이터 채우기, 인덱스, FK
-- ---------------------------------------------
ALTER TABLE `roomStatus` ADD COLUMN `gosiwonEsntlId` VARCHAR(50) NULL COMMENT '고시원 고유 아이디' AFTER `roomEsntlId`;
UPDATE `roomStatus` RS INNER JOIN `room` R ON RS.roomEsntlId = R.esntlId SET RS.gosiwonEsntlId = R.gosiwonEsntlId WHERE RS.gosiwonEsntlId IS NULL;
ALTER TABLE `roomStatus` MODIFY COLUMN `gosiwonEsntlId` VARCHAR(50) NOT NULL COMMENT '고시원 고유 아이디';
CREATE INDEX `idx_roomStatus_gosiwonEsntlId` ON `roomStatus` (`gosiwonEsntlId`);
CREATE INDEX `idx_roomStatus_gosiwon_status` ON `roomStatus` (`gosiwonEsntlId`, `status`);
-- ALTER TABLE `roomStatus` ADD CONSTRAINT `fk_roomStatus_gosiwon` FOREIGN KEY (`gosiwonEsntlId`) REFERENCES `gosiwon` (`esntlId`) ON DELETE CASCADE ON UPDATE CASCADE;
