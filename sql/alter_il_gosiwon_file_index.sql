-- =============================================
-- il_gosiwon_file 인덱스 추가 (가입 관리 목록 조회 최적화)
-- gosiwonRegist/accept/list API 쿼리 성능 개선
-- il_gosiwon_file 테이블이 있는 경우에만 실행
-- =============================================

-- gsw_eid + gfi_type 복합 인덱스: 서브쿼리 피벗(GROUP BY gsw_eid, WHERE gfi_type IN)에 사용
CREATE INDEX IF NOT EXISTS `idx_il_gosiwon_file_gsw_type` ON `il_gosiwon_file` (`gsw_eid`, `gfi_type`);
