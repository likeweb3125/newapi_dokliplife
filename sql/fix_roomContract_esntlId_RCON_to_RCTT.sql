-- =============================================
-- roomContract 테이블의 esntlId 접두사 RCON을 RCTT로 변경
-- =============================================

-- 1. RCON으로 시작하는 esntlId를 RCTT로 변경
-- 주의: 이 작업은 외래키 관계가 있는 다른 테이블들도 함께 업데이트해야 할 수 있습니다.
-- 관련 테이블: roomStatus, paymentLog, il_room_refund_request, extraPayment, deposit 등

-- roomContract 테이블 업데이트
UPDATE `roomContract`
SET `esntlId` = CONCAT('RCTT', SUBSTRING(`esntlId`, 5))
WHERE `esntlId` LIKE 'RCON%';

-- roomStatus 테이블 업데이트 (contractEsntlId)
UPDATE `roomStatus`
SET `contractEsntlId` = CONCAT('RCTT', SUBSTRING(`contractEsntlId`, 5))
WHERE `contractEsntlId` LIKE 'RCON%';

-- paymentLog 테이블 업데이트 (contractEsntlId)
UPDATE `paymentLog`
SET `contractEsntlId` = CONCAT('RCTT', SUBSTRING(`contractEsntlId`, 5))
WHERE `contractEsntlId` LIKE 'RCON%';

-- il_room_refund_request 테이블 업데이트 (ctt_eid)
UPDATE `il_room_refund_request`
SET `ctt_eid` = CONCAT('RCTT', SUBSTRING(`ctt_eid`, 5))
WHERE `ctt_eid` LIKE 'RCON%';

-- extraPayment 테이블 업데이트 (contractEsntlId)
UPDATE `extraPayment`
SET `contractEsntlId` = CONCAT('RCTT', SUBSTRING(`contractEsntlId`, 5))
WHERE `contractEsntlId` LIKE 'RCON%';

-- deposit 테이블 업데이트 (contractEsntlId)
UPDATE `deposit`
SET `contractEsntlId` = CONCAT('RCTT', SUBSTRING(`contractEsntlId`, 5))
WHERE `contractEsntlId` LIKE 'RCON%';

-- history 테이블 업데이트 (contractEsntlId)
UPDATE `history`
SET `contractEsntlId` = CONCAT('RCTT', SUBSTRING(`contractEsntlId`, 5))
WHERE `contractEsntlId` LIKE 'RCON%';

-- roomMoveStatus 테이블 업데이트 (contractEsntlId)
UPDATE `roomMoveStatus`
SET `contractEsntlId` = CONCAT('RCTT', SUBSTRING(`contractEsntlId`, 5))
WHERE `contractEsntlId` LIKE 'RCON%';

-- =============================================
-- 변경 전 확인 쿼리 (실행 전 확인용)
-- =============================================
-- SELECT COUNT(*) AS rcon_count FROM roomContract WHERE esntlId LIKE 'RCON%';
-- SELECT COUNT(*) AS rctt_count FROM roomContract WHERE esntlId LIKE 'RCTT%';

-- =============================================
-- 변경 후 확인 쿼리 (실행 후 확인용)
-- =============================================
-- SELECT COUNT(*) AS rcon_count FROM roomContract WHERE esntlId LIKE 'RCON%';
-- SELECT COUNT(*) AS rctt_count FROM roomContract WHERE esntlId LIKE 'RCTT%';
