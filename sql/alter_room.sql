-- =============================================
-- room 테이블 수정 스크립트 (통합)
-- 적용 순서대로 실행하세요.
-- =============================================

-- ---------------------------------------------
-- 1. roomCategory, depositYN, agreementType, agreementContent 컬럼 추가
-- ---------------------------------------------
ALTER TABLE `room` ADD COLUMN `roomCategory` VARCHAR(50) NULL COMMENT '룸카테고리' AFTER `roomType`;
ALTER TABLE `room` ADD COLUMN `depositYN` CHAR(1) NULL DEFAULT 'N' COMMENT '보증금 사용여부' AFTER `deposit`;
ALTER TABLE `room` ADD COLUMN `agreementType` VARCHAR(50) NULL DEFAULT 'GENERAL' COMMENT '특약타입 (GENERAL, GOSIWON, ROOM)' AFTER `org_rom_eid`;
ALTER TABLE `room` ADD COLUMN `agreementContent` TEXT NULL COMMENT '특약내용' AFTER `agreementType`;
CREATE INDEX `idx_room_roomCategory` ON `room` (`roomCategory`);
CREATE INDEX `idx_room_agreementType` ON `room` (`agreementType`);
CREATE INDEX `idx_room_depositYN` ON `room` (`depositYN`);
-- UPDATE `room` SET `agreementType` = 'GENERAL' WHERE `agreementType` IS NULL;

-- ---------------------------------------------
-- 2. agreementType 기본값 (MODIFY)
-- ---------------------------------------------
ALTER TABLE `room` MODIFY COLUMN `agreementType` VARCHAR(50) NULL DEFAULT 'GENERAL' COMMENT '특약타입 (GENERAL: 독립생활 일반 규정 11항 적용, GOSIWON: 현재 고시원 특약사항 적용, ROOM: 해당 방만 특약사항 수정)';
-- UPDATE `room` SET `agreementType` = 'GENERAL' WHERE `agreementType` IS NULL;

-- ---------------------------------------------
-- 3. useRoomRentFee 컬럼 추가
-- ---------------------------------------------
ALTER TABLE `room` ADD COLUMN `useRoomRentFee` CHAR(1) NULL DEFAULT NULL COMMENT '방 월비용 사용 YN' AFTER `roomCategory`;

-- ---------------------------------------------
-- 4. roomEsntlId 컬럼 및 자기참조 FK
-- ---------------------------------------------
ALTER TABLE `room` ADD COLUMN `roomEsntlId` VARCHAR(50) NULL COMMENT '방 고유아이디 (자기참조)' AFTER `customerEsntlId`;
CREATE INDEX `idx_room_roomEsntlId` ON `room` (`roomEsntlId`);
-- ALTER TABLE `room` ADD CONSTRAINT `fk_room_roomEsntlId` FOREIGN KEY (`roomEsntlId`) REFERENCES `room` (`esntlId`) ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------
-- 5. availableGender 컬럼 추가
-- ---------------------------------------------
ALTER TABLE `room` ADD COLUMN `availableGender` VARCHAR(50) NULL DEFAULT 'DEFAULT' COMMENT '이용 가능 성별 (DEFAULT, MALE, FEMALE)' AFTER `agreementContent`;
CREATE INDEX `idx_room_availableGender` ON `room` (`availableGender`);

-- ---------------------------------------------
-- 6. 인덱스 추가 (고시원 리스트 조회 최적화)
-- ---------------------------------------------
CREATE INDEX IF NOT EXISTS `idx_room_gosiwonEsntlId` ON `room` (`gosiwonEsntlId`);
CREATE INDEX IF NOT EXISTS `idx_room_gosiwon_status` ON `room` (`gosiwonEsntlId`, `status`);
