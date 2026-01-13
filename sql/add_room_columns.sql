-- =============================================
-- room 테이블 컬럼 추가 SQL
-- =============================================

-- roomCategory 컬럼 추가
-- 룸 카테고리를 저장하는 컬럼
-- 주의: 이미 컬럼이 존재하는 경우 오류가 발생할 수 있습니다.
ALTER TABLE `room` 
ADD COLUMN `roomCategory` VARCHAR(50) NULL COMMENT '룸카테고리' 
AFTER `roomType`;

-- depositYN 컬럼 추가
-- 보증금 사용 여부를 저장하는 컬럼 (Y: 사용, N: 미사용)
-- 주의: 이미 컬럼이 존재하는 경우 오류가 발생할 수 있습니다.
ALTER TABLE `room` 
ADD COLUMN `depositYN` CHAR(1) NULL DEFAULT 'N' COMMENT '보증금 사용여부' 
AFTER `deposit`;

-- agreementType 컬럼 추가
-- 특약 타입을 저장하는 컬럼 (GENERAL: 독립생활 일반 규정 11항 적용, GOSIWON: 현재 고시원 특약사항 적용, ROOM: 해당 방만 특약사항 수정)
-- 주의: 이미 컬럼이 존재하는 경우 오류가 발생할 수 있습니다.
ALTER TABLE `room` 
ADD COLUMN `agreementType` VARCHAR(50) NULL DEFAULT 'GENERAL' COMMENT '특약타입 (GENERAL: 독립생활 일반 규정 11항 적용, GOSIWON: 현재 고시원 특약사항 적용, ROOM: 해당 방만 특약사항 수정)' 
AFTER `org_rom_eid`;

-- agreementContent 컬럼 추가
-- 특약 내용을 저장하는 컬럼 (리치 텍스트)
-- 주의: 이미 컬럼이 존재하는 경우 오류가 발생할 수 있습니다.
ALTER TABLE `room` 
ADD COLUMN `agreementContent` TEXT NULL COMMENT '특약내용' 
AFTER `agreementType`;

-- =============================================
-- 인덱스 추가 (성능 최적화)
-- =============================================

-- roomCategory 인덱스 추가 (카테고리별 조회 최적화)
-- 주의: 이미 인덱스가 존재하는 경우 오류가 발생할 수 있습니다.
CREATE INDEX `idx_room_roomCategory` ON `room` (`roomCategory`);

-- agreementType 인덱스 추가 (특약 타입별 조회 최적화)
-- 주의: 이미 인덱스가 존재하는 경우 오류가 발생할 수 있습니다.
CREATE INDEX `idx_room_agreementType` ON `room` (`agreementType`);

-- depositYN 인덱스 추가 (보증금 사용 여부별 조회 최적화)
-- 주의: 이미 인덱스가 존재하는 경우 오류가 발생할 수 있습니다.
CREATE INDEX `idx_room_depositYN` ON `room` (`depositYN`);

-- =============================================
-- 참고사항
-- =============================================

-- 기존 데이터가 있는 경우, 컬럼 추가 후 기본값 설정
UPDATE `room` SET `agreementType` = 'GENERAL' WHERE `agreementType` IS NULL;

