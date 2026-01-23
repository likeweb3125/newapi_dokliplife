-- =============================================
-- history 테이블에 삭제자 정보 컬럼 추가 SQL
-- =============================================

-- deletedBy 컬럼 추가 (삭제한 관리자 ID)
-- 주의: 이미 컬럼이 존재하는 경우 오류가 발생할 수 있습니다.
ALTER TABLE `history` 
ADD COLUMN `deletedBy` VARCHAR(50) NULL COMMENT '삭제한 관리자 ID' 
AFTER `deleteYN`;

-- deletedAt 컬럼 추가 (삭제 시간)
-- 주의: 이미 컬럼이 존재하는 경우 오류가 발생할 수 있습니다.
ALTER TABLE `history` 
ADD COLUMN `deletedAt` DATETIME NULL COMMENT '삭제 시간' 
AFTER `deletedBy`;

-- deletedBy 인덱스 추가 (성능 최적화)
-- 주의: 이미 인덱스가 존재하는 경우 오류가 발생할 수 있습니다.
CREATE INDEX `idx_history_deletedBy` ON `history` (`deletedBy`);

-- deletedAt 인덱스 추가 (성능 최적화)
-- 주의: 이미 인덱스가 존재하는 경우 오류가 발생할 수 있습니다.
CREATE INDEX `idx_history_deletedAt` ON `history` (`deletedAt`);

