# /v1/roomContract/list — 테이블 & 플로우

## API 개요

| 항목          | 내용                                                                      |
|---------------|---------------------------------------------------------------------------|
| **엔드포인트** | `GET /v1/roomContract/list`                                              |
| **역할**      | 계약현황 목록 조회 (계약 정보, 고시원 정보, 고객 정보, 방 정보, 결제 정보 포함) |
| **인증**      | JWT Bearer (관리자)                                                       |
| **트랜잭션**  | 조회 전용 (읽기 작업만 수행)                                               |

---

## 사용 테이블

### 1. roomContract (RC) - 메인 테이블

계약 기본 정보를 제공하는 메인 테이블.

| 컬럼              | 용도                                    |
|-------------------|---------------------------------------|
| esntlId           | 계약 고유 아이디 (PK)                     |
| contractDate      | 계약일                                  |
| startDate         | 계약 시작일                              |
| endDate           | 계약 종료일                              |
| month             | 계약 기간 (월)                           |
| gosiwonEsntlId    | 고시원 고유 아이디 (FK)                   |
| roomEsntlId       | 방 고유 아이디 (FK)                      |
| customerEsntlId   | 고객 고유 아이디 (FK)                     |
| contract          | 계약서 일반                              |
| spacialContract   | 계약서 특약                              |
| customerName      | 고객 이름 (roomContract 테이블)           |
| customerPhone     | 고객 연락처 (roomContract 테이블)         |
| customerGender    | 고객 성별 (roomContract 테이블)           |
| customerAge       | 고객 나이 (roomContract 테이블)           |
| checkinName       | 체크인한 사람 이름                        |
| checkinPhone      | 체크인한 사람 연락처                      |
| checkinGender     | 체크인한 사람 성별                       |
| checkinAge        | 체크인한 사람 나이                       |
| status            | 계약 상태 (필터링에 사용)                  |

---

### 2. gosiwon (G) - JOIN

고시원 정보를 제공.

| 컬럼    | 용도                      |
|---------|---------------------------|
| esntlId | 고시원 고유 아이디 (PK, 검색 조건) |
| name    | 고시원명 (검색 조건)       |
| address | 고시원 주소 (지역 추출용)   |

**조인 조건:**
- `RC.gosiwonEsntlId = G.esntlId` (INNER JOIN)

**추출:**
- `region`: `SUBSTRING_INDEX(SUBSTRING_INDEX(G.address, ' ', 2), ' ', -2)` - 주소에서 지역 추출

---

### 3. customer (C) - JOIN

고객 정보를 제공.

| 컬럼  | 용도                    |
|-------|-------------------------|
| esntlId | 고객 고유 아이디 (PK)   |
| name    | 고객명 (검색 조건)       |
| phone   | 고객 전화번호 (검색 조건) |

**조인 조건:**
- `RC.customerEsntlId = C.esntlId` (INNER JOIN)

---

### 4. room (R) - JOIN

방 정보를 제공.

| 컬럼      | 용도          |
|-----------|---------------|
| esntlId   | 방 고유 아이디 (PK) |
| roomNumber | 방 번호       |
| roomType  | 방 타입       |
| window    | 창 타입       |

**조인 조건:**
- `RC.roomEsntlId = R.esntlId` (INNER JOIN)

---

### 5. roomStatus (RS) - LEFT JOIN

방 상태 정보를 제공 (필터링에 사용).

| 컬럼           | 용도                                                                      |
|----------------|---------------------------------------------------------------------------|
| contractEsntlId | 계약 고유 아이디 (FK)                                                      |
| status         | 방 상태 (PENDING, RESERVED, CONTRACT, OVERDUE, CHECKOUT_CONFIRMED, UNPAID) |

**조인 조건:**
- `RC.esntlId = RS.contractEsntlId` (LEFT JOIN)

**필터링:**
- `roomStatus` 파라미터로 방 상태 필터링 가능

---

### 6. paymentLog (PL) - LEFT JOIN (서브쿼리로 집계)

결제 정보를 계약별로 집계하여 제공.

| 컬럼            | 용도                  |
|-----------------|-----------------------|
| contractEsntlId | 계약 고유 아이디 (FK)  |
| pTime           | 결제 시간 (최신 결제 시간) |
| pyl_goods_amount | 상품 금액             |
| paymentAmount   | 결제 금액 (SUM)       |
| paymentPoint    | 포인트 결제 금액 (SUM) |
| paymentCoupon   | 쿠폰 결제 금액 (SUM)   |
| cAmount         | 수수료 금액 (SUM)      |
| cPercent        | 수수료 비율 (AVG)      |

**집계 쿼리:**
```sql
SELECT 
    contractEsntlId,
    pTime,
    pyl_goods_amount,
    SUM(paymentAmount) AS paymentAmount,
    SUM(paymentPoint) AS paymentPoint,
    SUM(paymentCoupon) AS paymentCoupon,
    SUM(cAmount) AS cAmount,
    AVG(cPercent) AS cPercent
FROM paymentLog 
GROUP BY contractEsntlId
```

**조인 조건:**
- `RC.esntlId = PL.contractEsntlId` (LEFT JOIN)

---

## 쿼리 파라미터

| 파라미터     | 타입              | 필수   | 기본값 | 설명                                                         |
|-------------|-------------------|--------|-------|--------------------------------------------------------------|
| page        | integer           | 아니오 | 1     | 페이지 번호                                                  |
| limit       | integer           | 아니오 | 50    | 페이지당 항목 수                                              |
| status      | string            | 아니오 | -     | 계약 상태 필터 (roomContract.status)                          |
| roomStatus  | string            | 아니오 | -     | 방 상태 필터 (PENDING, RESERVED, CONTRACT, OVERDUE, CHECKOUT_CONFIRMED, UNPAID) |
| startDate   | string (YYYY-MM-DD) | 아니오 | -     | 계약일 시작일                                                 |
| endDate     | string (YYYY-MM-DD) | 아니오 | -     | 계약일 종료일                                                 |
| searchString | string           | 아니오 | -     | 검색어 (고시원 ID, 고시원명, 고객명, 고객 전화번호)            |
| order       | string (ASC/DESC) | 아니오 | DESC  | 정렬 순서                                                    |

---

## 플로우 다이어그램

```
[Client]  GET /v1/roomContract/list
    query: { page, limit, status, roomStatus, startDate, endDate, searchString, order }
          |
          v
[1] JWT 검증 (관리자)
          |
          v
[2] 쿼리 파라미터 파싱 및 기본값 설정
    (page=1, limit=50, order=DESC)
          |
          v
[3] WHERE 조건 구성 (buildWhereConditions)
    ├── startDate && endDate → RC.contractDate BETWEEN ? AND ?
    ├── searchString → (G.esntlId LIKE ? OR G.name LIKE ? OR C.name LIKE ? OR C.phone LIKE ?)
    ├── status → RC.status = ?
    └── roomStatus → RS.status = ?
          |
          v
[4] 페이징 계산
    offset = (page - 1) * limit
          |
          v
[5] 메인 데이터 조회 쿼리 실행
    SELECT 
        RC.esntlId, region, RC.contractDate, PL.pTime,
        RC.startDate, RC.endDate, RC.month,
        RC.gosiwonEsntlId, G.name AS gosiwonName, G.address AS gosiwonAddress,
        RC.contract, RC.spacialContract,
        R.roomNumber, R.roomType, R.window,
        C.name AS customerName, C.phone AS customerPhone,
        RC.customerEsntlId, RC.checkinName, RC.checkinPhone,
        RC.checkinGender, RC.checkinAge,
        RC.customerName AS contractCustomerName,
        RC.customerPhone AS contractCustomerPhone,
        RC.customerGender AS contractCustomerGender,
        RC.customerAge AS contractCustomerAge,
        PL.pyl_goods_amount, PL.paymentAmount, PL.paymentPoint,
        PL.paymentCoupon, PL.cAmount, PL.cPercent,
        1 AS paymentCount,
        COUNT(*) OVER() AS totcnt
    FROM roomContract RC
    JOIN gosiwon G ON RC.gosiwonEsntlId = G.esntlId
    JOIN customer C ON RC.customerEsntlId = C.esntlId
    JOIN room R ON RC.roomEsntlId = R.esntlId
    LEFT JOIN roomStatus RS ON RC.esntlId = RS.contractEsntlId
    LEFT JOIN (paymentLog 집계 서브쿼리) PL ON RC.esntlId = PL.contractEsntlId
    WHERE [조건]
    ORDER BY RC.contractDate [order], PL.pTime [order]
    LIMIT ? OFFSET ?
          |
          v
[6] 합계 조회 쿼리 실행
    SELECT 
        FORMAT(COALESCE(SUM(PL.paymentAmount), 0), 0) AS paymentAmount,
        FORMAT(COALESCE(SUM(PL.paymentPoint), 0), 0) AS paymentPoint,
        FORMAT(COALESCE(SUM(PL.paymentCoupon), 0), 0) AS paymentCoupon,
        FORMAT(COALESCE(SUM(PL.cAmount), 0), 0) AS cAmount,
        FORMAT(COALESCE(AVG(PL.cPercent), 0), 0) AS cPercent
    FROM roomContract RC
    JOIN gosiwon G ON RC.gosiwonEsntlId = G.esntlId
    JOIN customer C ON RC.customerEsntlId = C.esntlId
    LEFT JOIN roomStatus RS ON RC.esntlId = RS.contractEsntlId
    LEFT JOIN paymentLog PL ON RC.esntlId = PL.contractEsntlId
    WHERE [조건]
          |
          v
[7] 전체 개수 조회 쿼리 실행
    SELECT COUNT(*) AS total
    FROM roomContract RC
    JOIN gosiwon G ON RC.gosiwonEsntlId = G.esntlId
    JOIN customer C ON RC.customerEsntlId = C.esntlId
    LEFT JOIN roomStatus RS ON RC.esntlId = RS.contractEsntlId
    WHERE [조건]
          |
          v
[8] 응답 데이터 구성
    {
        resultList: [계약 목록],
        totcnt: 전체 개수,
        totPaymentAmount: 전체 결제 금액 합계,
        totPaymentPoint: 전체 포인트 결제 금액 합계,
        totPaymentCoupon: 전체 쿠폰 결제 금액 합계,
        totCAmount: 전체 수수료 금액 합계,
        totCPercent: 전체 수수료 비율 평균,
        page: 현재 페이지,
        limit: 페이지당 항목 수,
        totalPages: 전체 페이지 수
    }
          |
          v
[9] 200 응답
```

---

## 테이블 관계 요약

```
roomContract (RC) ──┬── INNER JOIN ──► gosiwon (G)
                    │                  (고시원 정보)
                    │
                    ├── INNER JOIN ──► customer (C)
                    │                  (고객 정보)
                    │
                    ├── INNER JOIN ──► room (R)
                    │                  (방 정보)
                    │
                    ├── LEFT JOIN ──► roomStatus (RS)
                    │                  (방 상태, 필터링용)
                    │
                    └── LEFT JOIN ──► paymentLog (PL)
                                       (결제 정보 집계)
                                       └── GROUP BY contractEsntlId
                                           (SUM, AVG 집계)
```

---

## 요청/응답 예시

**요청**

```
GET /v1/roomContract/list?page=1&limit=50&roomStatus=CONTRACT&startDate=2024-01-01&endDate=2024-12-31&order=DESC
Authorization: Bearer {token}
```

**응답**

```json
{
  "statusCode": 200,
  "message": "계약현황 목록 조회 성공",
  "data": {
    "resultList": [
      {
        "esntlId": "RCTT0000025145",
        "region": "서울시 강남구",
        "contractDate": "2024-01-15",
        "pTime": "2024-01-15 14:30:00",
        "startDate": "2024-01-15",
        "endDate": "2024-02-14",
        "month": "1",
        "gosiwonEsntlId": "GOSI0000002130",
        "gosiwonName": "강남 고시원",
        "gosiwonAddress": "서울시 강남구 테헤란로 123",
        "contract": "계약서 일반 내용",
        "spacialContract": "계약서 특약 내용",
        "roomNumber": "101",
        "roomType": "원룸",
        "window": "창문 있음",
        "customerName": "홍길동",
        "customerPhone": "010-1234-5678",
        "customerEsntlId": "CUST0000000123",
        "checkinName": "홍길동",
        "checkinPhone": "010-1234-5678",
        "checkinGender": "남성",
        "checkinAge": 30,
        "contractCustomerName": "홍길동",
        "contractCustomerPhone": "010-1234-5678",
        "contractCustomerGender": "남성",
        "contractCustomerAge": 30,
        "pyl_goods_amount": 300000,
        "paymentAmount": "300,000",
        "payment_amount": 300000,
        "paymentPoint": "0",
        "paymentCoupon": "0",
        "cAmount": "30,000",
        "cPercent": "10.00",
        "paymentCount": 1,
        "totcnt": 150
      }
    ],
    "totcnt": 150,
    "totPaymentAmount": "45,000,000",
    "totPaymentPoint": "500,000",
    "totPaymentCoupon": "1,000,000",
    "totCAmount": "4,500,000",
    "totCPercent": "10.00",
    "page": 1,
    "limit": 50,
    "totalPages": 3
  }
}
```

---

## 주요 특징

### 1. 결제 정보 집계

- `paymentLog` 테이블의 데이터를 계약별로 집계하여 제공
- 각 계약에 대해 결제 금액, 포인트, 쿠폰, 수수료를 합산
- `pTime`은 최신 결제 시간을 표시

### 2. 검색 기능

- `searchString` 파라미터로 다음 필드에서 검색:
  - 고시원 ID (`G.esntlId`)
  - 고시원명 (`G.name`)
  - 고객명 (`C.name`)
  - 고객 전화번호 (`C.phone`)

### 3. 필터링

- **계약 상태**: `status` 파라미터로 `roomContract.status` 필터링
- **방 상태**: `roomStatus` 파라미터로 `roomStatus.status` 필터링
  - PENDING: 입금대기중
  - RESERVED: 예약중
  - CONTRACT: 이용중
  - OVERDUE: 체납상태
  - CHECKOUT_CONFIRMED: 퇴실확정
  - UNPAID: 보증금 미납
- **계약일 기간**: `startDate`, `endDate`로 계약일 범위 필터링

### 4. 정렬

- 기본 정렬: `RC.contractDate DESC, PL.pTime DESC`
- `order` 파라미터로 ASC/DESC 변경 가능

### 5. 페이징

- `page`와 `limit` 파라미터로 페이징 처리
- `totalPages` 계산: `Math.ceil(totalCount / limit)`
- 각 항목에 `totcnt` (전체 개수) 포함

### 6. 집계 정보

- 전체 목록에 대한 합계 정보 제공:
  - `totPaymentAmount`: 전체 결제 금액 합계
  - `totPaymentPoint`: 전체 포인트 결제 금액 합계
  - `totPaymentCoupon`: 전체 쿠폰 결제 금액 합계
  - `totCAmount`: 전체 수수료 금액 합계
  - `totCPercent`: 전체 수수료 비율 평균

---

## 정리

| 구분     | 테이블            | 사용 시점                        |
|----------|-------------------|----------------------------------|
| **메인** | roomContract (RC) | 계약 기본 정보 조회              |
| **JOIN** | gosiwon (G)       | 고시원 정보 (INNER JOIN)         |
| **JOIN** | customer (C)      | 고객 정보 (INNER JOIN)           |
| **JOIN** | room (R)          | 방 정보 (INNER JOIN)             |
| **JOIN** | roomStatus (RS)   | 방 상태 필터링 (LEFT JOIN)       |
| **집계** | paymentLog (PL)   | 결제 정보 집계 (LEFT JOIN, 서브쿼리) |

**참고:**
- 조회 전용 API (읽기 작업만 수행)
- `paymentLog`는 서브쿼리로 집계하여 조인
- 금액 필드는 `FORMAT()` 함수로 천 단위 구분자 적용
- `COUNT(*) OVER()` 윈도우 함수로 각 행에 전체 개수 포함