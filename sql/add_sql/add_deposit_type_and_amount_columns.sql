-- =============================================
-- deposit 테이블에 type과 amount 컬럼 추가 및 통합
-- =============================================
-- reservationDepositAmount와 depositAmount를 통합하여 amount 컬럼으로 관리
-- type 컬럼으로 RESERVATION(예약금) 또는 DEPOSIT(보증금) 구분

-- 1. type 컬럼 추가
ALTER TABLE `deposit`
  ADD COLUMN `type` VARCHAR(50) NULL COMMENT '타입 (RESERVATION: 예약금, DEPOSIT: 보증금)' 
  AFTER `contractEsntlId`;

-- 2. amount 컬럼 추가
ALTER TABLE `deposit`
  ADD COLUMN `amount` INT(11) NULL DEFAULT 0 COMMENT '금액 (예약금 또는 보증금)' 
  AFTER `type`;

-- 3. 기존 데이터 마이그레이션
-- reservationDepositAmount가 있으면 RESERVATION, depositAmount가 있으면 DEPOSIT
-- 둘 다 있으면 depositAmount 우선
UPDATE `deposit`
SET 
  `type` = CASE 
    WHEN `depositAmount` > 0 THEN 'DEPOSIT'
    WHEN `reservationDepositAmount` > 0 THEN 'RESERVATION'
    ELSE 'DEPOSIT'
  END,
  `amount` = COALESCE(
    NULLIF(`depositAmount`, 0),
    NULLIF(`reservationDepositAmount`, 0),
    0
  )
WHERE `type` IS NULL OR `amount` IS NULL;

-- 4. type 컬럼을 NOT NULL로 변경
ALTER TABLE `deposit`
  MODIFY COLUMN `type` VARCHAR(50) NOT NULL COMMENT '타입 (RESERVATION: 예약금, DEPOSIT: 보증금)';

-- 5. amount 컬럼을 NOT NULL로 변경
ALTER TABLE `deposit`
  MODIFY COLUMN `amount` INT(11) NOT NULL DEFAULT 0 COMMENT '금액 (예약금 또는 보증금)';

-- 6. type 컬럼에 인덱스 추가
CREATE INDEX `idx_type` ON `deposit` (`type`);

-- 7. amount 컬럼에 인덱스 추가
CREATE INDEX `idx_amount` ON `deposit` (`amount`);

-- 8. 복합 인덱스 추가 (type과 amount 함께 조회 시 성능 향상)
CREATE INDEX `idx_type_amount` ON `deposit` (`type`, `amount`);

-- =============================================
-- 참고: 기존 reservationDepositAmount와 depositAmount 컬럼은 유지
-- (하위 호환성을 위해, 추후 제거 가능)
-- =============================================

