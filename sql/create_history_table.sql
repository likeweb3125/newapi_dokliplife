-- =============================================
-- 통합 히스토리 관리 테이블 생성 SQL
-- 모든 액션을 아우르는 히스토리용 테이블
-- =============================================

CREATE TABLE IF NOT EXISTS `history` (
  `esntlId` VARCHAR(50) NOT NULL COMMENT '히스토리 고유아이디 (HISTORY0000000001 형식)',
  `gosiwonEsntlId` VARCHAR(50) NULL COMMENT '고시원 고유아이디',
  `roomEsntlId` VARCHAR(50) NULL COMMENT '방 고유아이디',
  `contractEsntlId` VARCHAR(50) NULL COMMENT '방계약 고유아이디',
  `depositEsntlId` VARCHAR(50) NULL COMMENT '보증금 고유아이디',
  `etcEsntlId` VARCHAR(50) NULL COMMENT '기타 고유아이디 (그 외의 id 값)',
  `content` TEXT NULL COMMENT '히스토리 내용',
  `category` VARCHAR(50) NULL COMMENT '히스토리 카테고리 (GOSIWON, ROOM, CONTRACT, DEPOSIT, CUSTOMER, ETC 등)',
  `priority` VARCHAR(20) NULL DEFAULT 'NORMAL' COMMENT '중요도 (LOW, NORMAL, HIGH, URGENT)',
  `publicRange` TINYINT(1) NULL DEFAULT 0 COMMENT '공개범위 (0: 비공개, 1: 공개)',
  `writerAdminId` VARCHAR(50) NULL COMMENT '작성한 관리자 ID',
  `writerCustomerId` VARCHAR(50) NULL COMMENT '작성한 고객 고유아이디',
  `writerType` VARCHAR(20) NULL COMMENT '작성자 타입 (ADMIN, PARTNER)',
  `tags` VARCHAR(500) NULL COMMENT '태그 (쉼표로 구분)',
  `isPinned` TINYINT(1) NULL DEFAULT 0 COMMENT '고정 여부 (0: 일반, 1: 고정)',
  `deleteYN` CHAR(1) NOT NULL DEFAULT 'N' COMMENT '삭제여부',
  `deletedBy` VARCHAR(50) NULL COMMENT '삭제한 관리자 ID',
  `deletedAt` DATETIME NULL COMMENT '삭제 시간',
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '생성일',
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정일',
  PRIMARY KEY (`esntlId`),
  INDEX `idx_gosiwonEsntlId` (`gosiwonEsntlId`),
  INDEX `idx_roomEsntlId` (`roomEsntlId`),
  INDEX `idx_contractEsntlId` (`contractEsntlId`),
  INDEX `idx_depositEsntlId` (`depositEsntlId`),
  INDEX `idx_etcEsntlId` (`etcEsntlId`),
  INDEX `idx_category` (`category`),
  INDEX `idx_priority` (`priority`),
  INDEX `idx_writerAdminId` (`writerAdminId`),
  INDEX `idx_writerCustomerId` (`writerCustomerId`),
  INDEX `idx_writerType` (`writerType`),
  INDEX `idx_isPinned` (`isPinned`),
  INDEX `idx_deleteYN` (`deleteYN`),
  INDEX `idx_deletedBy` (`deletedBy`),
  INDEX `idx_deletedAt` (`deletedAt`),
  INDEX `idx_createdAt` (`createdAt`),
  INDEX `idx_updatedAt` (`updatedAt`),
  INDEX `idx_gosiwon_created` (`gosiwonEsntlId`, `deleteYN`, `createdAt`),
  INDEX `idx_room_created` (`roomEsntlId`, `deleteYN`, `createdAt`),
  INDEX `idx_contract_created` (`contractEsntlId`, `deleteYN`, `createdAt`),
  INDEX `idx_deposit_created` (`depositEsntlId`, `deleteYN`, `createdAt`),
  CONSTRAINT `fk_history_gosiwon` FOREIGN KEY (`gosiwonEsntlId`)
    REFERENCES `gosiwon` (`esntlId`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_history_room` FOREIGN KEY (`roomEsntlId`)
    REFERENCES `room` (`esntlId`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_history_contract` FOREIGN KEY (`contractEsntlId`)
    REFERENCES `roomContract` (`esntlId`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_history_deposit` FOREIGN KEY (`depositEsntlId`)
    REFERENCES `deposit` (`esntlId`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_history_customer` FOREIGN KEY (`writerCustomerId`)
    REFERENCES `customer` (`esntlId`)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci COMMENT='통합 히스토리 관리 테이블';

-- =============================================
-- 인덱스 추가 (성능 최적화)
-- =============================================

-- 카테고리별 조회 최적화
CREATE INDEX `idx_history_category_delete` ON `history` (`category`, `deleteYN`, `createdAt`);

-- 중요도별 조회 최적화
CREATE INDEX `idx_history_priority_delete` ON `history` (`priority`, `deleteYN`, `createdAt`);

-- 작성자별 조회 최적화
CREATE INDEX `idx_history_writer_admin` ON `history` (`writerAdminId`, `deleteYN`, `createdAt`);
CREATE INDEX `idx_history_writer_customer` ON `history` (`writerCustomerId`, `deleteYN`, `createdAt`);

-- 고정 히스토리 조회 최적화
CREATE INDEX `idx_history_pinned` ON `history` (`isPinned`, `deleteYN`, `createdAt`);

-- =============================================
-- 참고사항
-- =============================================

-- history 테이블은 모든 액션을 아우르는 통합 히스토리 관리 테이블입니다.
-- 
-- 주요 특징:
--   - esntlId: HISTORY0000000001 형식의 고유아이디
--   - 여러 ID 컬럼을 통해 다양한 엔티티와 연결 가능
--   - etcEsntlId로 그 외의 ID 값도 저장 가능
--   - 카테고리와 중요도를 통한 분류 가능
--   - 공개범위 설정으로 히스토리 공개/비공개 관리
--   - 고정 기능으로 중요 히스토리 상단 고정 가능
--   - 태그 기능으로 히스토리 검색 및 분류 용이
--   - 작성자 정보(관리자/고객) 추적 가능
-- 
-- 사용 예시:
--   - 고시원 관련 히스토리: gosiwonEsntlId 사용
--   - 방 관련 히스토리: roomEsntlId 사용
--   - 계약 관련 히스토리: contractEsntlId 사용
--   - 보증금 관련 히스토리: depositEsntlId 사용
--   - 기타 히스토리: etcEsntlId 사용
