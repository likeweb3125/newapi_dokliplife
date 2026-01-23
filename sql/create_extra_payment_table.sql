-- =============================================
-- 추가 결제 관리 테이블 생성 SQL
-- =============================================

-- extraPayment 테이블 (추가 결제 항목 관리)
-- 계약에 대한 추가 결제 항목(주차비, 추가 입실료, 직접 입력 등)을 관리하는 테이블
-- 기존 paymentLog 테이블의 추가 결제 관련 필드와 호환성을 유지합니다.
CREATE TABLE IF NOT EXISTS `extraPayment` (
  `esntlId` VARCHAR(50) NOT NULL COMMENT '추가 결제 고유아이디 (EXTR 접두사 사용)',
  `contractEsntlId` VARCHAR(50) NOT NULL COMMENT '계약 고유아이디',
  `gosiwonEsntlId` VARCHAR(50) NOT NULL COMMENT '고시원 고유아이디',
  `roomEsntlId` VARCHAR(50) NOT NULL COMMENT '방 고유아이디',
  `customerEsntlId` VARCHAR(50) NOT NULL DEFAULT '' COMMENT '고객 고유아이디',
  `uniqueId` VARCHAR(50) NULL COMMENT '고유 식별자',
  `extraCostName` VARCHAR(200) NOT NULL COMMENT '추가비용명칭 (주차비, 추가 입실료, 직접 입력 등)',
  `memo` TEXT NULL COMMENT '메모 (ex. 2인 추가 / 정가 계산 등)',
  `optionInfo` VARCHAR(200) NULL COMMENT '옵션정보 (주차비의 경우 차량정보, 직접 입력의 경우 옵션명 등)',
  `useStartDate` DATE NULL COMMENT '이용 시작 일자 (주차비, 직접 입력의 경우)',
  `optionName` VARCHAR(200) NULL COMMENT '옵션명 (직접 입력의 경우, 예: 자동차, 오토바이, 기타 비용 등)',
  `extendWithPayment` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '연장시 함께 결제 여부 (0: 미사용, 1: 사용)',
  `pDate` VARCHAR(50) NULL COMMENT '결제 날짜 (YYYY-MM-DD)',
  `pTime` VARCHAR(50) NULL COMMENT '결제 시간 (HH:MM:SS)',
  `paymentAmount` VARCHAR(50) NOT NULL DEFAULT '0' COMMENT '결제 금액 (String 타입, 기존 paymentLog와 호환)',
  `pyl_goods_amount` INT(11) NOT NULL DEFAULT 0 COMMENT '상품금액(원입실료) - 절댓값 저장',
  `imp_uid` VARCHAR(50) NOT NULL DEFAULT '' COMMENT 'PG 결제 고유아이디 (결제 완료 시)',
  `paymentStatus` VARCHAR(50) NOT NULL DEFAULT 'PENDING' COMMENT '결제 상태 (PENDING: 결제대기, COMPLETED: 결제완료, CANCELLED: 결제취소, FAILED: 결제실패)',
  `paymentType` VARCHAR(50) NULL COMMENT '결제 방식 (accountPayment: 계좌 결제, cardPayment: 카드 결제, appPayment: 앱 결제, manualPayment: 수동 결제)',
  `withdrawalStatus` VARCHAR(50) NULL COMMENT '결제 취소 여부 (기존 paymentLog와 호환)',
  `deleteYN` CHAR(1) NOT NULL DEFAULT 'N' COMMENT '삭제여부',
  `deletedBy` VARCHAR(50) NULL COMMENT '삭제한 관리자 ID',
  `deletedAt` DATETIME NULL COMMENT '삭제 시간',
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '생성일',
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정일',
  PRIMARY KEY (`esntlId`),
  INDEX `idx_contractEsntlId` (`contractEsntlId`),
  INDEX `idx_gosiwonEsntlId` (`gosiwonEsntlId`),
  INDEX `idx_roomEsntlId` (`roomEsntlId`),
  INDEX `idx_customerEsntlId` (`customerEsntlId`),
  INDEX `idx_extraCostName` (`extraCostName`),
  INDEX `idx_optionName` (`optionName`),
  INDEX `idx_extendWithPayment` (`extendWithPayment`),
  INDEX `idx_paymentAmount` (`paymentAmount`),
  INDEX `idx_pyl_goods_amount` (`pyl_goods_amount`),
  INDEX `idx_paymentStatus` (`paymentStatus`),
  INDEX `idx_paymentType` (`paymentType`),
  INDEX `idx_withdrawalStatus` (`withdrawalStatus`),
  INDEX `idx_pDate` (`pDate`),
  INDEX `idx_deleteYN` (`deleteYN`),
  INDEX `idx_deletedBy` (`deletedBy`),
  INDEX `idx_deletedAt` (`deletedAt`),
  INDEX `idx_createdAt` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci COMMENT='추가 결제 항목 관리 테이블';

-- =============================================
-- 인덱스 추가 (성능 최적화)
-- =============================================

-- extraPayment 테이블 복합 인덱스
CREATE INDEX `idx_extraPayment_contract_extend` ON `extraPayment` (`contractEsntlId`, `extendWithPayment`, `withdrawalStatus`, `deleteYN`);
CREATE INDEX `idx_extraPayment_gosiwon_delete` ON `extraPayment` (`gosiwonEsntlId`, `deleteYN`);
CREATE INDEX `idx_extraPayment_room_delete` ON `extraPayment` (`roomEsntlId`, `deleteYN`);
CREATE INDEX `idx_extraPayment_extraCostName` ON `extraPayment` (`contractEsntlId`, `extraCostName`, `deleteYN`);
CREATE INDEX `idx_extraPayment_optionName` ON `extraPayment` (`contractEsntlId`, `optionName`, `deleteYN`);
CREATE INDEX `idx_extraPayment_status_type` ON `extraPayment` (`contractEsntlId`, `paymentStatus`, `paymentType`, `deleteYN`);
CREATE INDEX `idx_extraPayment_uniqueId` ON `extraPayment` (`uniqueId`);

-- =============================================
-- 외래키 제약조건 추가 (선택사항)
-- =============================================
-- 주의: 참조하는 테이블(roomContract, gosiwon, room, customer)이 존재하고
--       각 테이블의 esntlId가 PRIMARY KEY로 설정되어 있어야 합니다.
--       외래키 제약조건이 필요하지 않거나 오류가 발생하는 경우 아래 코드를 주석 처리하세요.

-- roomContract 외래키 제약조건 추가
-- ALTER TABLE `extraPayment` 
-- ADD CONSTRAINT `fk_extraPayment_roomContract` FOREIGN KEY (`contractEsntlId`) 
--   REFERENCES `roomContract` (`esntlId`) 
--   ON DELETE CASCADE 
--   ON UPDATE CASCADE;

-- gosiwon 외래키 제약조건 추가
-- ALTER TABLE `extraPayment` 
-- ADD CONSTRAINT `fk_extraPayment_gosiwon` FOREIGN KEY (`gosiwonEsntlId`) 
--   REFERENCES `gosiwon` (`esntlId`) 
--   ON DELETE CASCADE 
--   ON UPDATE CASCADE;

-- room 외래키 제약조건 추가
-- ALTER TABLE `extraPayment` 
-- ADD CONSTRAINT `fk_extraPayment_room` FOREIGN KEY (`roomEsntlId`) 
--   REFERENCES `room` (`esntlId`) 
--   ON DELETE CASCADE 
--   ON UPDATE CASCADE;

-- customer 외래키 제약조건 추가
-- ALTER TABLE `extraPayment` 
-- ADD CONSTRAINT `fk_extraPayment_customer` FOREIGN KEY (`customerEsntlId`) 
--   REFERENCES `customer` (`esntlId`) 
--   ON DELETE SET NULL 
--   ON UPDATE CASCADE;

-- =============================================
-- 추가 컬럼 및 인덱스 (add 파일에서 병합)
-- =============================================
-- 아래 내용은 add_extra_payment_status_columns.sql과 add_extra_payment_uniqueId_column.sql에서 병합되었습니다.
-- 이미 CREATE TABLE 문에 포함되어 있으므로 ALTER TABLE 문은 실행할 필요가 없습니다.
-- 
-- 추가된 컬럼:
--   - uniqueId: 고유 식별자 (customerEsntlId 뒤에 위치)
--   - paymentStatus: 결제 상태 (이미 CREATE TABLE에 포함)
-- 
-- 추가된 인덱스:
--   - idx_extraPayment_uniqueId: uniqueId 인덱스

