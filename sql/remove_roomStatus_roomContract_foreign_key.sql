-- =============================================
-- roomStatus 테이블의 roomContract 외래키 제약조건 제거 SQL
-- =============================================
-- roomStatus.contractEsntlId가 roomContract에 존재하지 않는 값도 허용하도록
-- 외래키 제약조건을 제거합니다.

-- 1. 외래키 제약조건 제거
ALTER TABLE `roomStatus`
DROP FOREIGN KEY `fk_roomStatus_roomContract`;

-- =============================================
-- 완료
-- =============================================
-- 이제 roomStatus.contractEsntlId에 roomContract에 존재하지 않는 값도
-- 저장할 수 있습니다.

