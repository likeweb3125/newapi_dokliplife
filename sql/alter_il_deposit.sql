-- =============================================
-- il_deposit 테이블 수정 스크립트 (통합)
-- 고시원 리스트 조회 최적화 인덱스
-- =============================================

CREATE INDEX IF NOT EXISTS `idx_il_deposit_gsw_eid` ON `il_deposit` (`gsw_eid`);
CREATE INDEX IF NOT EXISTS `idx_il_deposit_gsw_status_manager` ON `il_deposit` (`gsw_eid`, `dps_status`, `dps_manager`);
