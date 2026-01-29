-- =============================================
-- il_room_deposit 테이블 (방 보증금 메인)
-- 예약금 입력 시 곧 보증금으로 사용 (예약금/보증금 구분 없음)
-- gsplus db 스크립트 실행용
-- =============================================

SET NAMES utf8mb3 COLLATE utf8mb3_general_ci;

CREATE TABLE IF NOT EXISTS `il_room_deposit` (
  `esntlId` VARCHAR(50) NOT NULL COMMENT '보증금 고유아이디',
  `roomEsntlId` VARCHAR(50) NOT NULL COMMENT '방 고유아이디',
  `gosiwonEsntlId` VARCHAR(50) NOT NULL COMMENT '고시원 고유아이디',
  `customerEsntlId` VARCHAR(50) NULL COMMENT '예약자/입실자 고유아이디',
  `contractorEsntlId` VARCHAR(50) NULL COMMENT '계약자 고유아이디',
  `contractEsntlId` VARCHAR(50) NULL COMMENT '방계약 고유아이디',
  `amount` INT(11) NOT NULL DEFAULT 0 COMMENT '금액 (보증금)',
  `paidAmount` INT(11) NULL DEFAULT 0 COMMENT '입금액',
  `unpaidAmount` INT(11) NULL DEFAULT 0 COMMENT '미납금액',
  `accountBank` VARCHAR(50) NULL COMMENT '은행명',
  `accountNumber` VARCHAR(50) NULL COMMENT '계좌번호',
  `accountHolder` VARCHAR(100) NULL COMMENT '예금주명',
  `status` VARCHAR(50) NOT NULL DEFAULT 'PENDING' COMMENT '입금상태 (PENDING, PARTIAL, COMPLETED, DELETED 등)',
  `manager` VARCHAR(100) NULL COMMENT '담당자',
  `depositDate` DATETIME NULL COMMENT '입금일자',
  `depositorName` VARCHAR(100) NULL COMMENT '입금자명',
  `depositorPhone` VARCHAR(50) NULL COMMENT '입금자 전화번호',
  `virtualAccountNumber` VARCHAR(100) NULL COMMENT '가상계좌번호',
  `virtualAccountExpiryDate` DATETIME NULL COMMENT '가상계좌 만료일시',
  `deleteYN` CHAR(1) NOT NULL DEFAULT 'N' COMMENT '삭제여부',
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '생성일',
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정일',
  PRIMARY KEY (`esntlId`),
  INDEX `idx_roomEsntlId` (`roomEsntlId`),
  INDEX `idx_gosiwonEsntlId` (`gosiwonEsntlId`),
  INDEX `idx_contractEsntlId` (`contractEsntlId`),
  INDEX `idx_status` (`status`),
  INDEX `idx_depositDate` (`depositDate`),
  INDEX `idx_deleteYN` (`deleteYN`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci COMMENT='방 보증금 메인 (예약금=보증금 단일)';
