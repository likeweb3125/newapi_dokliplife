-- =============================================
-- 방 이용 환불 관리 테이블 생성 SQL
-- =============================================

-- refund 테이블 (환불 메인 테이블)
-- 방 이용에 대한 환불 정보를 관리하는 테이블
CREATE TABLE IF NOT EXISTS `refund` (
  `esntlId` VARCHAR(50) NOT NULL COMMENT '환불 고유아이디 (RFND0000000001 형식)',
  `gosiwonEsntlId` VARCHAR(50) NOT NULL COMMENT '고시원 고유아이디',
  `roomEsntlId` VARCHAR(50) NOT NULL COMMENT '방 고유아이디',
  `contractEsntlId` VARCHAR(50) NULL COMMENT '계약 고유아이디',
  `contractorEsntlId` VARCHAR(50) NULL COMMENT '계약자 고유아이디',
  `customerEsntlId` VARCHAR(50) NULL COMMENT '사용자(입실자) 고유아이디',
  `cancelReason` VARCHAR(50) NOT NULL COMMENT '취소사유 (EXPIRED_CHECKOUT: 만기퇴실, MIDDLE_CHECKOUT: 중도퇴실, CONTRACT_CANCEL: 계약취소)',
  `cancelDate` DATE NOT NULL COMMENT '취소날짜',
  `cancelMemo` TEXT NULL COMMENT '취소메모',
  `liabilityReason` VARCHAR(50) NULL COMMENT '귀책사유 (OWNER: 사장님, OCCUPANT: 입실자)',
  `contactedOwner` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '사장님과 연락이 되었는지 유무 (0: 미연락, 1: 연락완료)',
  `refundMethod` VARCHAR(50) NULL COMMENT '환불수단 (예: 계좌이체, 현금, 카드취소 등)',
  `paymentAmount` INT(11) NOT NULL DEFAULT 0 COMMENT '결제금액',
  `proratedRent` INT(11) NOT NULL DEFAULT 0 COMMENT '일할입실료',
  `penalty` INT(11) NOT NULL DEFAULT 0 COMMENT '위약금',
  `totalRefundAmount` INT(11) NOT NULL DEFAULT 0 COMMENT '총환불금액',
  `deleteYN` CHAR(1) NOT NULL DEFAULT 'N' COMMENT '삭제여부',
  `deletedBy` VARCHAR(50) NULL COMMENT '삭제한 관리자 ID',
  `deletedAt` DATETIME NULL COMMENT '삭제 시간',
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '생성일',
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정일',
  PRIMARY KEY (`esntlId`),
  INDEX `idx_gosiwonEsntlId` (`gosiwonEsntlId`),
  INDEX `idx_roomEsntlId` (`roomEsntlId`),
  INDEX `idx_contractEsntlId` (`contractEsntlId`),
  INDEX `idx_contractorEsntlId` (`contractorEsntlId`),
  INDEX `idx_customerEsntlId` (`customerEsntlId`),
  INDEX `idx_cancelReason` (`cancelReason`),
  INDEX `idx_cancelDate` (`cancelDate`),
  INDEX `idx_liabilityReason` (`liabilityReason`),
  INDEX `idx_deleteYN` (`deleteYN`),
  INDEX `idx_deletedBy` (`deletedBy`),
  INDEX `idx_deletedAt` (`deletedAt`),
  CONSTRAINT `fk_refund_gosiwon` FOREIGN KEY (`gosiwonEsntlId`) 
    REFERENCES `gosiwon` (`esntlId`) 
    ON DELETE CASCADE 
    ON UPDATE CASCADE,
  CONSTRAINT `fk_refund_room` FOREIGN KEY (`roomEsntlId`) 
    REFERENCES `room` (`esntlId`) 
    ON DELETE CASCADE 
    ON UPDATE CASCADE,
  CONSTRAINT `fk_refund_roomContract` FOREIGN KEY (`contractEsntlId`) 
    REFERENCES `roomContract` (`esntlId`) 
    ON DELETE SET NULL 
    ON UPDATE CASCADE,
  CONSTRAINT `fk_refund_contractor` FOREIGN KEY (`contractorEsntlId`) 
    REFERENCES `customer` (`esntlId`) 
    ON DELETE SET NULL 
    ON UPDATE CASCADE,
  CONSTRAINT `fk_refund_customer` FOREIGN KEY (`customerEsntlId`) 
    REFERENCES `customer` (`esntlId`) 
    ON DELETE SET NULL 
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci COMMENT='방 이용 환불 관리 테이블';

-- =============================================
-- 인덱스 추가 (성능 최적화)
-- =============================================

-- refund 테이블 복합 인덱스
-- 고시원별 환불 조회 최적화
CREATE INDEX `idx_refund_gosiwon_cancelDate` ON `refund` (`gosiwonEsntlId`, `cancelDate`, `deleteYN`);

-- 방별 환불 조회 최적화
CREATE INDEX `idx_refund_room_cancelDate` ON `refund` (`roomEsntlId`, `cancelDate`, `deleteYN`);

-- 계약별 환불 조회 최적화
CREATE INDEX `idx_refund_contract_cancelDate` ON `refund` (`contractEsntlId`, `cancelDate`, `deleteYN`);

-- 취소사유별 조회 최적화
CREATE INDEX `idx_refund_cancelReason_cancelDate` ON `refund` (`cancelReason`, `cancelDate`, `deleteYN`);
