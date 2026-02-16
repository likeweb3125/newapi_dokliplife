-- =============================================
-- il_room_deposit 인덱스 추가 (reservationList 등 방별 최신 1건 derived 쿼리용)
-- rom_eid + rdp_delete_dtm + rdp_regist_dtm 로 방별 미삭제·최신 1건 조회 가속
-- =============================================

SET NAMES utf8mb3 COLLATE utf8mb3_general_ci;

-- 기존 동일 인덱스가 있으면 에러 나므로, 필요 시 먼저 DROP 후 실행하거나 중복 생성하지 않도록 확인
-- MySQL 8.0+ / MariaDB 10.3+ 에서는 아래 DESC 버전 사용 시 ORDER BY rdp_regist_dtm DESC 에 더 유리함
CREATE INDEX `idx_il_room_deposit_rom_delete_regist`
ON `il_room_deposit` (`rom_eid`, `rdp_delete_dtm`, `rdp_regist_dtm`);

-- (선택) MySQL 8.0+ / MariaDB 10.3+ 인 경우 위 인덱스 대신 아래 사용 가능:
-- CREATE INDEX `idx_il_room_deposit_rom_delete_regist_desc`
-- ON `il_room_deposit` (`rom_eid`, `rdp_delete_dtm`, `rdp_regist_dtm` DESC);
