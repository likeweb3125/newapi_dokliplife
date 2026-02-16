-- =============================================
-- roomStatus 테이블에 gosiwonEsntlId 컬럼 추가 SQL
-- =============================================

-- gosiwonEsntlId 컬럼 추가
-- 고시원 고유 아이디를 저장하는 컬럼
-- 주의: 이미 컬럼이 존재하는 경우 오류가 발생할 수 있습니다.
ALTER TABLE `roomStatus` 
ADD COLUMN `gosiwonEsntlId` VARCHAR(50) NULL COMMENT '고시원 고유 아이디' 
AFTER `roomEsntlId`;

-- 기존 데이터 업데이트 (room 테이블과 join하여 gosiwonEsntlId 설정)
UPDATE `roomStatus` RS
INNER JOIN `room` R ON RS.roomEsntlId = R.esntlId
SET RS.gosiwonEsntlId = R.gosiwonEsntlId
WHERE RS.gosiwonEsntlId IS NULL;

-- NOT NULL 제약 조건 추가 (기존 데이터 업데이트 후)
ALTER TABLE `roomStatus` 
MODIFY COLUMN `gosiwonEsntlId` VARCHAR(50) NOT NULL COMMENT '고시원 고유 아이디';

-- =============================================
-- 인덱스 추가 (성능 최적화)
-- =============================================

-- 고시원별 조회 최적화
-- 주의: 이미 인덱스가 존재하는 경우 오류가 발생할 수 있습니다.
CREATE INDEX `idx_roomStatus_gosiwonEsntlId` ON `roomStatus` (`gosiwonEsntlId`);

-- 고시원별 상태 조회 최적화
CREATE INDEX `idx_roomStatus_gosiwon_status` ON `roomStatus` (`gosiwonEsntlId`, `status`);

-- =============================================
-- 외래키 제약 조건 추가
-- =============================================

-- gosiwon 테이블과의 외래키 제약 조건 추가
-- 주의: 이미 제약 조건이 존재하는 경우 오류가 발생할 수 있습니다.
ALTER TABLE `roomStatus`
ADD CONSTRAINT `fk_roomStatus_gosiwon` FOREIGN KEY (`gosiwonEsntlId`) 
  REFERENCES `gosiwon` (`esntlId`) 
  ON DELETE CASCADE 
  ON UPDATE CASCADE;
