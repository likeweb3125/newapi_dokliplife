-- =============================================
-- room 테이블에 이용 가능 성별 컬럼 추가 SQL
-- =============================================

-- availableGender 컬럼 추가
-- 방을 이용할 수 있는 성별을 저장하는 컬럼 (DEFAULT: 기본값/제한없음, MALE: 남성, FEMALE: 여성)
-- 주의: 이미 컬럼이 존재하는 경우 오류가 발생할 수 있습니다.
ALTER TABLE `room` 
ADD COLUMN `availableGender` VARCHAR(50) NULL DEFAULT 'DEFAULT' COMMENT '이용 가능 성별 (DEFAULT: 제한없음, MALE: 남성, FEMALE: 여성)' 
AFTER `agreementContent`;

-- =============================================
-- 인덱스 추가 (성능 최적화)
-- =============================================

-- availableGender 인덱스 추가 (성별별 조회 최적화)
-- 주의: 이미 인덱스가 존재하는 경우 오류가 발생할 수 있습니다.
CREATE INDEX `idx_room_availableGender` ON `room` (`availableGender`);
