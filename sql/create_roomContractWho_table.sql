-- =============================================
-- roomContractWho 테이블 (계약별 입실자/계약고객/비상연락망 정보)
-- roomContract의 checkin~, customer~, emergencyContact 컬럼을 별도 테이블로 관리
-- =============================================

SET NAMES utf8mb3 COLLATE utf8mb3_general_ci;

CREATE TABLE IF NOT EXISTS `roomContractWho` (
  `contractEsntlId` VARCHAR(50) NOT NULL COMMENT '계약 고유아이디 (roomContract.esntlId)',
  `checkinName` VARCHAR(100) NULL DEFAULT NULL COMMENT '체크인한 사람 이름',
  `checkinPhone` VARCHAR(50) NULL DEFAULT NULL COMMENT '체크인한 사람 연락처',
  `checkinGender` VARCHAR(20) NULL DEFAULT NULL COMMENT '체크인한 사람 성별',
  `checkinAge` INT(3) NULL DEFAULT NULL COMMENT '체크인한 사람 나이',
  `customerName` VARCHAR(100) NULL DEFAULT NULL COMMENT '고객 이름(계약서 기준)',
  `customerPhone` VARCHAR(50) NULL DEFAULT NULL COMMENT '고객 연락처(계약서 기준)',
  `customerGender` VARCHAR(20) NULL DEFAULT NULL COMMENT '고객 성별(계약서 기준)',
  `customerAge` INT(3) NULL DEFAULT NULL COMMENT '고객 나이(계약서 기준)',
  `emergencyContact` VARCHAR(250) NULL DEFAULT NULL COMMENT '비상연락망/관계 (예: 010-1234-5678 / 부모)',
  `createdAt` DATETIME NULL DEFAULT NULL COMMENT '생성일',
  `updatedAt` DATETIME NULL DEFAULT NULL COMMENT '수정일',
  PRIMARY KEY (`contractEsntlId`),
  CONSTRAINT `fk_roomContractWho_roomContract`
    FOREIGN KEY (`contractEsntlId`) REFERENCES `roomContract` (`esntlId`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci
COMMENT='계약별 입실자/계약고객/비상연락망 정보 (roomContract 1:1)';
