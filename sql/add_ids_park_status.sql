-- =============================================
-- IDS 테이블에 parkStatus (prefix PKST) 등록
-- =============================================

SET NAMES utf8mb3 COLLATE utf8mb3_general_ci;

INSERT IGNORE INTO `IDS` (`tableName`, `prefix`, `count`) VALUES ('parkStatus', 'PKST', 0);
