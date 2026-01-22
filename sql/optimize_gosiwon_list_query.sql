-- =============================================
-- 고시원 리스트 조회 쿼리 성능 최적화 인덱스
-- =============================================

-- gosiwon 테이블 인덱스
-- acceptDate로 정렬 및 필터링 최적화
CREATE INDEX IF NOT EXISTS `idx_gosiwon_acceptDate` ON `gosiwon` (`acceptDate`);

-- status 필터링 최적화
CREATE INDEX IF NOT EXISTS `idx_gosiwon_status` ON `gosiwon` (`status`);

-- 검색 최적화 (esntlId, name, address, phone)
CREATE INDEX IF NOT EXISTS `idx_gosiwon_search` ON `gosiwon` (`esntlId`, `name`, `address`, `phone`);

-- 복합 인덱스 (status + acceptDate)
CREATE INDEX IF NOT EXISTS `idx_gosiwon_status_acceptDate` ON `gosiwon` (`status`, `acceptDate`);

-- stateType 필터링 최적화 인덱스
-- is_controlled 필터링 (관제/제휴)
CREATE INDEX IF NOT EXISTS `idx_gosiwon_is_controlled` ON `gosiwon` (`is_controlled`);

-- use_settlement 필터링 (전산지급/정산중지)
CREATE INDEX IF NOT EXISTS `idx_gosiwon_use_settlement` ON `gosiwon` (`use_settlement`);

-- commision 필터링 (수수료할인적용)
CREATE INDEX IF NOT EXISTS `idx_gosiwon_commision` ON `gosiwon` (`commision`);

-- 복합 인덱스 (stateType 필터 + 정렬 최적화)
-- is_controlled + acceptDate (관제/제휴 필터 + 정렬)
CREATE INDEX IF NOT EXISTS `idx_gosiwon_controlled_acceptDate` ON `gosiwon` (`is_controlled`, `acceptDate`);

-- use_settlement + acceptDate (전산지급/정산중지 필터 + 정렬)
CREATE INDEX IF NOT EXISTS `idx_gosiwon_settlement_acceptDate` ON `gosiwon` (`use_settlement`, `acceptDate`);

-- commision + acceptDate (수수료할인 필터 + 정렬)
CREATE INDEX IF NOT EXISTS `idx_gosiwon_commision_acceptDate` ON `gosiwon` (`commision`, `acceptDate`);

-- roomContract 테이블 인덱스
-- gosiwonEsntlId로 조인 최적화
CREATE INDEX IF NOT EXISTS `idx_roomContract_gosiwonEsntlId` ON `roomContract` (`gosiwonEsntlId`);

-- gosiwonEsntlId + startDate, endDate 복합 인덱스
CREATE INDEX IF NOT EXISTS `idx_roomContract_gosiwon_dates` ON `roomContract` (`gosiwonEsntlId`, `startDate`, `endDate`);

-- paymentLog 테이블 인덱스
-- contractEsntlId로 조인 최적화 (이미 있을 수 있음)
CREATE INDEX IF NOT EXISTS `idx_paymentLog_contractEsntlId` ON `paymentLog` (`contractEsntlId`);

-- contractEsntlId + pTime 복합 인덱스 (정렬 최적화)
CREATE INDEX IF NOT EXISTS `idx_paymentLog_contract_pTime` ON `paymentLog` (`contractEsntlId`, `pTime`);

-- =============================================
-- 참고사항
-- =============================================
-- 
-- 이 인덱스들은 고시원 리스트 조회 쿼리의 성능을 향상시키기 위해 추가되었습니다.
-- 
-- 주요 최적화 포인트:
-- 1. gosiwon 테이블의 acceptDate, status 필터링 및 정렬 최적화
-- 2. roomContract와 paymentLog 조인 최적화
-- 3. 검색 쿼리 최적화
-- 4. stateType 필터링 최적화 (is_controlled, use_settlement, commision)
-- 
-- 인덱스 추가 후 쿼리 실행 계획을 확인하여 인덱스가 제대로 사용되는지 확인하세요:
-- EXPLAIN SELECT ... (실제 쿼리)
-- 
-- 인덱스가 너무 많으면 INSERT/UPDATE 성능에 영향을 줄 수 있으므로,
-- 실제 사용 패턴에 따라 필요한 인덱스만 유지하세요.
