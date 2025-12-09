-- roomStatus 테이블에 예약/계약자 정보 컬럼 추가 스크립트

-- 1) 컬럼 추가 (NULL 허용으로 먼저 추가)
ALTER TABLE `roomStatus`
  ADD COLUMN `reservationEsntlId` VARCHAR(50) NULL COMMENT '예약자 고유아이디' AFTER `customerName`,
  ADD COLUMN `reservationName` VARCHAR(100) NULL COMMENT '예약자 이름' AFTER `reservationEsntlId`,
  ADD COLUMN `contractorEsntlId` VARCHAR(50) NULL COMMENT '계약자 고유아이디' AFTER `reservationName`,
  ADD COLUMN `contractorName` VARCHAR(100) NULL COMMENT '계약자 이름' AFTER `contractorEsntlId`;

-- 2) 필요시 기존 데이터 마이그레이션 로직을 여기에 추가하세요.
-- 예: UPDATE roomStatus SET reservationEsntlId = customerEsntlId, reservationName = customerName WHERE reservationEsntlId IS NULL;


