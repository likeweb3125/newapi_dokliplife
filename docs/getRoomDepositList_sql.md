# getRoomDepositList API · SQL 정리

## 1. 테이블 구조 (계약서 ID 포함)

`il_room_deposit_history` 테이블은 **계약서 ID(`contractEsntlId`)** 컬럼을 갖고, 계약서/방 기준 조회에 사용합니다.

### CREATE TABLE (전체)

`sql/create_il_room_deposit_history_table.sql` 참고. 요약:

```sql
CREATE TABLE `il_room_deposit_history` (
  `esntlId` VARCHAR(50) NOT NULL COMMENT '이력 고유아이디',
  `depositEsntlId` VARCHAR(50) NOT NULL COMMENT '보증금 고유아이디',
  `roomEsntlId` VARCHAR(50) NOT NULL COMMENT '방 고유아이디',
  `contractEsntlId` VARCHAR(50) NULL COMMENT '방계약 고유아이디 (계약서 기준 조회용)',
  `type` VARCHAR(50) NOT NULL COMMENT '타입 (DEPOSIT: 입금, RETURN: 반환)',
  `amount` INT(11) NOT NULL DEFAULT 0 COMMENT '금액',
  `status` VARCHAR(50) NOT NULL COMMENT '상태',
  `depositorName` VARCHAR(100) NULL,
  `manager` VARCHAR(100) NULL,
  `depositDate` DATETIME NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`esntlId`),
  INDEX `idx_depositEsntlId` (`depositEsntlId`),
  INDEX `idx_roomEsntlId` (`roomEsntlId`),
  INDEX `idx_contractEsntlId` (`contractEsntlId`),
  INDEX `idx_type` (`type`),
  INDEX `idx_status` (`status`),
  INDEX `idx_createdAt` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COMMENT='방 보증금/예약금 입금·반환 이력 테이블';
```

### 기존 테이블에 계약서 ID만 추가할 때

`sql/alter_il_room_deposit_history_add_contract_esntl_id.sql` 사용:

```sql
ALTER TABLE `il_room_deposit_history`
  ADD COLUMN `contractEsntlId` VARCHAR(50) NULL COMMENT '방계약 고유아이디 (계약서 기준 조회용)' AFTER `roomEsntlId`;

CREATE INDEX `idx_contractEsntlId` ON `il_room_deposit_history` (`contractEsntlId`);
```

---

## 2. API 조회에 대응하는 SQL

`GET /v1/deposit/getRoomDepositList` 는 **il_room_deposit_history** 를 계약서/방 기준으로 조회합니다.

### 쿼리 파라미터

- `contractEsntlId` (선택): 계약서 고유아이디
- `roomEsntlId` (선택): 방 고유아이디  
- **둘 중 하나는 필수** (둘 다 줄 수 있음)

### 대응 SELECT 문 (계약서 기준)

```sql
-- contractEsntlId 로 조회
SELECT
  esntlId,
  depositEsntlId,
  roomEsntlId,
  contractEsntlId,
  type,
  amount,
  status,
  depositDate,
  depositorName,
  manager,
  createdAt
FROM il_room_deposit_history
WHERE contractEsntlId = :contractEsntlId
ORDER BY depositDate DESC, createdAt DESC;
```

### 계약서 + 방 둘 다 조건

```sql
SELECT
  esntlId,
  depositEsntlId,
  roomEsntlId,
  contractEsntlId,
  type,
  amount,
  status,
  depositDate,
  depositorName,
  manager,
  createdAt
FROM il_room_deposit_history
WHERE contractEsntlId = :contractEsntlId
  AND roomEsntlId = :roomEsntlId
ORDER BY depositDate DESC, createdAt DESC;
```

### 방만 조건 (roomEsntlId 만 사용)

```sql
SELECT
  esntlId,
  depositEsntlId,
  roomEsntlId,
  contractEsntlId,
  type,
  amount,
  status,
  depositDate,
  depositorName,
  manager,
  createdAt
FROM il_room_deposit_history
WHERE roomEsntlId = :roomEsntlId
ORDER BY depositDate DESC, createdAt DESC;
```

응답의 `paidAmount` / `unpaidAmount` 는 API에서 `status = 'COMPLETED'` 여부로 계산합니다.
