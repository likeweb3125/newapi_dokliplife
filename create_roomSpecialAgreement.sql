-- 방 특약 관리 테이블 생성
CREATE TABLE `roomSpecialAgreement` (
  `esntlId` VARCHAR(50) NOT NULL COMMENT '특약 고유아이디',
  `roomEsntlId` VARCHAR(50) NOT NULL COMMENT '방 고유아이디',
  `agreementType` VARCHAR(50) NOT NULL COMMENT '특약타입 (GENERAL: 독립생활 일반 규정 11항 적용, GOSIWON: 현재 고시원 특약사항 적용, ROOM: 해당 방만 특약사항 수정)',
  `agreementContent` TEXT NULL COMMENT '특약내용',
  `created_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP COMMENT '생성시간',
  PRIMARY KEY (`esntlId`),
  INDEX `idx_roomEsntlId` (`roomEsntlId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='방 특약 관리 테이블';

