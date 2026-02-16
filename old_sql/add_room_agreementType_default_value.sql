-- =============================================
-- room 테이블 agreementType 컬럼 기본값 추가 SQL
-- =============================================

-- agreementType 컬럼에 기본값 'GENERAL' 추가
-- 주의: 이미 기본값이 설정되어 있는 경우 오류가 발생할 수 있습니다.
ALTER TABLE `room` 
MODIFY COLUMN `agreementType` VARCHAR(50) NULL DEFAULT 'GENERAL' COMMENT '특약타입 (GENERAL: 독립생활 일반 규정 11항 적용, GOSIWON: 현재 고시원 특약사항 적용, ROOM: 해당 방만 특약사항 수정)';

-- 기존 NULL 값들을 'GENERAL'로 업데이트
UPDATE `room` SET `agreementType` = 'GENERAL' WHERE `agreementType` IS NULL;
