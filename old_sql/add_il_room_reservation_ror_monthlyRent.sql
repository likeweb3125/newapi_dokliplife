-- =============================================
-- il_room_reservation 테이블 ror_monthlyRent 컬럼 추가
-- =============================================
-- ror_deposit 바로 뒤에 월세 컬럼 추가
-- room.monthlyRent와 동일하게 VARCHAR로 저장 (0.5, 1 등 만원 단위)
-- 주의: 이미 컬럼이 존재하는 경우 오류가 발생할 수 있습니다.
-- =============================================

ALTER TABLE `gsplus`.`il_room_reservation` 
ADD COLUMN `ror_monthlyRent` VARCHAR(50) NULL COMMENT '월세 (만원 단위, 0.5·1 등)' 
AFTER `ror_deposit`;
