-- =============================================
-- 보증금(예약금) 관리 테이블 생성 SQL
-- =============================================

-- 1. deposit 테이블 (보증금/예약금 메인 테이블)
-- 방의 보증금 및 예약금 정보를 관리하는 테이블
CREATE TABLE IF NOT EXISTS `deposit` (
  `esntlId` VARCHAR(50) NOT NULL COMMENT '보증금 고유아이디',
  `roomEsntlId` VARCHAR(50) NOT NULL COMMENT '방 고유아이디',
  `gosiwonEsntlId` VARCHAR(50) NOT NULL COMMENT '고시원 고유아이디',
  `customerEsntlId` VARCHAR(50) NULL COMMENT '예약자/입실자 고유아이디',
  `contractorEsntlId` VARCHAR(50) NULL COMMENT '계약자 고유아이디',
  `contractEsntlId` VARCHAR(50) NULL COMMENT '방계약 고유아이디',
  `type` VARCHAR(50) NULL COMMENT '타입 (RESERVATION: 예약금, DEPOSIT: 보증금)',
  `amount` INT(11) NOT NULL DEFAULT 0 COMMENT '금액 (예약금 또는 보증금)',
  `paidAmount` INT(11) NULL DEFAULT 0 COMMENT '입금액',
  `unpaidAmount` INT(11) NULL DEFAULT 0 COMMENT '미납금액',
  `accountBank` VARCHAR(50) NULL COMMENT '은행명',
  `accountNumber` VARCHAR(50) NULL COMMENT '계좌번호',
  `accountHolder` VARCHAR(100) NULL COMMENT '예금주명',
  `expectedOccupantName` VARCHAR(100) NULL COMMENT '입실예정자명 (type이 RESERVATION일 때 사용)',
  `expectedOccupantPhone` VARCHAR(50) NULL COMMENT '입실예정자연락처 (type이 RESERVATION일 때 사용)',
  `status` VARCHAR(50) NOT NULL DEFAULT 'PENDING' COMMENT '입금상태 (PENDING: 입금대기, PARTIAL: 부분입금, COMPLETED: 입금완료, RETURN_COMPLETED: 반환완료, DELETED: 삭제됨)',
  `manager` VARCHAR(100) NULL COMMENT '담당자',
  `depositDate` DATETIME NULL COMMENT '입금일자',
  `depositorName` VARCHAR(100) NULL COMMENT '입금자명',
  `depositorPhone` VARCHAR(50) NULL COMMENT '입금자 전화번호',
  `virtualAccountNumber` VARCHAR(100) NULL COMMENT '가상계좌번호',
  `virtualAccountExpiryDate` DATETIME NULL COMMENT '가상계좌 만료일시',
  `deleteYN` CHAR(1) NOT NULL DEFAULT 'N' COMMENT '삭제여부',
  `deletedBy` VARCHAR(50) NULL COMMENT '삭제한 관리자 ID',
  `deletedAt` DATETIME NULL COMMENT '삭제 시간',
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '생성일',
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정일',
  PRIMARY KEY (`esntlId`),
  INDEX `idx_roomEsntlId` (`roomEsntlId`),
  INDEX `idx_gosiwonEsntlId` (`gosiwonEsntlId`),
  INDEX `idx_customerEsntlId` (`customerEsntlId`),
  INDEX `idx_contractorEsntlId` (`contractorEsntlId`),
  INDEX `idx_contractEsntlId` (`contractEsntlId`),
  INDEX `idx_type` (`type`),
  INDEX `idx_amount` (`amount`),
  INDEX `idx_status` (`status`),
  INDEX `idx_manager` (`manager`),
  INDEX `idx_depositDate` (`depositDate`),
  INDEX `idx_depositorName` (`depositorName`),
  INDEX `idx_depositorPhone` (`depositorPhone`),
  INDEX `idx_expectedOccupantPhone` (`expectedOccupantPhone`),
  INDEX `idx_deleteYN` (`deleteYN`),
  INDEX `idx_deletedBy` (`deletedBy`),
  INDEX `idx_deletedAt` (`deletedAt`),
  CONSTRAINT `fk_deposit_room` FOREIGN KEY (`roomEsntlId`) 
    REFERENCES `room` (`esntlId`) 
    ON DELETE CASCADE 
    ON UPDATE CASCADE,
  CONSTRAINT `fk_deposit_gosiwon` FOREIGN KEY (`gosiwonEsntlId`) 
    REFERENCES `gosiwon` (`esntlId`) 
    ON DELETE CASCADE 
    ON UPDATE CASCADE,
  CONSTRAINT `fk_deposit_customer` FOREIGN KEY (`customerEsntlId`) 
    REFERENCES `customer` (`esntlId`) 
    ON DELETE SET NULL 
    ON UPDATE CASCADE,
  CONSTRAINT `fk_deposit_contractor` FOREIGN KEY (`contractorEsntlId`) 
    REFERENCES `customer` (`esntlId`) 
    ON DELETE SET NULL 
    ON UPDATE CASCADE,
  CONSTRAINT `fk_deposit_roomContract` FOREIGN KEY (`contractEsntlId`) 
    REFERENCES `roomContract` (`esntlId`) 
    ON DELETE SET NULL 
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci COMMENT='보증금(예약금) 관리 메인 테이블';

-- 2. depositHistory 테이블 (입금/반환 이력)
-- 입금 및 반환 등록 이력을 관리하는 테이블
CREATE TABLE IF NOT EXISTS `depositHistory` (
  `esntlId` VARCHAR(50) NOT NULL COMMENT '이력 고유아이디',
  `depositEsntlId` VARCHAR(50) NOT NULL COMMENT '보증금 고유아이디',
  `roomEsntlId` VARCHAR(50) NOT NULL COMMENT '방 고유아이디',
  `contractEsntlId` VARCHAR(50) NULL COMMENT '방계약 고유아이디',
  `type` VARCHAR(50) NOT NULL COMMENT '타입 (DEPOSIT: 입금, RETURN: 반환)',
  `amount` INT(11) NOT NULL DEFAULT 0 COMMENT '금액',
  `status` VARCHAR(50) NOT NULL COMMENT '상태 (PENDING: 입금대기, PARTIAL_DEPOSIT: 부분입금, DEPOSIT_COMPLETED: 입금완료, RETURN_COMPLETED: 반환완료, DEPOSIT_RE_REQUEST: 입금재요청, VIRTUAL_ACCOUNT_ISSUED: 가상계좌 발급, VIRTUAL_ACCOUNT_EXPIRED: 가상계좌 만료)',
  `depositorName` VARCHAR(100) NULL COMMENT '입금자명',
  `deductionAmount` INT(11) NULL DEFAULT 0 COMMENT '차감금액 (반환시)',
  `refundAmount` INT(11) NULL DEFAULT 0 COMMENT '반환금액',
  `accountBank` VARCHAR(50) NULL COMMENT '계좌 은행명',
  `accountNumber` VARCHAR(50) NULL COMMENT '계좌번호',
  `accountHolder` VARCHAR(100) NULL COMMENT '예금주명',
  `manager` VARCHAR(100) NULL COMMENT '담당자',
  `memo` TEXT NULL COMMENT '메모',
  `depositDate` DATETIME NULL COMMENT '입금일시',
  `refundDate` DATETIME NULL COMMENT '반환일시',
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '생성일',
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정일',
  PRIMARY KEY (`esntlId`),
  INDEX `idx_depositEsntlId` (`depositEsntlId`),
  INDEX `idx_roomEsntlId` (`roomEsntlId`),
  INDEX `idx_contractEsntlId` (`contractEsntlId`),
  INDEX `idx_type` (`type`),
  INDEX `idx_status` (`status`),
  INDEX `idx_manager` (`manager`),
  INDEX `idx_depositDate` (`depositDate`),
  INDEX `idx_refundDate` (`refundDate`),
  INDEX `idx_createdAt` (`createdAt`),
  CONSTRAINT `fk_depositHistory_deposit` FOREIGN KEY (`depositEsntlId`) 
    REFERENCES `deposit` (`esntlId`) 
    ON DELETE CASCADE 
    ON UPDATE CASCADE,
  CONSTRAINT `fk_depositHistory_room` FOREIGN KEY (`roomEsntlId`) 
    REFERENCES `room` (`esntlId`) 
    ON DELETE CASCADE 
    ON UPDATE CASCADE,
  CONSTRAINT `fk_depositHistory_roomContract` FOREIGN KEY (`contractEsntlId`) 
    REFERENCES `roomContract` (`esntlId`) 
    ON DELETE SET NULL 
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci COMMENT='입금/반환 이력 테이블';

-- 3. depositDeduction 테이블 (차감 항목)
-- 반환 시 차감되는 항목들을 관리하는 테이블
CREATE TABLE IF NOT EXISTS `depositDeduction` (
  `esntlId` VARCHAR(50) NOT NULL COMMENT '차감 항목 고유아이디',
  `depositHistoryEsntlId` VARCHAR(50) NOT NULL COMMENT '입금/반환 이력 고유아이디',
  `deductionName` VARCHAR(200) NOT NULL COMMENT '차감명 (예: 고정청소비, 차감청소비 등)',
  `deductionAmount` INT(11) NOT NULL DEFAULT 0 COMMENT '차감금액',
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '생성일',
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정일',
  PRIMARY KEY (`esntlId`),
  INDEX `idx_depositHistoryEsntlId` (`depositHistoryEsntlId`),
  CONSTRAINT `fk_depositDeduction_history` FOREIGN KEY (`depositHistoryEsntlId`) 
    REFERENCES `depositHistory` (`esntlId`) 
    ON DELETE CASCADE 
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci COMMENT='차감 항목 테이블';

-- =============================================
-- 인덱스 추가 (성능 최적화)
-- =============================================

-- deposit 테이블 복합 인덱스
CREATE INDEX `idx_deposit_gosiwon_status` ON `deposit` (`gosiwonEsntlId`, `status`, `deleteYN`);
CREATE INDEX `idx_deposit_room_status` ON `deposit` (`roomEsntlId`, `status`, `deleteYN`);
CREATE INDEX `idx_deposit_customer_status` ON `deposit` (`customerEsntlId`, `status`, `deleteYN`);

-- depositHistory 테이블 복합 인덱스
CREATE INDEX `idx_depositHistory_deposit_type` ON `depositHistory` (`depositEsntlId`, `type`, `createdAt`);

-- =============================================
-- 기존 테이블에 contractEsntlId 컬럼 추가 (이미 테이블이 생성된 경우)
-- =============================================

-- deposit 테이블에 contractEsntlId 컬럼 추가
-- 주의: 이미 컬럼이 존재하는 경우 오류가 발생할 수 있습니다.
ALTER TABLE `deposit` 
ADD COLUMN `contractEsntlId` VARCHAR(50) NULL COMMENT '방계약 고유아이디' 
AFTER `contractorEsntlId`;

-- deposit 테이블에 contractEsntlId 인덱스 추가
-- 주의: 이미 인덱스가 존재하는 경우 오류가 발생할 수 있습니다.
CREATE INDEX `idx_contractEsntlId` ON `deposit` (`contractEsntlId`);

-- deposit 테이블에 외래키 제약조건 추가
-- 주의: 이미 제약조건이 존재하는 경우 오류가 발생할 수 있습니다.
ALTER TABLE `deposit` 
ADD CONSTRAINT `fk_deposit_roomContract` FOREIGN KEY (`contractEsntlId`) 
  REFERENCES `roomContract` (`esntlId`) 
  ON DELETE SET NULL 
  ON UPDATE CASCADE;

-- depositHistory 테이블에 contractEsntlId 컬럼 추가
-- 주의: 이미 컬럼이 존재하는 경우 오류가 발생할 수 있습니다.
ALTER TABLE `depositHistory` 
ADD COLUMN `contractEsntlId` VARCHAR(50) NULL COMMENT '방계약 고유아이디' 
AFTER `roomEsntlId`;

-- depositHistory 테이블에 contractEsntlId 인덱스 추가
-- 주의: 이미 인덱스가 존재하는 경우 오류가 발생할 수 있습니다.
CREATE INDEX `idx_contractEsntlId` ON `depositHistory` (`contractEsntlId`);

-- depositHistory 테이블에 외래키 제약조건 추가
-- 주의: 이미 제약조건이 존재하는 경우 오류가 발생할 수 있습니다.
ALTER TABLE `depositHistory` 
ADD CONSTRAINT `fk_depositHistory_roomContract` FOREIGN KEY (`contractEsntlId`) 
  REFERENCES `roomContract` (`esntlId`) 
  ON DELETE SET NULL 
  ON UPDATE CASCADE;

-- =============================================
-- 추가 컬럼 (add 파일에서 병합)
-- =============================================
-- 아래 내용은 add_deposit_*.sql 파일들에서 병합되었습니다.
-- 이미 CREATE TABLE 문에 포함되어 있으므로 ALTER TABLE 문은 실행할 필요가 없습니다.
-- 
-- 추가된 컬럼:
--   - expectedOccupantName: 입실예정자명 (type이 RESERVATION일 때 사용)
--   - expectedOccupantPhone: 입실예정자연락처 (type이 RESERVATION일 때 사용)
-- 
-- 참고: depositorPhone, manager, deletedBy, deletedAt 등은 이미 CREATE TABLE에 포함되어 있습니다.

