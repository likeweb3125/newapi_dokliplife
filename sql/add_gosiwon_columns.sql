-- =============================================
-- gosiwon 테이블 컬럼 추가 SQL
-- =============================================

-- is_favorite 컬럼 추가
-- 즐겨찾기 여부를 저장하는 컬럼 (0: 일반, 1: 즐겨찾기)
-- 주의: 이미 컬럼이 존재하는 경우 오류가 발생할 수 있습니다.
ALTER TABLE `gosiwon` 
ADD COLUMN `is_favorite` INT(11) NULL DEFAULT NULL COMMENT '즐겨찾기 0/1' 
AFTER `district`;

-- =============================================
-- 인덱스 추가 (성능 최적화)
-- =============================================

-- is_favorite 인덱스 추가 (즐겨찾기별 조회 최적화)
-- 주의: 이미 인덱스가 존재하는 경우 오류가 발생할 수 있습니다.
CREATE INDEX `idx_gosiwon_is_favorite` ON `gosiwon` (`is_favorite`);

-- =============================================
-- 보증금 및 수수료 관련 컬럼 추가
-- =============================================

-- use_deposit 컬럼 추가
-- 보증금 사용 여부를 저장하는 컬럼 (0: 미사용, 1: 사용)
-- 주의: 이미 컬럼이 존재하는 경우 오류가 발생할 수 있습니다.
ALTER TABLE `gosiwon` 
ADD COLUMN `use_deposit` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '보증금 사용 여부' 
AFTER `is_controlled`;

-- use_sale_commision 컬럼 추가
-- 할인 수수료 적용 여부를 저장하는 컬럼 (0: 미적용, 1: 적용)
-- 주의: 이미 컬럼이 존재하는 경우 오류가 발생할 수 있습니다.
ALTER TABLE `gosiwon` 
ADD COLUMN `use_sale_commision` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '할인 수수료 적용 여부' 
AFTER `use_deposit`;

-- saleCommisionStartDate 컬럼 추가
-- 할인 수수료 시작일을 저장하는 컬럼
-- 주의: 이미 컬럼이 존재하는 경우 오류가 발생할 수 있습니다.
ALTER TABLE `gosiwon` 
ADD COLUMN `saleCommisionStartDate` VARCHAR(20) NULL DEFAULT NULL COMMENT '할인수수료 시작일' 
AFTER `use_sale_commision`;

-- saleCommisionEndDate 컬럼 추가
-- 할인 수수료 종료일을 저장하는 컬럼
-- 주의: 이미 컬럼이 존재하는 경우 오류가 발생할 수 있습니다.
ALTER TABLE `gosiwon` 
ADD COLUMN `saleCommisionEndDate` VARCHAR(20) NULL DEFAULT NULL COMMENT '할인수수료 끝나는날' 
AFTER `saleCommisionStartDate`;

-- saleCommision 컬럼 추가
-- 할인 수수료율을 저장하는 컬럼
-- 주의: 이미 컬럼이 존재하는 경우 오류가 발생할 수 있습니다.
ALTER TABLE `gosiwon` 
ADD COLUMN `saleCommision` INT(2) NULL DEFAULT NULL COMMENT '할인 수수료 숫자' 
AFTER `saleCommisionEndDate`;

-- use_settlement 컬럼 추가
-- 정산 사용 여부를 저장하는 컬럼 (0: 미사용, 1: 사용)
-- 주의: 이미 컬럼이 존재하는 경우 오류가 발생할 수 있습니다.
ALTER TABLE `gosiwon` 
ADD COLUMN `use_settlement` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '정산 사용유무' 
AFTER `is_favorite`;

-- settlementReason 컬럼 추가
-- 정산 사용 여부 사유를 저장하는 컬럼
-- 주의: 이미 컬럼이 존재하는 경우 오류가 발생할 수 있습니다.
ALTER TABLE `gosiwon` 
ADD COLUMN `settlementReason` VARCHAR(100) NULL DEFAULT NULL COMMENT '정상사용유무 사유' 
AFTER `use_settlement`;

-- =============================================
-- 인덱스 추가 (성능 최적화)
-- =============================================

-- use_deposit 인덱스 추가 (보증금 사용 여부별 조회 최적화)
-- 주의: 이미 인덱스가 존재하는 경우 오류가 발생할 수 있습니다.
CREATE INDEX `idx_gosiwon_use_deposit` ON `gosiwon` (`use_deposit`);

-- use_sale_commision 인덱스 추가 (할인 수수료 적용 여부별 조회 최적화)
-- 주의: 이미 인덱스가 존재하는 경우 오류가 발생할 수 있습니다.
CREATE INDEX `idx_gosiwon_use_sale_commision` ON `gosiwon` (`use_sale_commision`);

-- use_settlement 인덱스 추가 (정산 사용 여부별 조회 최적화)
-- 주의: 이미 인덱스가 존재하는 경우 오류가 발생할 수 있습니다.
CREATE INDEX `idx_gosiwon_use_settlement` ON `gosiwon` (`use_settlement`);

-- =============================================
-- 참고사항
-- =============================================

-- 기존 데이터가 있는 경우, 컬럼 추가 후 기본값 설정이 필요할 수 있습니다.
-- 예시:
-- UPDATE `gosiwon` SET `is_favorite` = 0 WHERE `is_favorite` IS NULL;
-- UPDATE `gosiwon` SET `use_deposit` = 0 WHERE `use_deposit` IS NULL;
-- UPDATE `gosiwon` SET `use_sale_commision` = 0 WHERE `use_sale_commision` IS NULL;
-- UPDATE `gosiwon` SET `use_settlement` = 0 WHERE `use_settlement` IS NULL;
