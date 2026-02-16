-- =============================================
-- roomLike 테이블 수정 스크립트 (통합)
-- 고시원 리스트 조회 최적화 인덱스
-- =============================================

CREATE INDEX IF NOT EXISTS `idx_roomLike_roomEsntlId` ON `roomLike` (`roomEsntlId`);
