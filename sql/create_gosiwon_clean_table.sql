-- =============================================
-- 고시원 청소 요일 관리 테이블 생성 SQL
-- =============================================
-- 삭제/수정 없이 새로 등록하는 방식. 적용기간(선택)별로 이력 보관.

SET NAMES utf8mb3 COLLATE utf8mb3_general_ci;

CREATE TABLE IF NOT EXISTS `gosiwonClean` (
  `esntlId` VARCHAR(50) NOT NULL COMMENT '청소설정 고유아이디 (IDS GCLN)',
  `gosiwonEsntlId` VARCHAR(50) NOT NULL COMMENT '고시원 고유아이디',
  `cleaning_days` VARCHAR(100) NOT NULL COMMENT '청소 요일 (예: 월 / 수 / 금)',
  `application_start_date` DATE NULL COMMENT '적용기간 시작일 (NULL이면 설정 안 함)',
  `application_end_date` DATE NULL COMMENT '적용기간 종료일 (NULL이면 설정 안 함)',
  `writer_admin_id` VARCHAR(50) NULL COMMENT '등록한 관리자 ID',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '등록일시',
  PRIMARY KEY (`esntlId`),
  INDEX `idx_gosiwonClean_gosiwon` (`gosiwonEsntlId`),
  INDEX `idx_gosiwonClean_dates` (`application_start_date`, `application_end_date`),
  CONSTRAINT `fk_gosiwonClean_gosiwon` FOREIGN KEY (`gosiwonEsntlId`)
    REFERENCES `gosiwon` (`esntlId`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci COMMENT='고시원 청소 요일 설정 이력';

-- IDS 테이블에 gosiwonClean 시퀀스 등록 (prefix GCLN)
INSERT IGNORE INTO `IDS` (`tableName`, `prefix`, `count`) VALUES ('gosiwonClean', 'GCLN', 0);
