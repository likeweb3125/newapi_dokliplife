-- =============================================
-- 주차 상태 관리 테이블 생성 SQL
-- =============================================

CREATE TABLE IF NOT EXISTS `parkStatus` (
  `esntlId` VARCHAR(50) NOT NULL COMMENT '주차 상태 고유아이디 (PKST0000000001 형식)',
  `gosiwonEsntlId` VARCHAR(50) NOT NULL COMMENT '고시원 고유아이디',
  `contractEsntlId` VARCHAR(50) NULL COMMENT '방계약 고유아이디',
  `customerEsntlId` VARCHAR(50) NULL COMMENT '고객 고유아이디',
  `status` VARCHAR(50) NOT NULL DEFAULT 'AVAILABLE' COMMENT '주차 상태 (AVAILABLE: 사용가능, IN_USE: 사용중, RESERVED: 예약됨, EXPIRED: 만료됨)',
  `useStartDate` DATE NULL COMMENT '사용 시작일',
  `useEndDate` DATE NULL COMMENT '사용 종료일',
  `memo` VARCHAR(500) NULL COMMENT '메모 (차량번호, 차종 등)',
  `deleteYN` CHAR(1) NOT NULL DEFAULT 'N' COMMENT '삭제여부',
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '생성일',
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정일',
  PRIMARY KEY (`esntlId`),
  INDEX `idx_gosiwonEsntlId` (`gosiwonEsntlId`),
  INDEX `idx_contractEsntlId` (`contractEsntlId`),
  INDEX `idx_customerEsntlId` (`customerEsntlId`),
  INDEX `idx_status` (`status`),
  INDEX `idx_deleteYN` (`deleteYN`),
  INDEX `idx_useStartDate` (`useStartDate`),
  INDEX `idx_useEndDate` (`useEndDate`),
  INDEX `idx_gosiwon_status` (`gosiwonEsntlId`, `status`, `deleteYN`),
  INDEX `idx_contract_status` (`contractEsntlId`, `status`, `deleteYN`),
  INDEX `idx_customer_status` (`customerEsntlId`, `status`, `deleteYN`),
  INDEX `idx_date_range` (`useStartDate`, `useEndDate`),
  CONSTRAINT `fk_parkStatus_gosiwon` FOREIGN KEY (`gosiwonEsntlId`)
    REFERENCES `gosiwon` (`esntlId`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_parkStatus_contract` FOREIGN KEY (`contractEsntlId`)
    REFERENCES `roomContract` (`esntlId`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_parkStatus_customer` FOREIGN KEY (`customerEsntlId`)
    REFERENCES `customer` (`esntlId`)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci COMMENT='주차 상태 관리 테이블';

-- =============================================
-- 인덱스 추가 (성능 최적화)
-- =============================================

-- 상태별 조회 최적화
CREATE INDEX `idx_parkStatus_status_delete` ON `parkStatus` (`status`, `deleteYN`, `createdAt`);

-- 기간별 조회 최적화
CREATE INDEX `idx_parkStatus_date_range_delete` ON `parkStatus` (`useStartDate`, `useEndDate`, `deleteYN`);

-- 고시원별 기간 조회 최적화
CREATE INDEX `idx_parkStatus_gosiwon_date` ON `parkStatus` (`gosiwonEsntlId`, `useStartDate`, `useEndDate`, `deleteYN`);

-- =============================================
-- 참고사항
-- =============================================

-- parkStatus 테이블은 주차장 사용 상태를 관리하는 테이블입니다.
-- 
-- 주요 특징:
--   - esntlId: PARK0000000001 형식의 고유아이디
--   - gosiwonEsntlId: 고시원과 연결
--   - contractEsntlId: 방계약과 연결 (계약 시 주차 사용)
--   - customerEsntlId: 고객과 연결
--   - status: 주차 상태 관리
--     * AVAILABLE: 사용 가능
--     * IN_USE: 현재 사용 중
--     * RESERVED: 예약됨
--     * EXPIRED: 만료됨
--   - useStartDate, useEndDate: 주차 사용 기간
--   - memo: 차량번호, 차종 등 주차 관련 메모 정보
-- 
-- 사용 예시:
--   - 계약 시 주차 사용: contractEsntlId와 customerEsntlId 함께 사용
--   - 기간별 주차 상태 조회: useStartDate, useEndDate 활용
--   - 고시원별 주차 현황: gosiwonEsntlId로 조회
