-- =============================================
-- 방 상태 관리 테이블 생성 SQL
-- =============================================

-- 1. roomStatus 테이블 (현재 방 상태 관리)
-- 방의 현재 상태를 저장하는 테이블
CREATE TABLE IF NOT EXISTS `roomStatus` (
  `esntlId` VARCHAR(50) NOT NULL COMMENT '방 상태 고유아이디',
  `roomEsntlId` VARCHAR(50) NOT NULL COMMENT '방 고유아이디',
  `status` VARCHAR(50) NOT NULL COMMENT '방 상태 (BEFORE_SALES: 판매신청전, ON_SALE: 판매중, DEPOSIT_PENDING: 입금대기중, RESERVED: 예약중, IN_USE: 이용중, OVERDUE: 체납상태, CHECKOUT_REQUESTED: 퇴실요청, CHECKOUT_CONFIRMED: 퇴실확정, ROOM_MOVE: 방이동)',
  `customerEsntlId` VARCHAR(50) NULL COMMENT '입실자 고유아이디',
  `customerName` VARCHAR(100) NULL COMMENT '입실자 이름',
  `reservationEsntlId` VARCHAR(50) NULL COMMENT '예약자 고유아이디',
  `reservationName` VARCHAR(100) NULL COMMENT '예약자 이름',
  `contractorEsntlId` VARCHAR(50) NULL COMMENT '계약자 고유아이디',
  `contractorName` VARCHAR(100) NULL COMMENT '계약자 이름',
  `statusStartDate` DATETIME NULL COMMENT '계약 시작일',
  `statusEndDate` DATETIME NULL COMMENT '계약 종료일',
  `etcStartDate` DATETIME NULL COMMENT '기타 시작일',
  `etcEndDate` DATETIME NULL COMMENT '기타 종료일',
  `memo` TEXT NULL COMMENT '메모',
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '생성일',
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정일',
  PRIMARY KEY (`esntlId`),
  INDEX `idx_roomEsntlId` (`roomEsntlId`),
  INDEX `idx_status` (`status`),
  INDEX `idx_customerEsntlId` (`customerEsntlId`),
  CONSTRAINT `fk_roomStatus_room` FOREIGN KEY (`roomEsntlId`) 
    REFERENCES `room` (`esntlId`) 
    ON DELETE CASCADE 
    ON UPDATE CASCADE,
  CONSTRAINT `fk_roomStatus_customer` FOREIGN KEY (`customerEsntlId`) 
    REFERENCES `customer` (`esntlId`) 
    ON DELETE SET NULL 
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci COMMENT='방 현재 상태 관리 테이블';



-- =============================================
-- 인덱스 추가 (성능 최적화)
-- =============================================

-- roomStatus 테이블 추가 인덱스
-- 방별 상태 조회 최적화
CREATE INDEX `idx_roomStatus_room_status` ON `roomStatus` (`roomEsntlId`, `status`);

-- =============================================
-- 초기 데이터 (선택사항)
-- =============================================

-- 기존 방들에 대한 기본 상태를 설정하려면 아래 쿼리 실행
-- INSERT INTO roomStatus (esntlId, roomEsntlId, status, createdAt, updatedAt)
-- SELECT 
--   CONCAT('RSTA', LPAD(ROW_NUMBER() OVER (ORDER BY esntlId), 10, '0')) as esntlId,
--   esntlId as roomEsntlId,
--   COALESCE(status, 'BEFORE_SALES') as status,
--   NOW() as createdAt,
--   NOW() as updatedAt
-- FROM room
-- WHERE deleteYN = 'N'
--   AND NOT EXISTS (
--     SELECT 1 FROM roomStatus WHERE roomStatus.roomEsntlId = room.esntlId
--   );

