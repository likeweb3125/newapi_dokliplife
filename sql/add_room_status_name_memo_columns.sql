-- =============================================
-- roomStatus 테이블에 subStatus, statusMemo 컬럼 추가 SQL
-- =============================================

-- subStatus 컬럼 추가
-- 서브 방상태를 저장하는 컬럼
-- 주의: 이미 컬럼이 존재하는 경우 오류가 발생할 수 있습니다.
ALTER TABLE `roomStatus` 
ADD COLUMN `subStatus` VARCHAR(50) NULL COMMENT '서브 방상태' 
AFTER `status`;

-- statusMemo 컬럼 추가
-- 상태 메모를 저장하는 컬럼
-- 주의: 이미 컬럼이 존재하는 경우 오류가 발생할 수 있습니다.
ALTER TABLE `roomStatus` 
ADD COLUMN `statusMemo` TEXT NULL COMMENT '상태 메모' 
AFTER `subStatus`;

