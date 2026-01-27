# /v1/roomExtraPayment — 테이블 & 플로우

## API 개요

| 항목          | 내용                                                                      |
|---------------|---------------------------------------------------------------------------|
| **엔드포인트** | `POST /v1/roomExtraPayment`                                               |
| **역할**      | 계약에 대한 **추가 결제 요청** 등록 (주차비, 추가 입실료, 직접 입력 등) |
| **인증**      | JWT Bearer (관리자)                                                       |

---

## 사용 테이블

### 1. roomContract (조회 전용)

계약 정보 조회에 사용. `room`, `customer`와 JOIN.

| 컬럼          | 용도                    |
|---------------|-------------------------|
| esntlId       | 계약 ID (contractEsntlId) |
| gosiwonEsntlId | 고시원 ID               |
| roomEsntlId   | 방 ID                   |
| customerEsntlId | 고객 ID                 |
| startDate, endDate | 계약 기간 (sendDate 검증용) |

---

### 2. extraPayment (추가·저장)

추가 결제 항목 저장. **메인 저장소**.

| 컬럼              | 용도                                    |
|-------------------|-----------------------------------------|
| esntlId           | PK, `EXTR` + 10자리 숫자                |
| contractEsntlId   | 계약 ID                                 |
| gosiwonEsntlId    | 고시원 ID (contract에서 복사)           |
| roomEsntlId       | 방 ID (contract에서 복사)               |
| customerEsntlId   | 고객 ID (contract에서 복사)             |
| uniqueId          | YYYYMMDD + esntlId 숫자부 (예: 202507214274) |
| extraCostName     | 추가비용명 (주차비, 추가 입실료, 직접 입력 등) |
| memo               | 메모 (2인 추가 등)                      |
| optionInfo        | 옵션정보 (차량번호·차종 등)              |
| useStartDate      | 이용 시작일 (주차비 등)                 |
| optionName        | 옵션명 (자동차, 오토바이, 기타 등)       |
| extendWithPayment | 연장 시 함께 결제 여부 (0/1)            |
| pDate, pTime      | 결제(요청) 일시                         |
| paymentAmount, pyl_goods_amount | 금액 (절댓값)                    |
| imp_uid           | PG 결제 ID (요청 시 `''`)                |
| paymentStatus     | `PENDING` (결제대기) 고정                |
| paymentType, withdrawalStatus | null                              |
| deleteYN          | `N`                                     |

---

### 3. gosiwonParking (parking 모델, 조건부 갱신)

**optionName = `자동차` | `오토바이`** 일 때만 사용.

| 컬럼          | 용도                  |
|---------------|-----------------------|
| esntlId       | PK                    |
| gosiwonEsntlId | 고시원 ID             |
| auto, autoUse | 자동차 가능/사용 대수  |
| bike, bikeUse | 오토바이 가능/사용 대수 |

- 자동차: `autoUse` +1  
- 오토바이: `bikeUse` +1  

---

### 4. parkStatus (조건부 생성)

**optionName = `자동차` | `오토바이`** 이고, 해당 고시원 `gosiwonParking`이 있을 때만 **INSERT**.

| 컬럼          | 용도                                    |
|---------------|-----------------------------------------|
| esntlId       | PK, `PKST` + 10자리 숫자                |
| gosiwonEsntlId | 고시원 ID                              |
| contractEsntlId | 계약 ID                                |
| customerEsntlId | 고객 ID                                |
| status        | `IN_USE`                                |
| useStartDate  | 이용 시작일 (useStartDate 또는 pDate)   |
| useEndDate    | 계약 종료일 (contract.endDate)          |
| memo          | optionInfo (차량번호 등)                |
| deleteYN      | `N`                                     |

---

### 5. history (항상 1건 생성)

추가 결제 요청 시 **항상** 1건 INSERT.

| 컬럼                              | 용도                                    |
|-----------------------------------|-----------------------------------------|
| esntlId                           | PK, `HISTORY` + 10자리 숫자             |
| gosiwonEsntlId, roomEsntlId, contractEsntlId | 계약·방·고시원                      |
| content                           | `"추가 결제 요청: N건, 총액: X원, 수신자: ..., 발송일: ..."` |
| category                          | `EXTRA_PAYMENT`                         |
| priority                          | `NORMAL`                                |
| publicRange                       | 0                                       |
| writerAdminId                     | 토큰 관리자 ID                          |
| writerType                        | `ADMIN`                                 |
| deleteYN                          | `N`                                     |

---

## 플로우 다이어그램

```
[Client]  POST /v1/roomExtraPayment
    body: { contractEsntlId, extraPayments[], receiverPhone?, sendDate? }
          |
          v
[1] JWT 검증 (관리자)
          |
          v
[2] roomContract + room + customer 조회
    → 계약 없으면 404
          |
          v
[3] sendDate 있으면 계약 기간(startDate~endDate) 안인지 검증
    → 아니면 400 "발송일은 계약기간 안에만 입력할 수 있습니다."
          |
          v
[4] pDate, pTime 생성 (현재 일시)
          |
          v
[5] extraPayments[] 루프
    |
    +-- [5-1] EXTR ID, uniqueId 생성
    |
    +-- [5-2] extraPayment INSERT
    |         (contractEsntlId, gosiwonEsntlId, roomEsntlId, customerEsntlId,
    |          extraCostName, cost, memo, optionInfo, useStartDate, optionName,
    |          extendWithPayment, pDate, pTime, paymentAmount, paymentStatus=PENDING, ...)
    |
    +-- [5-3] optionName IN ('자동차', '오토바이') ?
    |         |
    |         YES --> [5-3a] gosiwonParking 조회 (gosiwonEsntlId)
    |                  |
    |                  +-- 있으면
    |                  |     · 자동차 → autoUse +1
    |                  |     · 오토바이 → bikeUse +1
    |                  |     · parkStatus INSERT (IN_USE, useStartDate, useEndDate, memo=optionInfo)
    |                  |
    |         NO  --> skip
    |
    +-- totalAmount += |cost|
    |
    v
[6] history INSERT
    (category=EXTRA_PAYMENT, content="추가 결제 요청: N건, 총액: X원, ...")
          |
          v
[7] transaction COMMIT
          |
          v
[8] 200 응답
    { contractEsntlId, totalAmount, paymentCount, payments[], historyId }
```

---

## 테이블 관계 요약

```
roomContract ──┬── (조회) ──► room, customer
               │
               └── (기준) ──► extraPayment (1:N, contractEsntlId)
                                    │
                                    ├── (같은 계약) gosiwonEsntlId
                                    │       │
                                    │       └── gosiwonParking (고시원별 주차장)
                                    │                 │
                                    │                 └── autoUse / bikeUse 갱신
                                    │
                                    └── optionName 자동차/오토바이 시
                                              │
                                              └── parkStatus (1:N, contractEsntlId)

history ── (항상 1건) contractEsntlId, gosiwonEsntlId, roomEsntlId, category=EXTRA_PAYMENT
```

---

## 요청/응답 예시

**요청**

```json
{
  "contractEsntlId": "RCO0000000001",
  "extraPayments": [
    {
      "extraCostName": "주차비",
      "cost": 20000,
      "memo": "1대",
      "extendWithPayment": true,
      "useStartDate": "2025-11-03",
      "optionInfo": "12가 3456",
      "optionName": "자동차"
    },
    {
      "extraCostName": "추가 입실료",
      "cost": 50000,
      "memo": "2인 추가"
    }
  ],
  "receiverPhone": "010-1234-5678",
  "sendDate": "2025-11-05"
}
```

**응답**

```json
{
  "statusCode": 200,
  "message": "추가 결제 요청이 완료되었습니다.",
  "data": {
    "contractEsntlId": "RCO0000000001",
    "totalAmount": 70000,
    "paymentCount": 2,
    "payments": [
      { "esntlId": "EXTR0000000001", "extraCostName": "주차비", "cost": 20000 },
      { "esntlId": "EXTR0000000002", "extraCostName": "추가 입실료", "cost": 50000 }
    ],
    "historyId": "HISTORY0000000001"
  }
}
```

---

## 정리

| 구분       | 테이블          | 사용 시점                                    |
|-----------|-----------------|----------------------------------------------|
| **조회**   | roomContract, room, customer | 계약 검증 및 ID 채우기                        |
| **저장**   | extraPayment    | 항목별 1건씩 INSERT                           |
| **조건부** | gosiwonParking  | optionName 자동차/오토바이 + 해당 고시원 주차장 존재 시 |
| **조건부** | parkStatus      | 위와 동일 조건 시 1건 INSERT                  |
| **로그**   | history         | 요청마다 1건 INSERT (EXTRA_PAYMENT)           |

全部 트랜잭션 내에서 처리하며, 예외 시 전부 rollback 됩니다.
