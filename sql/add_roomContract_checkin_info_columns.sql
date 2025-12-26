-- =============================================
-- roomContract 테이블에 체크인한 사람 정보 컬럼 추가 SQL
-- =============================================

-- checkinName 컬럼 추가
-- 체크인한 사람의 이름을 저장하는 컬럼
-- 주의: 이미 컬럼이 존재하는 경우 오류가 발생할 수 있습니다.
ALTER TABLE `roomContract` 
ADD COLUMN `checkinName` VARCHAR(100) NULL DEFAULT NULL COMMENT '체크인한 사람 이름' 
AFTER `emergencyContact`;

-- checkinPhone 컬럼 추가
-- 체크인한 사람의 연락처를 저장하는 컬럼
-- 주의: 이미 컬럼이 존재하는 경우 오류가 발생할 수 있습니다.
ALTER TABLE `roomContract` 
ADD COLUMN `checkinPhone` VARCHAR(50) NULL DEFAULT NULL COMMENT '체크인한 사람 연락처' 
AFTER `checkinName`;

-- checkinGender 컬럼 추가
-- 체크인한 사람의 성별을 저장하는 컬럼
-- 주의: 이미 컬럼이 존재하는 경우 오류가 발생할 수 있습니다.
ALTER TABLE `roomContract` 
ADD COLUMN `checkinGender` VARCHAR(20) NULL DEFAULT NULL COMMENT '체크인한 사람 성별' 
AFTER `checkinPhone`;

-- checkinAge 컬럼 추가
-- 체크인한 사람의 나이를 저장하는 컬럼
-- 주의: 이미 컬럼이 존재하는 경우 오류가 발생할 수 있습니다.
ALTER TABLE `roomContract` 
ADD COLUMN `checkinAge` INT(3) NULL DEFAULT NULL COMMENT '체크인한 사람 나이' 
AFTER `checkinGender`;

-- customerName 컬럼 추가
-- 고객 이름을 저장하는 컬럼
-- 주의: 이미 컬럼이 존재하는 경우 오류가 발생할 수 있습니다.
ALTER TABLE `roomContract` 
ADD COLUMN `customerName` VARCHAR(100) NULL DEFAULT NULL COMMENT '고객 이름' 
AFTER `checkinAge`;

-- customerPhone 컬럼 추가
-- 고객 연락처를 저장하는 컬럼
-- 주의: 이미 컬럼이 존재하는 경우 오류가 발생할 수 있습니다.
ALTER TABLE `roomContract` 
ADD COLUMN `customerPhone` VARCHAR(50) NULL DEFAULT NULL COMMENT '고객 연락처' 
AFTER `customerName`;

-- customerGender 컬럼 추가
-- 고객 성별을 저장하는 컬럼
-- 주의: 이미 컬럼이 존재하는 경우 오류가 발생할 수 있습니다.
ALTER TABLE `roomContract` 
ADD COLUMN `customerGender` VARCHAR(20) NULL DEFAULT NULL COMMENT '고객 성별' 
AFTER `customerPhone`;

-- customerAge 컬럼 추가
-- 고객 나이를 저장하는 컬럼
-- 주의: 이미 컬럼이 존재하는 경우 오류가 발생할 수 있습니다.
ALTER TABLE `roomContract` 
ADD COLUMN `customerAge` INT(3) NULL DEFAULT NULL COMMENT '고객 나이' 
AFTER `customerGender`;

