-- =============================================
-- IDS 테이블 (테이블별 시퀀스 ID 관리)
-- next(tbl_name, prefix) 호출 시 해당 tableName의 count가 1 증가하고 prefix + count 로 ID 반환
-- =============================================

SET NAMES utf8mb3 COLLATE utf8mb3_general_ci;

CREATE TABLE IF NOT EXISTS `IDS` (
  `tableName` VARCHAR(100) NOT NULL COMMENT '테이블명 (예: il_room_deposit_history, paymentLog)',
  `prefix` VARCHAR(20) NOT NULL DEFAULT '' COMMENT 'ID 접두사 (예: RDP, DEPO)',
  `count` INT(11) NOT NULL DEFAULT 0 COMMENT '현재까지 사용한 번호 (next 호출 시 1 증가)',
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정일',
  PRIMARY KEY (`tableName`),
  INDEX `idx_prefix` (`prefix`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci COMMENT='테이블별 ID 시퀀스';

-- il_room_deposit_history 사용 시 아래 행 등록 (이미 있으면 무시)
-- next('il_room_deposit_history', 'RDP') 호출 시 RDP + count(0패딩) 형식 ID 발급
INSERT IGNORE INTO `IDS` (`tableName`, `prefix`, `count`) VALUES ('il_room_deposit_history', 'RDP', 0);
