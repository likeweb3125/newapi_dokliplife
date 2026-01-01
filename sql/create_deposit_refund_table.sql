-- =============================================
-- depositRefund 테이블 생성 SQL
-- =============================================
-- 보증금 환불 정보를 저장하는 테이블

CREATE TABLE IF NOT EXISTS `depositRefund` (
  `esntlId` VARCHAR(50) NOT NULL COMMENT '보증금 환불 고유아이디 (DERF0000000001 형식)',
  `contractEsntlId` VARCHAR(50) NOT NULL COMMENT '방계약 고유아이디',
  `bank` VARCHAR(100) NULL COMMENT '환불 받을 은행명',
  `bankAccount` VARCHAR(100) NULL COMMENT '환불 받을 계좌번호',
  `accountHolder` VARCHAR(100) NULL COMMENT '계좌소유자 이름',
  `refundItems` JSON NULL COMMENT '환불 항목 배열 (JSON 형식: [{"content": "항목명", "amount": 금액}, ...])',
  `totalDepositAmount` INT(11) NOT NULL DEFAULT 0 COMMENT '전체 예약금 금액',
  `totalRefundAmount` INT(11) NOT NULL DEFAULT 0 COMMENT '환불 항목 합계 금액',
  `finalRefundAmount` INT(11) NOT NULL DEFAULT 0 COMMENT '최종 환불 금액',
  `status` VARCHAR(50) NOT NULL DEFAULT 'PARTIAL' COMMENT '환불 상태 (COMPLETED: 전액환불, PARTIAL: 부분환불)',
  `manager` VARCHAR(100) NULL COMMENT '작성자 ID',
  `deleteYN` CHAR(1) NOT NULL DEFAULT 'N' COMMENT '삭제여부',
  `deletedBy` VARCHAR(50) NULL COMMENT '삭제한 관리자 ID',
  `deletedAt` DATETIME NULL COMMENT '삭제 시간',
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '생성일',
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정일',
  PRIMARY KEY (`esntlId`),
  INDEX `idx_contractEsntlId` (`contractEsntlId`),
  INDEX `idx_status` (`status`),
  INDEX `idx_manager` (`manager`),
  INDEX `idx_deleteYN` (`deleteYN`),
  INDEX `idx_deletedBy` (`deletedBy`),
  INDEX `idx_deletedAt` (`deletedAt`),
  INDEX `idx_createdAt` (`createdAt`),
  CONSTRAINT `fk_depositRefund_roomContract` FOREIGN KEY (`contractEsntlId`) 
    REFERENCES `roomContract` (`esntlId`) 
    ON DELETE CASCADE 
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci COMMENT='보증금 환불 정보 테이블';

-- =============================================
-- 복합 인덱스 추가 (성능 최적화)
-- =============================================

-- 계약서별 환불 정보 조회 최적화
CREATE INDEX `idx_depositRefund_contract_delete` ON `depositRefund` (`contractEsntlId`, `deleteYN`);

-- 작성자별 환불 정보 조회 최적화
CREATE INDEX `idx_depositRefund_manager_delete` ON `depositRefund` (`manager`, `deleteYN`);

-- =============================================
-- 완료
-- =============================================

