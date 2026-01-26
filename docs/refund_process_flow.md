# /v1/refund/process — 테이블 & 플로우

## API 개요

| 항목 | 내용 |
|------|------|
| **엔드포인트** | `POST /v1/refund/process` |
| **역할** | 계약에 대한 **환불 및 퇴실처리** 수행 |
| **인증** | JWT Bearer (관리자) |
| **트랜잭션** | 전체 처리 구간이 하나의 트랜잭션으로 묶여 있으며, 에러 시 롤백 |

---

## 사용 테이블

### 1. roomContract, room, customer, deposit, customer(계약자) (조회 전용)

계약 정보 조회에 사용. `room`, `customer`, `deposit`, `customer(계약자)`와 JOIN.

| 테이블 | 역할 |
|--------|------|
| **roomContract (RC)** | 계약 기본 정보 (gosiwonEsntlId, roomEsntlId, customerEsntlId, startDate, endDate, status 등) |
| **room (R)** | 방 정보 (JOIN용) |
| **customer (C)** | 입실자 이름 (customerNameFromCustomer) |
| **deposit (D)** | 예약금 정보, 계약자 ID(contractorEsntlId) - LEFT JOIN |
| **customer (CT)** | 계약자 이름 (contractorName) - LEFT JOIN |

**조인 조건:**
- `RC.roomEsntlId = R.esntlId`
- `RC.customerEsntlId = C.esntlId`
- `D.contractEsntlId = RC.esntlId AND D.deleteYN = 'N'` (LEFT JOIN)
- `D.contractorEsntlId = CT.esntlId` (LEFT JOIN)

**계산:**
- `usePeriodDays`: 입실 시작일(`startDate`)부터 현재일까지 일수 계산

---

### 2. il_room_refund_request (INSERT)

환불 요청 저장. **메인 저장 테이블**. **`refund` 테이블은 사용하지 않습니다.**

| 컬럼 | 용도 |
|------|------|
| rrr_sno | PK, AUTO_INCREMENT (반환값) |
| gsw_eid | 고시원 ID (contract.gosiwonEsntlId) |
| rom_eid | 방 ID (contract.roomEsntlId) |
| mbr_eid | 회원 ID (contract.customerEsntlId) |
| ctt_eid | 계약 ID (contractEsntlId) |
| rrr_leave_type_cd | 취소사유 (FULL / INTERIM / CANCEL / ETC) |
| rrr_leave_date | 취소날짜 (cancelDate) |
| rrr_leave_reason | 퇴실 사유 (cancelMemo 또는 "{취소사유} 퇴실") |
| rrr_liability_reason | 귀책사유 (OWNER / OCCUPANT 또는 null) |
| rrr_payment_amt | 결제금액 (paymentAmount) |
| rrr_use_period | 사용기간 일수 (입실 시작일 ~ 현재일) |
| rrr_use_amt | 일할입실료 (proratedRent) |
| rrr_penalty_amt | 위약금 (penalty) |
| rrr_refund_total_amt | 총환불금액 (totalRefundAmount) |
| rrr_registrant_id | 등록자 ID (writerAdminId) |
| rrr_update_dtm | NOW() |
| rrr_updater_id | 수정자 ID (writerAdminId) |

---

### 3. roomStatus (UPDATE)

`contractEsntlId`가 일치하는 행의 `status`를 `CHECKOUT_CONFIRMED`로 변경.

| 컬럼 | 용도 |
|------|------|
| status | `CHECKOUT_CONFIRMED`로 업데이트 |
| updatedAt | 현재 시간 (한국 시간) |

---

### 4. roomContract (UPDATE)

`status`를 다음 규칙으로 갱신.

| cancelReason | roomContract.status |
|--------------|---------------------|
| CANCEL | CANCEL |
| FULL, INTERIM, ETC | FIN |

---

### 5. il_gosiwon_config (SELECT, 조건부)

**`check_basic_sell === true`** 일 때만 조회.

| 컬럼 | 용도 |
|------|------|
| gsc_checkin_able_date | 입실 가능 일수 (기본 설정) |
| gsc_sell_able_period | 판매 가능 기간 일수 (기본 설정) |

**사용:**
- `roomAfterUse` 함수 내에서 CAN_CHECKIN / ON_SALE 기간 계산에 사용
- `baseDate` 미전달 시 **현재일** 기준으로 계산

---

### 6. roomStatus (INSERT, 조건부 - roomAfterUse 내부)

**`roomAfterUse` 함수 호출 시** 생성. 다음 중 하나라도 존재할 때만 호출:
- `check_basic_sell !== undefined`
- `unableCheckInReason`
- `check_room_only_config !== undefined`
- `sell_able_start_date`
- `can_checkin_start_date`

| 조건 | 생성 상태 | 설명 |
|------|----------|------|
| `check_room_only_config === true` | **ON_SALE** 1건<br>**CAN_CHECKIN** 1건 | 전달된 날짜(sell_able_*, can_checkin_*) 사용 |
| `check_basic_sell === true` | **CAN_CHECKIN** 1건<br>**ON_SALE** 1건 | il_gosiwon_config 기반 계산 |
| `check_basic_sell === false` && `unableCheckInReason` 존재 | **BEFORE_SALES** 1건 | subStatus = unableCheckInReason |

**roomStatus 생성 컬럼:**
- `esntlId`: PK, `RSTA` + 10자리 숫자 (자동 생성)
- `roomEsntlId`, `gosiwonEsntlId`: 계약에서 가져옴
- `status`: ON_SALE / CAN_CHECKIN / BEFORE_SALES
- `subStatus`: unableCheckInReason (BEFORE_SALES일 때만)
- `statusStartDate`, `statusEndDate`: 판매/입실 기간
- `etcStartDate`, `etcEndDate`: statusStartDate/statusEndDate와 동일
- `statusMemo`: unableCheckInReason (BEFORE_SALES일 때만)

---

### 7. history (SELECT + INSERT)

**항상** 1건 INSERT.

| 컬럼 | 용도 |
|------|------|
| esntlId | PK, `HISTORY` + 10자리 숫자 (SELECT로 최신 ID 조회 후 +1) |
| gosiwonEsntlId, roomEsntlId, contractEsntlId | 계약 정보 |
| etcEsntlId | `il_room_refund_request` INSERT 후 `insertId` (rrr_sno) |
| content | `"환불 및 퇴실처리: {취소사유}, 귀책사유: {귀책사유}, 총환불금액: {금액}원"` |
| category | `REFUND` |
| priority | `NORMAL` |
| publicRange | 0 |
| writerAdminId | 토큰 관리자 ID |
| writerType | `ADMIN` |
| deleteYN | `N` |

---

## 플로우 다이어그램

```
[Client]  POST /v1/refund/process
    body: { contractEsntlId, cancelReason, cancelDate, ... }
          |
          v
[1] JWT 검증 (관리자)
          |
          v
[2] cancelReason 유효성 검증
    (FULL, INTERIM, CANCEL, ETC)
          |
          v
[3] roomContract + room + customer + deposit + customer(계약자) 조회
    → 계약 없으면 404
    → usePeriodDays 계산 (입실 시작일 ~ 현재일)
          |
          v
[4] il_room_refund_request INSERT
    (gsw_eid, rom_eid, mbr_eid, ctt_eid, rrr_leave_type_cd, 
     rrr_leave_date, rrr_leave_reason, rrr_liability_reason,
     rrr_payment_amt, rrr_use_period, rrr_use_amt, 
     rrr_penalty_amt, rrr_refund_total_amt, ...)
    → rrr_sno 저장 (insertId)
          |
          v
[5] roomStatus UPDATE
    WHERE contractEsntlId = ?
    SET status = 'CHECKOUT_CONFIRMED'
          |
          v
[6] roomContract UPDATE
    WHERE esntlId = ?
    SET status = ? 
    (CANCEL: cancelReason === 'CANCEL' ? 'CANCEL' : 'FIN')
          |
          v
[7] roomAfterUse 호출 여부 확인
    (check_basic_sell !== undefined || unableCheckInReason || 
     check_room_only_config !== undefined || sell_able_start_date || 
     can_checkin_start_date)
          |
          +-- YES --> [7-1] roomAfterUse 실행
          |              |
          |              +-- check_room_only_config === true
          |              |     → ON_SALE 1건 + CAN_CHECKIN 1건 INSERT
          |              |       (전달된 날짜 사용)
          |              |
          |              +-- check_basic_sell === true
          |              |     → il_gosiwon_config 조회
          |              |     → CAN_CHECKIN 1건 + ON_SALE 1건 INSERT
          |              |       (기본 설정 기반 계산)
          |              |
          |              +-- check_basic_sell === false && unableCheckInReason
          |                    → BEFORE_SALES 1건 INSERT
          |                      (subStatus = unableCheckInReason)
          |
          +-- NO  --> skip
          |
          v
[8] history ID 생성 (SELECT 최신 ID + 1)
          |
          v
[9] history INSERT
    (category=REFUND, etcEsntlId=rrr_sno, content="환불 및 퇴실처리: ...")
          |
          v
[10] transaction COMMIT
          |
          v
[11] 200 응답
    { rrr_sno, historyId, roomStatus: 'CHECKOUT_CONFIRMED' }
```

---

## 테이블 관계 요약

```
roomContract ──┬── (조회) ──► room, customer, deposit, customer(계약자)
               │
               ├── (기준) ──► il_room_refund_request (1:1, ctt_eid)
               │                    │
               │                    └── rrr_sno ──► history.etcEsntlId
               │
               ├── (기준) ──► roomStatus UPDATE (contractEsntlId)
               │                    └── status = CHECKOUT_CONFIRMED
               │
               └── (기준) ──► roomContract UPDATE (esntlId)
                                    └── status = CANCEL 또는 FIN

roomAfterUse ── (조건부) ──► il_gosiwon_config (check_basic_sell === true)
                    │
                    └── (조건부) ──► roomStatus INSERT
                                      ├── ON_SALE (check_room_only_config 또는 check_basic_sell)
                                      ├── CAN_CHECKIN (check_room_only_config 또는 check_basic_sell)
                                      └── BEFORE_SALES (check_basic_sell === false && unableCheckInReason)

history ── (항상 1건) contractEsntlId, gosiwonEsntlId, roomEsntlId, 
           category=REFUND, etcEsntlId=rrr_sno
```

---

## 요청/응답 예시

**요청**

```json
{
  "contractEsntlId": "RCO0000000001",
  "cancelReason": "INTERIM",
  "cancelDate": "2025-11-06",
  "cancelMemo": "개인 사정으로 인한 중도퇴실",
  "liabilityReason": "OCCUPANT",
  "contactedOwner": true,
  "refundMethod": "계좌이체",
  "paymentAmount": 300000,
  "proratedRent": 200000,
  "penalty": 30000,
  "totalRefundAmount": 70000,
  "check_basic_sell": true
}
```

**응답**

```json
{
  "statusCode": 200,
  "message": "환불 및 퇴실처리 성공",
  "data": {
    "rrr_sno": 123,
    "historyId": "HISTORY0000000123",
    "roomStatus": "CHECKOUT_CONFIRMED"
  }
}
```

---

## roomAfterUse 함수 상세

### 호출 조건

다음 중 **하나라도 존재**할 때만 호출:
- `check_basic_sell !== undefined`
- `unableCheckInReason`
- `check_room_only_config !== undefined`
- `sell_able_start_date`
- `can_checkin_start_date`

### 처리 로직

#### 1. `check_room_only_config === true`

**필수 파라미터:**
- `sell_able_start_date`, `sell_able_end_date`
- `can_checkin_start_date`, `can_checkin_end_date`

**생성:**
- **ON_SALE** 1건: `statusStartDate` = `sell_able_start_date`, `statusEndDate` = `sell_able_end_date`
- **CAN_CHECKIN** 1건: `statusStartDate` = `can_checkin_start_date`, `statusEndDate` = `can_checkin_end_date`

---

#### 2. `check_basic_sell === true`

**필수:**
- `il_gosiwon_config` 테이블에 해당 고시원 설정 존재

**계산:**
- 기준일: `baseDate` 또는 현재일
- 입실 가능 시작일: 기준일 + `gsc_checkin_able_date` 일
- 판매 시작일: 입실 가능 시작일
- 판매 종료일: 판매 시작일 + `gsc_sell_able_period` 일
- 입실/판매 종료일: 무한대 (9999-12-31)

**생성:**
- **CAN_CHECKIN** 1건: `statusStartDate` = 입실 가능 시작일, `statusEndDate` = 무한대
- **ON_SALE** 1건: `statusStartDate` = 판매 시작일, `statusEndDate` = 판매 종료일

---

#### 3. `check_basic_sell === false` && `unableCheckInReason` 존재

**생성:**
- **BEFORE_SALES** 1건:
  - `status` = `BEFORE_SALES`
  - `subStatus` = `unableCheckInReason` (CHECKOUT, CHECK, CONTRACT, ROOM_MOVE, FREE_EXPERIENCE, OTHER, ETC)
  - `statusStartDate` = 현재일
  - `statusEndDate` = 무한대 (9999-12-31)
  - `statusMemo` = `unableCheckInReason`

---

## 정리

| 구분 | 테이블 | 사용 시점 |
|------|--------|-----------|
| **조회** | roomContract, room, customer, deposit, customer(계약자) | 계약 검증 및 정보 수집 |
| **저장** | il_room_refund_request | 환불 요청 1건 INSERT (rrr_sno 반환) |
| **갱신** | roomStatus | status = CHECKOUT_CONFIRMED |
| **갱신** | roomContract | status = CANCEL 또는 FIN |
| **조건부 조회** | il_gosiwon_config | check_basic_sell === true일 때만 |
| **조건부 생성** | roomStatus | roomAfterUse 호출 시 (ON_SALE / CAN_CHECKIN / BEFORE_SALES) |
| **로그** | history | 요청마다 1건 INSERT (REFUND, etcEsntlId=rrr_sno) |

**참고:**
- **`refund` 테이블은 사용하지 않음** (il_room_refund_request만 사용)
- 전체 처리 구간이 하나의 트랜잭션으로 묶여 있으며, 에러 시 롤백
- `roomAfterUse` 함수는 다른 곳에서도 재사용 가능하도록 export됨
