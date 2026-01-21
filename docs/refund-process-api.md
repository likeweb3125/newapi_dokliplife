# /v1/refund/process API 문서

**경로:** `POST /v1/refund/process`  
**컨트롤러:** `refundController.processRefundAndCheckout`  
**설명:** 계약에 대한 환불 및 퇴실 처리를 수행합니다. 모든 작업은 트랜잭션 내에서 실행되며, 에러 시 롤백됩니다.

---

## 1. 사용 테이블 및 처리

### 1.1 roomContract, room, customer, deposit, customer(계약자) — SELECT

`contractEsntlId`로 계약 1건 조회합니다.

| 테이블 | 역할 |
|--------|------|
| **roomContract (RC)** | 계약 기본 정보 |
| **room (R)** | 방 정보 |
| **customer (C)** | 입실자 이름 |
| **deposit (D)** | 예약금, 계약자 ID(contractorEsntlId) |
| **customer (CT)** | 계약자 이름 |

**조인 조건:**
- `RC.roomEsntlId = R.esntlId`
- `RC.customerEsntlId = C.esntlId`
- `D.contractEsntlId = RC.esntlId AND D.deleteYN = 'N'` (LEFT JOIN)
- `D.contractorEsntlId = CT.esntlId` (LEFT JOIN)

---

### 1.2 il_room_refund_request — INSERT

환불 요청 1건을 저장합니다. **`refund` 테이블은 사용하지 않습니다.**

**저장 컬럼:**

| 컬럼 | 요청/계산 값 |
|------|-------------|
| gsw_eid | contract.gosiwonEsntlId |
| rom_eid | contract.roomEsntlId |
| mbr_eid | contract.customerEsntlId |
| ctt_eid | contractEsntlId |
| rrr_leave_type_cd | cancelReason (FULL / INTERIM / CANCEL / ETC) |
| rrr_leave_date | cancelDate |
| rrr_leave_reason | cancelMemo 또는 "{취소사유} 퇴실" |
| rrr_liability_reason | liabilityReason (OWNER / OCCUPANT) 또는 null |
| rrr_payment_amt | paymentAmount |
| rrr_use_period | 입실 시작일 ~ 현재일 일수 |
| rrr_use_amt | proratedRent |
| rrr_penalty_amt | penalty |
| rrr_refund_total_amt | totalRefundAmount |
| rrr_registrant_id | writerAdminId |
| rrr_update_dtm | NOW() |
| rrr_updater_id | writerAdminId |

---

### 1.3 roomStatus — UPDATE

`contractEsntlId`가 일치하는 행의 `status`를 `CHECKOUT_CONFIRMED`로 변경합니다.

---

### 1.4 roomContract — UPDATE

`status`를 다음 규칙으로 갱신합니다.

| cancelReason | roomContract.status |
|--------------|---------------------|
| CANCEL | CANCEL |
| FULL, INTERIM, ETC | FIN |

---

### 1.5 roomAfterUse 호출 시 사용 테이블

다음 중 하나라도 존재할 때만 `roomAfterUse`를 호출합니다.

- `check_basic_sell !== undefined`
- `unableCheckInReason`
- `check_room_only_config !== undefined`
- `sell_able_start_date`
- `can_checkin_start_date`

#### 1.5.1 il_gosiwon_config — SELECT (`check_basic_sell === true`)

- `gsc_checkin_able_date`, `gsc_sell_able_period` 조회
- CAN_CHECKIN / ON_SALE 기간 계산에 사용
- `baseDate` 미전달 시 **현재일** 기준

#### 1.5.2 roomStatus — INSERT (roomAfterUse 내부)

| 조건 | 생성 상태 | 비고 |
|------|----------|------|
| `check_room_only_config === true` | ON_SALE 1건, CAN_CHECKIN 1건 | 전달된 날짜(sell_able_*, can_checkin_*) 사용 |
| `check_basic_sell === true` | CAN_CHECKIN 1건, ON_SALE 1건 | il_gosiwon_config 기반 |
| `check_basic_sell === false` && `unableCheckInReason` 존재 | BEFORE_SALES 1건 | subStatus = unableCheckInReason |

---

### 1.6 history — SELECT + INSERT

- **SELECT:** `generateHistoryId`에서 최신 `esntlId` 조회
- **INSERT:** 환불/퇴실 이력 저장
  - `etcEsntlId`: `il_room_refund_request` INSERT 후 `insertId` (rrr_sno)
  - `category`: `REFUND`

---

## 2. 처리 순서 요약

| 순서 | 테이블 | 작업 | 비고 |
|------|--------|------|------|
| 1 | roomContract, room, customer, deposit, customer | SELECT | 계약·방·입실자·예약금·계약자 조회 |
| 2 | il_room_refund_request | INSERT | 환불 요청 저장 |
| 3 | roomStatus | UPDATE | status = CHECKOUT_CONFIRMED |
| 4 | roomContract | UPDATE | status = CANCEL 또는 FIN |
| 5 | il_gosiwon_config | SELECT | check_basic_sell === true일 때만 |
| 6 | roomStatus | INSERT | roomAfterUse: ON_SALE / CAN_CHECKIN / BEFORE_SALES |
| 7 | history | SELECT + INSERT | REFUND 이력 생성 |

---

## 3. 요청 파라미터 (body)

| 필드 | 필수 | 설명 |
|------|------|------|
| contractEsntlId | O | 계약 ID |
| cancelReason | O | FULL / INTERIM / CANCEL / ETC |
| cancelDate | O | 퇴실/취소 일자 |
| cancelMemo | | 퇴실 사유 (없으면 "{취소사유} 퇴실") |
| liabilityReason | | OWNER / OCCUPANT |
| refundMethod | | 환불 수단 |
| paymentAmount | | 결제 금액 (rrr_payment_amt) |
| proratedRent | | 일할 계산 금액 (rrr_use_amt) |
| penalty | | 위약금 (rrr_penalty_amt) |
| totalRefundAmount | | 총 환불 금액 (rrr_refund_total_amt) |
| check_basic_sell | | roomAfterUse: 기본 판매 설정 사용 여부 |
| unableCheckInReason | | roomAfterUse: BEFORE_SALES의 subStatus |
| check_room_only_config | | roomAfterUse: 사용자 지정 날짜 사용 여부 |
| sell_able_start_date | | roomAfterUse: 판매 가능 시작일 |
| sell_able_end_date | | roomAfterUse: 판매 가능 종료일 |
| can_checkin_start_date | | roomAfterUse: 입실 가능 시작일 |
| can_checkin_end_date | | roomAfterUse: 입실 가능 종료일 |

---

## 4. 응답 예시

```json
{
  "rrr_sno": 123,
  "historyId": "HISTORY0000000123",
  "roomStatus": "CHECKOUT_CONFIRMED"
}
```

---

## 5. 참고

- **refund 테이블:** 이 API에서는 사용하지 않음 (il_room_refund_request만 사용)
- **트랜잭션:** 전체 처리 구간이 하나의 트랜잭션으로 묶여 있으며, 에러 시 롤백
