-- =============================================
-- IDS 테이블에 messageSmsHistory (prefix MSH) 등록
-- =============================================

SET NAMES utf8mb3 COLLATE utf8mb3_general_ci;

INSERT IGNORE INTO `IDS` (`tableName`, `prefix`, `count`) VALUES ('messageSmsHistory', 'MSH', 0);
