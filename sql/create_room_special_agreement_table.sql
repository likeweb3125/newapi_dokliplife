-- =============================================
-- 방 특약 관리 테이블 생성 SQL
-- =============================================

-- roomSpecialAgreement 테이블 (방 특약 관리)
-- 방별 특약 타입과 특약 내용을 관리하는 테이블
CREATE TABLE IF NOT EXISTS `roomSpecialAgreement` (
  `esntlId` VARCHAR(50) NOT NULL COMMENT '특약 고유아이디',
  `roomEsntlId` VARCHAR(50) NOT NULL COMMENT '방 고유아이디',
  `agreementType` VARCHAR(50) NOT NULL COMMENT '특약타입 (GENERAL: 독립생활 일반 규정 11항 적용, GOSIWON: 현재 고시원 특약사항 적용, ROOM: 해당 방만 특약사항 수정)',
  `agreementContent` TEXT NULL COMMENT '특약내용',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '생성시간',
  PRIMARY KEY (`esntlId`),
  INDEX `idx_roomEsntlId` (`roomEsntlId`),
  CONSTRAINT `fk_roomSpecialAgreement_room` FOREIGN KEY (`roomEsntlId`) 
    REFERENCES `room` (`esntlId`) 
    ON DELETE CASCADE 
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci COMMENT='방 특약 관리 테이블';

-- =============================================
-- 인덱스 추가 (성능 최적화)
-- =============================================

-- 방별 특약 타입별 조회 최적화
-- 주의: 이미 인덱스가 존재하는 경우 오류가 발생할 수 있습니다.
CREATE INDEX `idx_roomSpecialAgreement_room_type` ON `roomSpecialAgreement` (`roomEsntlId`, `agreementType`);

-- =============================================
-- 참고사항
-- =============================================

-- roomSpecialAgreement 테이블은 각 방별로 특약 타입과 특약 내용을 관리합니다.
-- agreementType은 다음 중 하나여야 합니다:
--   - GENERAL: 독립생활 일반 규정 11항 적용
--   - GOSIWON: 현재 고시원 특약사항 적용
--   - ROOM: 해당 방만 특약사항 수정
--
-- room 테이블의 agreementType, agreementContent 컬럼과 연계하여 사용할 수 있습니다.
-- 이 테이블을 통해 방별 특약 이력을 관리하거나, 특약 변경 내역을 추적할 수 있습니다.

