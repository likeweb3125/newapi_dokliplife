-- =============================================
-- il_room_deposit 테이블 수정 스크립트 (통합)
-- 이 파일은 il_room_deposit 에 대한 ALTER 문을 모아 두었습니다.
-- 적용 순서대로 실행하세요. 이미 적용된 구간은 주석 처리하거나 건너뛰세요.
-- =============================================

SET NAMES utf8mb3 COLLATE utf8mb3_general_ci;

-- ---------------------------------------------
-- 1. rdp_memo 컬럼 추가 (메모 CRUD API용)
-- ---------------------------------------------
ALTER TABLE il_room_deposit
ADD COLUMN rdp_memo TEXT NULL COMMENT '메모' AFTER rdp_return_dtm;

-- ---------------------------------------------
-- 2. 인덱스 추가 (reservationList 등 방별 최신 1건 쿼리용)
-- ---------------------------------------------
-- rom_eid + rdp_delete_dtm + rdp_regist_dtm 로 방별 미삭제·최신 1건 조회 가속
-- 기존 동일 인덱스가 있으면 에러. 필요 시 DROP 후 실행.
CREATE INDEX `idx_il_room_deposit_rom_delete_regist`
ON `il_room_deposit` (`rom_eid`, `rdp_delete_dtm`, `rdp_regist_dtm`);
