-- 아래 테이블들 데이터 전체 삭제 (TRUNCATE)
-- 외래키 제약이 있으면 실행 전에 FOREIGN_KEY_CHECKS 비활성화 후 실행, 완료 후 재활성화

-- SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE `history`;
TRUNCATE TABLE `roomStatus`;
TRUNCATE TABLE `roomMoveStatus`;
TRUNCATE TABLE `roomContract`;
TRUNCATE TABLE `roomContractWho`;
TRUNCATE TABLE `extraPayment`;
TRUNCATE TABLE `parkStatus`;
TRUNCATE TABLE `il_room_deposit_history`;
TRUNCATE TABLE `il_room_deposit`;
TRUNCATE TABLE `il_room_reservation`;
TRUNCATE TABLE `il_room_refund_request`;

-- SET FOREIGN_KEY_CHECKS = 1;
