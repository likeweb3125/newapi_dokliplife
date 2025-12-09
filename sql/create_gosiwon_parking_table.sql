-- =============================================
-- 고시원 주차장 관리 테이블 생성 SQL
-- =============================================

-- gosiwonParking 테이블 (고시원 주차장 관리)
-- 고시원별 주차장 정보와 주차비를 관리하는 테이블
CREATE TABLE IF NOT EXISTS `gosiwonParking` (
  `esntlId` VARCHAR(50) NOT NULL COMMENT '주차장 고유아이디',
  `gosiwonEsntlId` VARCHAR(50) NOT NULL COMMENT '고시원 고유아이디',
  `structure` VARCHAR(255) NULL COMMENT '주차장 구조',
  `auto` INT(11) DEFAULT 0 COMMENT '자동차 주차 가능 대수',
  `autoPrice` INT(11) DEFAULT 0 COMMENT '자동차 한달 주차비',
  `bike` INT(11) DEFAULT 0 COMMENT '오토바이 주차 가능 대수',
  `bikePrice` INT(11) DEFAULT 0 COMMENT '오토바이 한달 주차비',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '등록일',
  PRIMARY KEY (`esntlId`),
  INDEX `idx_gosiwonEsntlId` (`gosiwonEsntlId`),
  CONSTRAINT `fk_parking_gosiwon` FOREIGN KEY (`gosiwonEsntlId`) 
    REFERENCES `gosiwon` (`esntlId`) 
    ON DELETE CASCADE 
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci COMMENT='주차장 관리 테이블';

-- =============================================
-- 인덱스 추가 (성능 최적화)
-- =============================================

-- 고시원별 주차장 조회 최적화
-- 이미 위에서 생성되었지만, 추가 최적화가 필요한 경우 아래 인덱스 사용 가능
-- CREATE INDEX `idx_gosiwonParking_structure` ON `gosiwonParking` (`structure`);

-- =============================================
-- 참고사항
-- =============================================

-- gosiwonParking 테이블은 각 고시원별로 주차장 정보를 관리합니다.
-- 한 고시원당 하나의 주차장 정보만 등록할 수 있습니다.
-- 
-- 주요 정보:
--   - structure: 주차장 구조 (예: 필로티 구조, 지하 주차장 등)
--   - auto: 자동차 주차 가능 대수
--   - autoPrice: 자동차 한달 주차비 (단위: 원)
--   - bike: 오토바이 주차 가능 대수
--   - bikePrice: 오토바이 한달 주차비 (단위: 원)

