-- =============================================
-- 방 액션/이벤트 이력 테이블 생성 SQL
-- 결제, 예약, 상태변경, 보증금, 환불, 메모 등 모든 액션 기록용
-- =============================================

CREATE TABLE IF NOT EXISTS `roomActionHistory` (
  `esntlId` VARCHAR(50) NOT NULL COMMENT '액션 이력 고유아이디',
  `roomEsntlId` VARCHAR(50) NOT NULL COMMENT '방 고유아이디',
  `actionType` VARCHAR(50) NOT NULL COMMENT '액션 타입 (RESERVE, PAYMENT, DEPOSIT, REFUND, STATUS_CHANGE, MEMO, FILE_UPLOAD, CHECKIN, CHECKOUT_REQUEST, CHECKOUT_CONFIRM 등)',
  `statusFrom` VARCHAR(50) NULL COMMENT '변경 전 상태 (상태 변경 시)',
  `statusTo` VARCHAR(50) NULL COMMENT '변경 후 상태 (상태 변경 시)',
  `actorAdminId` VARCHAR(50) NULL COMMENT '처리한 관리자 ID',
  `actorCustomerId` VARCHAR(50) NULL COMMENT '처리한 고객 고유아이디',
  `amount` DECIMAL(12,2) NULL COMMENT '금액 (결제/보증금/환불 등)',
  `currency` VARCHAR(10) NULL DEFAULT 'KRW' COMMENT '통화 (기본 KRW)',
  `paymentMethod` VARCHAR(30) NULL COMMENT '결제수단 (CARD/BANK/CASH 등)',
  `reservationId` VARCHAR(50) NULL COMMENT '예약 식별자(필요 시)',
  `memo` TEXT NULL COMMENT '비고/메모',
  `metadata` TEXT NULL COMMENT '추가 정보(JSON 문자열 보관)',
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '생성일',
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정일',
  PRIMARY KEY (`esntlId`),
  INDEX `idx_roomEsntlId` (`roomEsntlId`),
  INDEX `idx_actionType` (`actionType`),
  INDEX `idx_createdAt` (`createdAt`),
  INDEX `idx_actorAdminId` (`actorAdminId`),
  INDEX `idx_actorCustomerId` (`actorCustomerId`),
  INDEX `idx_room_action_created` (`roomEsntlId`, `actionType`, `createdAt`),
  CONSTRAINT `fk_roomActionHistory_room` FOREIGN KEY (`roomEsntlId`)
    REFERENCES `room` (`esntlId`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_roomActionHistory_customer` FOREIGN KEY (`actorCustomerId`)
    REFERENCES `customer` (`esntlId`)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci COMMENT='방 액션/이벤트 이력 테이블';

