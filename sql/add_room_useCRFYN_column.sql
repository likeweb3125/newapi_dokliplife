-- =============================================
-- room 테이블 useCRFYN 컬럼 추가
-- =============================================

-- useCRFYN 컬럼 추가 (roomCategory 아래)
-- 카테고리 월비용 사용 여부 (Y: 사용, N: 미사용)
-- 주의: 이미 컬럼이 존재하는 경우 오류가 발생할 수 있습니다.
ALTER TABLE `room`
ADD COLUMN `useCRFYN` CHAR(1) NULL DEFAULT 'N' COMMENT '카테고리 월비용 사용 YN'
AFTER `roomCategory`;
