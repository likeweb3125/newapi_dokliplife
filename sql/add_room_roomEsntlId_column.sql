-- =============================================
-- room 테이블에 roomEsntlId 컬럼 추가 SQL
-- =============================================
-- 주의: 이미 컬럼이 존재하는 경우 오류가 발생할 수 있습니다.

-- roomEsntlId 컬럼 추가 (customerEsntlId 컬럼 아래)
ALTER TABLE `room` 
ADD COLUMN `roomEsntlId` VARCHAR(50) NULL COMMENT '방 고유아이디 (자기참조)' 
AFTER `customerEsntlId`;

-- 인덱스 추가 (성능 최적화)
-- 주의: 이미 인덱스가 존재하는 경우 오류가 발생할 수 있습니다.
CREATE INDEX `idx_room_roomEsntlId` ON `room` (`roomEsntlId`);

-- 외래키 제약 조건 추가 (자기참조)
-- 주의: 이미 제약 조건이 존재하는 경우 오류가 발생할 수 있습니다.
ALTER TABLE `room`
ADD CONSTRAINT `fk_room_roomEsntlId` FOREIGN KEY (`roomEsntlId`) 
  REFERENCES `room` (`esntlId`) 
  ON DELETE SET NULL 
  ON UPDATE CASCADE;

-- =============================================
-- 완료
-- =============================================

