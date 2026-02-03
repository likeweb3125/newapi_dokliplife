-- =============================================
-- room 테이블 useRoomRentFee 컬럼 추가 (신규 설치용)
-- =============================================
-- 이미 useCRFYN 컬럼이 있는 DB는 alter_room_rename_useCRFYN_to_useRoomRentFee.sql 을 실행하세요.

-- useRoomRentFee 컬럼 추가 (roomCategory 아래)
-- 방 월비용 사용 여부 (Y: 사용, N: 미사용, NULL: 미설정)
-- 주의: 이미 컬럼이 존재하는 경우 오류가 발생할 수 있습니다.
ALTER TABLE `room`
ADD COLUMN `useRoomRentFee` CHAR(1) NULL DEFAULT NULL COMMENT '방 월비용 사용 YN'
AFTER `roomCategory`;
