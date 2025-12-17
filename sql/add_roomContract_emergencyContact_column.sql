-- =============================================
-- roomContract 테이블에 비상연락망/관계 컬럼 추가 SQL
-- =============================================

-- emergencyContact 컬럼 추가
-- 비상연락망/관계를 저장하는 컬럼 (예: '010-1234-5678 / 부모')
-- 주의: 이미 컬럼이 존재하는 경우 오류가 발생할 수 있습니다.
ALTER TABLE `roomContract` 
ADD COLUMN `emergencyContact` VARCHAR(250) NULL DEFAULT NULL COMMENT '비상연락망/관계' 
AFTER `memo2`;
