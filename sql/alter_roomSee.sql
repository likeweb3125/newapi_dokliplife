-- =============================================
-- roomSee 테이블 수정 스크립트 (통합)
-- 고시원 리스트 조회 최적화 인덱스
-- =============================================

CREATE INDEX IF NOT EXISTS `idx_roomSee_roomEsntlId` ON `roomSee` (`roomEsntlId`);

-- 주간 랭킹(weeklyRanking) 쿼리: rse_regist_dtm 기간 필터 후 roomEsntlId별 집계용
CREATE INDEX IF NOT EXISTS `idx_roomSee_regist_room` ON `roomSee` (`rse_regist_dtm`, `roomEsntlId`);
