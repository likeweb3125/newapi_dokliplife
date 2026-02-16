-- =============================================
-- roomContract 테이블에 contractDay 컬럼 추가 (month 뒤)
-- ※ 기존 테이블에 컬럼이 없을 때만 실행 (컬럼이 있으면 ALTER 실패)
-- =============================================

SET NAMES utf8mb3 COLLATE utf8mb3_general_ci;

ALTER TABLE `roomContract`
  ADD COLUMN `contractDay` INT(11) NULL COMMENT '계약 일수' AFTER `month`;
