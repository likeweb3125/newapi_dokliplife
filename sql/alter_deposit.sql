-- =============================================
-- deposit 테이블 수정 스크립트 (통합)
-- 적용 순서대로 실행하세요. 일부 스크립트는 상호 배타적(컬럼 추가 vs 제거)일 수 있으니 주석 참고.
-- =============================================

-- ---------------------------------------------
-- 1. contractEsntlId 컬럼 및 인덱스, FK (create_deposit_tables 에서)
-- ---------------------------------------------
-- ALTER TABLE `deposit` ADD COLUMN `contractEsntlId` VARCHAR(50) NULL COMMENT '방계약 고유아이디' AFTER `contractorEsntlId`;
-- CREATE INDEX `idx_contractEsntlId` ON `deposit` (`contractEsntlId`);
-- ALTER TABLE `deposit` ADD CONSTRAINT `fk_deposit_roomContract` FOREIGN KEY (`contractEsntlId`) REFERENCES `roomContract` (`esntlId`) ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------
-- 2. type, amount, paidAmount, unpaidAmount, depositDate, depositorName, manager 등 (입금 관련)
-- ---------------------------------------------
-- ALTER TABLE `deposit` ADD COLUMN `paidAmount` INT(11) NULL DEFAULT 0 COMMENT '입금액' AFTER `amount`;
-- ALTER TABLE `deposit` ADD COLUMN `unpaidAmount` INT(11) NULL DEFAULT 0 COMMENT '미납금액' AFTER `paidAmount`;
-- ALTER TABLE `deposit` ADD COLUMN `depositDate` DATETIME NULL COMMENT '입금일자' AFTER `status`;
-- ALTER TABLE `deposit` ADD COLUMN `depositorName` VARCHAR(100) NULL COMMENT '입금자명' AFTER `depositDate`;
-- ALTER TABLE `deposit` ADD COLUMN `type` VARCHAR(50) NULL COMMENT '타입 (RESERVATION: 예약금, DEPOSIT: 보증금)' AFTER `contractEsntlId`;
-- CREATE INDEX `idx_depositDate` ON `deposit` (`depositDate`);
-- CREATE INDEX `idx_depositorName` ON `deposit` (`depositorName`);
-- CREATE INDEX `idx_type` ON `deposit` (`type`);

-- ---------------------------------------------
-- 3. manager 컬럼
-- ---------------------------------------------
-- ALTER TABLE `deposit` ADD COLUMN `manager` VARCHAR(100) NULL COMMENT '담당자' AFTER `status`;
-- CREATE INDEX `idx_manager` ON `deposit` (`manager`);

-- ---------------------------------------------
-- 4. depositorPhone 컬럼
-- ---------------------------------------------
-- ALTER TABLE `deposit` ADD COLUMN `depositorPhone` VARCHAR(50) NULL COMMENT '입금자 전화번호' AFTER `depositorName`;
-- CREATE INDEX `idx_depositorPhone` ON `deposit` (`depositorPhone`);

-- ---------------------------------------------
-- 5. expectedOccupantName, expectedOccupantPhone 컬럼
-- ---------------------------------------------
-- ALTER TABLE `deposit` ADD COLUMN `expectedOccupantName` VARCHAR(100) NULL COMMENT '입실예정자명' AFTER `accountHolder`;
-- ALTER TABLE `deposit` ADD COLUMN `expectedOccupantPhone` VARCHAR(50) NULL COMMENT '입실예정자연락처' AFTER `expectedOccupantName`;
-- CREATE INDEX `idx_expectedOccupantPhone` ON `deposit` (`expectedOccupantPhone`);

-- ---------------------------------------------
-- 6. deletedBy, deletedAt 컬럼 및 인덱스
-- ---------------------------------------------
ALTER TABLE `deposit` ADD COLUMN `deletedBy` VARCHAR(50) NULL COMMENT '삭제한 관리자 ID' AFTER `deleteYN`;
ALTER TABLE `deposit` ADD COLUMN `deletedAt` DATETIME NULL COMMENT '삭제 시간' AFTER `deletedBy`;
CREATE INDEX `idx_deposit_deletedBy` ON `deposit` (`deletedBy`);
CREATE INDEX `idx_deposit_deletedAt` ON `deposit` (`deletedAt`);

-- ---------------------------------------------
-- (참고) depositAmount 제거·type 추가, 또는 type 등 제거 스크립트는
-- remove_depositAmount_add_type_column.sql, remove_deposit_type_column.sql 참고.
-- 필요 시 해당 파일에서 문장만 이 파일로 옮겨 사용하세요.
-- ---------------------------------------------
