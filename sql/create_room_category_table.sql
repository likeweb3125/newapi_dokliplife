-- =============================================
-- 방 카테고리 관리 테이블 생성 SQL
-- =============================================

-- 1. roomCategory 테이블 (방 카테고리 관리)
-- 고시원별 방 카테고리와 기본 가격을 관리하는 테이블
CREATE TABLE IF NOT EXISTS `roomCategory` (
  `esntlId` VARCHAR(50) NOT NULL COMMENT '카테고리 고유아이디',
  `gosiwonEsntlId` VARCHAR(50) NOT NULL COMMENT '고시원 고유아이디',
  `name` VARCHAR(50) NOT NULL COMMENT '카테고리명',
  `base_price` INT(11) NOT NULL COMMENT '정가 (단위: 원)',
  `memo` TEXT NULL COMMENT '메모',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '생성일시',
  PRIMARY KEY (`esntlId`),
  INDEX `idx_roomCategory_gosiwonEstnlId` (`gosiwonEsntlId`),
  CONSTRAINT `fk_roomCategory_gosiwon` FOREIGN KEY (`gosiwonEsntlId`) 
    REFERENCES `gosiwon` (`esntlId`) 
    ON DELETE CASCADE 
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci COMMENT='방 카테고리 관리 테이블';

-- 2. roomCategoryOption 테이블 (방 카테고리 옵션 관리)
-- 방 카테고리별 옵션과 추가 금액을 관리하는 테이블
CREATE TABLE IF NOT EXISTS `roomCategoryOption` (
  `esntlId` VARCHAR(50) NOT NULL COMMENT '옵션 고유아이디',
  `categoryEsntlId` VARCHAR(50) NOT NULL COMMENT '카테고리 고유아이디',
  `option_name` VARCHAR(50) NOT NULL COMMENT '옵션명',
  `option_amount` DECIMAL(10,1) NOT NULL COMMENT '옵션 금액 (단위: 만원)',
  `sort_order` INT(11) DEFAULT 0 COMMENT '정렬순서',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '생성일시',
  PRIMARY KEY (`esntlId`),
  INDEX `idx_roomCategoryOption_categoryEstnlId` (`categoryEsntlId`),
  CONSTRAINT `fk_roomCategoryOption_roomCategory` FOREIGN KEY (`categoryEsntlId`) 
    REFERENCES `roomCategory` (`esntlId`) 
    ON DELETE CASCADE 
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci COMMENT='방 카테고리 옵션 관리 테이블';

-- =============================================
-- 인덱스 추가 (성능 최적화)
-- =============================================

-- 고시원별 카테고리 조회 최적화
-- 이미 위에서 생성되었지만, 추가 최적화가 필요한 경우 아래 인덱스 사용 가능
-- CREATE INDEX `idx_roomCategory_gosiwon_name` ON `roomCategory` (`gosiwonEsntlId`, `name`);

-- =============================================
-- 참고사항
-- =============================================

-- roomCategory 테이블은 고시원별로 방 카테고리를 관리하며,
-- 각 카테고리는 기본 가격(base_price)을 가지고 있습니다.
-- room 테이블의 roomCategory 컬럼과 연결하여 사용합니다.
--
-- roomCategoryOption 테이블은 각 카테고리별 옵션과 추가 금액을 관리합니다.
-- 예를 들어, "남향", "에어컨", "냉장고" 등의 옵션과 각 옵션의 추가 금액을 저장합니다.
-- sort_order를 통해 옵션의 표시 순서를 제어할 수 있습니다.

