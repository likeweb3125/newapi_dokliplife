-- =============================================
-- 방이동 상태 관리 테이블 생성 SQL
-- =============================================

CREATE TABLE IF NOT EXISTS `roomMoveStatus` (
  `esntlId` VARCHAR(50) NOT NULL COMMENT '방이동 상태 고유아이디 (RMV0000000001 형식)',
  `gosiwonEsntlId` VARCHAR(50) NOT NULL COMMENT '고시원 고유아이디',
  `contractEsntlId` VARCHAR(50) NOT NULL COMMENT '방계약 고유아이디',
  `customerEsntlId` VARCHAR(50) NULL COMMENT '고객 고유아이디',
  `originalRoomEsntlId` VARCHAR(50) NOT NULL COMMENT '원래 방 고유아이디',
  `targetRoomEsntlId` VARCHAR(50) NOT NULL COMMENT '이동할 방 고유아이디',
  `reason` VARCHAR(50) NOT NULL COMMENT '방이동 사유 (OWNER: 운영자, CUSTOMER: 고객단순변심)',
  `status` VARCHAR(50) NOT NULL DEFAULT 'PENDING' COMMENT '방이동 상태 (PENDING: 신청중, COMPLETED: 처리완료, CANCELLED: 신청취소)',
  `moveDate` DATETIME NOT NULL COMMENT '방이동일자',
  `adjustmentAmount` INTEGER NOT NULL DEFAULT 0 COMMENT '조정금액 (양수: 추가금액, 음수: 차감금액, 0: 조정없음)',
  `memo` TEXT NULL COMMENT '메모',
  `deleteYN` CHAR(1) NOT NULL DEFAULT 'N' COMMENT '삭제여부',
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '생성일',
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정일',
  PRIMARY KEY (`esntlId`),
  INDEX `idx_gosiwonEsntlId` (`gosiwonEsntlId`),
  INDEX `idx_contractEsntlId` (`contractEsntlId`),
  INDEX `idx_customerEsntlId` (`customerEsntlId`),
  INDEX `idx_originalRoomEsntlId` (`originalRoomEsntlId`),
  INDEX `idx_targetRoomEsntlId` (`targetRoomEsntlId`),
  INDEX `idx_reason` (`reason`),
  INDEX `idx_status` (`status`),
  INDEX `idx_moveDate` (`moveDate`),
  INDEX `idx_deleteYN` (`deleteYN`),
  INDEX `idx_gosiwon_delete` (`gosiwonEsntlId`, `deleteYN`),
  INDEX `idx_contract_delete` (`contractEsntlId`, `deleteYN`),
  INDEX `idx_customer_delete` (`customerEsntlId`, `deleteYN`),
  INDEX `idx_status_delete` (`status`, `deleteYN`),
  INDEX `idx_move_date_delete` (`moveDate`, `deleteYN`),
  CONSTRAINT `fk_roomMoveStatus_gosiwon` FOREIGN KEY (`gosiwonEsntlId`)
    REFERENCES `gosiwon` (`esntlId`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_roomMoveStatus_contract` FOREIGN KEY (`contractEsntlId`)
    REFERENCES `roomContract` (`esntlId`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_roomMoveStatus_customer` FOREIGN KEY (`customerEsntlId`)
    REFERENCES `customer` (`esntlId`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_roomMoveStatus_originalRoom` FOREIGN KEY (`originalRoomEsntlId`)
    REFERENCES `room` (`esntlId`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_roomMoveStatus_targetRoom` FOREIGN KEY (`targetRoomEsntlId`)
    REFERENCES `room` (`esntlId`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci COMMENT='방이동 상태 관리 테이블';

-- =============================================
-- 인덱스 추가 (성능 최적화)
-- =============================================

-- 고시원별 방이동 조회 최적화
CREATE INDEX `idx_roomMoveStatus_gosiwon_date` ON `roomMoveStatus` (`gosiwonEsntlId`, `moveDate`, `deleteYN`);

-- 고시원별 상태 조회 최적화
CREATE INDEX `idx_roomMoveStatus_gosiwon_status` ON `roomMoveStatus` (`gosiwonEsntlId`, `status`, `deleteYN`);

-- 계약별 방이동 조회 최적화
CREATE INDEX `idx_roomMoveStatus_contract_date` ON `roomMoveStatus` (`contractEsntlId`, `moveDate`, `deleteYN`);

-- 계약별 상태 조회 최적화
CREATE INDEX `idx_roomMoveStatus_contract_status` ON `roomMoveStatus` (`contractEsntlId`, `status`, `deleteYN`);

-- 고객별 방이동 조회 최적화
CREATE INDEX `idx_roomMoveStatus_customer_date` ON `roomMoveStatus` (`customerEsntlId`, `moveDate`, `deleteYN`);

-- 고객별 상태 조회 최적화
CREATE INDEX `idx_roomMoveStatus_customer_status` ON `roomMoveStatus` (`customerEsntlId`, `status`, `deleteYN`);

-- 방별 방이동 조회 최적화 (원래 방 기준)
CREATE INDEX `idx_roomMoveStatus_original_room_date` ON `roomMoveStatus` (`originalRoomEsntlId`, `moveDate`, `deleteYN`);

-- 방별 방이동 조회 최적화 (이동할 방 기준)
CREATE INDEX `idx_roomMoveStatus_target_room_date` ON `roomMoveStatus` (`targetRoomEsntlId`, `moveDate`, `deleteYN`);

-- =============================================
-- 참고사항
-- =============================================

-- roomMoveStatus 테이블은 방이동 이력을 관리하는 테이블입니다.
-- 
-- 주요 특징:
--   - esntlId: RMV0000000001 형식의 고유아이디
--   - gosiwonEsntlId: 고시원과 연결
--   - contractEsntlId: 방계약과 연결 (필수)
--   - customerEsntlId: 고객과 연결 (선택)
--   - originalRoomEsntlId: 원래 방과 연결 (필수)
--   - targetRoomEsntlId: 이동할 방과 연결 (필수)
--   - reason: 방이동 사유
--     * OWNER: 운영자
--     * CUSTOMER: 고객단순변심
--   - status: 방이동 상태
--     * PENDING: 신청중
--     * COMPLETED: 처리완료
--     * CANCELLED: 신청취소
--   - moveDate: 방이동일자
--   - adjustmentAmount: 조정금액
--     * 양수: 추가금액 (고객이 추가로 지불)
--     * 음수: 차감금액 (고객에게 환불)
--     * 0: 조정없음
--   - memo: 방이동 관련 추가 메모 정보
-- 
-- 사용 예시:
--   - 계약별 방이동 이력 조회: contractEsntlId로 조회
--   - 고객별 방이동 이력 조회: customerEsntlId로 조회
--   - 방별 방이동 이력 조회: originalRoomEsntlId 또는 targetRoomEsntlId로 조회
--   - 고시원별 방이동 현황: gosiwonEsntlId로 조회
--   - 상태별 방이동 조회: status로 조회 (PENDING, COMPLETED, CANCELLED)
--   - 기간별 방이동 통계: moveDate로 조회

