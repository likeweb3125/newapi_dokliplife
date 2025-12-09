-- =============================================
-- customer 테이블 컬럼 추가 SQL
-- =============================================

-- cus_location_yn 컬럼 추가
-- 위치 정보 약관 동의 여부를 저장하는 컬럼 (Y: 동의, N: 비동의)
-- 주의: 이미 컬럼이 존재하는 경우 오류가 발생할 수 있습니다.
ALTER TABLE `customer` 
ADD COLUMN `cus_location_yn` CHAR(1) NOT NULL DEFAULT 'N' COMMENT '위치 정보 약관 동의' 
AFTER `cus_collect_yn`;

-- cus_promotion_yn 컬럼 추가
-- 프로모션 정보 동의 여부를 저장하는 컬럼 (Y: 동의, N: 비동의)
-- 주의: 이미 컬럼이 존재하는 경우 오류가 발생할 수 있습니다.
ALTER TABLE `customer` 
ADD COLUMN `cus_promotion_yn` CHAR(1) NOT NULL DEFAULT 'N' COMMENT '프로모션 정보 동의' 
AFTER `cus_location_yn`;

-- =============================================
-- 인덱스 추가 (성능 최적화)
-- =============================================

-- cus_location_yn 인덱스 추가 (위치 정보 동의 여부별 조회 최적화)
-- 주의: 이미 인덱스가 존재하는 경우 오류가 발생할 수 있습니다.
CREATE INDEX `idx_customer_cus_location_yn` ON `customer` (`cus_location_yn`);

-- cus_promotion_yn 인덱스 추가 (프로모션 정보 동의 여부별 조회 최적화)
-- 주의: 이미 인덱스가 존재하는 경우 오류가 발생할 수 있습니다.
CREATE INDEX `idx_customer_cus_promotion_yn` ON `customer` (`cus_promotion_yn`);

-- =============================================
-- 참고사항
-- =============================================

-- 기존 데이터가 있는 경우, 컬럼 추가 후 기본값 설정이 필요할 수 있습니다.
-- 예시:
-- UPDATE `customer` SET `cus_location_yn` = 'N' WHERE `cus_location_yn` IS NULL;
-- UPDATE `customer` SET `cus_promotion_yn` = 'N' WHERE `cus_promotion_yn` IS NULL;

