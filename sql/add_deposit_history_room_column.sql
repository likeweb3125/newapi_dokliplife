-- =============================================
-- depositHistory 테이블에 roomEsntlId 컬럼 추가
-- =============================================
-- 기존 테이블에 roomEsntlId 컬럼을 추가하는 SQL
-- 이미 테이블이 생성된 경우 이 SQL을 실행하세요.

-- 1. roomEsntlId 컬럼 추가 (NULL 허용으로 먼저 추가)
ALTER TABLE `depositHistory`
  ADD COLUMN `roomEsntlId` VARCHAR(50) NULL COMMENT '방 고유아이디' AFTER `depositEsntlId`;

-- 1-1. 기존 데이터 업데이트 (deposit 테이블의 roomEsntlId를 참조하여 채움)
UPDATE `depositHistory` dh
INNER JOIN `deposit` d ON dh.`depositEsntlId` = d.`esntlId`
SET dh.`roomEsntlId` = d.`roomEsntlId`
WHERE dh.`roomEsntlId` IS NULL;

-- 1-2. NOT NULL 제약조건 추가
ALTER TABLE `depositHistory`
  MODIFY COLUMN `roomEsntlId` VARCHAR(50) NOT NULL COMMENT '방 고유아이디';

-- 2. 인덱스 추가
CREATE INDEX `idx_roomEsntlId` ON `depositHistory` (`roomEsntlId`);

-- 3. 외래키 제약조건 추가
ALTER TABLE `depositHistory`
  ADD CONSTRAINT `fk_depositHistory_room` FOREIGN KEY (`roomEsntlId`) 
    REFERENCES `room` (`esntlId`) 
    ON DELETE CASCADE 
    ON UPDATE CASCADE;

-- 4. 기존 데이터 업데이트 (deposit 테이블의 roomEsntlId를 참조하여 채움)
UPDATE `depositHistory` dh
INNER JOIN `deposit` d ON dh.`depositEsntlId` = d.`esntlId`
SET dh.`roomEsntlId` = d.`roomEsntlId`
WHERE dh.`roomEsntlId` IS NULL;

