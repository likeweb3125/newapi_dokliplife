-- =============================================
-- il_room_reservation 테이블 수정 스크립트 (통합)
-- gsplus DB. 적용 순서대로 실행하세요.
-- =============================================

-- ---------------------------------------------
-- 1. ror_monthlyRent 컬럼 추가
-- ---------------------------------------------
ALTER TABLE `gsplus`.`il_room_reservation`
ADD COLUMN `ror_monthlyRent` VARCHAR(50) NULL COMMENT '월세 (만원 단위, 0.5·1 등)' AFTER `ror_deposit`;

-- ---------------------------------------------
-- 2. ror_period, ror_contract_start_date, ror_contract_end_date, ror_pay_method 컬럼 추가
-- ---------------------------------------------
ALTER TABLE `gsplus`.`il_room_reservation` ADD COLUMN `ror_period` VARCHAR(20) NULL COMMENT '결제요청 계약기간 (MONTH / PART)';
ALTER TABLE `gsplus`.`il_room_reservation` ADD COLUMN `ror_contract_start_date` VARCHAR(50) NULL COMMENT '부분 결제의 시작날짜';
ALTER TABLE `gsplus`.`il_room_reservation` ADD COLUMN `ror_contract_end_date` VARCHAR(50) NULL COMMENT '부분 결제의 종료날짜';
ALTER TABLE `gsplus`.`il_room_reservation` ADD COLUMN `ror_pay_method` VARCHAR(20) NULL COMMENT '결제 방식( APP / ACCOUNT)';
