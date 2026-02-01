-- =============================================
-- roomContract의 checkin~, customer~, emergencyContact 데이터를
-- roomContractWho 테이블로 복사 (기존 DB 마이그레이션)
-- roomContractWho 테이블 생성 후 실행
-- =============================================

SET NAMES utf8mb3 COLLATE utf8mb3_general_ci;

-- roomContract에 who 관련 컬럼이 있는 경우에만 실행 (없으면 스킵)
-- 모든 계약에 대해 roomContractWho 행 생성 (없는 경우만)
INSERT INTO `roomContractWho` (
  `contractEsntlId`,
  `checkinName`,
  `checkinPhone`,
  `checkinGender`,
  `checkinAge`,
  `customerName`,
  `customerPhone`,
  `customerGender`,
  `customerAge`,
  `emergencyContact`,
  `createdAt`,
  `updatedAt`
)
SELECT
  RC.`esntlId`,
  RC.`checkinName`,
  RC.`checkinPhone`,
  RC.`checkinGender`,
  RC.`checkinAge`,
  RC.`customerName`,
  RC.`customerPhone`,
  RC.`customerGender`,
  RC.`customerAge`,
  RC.`emergencyContact`,
  NOW(),
  NOW()
FROM `roomContract` RC
WHERE NOT EXISTS (
  SELECT 1 FROM `roomContractWho` RCW WHERE RCW.contractEsntlId = RC.esntlId
);
