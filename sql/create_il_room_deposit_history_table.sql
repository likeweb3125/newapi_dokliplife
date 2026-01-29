-- =============================================
-- il_room_deposit_history 테이블 (예약금/보증금 입금·등록 이력)
-- depositHistory와 동일한 용도, 별도 테이블로 히스토리 관리
-- gsplus db 스크립트 실행용
-- =============================================

SET NAMES utf8mb3 COLLATE utf8mb3_general_ci;

DROP TABLE IF EXISTS `il_room_deposit_history`;

CREATE TABLE `il_room_deposit_history` (
  `esntlId` VARCHAR(50) NOT NULL COMMENT '이력 고유아이디',
  `depositEsntlId` VARCHAR(50) NOT NULL COMMENT '보증금 고유아이디 (deposit.esntlId 또는 추후 il_room_deposit PK)',
  `roomEsntlId` VARCHAR(50) NOT NULL COMMENT '방 고유아이디',
  `contractEsntlId` VARCHAR(50) NULL COMMENT '방계약 고유아이디',
  `type` VARCHAR(50) NOT NULL COMMENT '타입 (DEPOSIT: 입금, RETURN: 반환)',
  `amount` INT(11) NOT NULL DEFAULT 0 COMMENT '금액',
  `status` VARCHAR(50) NOT NULL COMMENT '상태 (PENDING, PARTIAL_DEPOSIT, DEPOSIT_COMPLETED, RETURN_COMPLETED 등)',
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
  INDEX `idx_createdAt` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci COMMENT='방 보증금/예약금 입금·반환 이력 테이블';
