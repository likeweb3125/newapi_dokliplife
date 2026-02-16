-- =============================================
-- IDS 테이블 수정 스크립트 (통합)
-- 새 테이블/엔티티용 prefix 등록. INSERT IGNORE 로 중복 시 무시.
-- =============================================

SET NAMES utf8mb3 COLLATE utf8mb3_general_ci;

INSERT IGNORE INTO `IDS` (`tableName`, `prefix`, `count`) VALUES ('parkStatus', 'PKST', 0);
INSERT IGNORE INTO `IDS` (`tableName`, `prefix`, `count`) VALUES ('messageSmsHistory', 'MSH', 0);
