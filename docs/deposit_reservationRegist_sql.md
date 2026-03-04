# /v1/deposit/reservationRegist — 4·5·6단계 SQL

사용자 페이지에서 결제 완료 시, API와 **동일한 절차**로 신규 예약금을 넣을 때 참고하는 SQL입니다.  
실제 코드는 Sequelize 모델로 INSERT하므로, 아래는 그에 대응하는 **raw SQL**입니다.

---

## 사전 준비 (ID 발급)

- **보증금 메인 ID** (`newDepositId`): `IDS` 테이블에서 `tableName = 'il_room_deposit'`, `prefix = 'RDP'` 기준으로 다음 번호 발급 → `RDP` + 11자리 숫자 (총 14자).
- **이력 ID** (`historyId`): `tableName = 'il_room_deposit_history'`, `prefix = 'RDPH'` 기준으로 다음 번호 발급.
- **통합 히스토리 ID**: `tableName = 'history'`, `prefix = 'HIST'` 기준으로 다음 번호 발급.

(백엔드에서는 `idsNext('il_room_deposit', 'RDP', transaction)` 등으로 발급합니다.)

---

## 4. il_room_deposit INSERT (메인 1건)

예약금 = 보증금으로 등록. **완료일시(rdp_completed_dtm)는 넣지 않음** (NULL → 미완료).

```sql
INSERT INTO il_room_deposit (
  rdp_eid,
  rom_eid,
  gsw_eid,
  rdp_customer_name,
  rdp_customer_phone,
  rdp_price,
  rdp_check_in_date,
  rdp_completed_dtm,
  rdp_return_dtm,
  rdp_regist_dtm,
  rdp_registrant_id,
  rdp_update_dtm,
  rdp_updater_id,
  rdp_delete_dtm,
  rdp_deleter_id
) VALUES (
  :newDepositId,           -- RDP 접두사 14자 (IDS 발급)
  :roomEsntlId,
  :gosiwonEsntlId,
  :depositorName,          -- NULL 가능
  :depositorPhone,         -- NULL 가능, 연락처는 raw 형식 권장
  :paidAmount,             -- 입금 금액 (정수)
  :checkInDate,            -- YYYY-MM-DD 또는 NULL
  NULL,                    -- rdp_completed_dtm: 미완료이므로 NULL
  NULL,
  CURRENT_TIMESTAMP,
  :managerId,              -- 등록자(관리자) ID
  CURRENT_TIMESTAMP,
  :managerId,
  NULL,
  NULL
);
```

| 바인드 변수 | 설명 |
|-------------|------|
| newDepositId | IDS로 발급한 보증금 PK (RDP...) |
| roomEsntlId | 방 고유아이디 (필수) |
| gosiwonEsntlId | 고시원 고유아이디 (room에서 조회 또는 입력) |
| depositorName | 입금자명 (없으면 NULL) |
| depositorPhone | 입금자 연락처 (없으면 NULL) |
| paidAmount | 입금 금액 (정수) |
| checkInDate | 입실예정일 YYYY-MM-DD (없으면 NULL) |
| managerId | 등록자/수정자 관리자 ID |

---

## 5. il_room_deposit_history INSERT (이력 1건)

최초 등록이므로 `amount = 0`, `status = 'PENDING'`, `unpaidAmount = 입금 금액`으로 넣습니다.

```sql
INSERT INTO il_room_deposit_history (
  esntlId,
  depositEsntlId,
  roomEsntlId,
  contractEsntlId,
  type,
  amount,
  status,
  unpaidAmount,
  depositorName,
  memo,
  manager,
  createdAt,
  updatedAt
) VALUES (
  :historyId,              -- RDPH 접두사 (IDS 발급)
  :newDepositId,           -- 4번에서 사용한 rdp_eid
  :roomEsntlId,
  :contractEsntlId,       -- NULL 가능 (계약 연결 시 사용)
  'DEPOSIT',
  0,                       -- 최초 등록 시 실제 입금액은 메인에만 있음
  'PENDING',
  :paidAmount,             -- 목표 금액(미납액) = 입금 금액
  :depositorName,          -- NULL 가능
  :memo,                   -- NULL 가능
  :managerName,            -- 담당자명 (예: '관리자')
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);
```

| 바인드 변수 | 설명 |
|-------------|------|
| historyId | IDS로 발급한 il_room_deposit_history PK (RDPH...) |
| newDepositId | 4번 INSERT의 rdp_eid |
| roomEsntlId | 방 고유아이디 |
| contractEsntlId | 계약서 고유아이디 (선택, 없으면 NULL) |
| paidAmount | 입금 금액 (unpaidAmount에 동일하게) |
| depositorName | 입금자명 (NULL 가능) |
| memo | 메모 (NULL 가능) |
| managerName | 담당자 이름 (토큰 또는 고정값) |

---

## 6. history INSERT (통합 히스토리 1건)

보증금/예약금 등록 이벤트를 통합 히스토리 테이블에 남깁니다.

```sql
INSERT INTO history (
  esntlId,
  gosiwonEsntlId,
  roomEsntlId,
  contractEsntlId,
  etcEsntlId,
  content,
  category,
  priority,
  publicRange,
  writerAdminId,
  writerName,
  writerType,
  deleteYN,
  createdAt,
  updatedAt
) VALUES (
  :historyEsntlId,         -- HIST 접두사 (IDS 발급)
  :gosiwonEsntlId,
  :roomEsntlId,
  :contractEsntlId,       -- NULL 가능
  :newDepositId,           -- 보증금 ID (etcEsntlId로 저장)
  :content,                -- 예: '보증금/예약금 등록: 보증금ID RDP..., 금액 1,000,000원, 입금자 홍길동, ...'
  'DEPOSIT',
  'NORMAL',
  0,
  :writerAdminId,
  :writerName,             -- 작성자 이름 (예: 토큰의 admin.name 또는 '관리자')
  'ADMIN',
  'N',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);
```

**content 예시** (API와 동일 형식):

```
보증금/예약금 등록: 보증금ID RDP0000000001, 금액 1,000,000원, 입금자 홍길동, 전화번호 010-1234-5678, 입실예정일 2025-04-01
```

| 바인드 변수 | 설명 |
|-------------|------|
| historyEsntlId | IDS로 발급한 history PK (HIST...) |
| gosiwonEsntlId | 고시원 고유아이디 |
| roomEsntlId | 방 고유아이디 |
| contractEsntlId | 계약서 고유아이디 (없으면 NULL) |
| newDepositId | 4번에서 넣은 보증금 rdp_eid (etcEsntlId) |
| content | 위 예시 형식의 문자열 |
| writerAdminId | 작성 관리자 ID (사용자 결제 시에는 시스템/관리자 ID 또는 NULL) |
| writerName | 작성자 이름 (예: 토큰의 admin.name, partner.name 또는 '관리자') |

---

## 실행 순서 및 트랜잭션

1. 트랜잭션 시작.
2. IDS 테이블로 **newDepositId**, **historyId**(RDPH), **historyEsntlId**(HIST) 발급 (동시성 고려해 FOR UPDATE 등으로 처리).
3. **4 → 5 → 6** 순서로 INSERT.
4. 커밋.
