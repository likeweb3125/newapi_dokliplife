-- =============================================
-- roomLike 테이블 수정 스크립트 (통합)
-- 고시원 리스트 조회 최적화 인덱스
-- =============================================

CREATE INDEX IF NOT EXISTS `idx_roomLike_roomEsntlId` ON `roomLike` (`roomEsntlId`);

-- 주간 랭킹(weeklyRanking) 쿼리: rlk_regist_dtm 기간 필터 후 roomEsntlId별 집계용
CREATE INDEX IF NOT EXISTS `idx_roomLike_regist_room` ON `roomLike` (`rlk_regist_dtm`, `roomEsntlId`);
