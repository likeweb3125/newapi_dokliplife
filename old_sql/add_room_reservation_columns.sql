-- =============================================
-- il_room_reservation 테이블 컬럼 추가 SQL
-- =============================================

-- ror_period 컬럼 추가
-- 결제요청 계약기간을 저장하는 컬럼 (MONTH / PART)
-- 주의: 이미 컬럼이 존재하는 경우 오류가 발생할 수 있습니다.
ALTER TABLE `gsplus`.`il_room_reservation` 
ADD COLUMN `ror_period` VARCHAR(20) NULL COMMENT '결제요청 계약기간 (MONTH / PART)';

-- ror_contract_start_date 컬럼 추가
-- 부분 결제의 시작날짜를 저장하는 컬럼
-- 주의: 이미 컬럼이 존재하는 경우 오류가 발생할 수 있습니다.
ALTER TABLE `gsplus`.`il_room_reservation` 
ADD COLUMN `ror_contract_start_date` VARCHAR(50) NULL COMMENT '부분 결제의 시작날짜';

-- ror_contract_end_date 컬럼 추가
-- 부분 결제의 종료날짜를 저장하는 컬럼
-- 주의: 이미 컬럼이 존재하는 경우 오류가 발생할 수 있습니다.
ALTER TABLE `gsplus`.`il_room_reservation` 
ADD COLUMN `ror_contract_end_date` VARCHAR(50) NULL COMMENT '부분 결제의 종료날짜';

-- ror_pay_method 컬럼 추가
-- 결제 방식을 저장하는 컬럼 (APP / ACCOUNT)
-- 주의: 이미 컬럼이 존재하는 경우 오류가 발생할 수 있습니다.
ALTER TABLE `gsplus`.`il_room_reservation` 
ADD COLUMN `ror_pay_method` VARCHAR(20) NULL COMMENT '결제 방식( APP / ACCOUNT)';

-- =============================================
-- 참고사항
-- =============================================

-- 기존 데이터가 있는 경우, 컬럼 추가 후 기본값 설정이 필요할 수 있습니다.
-- 예시:
-- UPDATE `gsplus`.`il_room_reservation` SET `ror_period` = 'MONTH' WHERE `ror_period` IS NULL;
