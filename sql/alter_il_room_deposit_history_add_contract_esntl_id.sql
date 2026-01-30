-- =============================================
-- il_room_deposit_history 에 계약서 ID(contractEsntlId) 컬럼 추가
-- getRoomDepositList API가 계약서 기준으로 조회할 수 있도록 사용
-- ※ 이미 create_il_room_deposit_history_table.sql 로 테이블을 만들었다면
--   contractEsntlId 는 포함되어 있으므로 이 스크립트는 생략 가능
-- ※ 기존 테이블에 컬럼이 없을 때만 실행 (컬럼이 있으면 ALTER 실패)
-- =============================================

SET NAMES utf8mb3 COLLATE utf8mb3_general_ci;

-- contractEsntlId 컬럼 추가 (컬럼이 이미 있으면 에러 발생 → 해당 라인만 제외하고 인덱스만 실행)
ALTER TABLE `il_room_deposit_history`
  ADD COLUMN `contractEsntlId` VARCHAR(50) NULL COMMENT '방계약 고유아이디 (계약서 기준 조회용)' AFTER `roomEsntlId`;

-- 인덱스 추가 (이미 있으면 에러 → 필요 시 수동으로 idx_contractEsntlId 존재 여부 확인 후 실행)
CREATE INDEX `idx_contractEsntlId` ON `il_room_deposit_history` (`contractEsntlId`);
