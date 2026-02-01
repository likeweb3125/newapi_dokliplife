# Deposit API 그룹 — 테이블 & 플로우

## 개요

Deposit API 그룹은 보증금(예약금) 관리 기능을 제공합니다. 예약금 등록, 보증금 등록, 환불 처리, 이력 조회 등의 기능을 포함합니다.

**인증**: 모든 API는 JWT Bearer 토큰(관리자)이 필요합니다.

---

## 사용 테이블

### 1. deposit (D) - 메인 테이블

보증금/예약금 기본 정보를 저장하는 메인 테이블.

| 컬럼              | 용도                                    |
|-------------------|---------------------------------------|
| esntlId           | 보증금 고유 아이디 (PK)                  |
| roomEsntlId       | 방 고유 아이디 (FK)                     |
| gosiwonEsntlId    | 고시원 고유 아이디 (FK)                  |
| customerEsntlId   | 고객 고유 아이디 (FK, 입실자)            |
| contractorEsntlId | 계약자 고유 아이디 (FK)                  |
| contractEsntlId   | 계약서 고유 아이디 (FK)                  |
| type              | 타입 (RESERVATION: 예약금, DEPOSIT: 보증금) |
| amount            | 보증금/예약금 총액                       |
| paidAmount        | 입금액                                  |
| unpaidAmount      | 미납금액                                |
| status            | 상태 (PENDING, COMPLETED, PARTIAL_DEPOSIT, DELETED 등) |
| depositDate       | 입금일시                                |
| depositorName     | 입금자명                                |
| depositorPhone    | 입금자 전화번호                          |
| accountBank       | 은행명                                  |
| accountNumber     | 계좌번호                                |
| accountHolder     | 예금주명                                |
| virtualAccountNumber | 가상계좌번호                         |
| virtualAccountExpiryDate | 가상계좌 만료일시                |
| manager           | 담당자(관리자)                          |
| deleteYN           | 삭제 여부 (N: 정상, Y: 삭제)            |

---

### 2. depositHistory (DH) - 입금/반환 이력

보증금 입금 및 반환 이력을 기록하는 테이블.

| 컬럼           | 용도                                    |
|----------------|---------------------------------------|
| esntlId        | 이력 고유 아이디 (PK)                    |
| depositEsntlId | 보증금 고유 아이디 (FK)                  |
| roomEsntlId    | 방 고유 아이디 (FK)                     |
| contractEsntlId | 계약서 고유 아이디 (FK)                |
| type           | 타입 (DEPOSIT: 입금, RETURN: 반환)       |
| amount         | 금액                                    |
| status         | 상태                                    |
| depositorName  | 입금자명                                |
| depositDate    | 입금일시                                |
| manager        | 담당자                                  |

---

### 3. depositDeduction (DD) - 차감 항목

보증금 차감 항목을 저장하는 테이블.

| 컬럼            | 용도         |
|----------------|--------------|
| esntlId        | 차감 고유 아이디 (PK) |
| depositHistoryEsntlId | 입금 이력 고유 아이디 (FK) |
| deductionName  | 차감 항목명   |
| deductionAmount | 차감 금액   |

---

### 4. depositRefund (DR) - 환불 정보

보증금 환불 정보를 저장하는 테이블.

| 컬럼              | 용도                                    |
|-------------------|---------------------------------------|
| esntlId           | 환불 고유 아이디 (PK)                    |
| contractEsntlId  | 계약서 고유 아이디 (FK)                  |
| roomEsntlId      | 방 고유 아이디 (FK)                     |
| bank              | 환불 받을 은행명                         |
| bankAccount       | 환불 받을 계좌번호                       |
| accountHolder     | 계좌소유자 이름                          |
| refundItems       | 환불 항목 (JSON 형식)                    |
| totalDepositAmount | 전체 예약금 금액                        |
| refundAmount      | 환불 금액                                |
| remainAmount      | 잔여 환불 금액                           |
| status            | 환불 상태 (COMPLETED: 전액환불, PARTIAL: 부분환불) |
| manager           | 담당자                                  |
| deleteYN          | 삭제 여부                                |

---

### 5. room (R) - JOIN

방 정보를 제공.

| 컬럼           | 용도                    |
|----------------|-------------------------|
| esntlId        | 방 고유 아이디 (PK)      |
| roomNumber     | 방 번호                 |
| roomType       | 방 타입                 |
| gosiwonEsntlId | 고시원 고유 아이디 (FK)  |
| customerEsntlId | 현재 입실자 고유 아이디 (FK) |
| status         | 방 상태                 |

---

### 6. gosiwon (G) - JOIN

고시원 정보를 제공.

| 컬럼    | 용도                      |
|---------|---------------------------|
| esntlId | 고시원 고유 아이디 (PK)    |
| name    | 고시원명                  |
| status  | 고시원 상태 (OPERATE 등)   |

---

### 7. customer (C) - JOIN

고객 정보를 제공.

| 컬럼        | 용도                    |
|-------------|-------------------------|
| esntlId     | 고객 고유 아이디 (PK)    |
| name        | 고객명                  |
| phone       | 고객 전화번호           |
| bank        | 은행명                  |
| bankAccount | 계좌번호                |

---

### 8. roomContract (RC) - JOIN

계약 정보를 제공.

| 컬럼           | 용도                    |
|----------------|-------------------------|
| esntlId        | 계약 고유 아이디 (PK)    |
| roomEsntlId    | 방 고유 아이디 (FK)      |
| customerEsntlId | 고객 고유 아이디 (FK)    |
| startDate      | 계약 시작일             |
| endDate        | 계약 종료일             |
| checkinName    | 체크인한 사람 이름       |
| checkinPhone   | 체크인한 사람 연락처     |
| customerName   | 고객 이름 (계약자)       |
| customerPhone  | 고객 연락처 (계약자)     |
| status         | 계약 상태 (CONTRACT 등)  |

---

### 9. roomStatus (RS) - JOIN

방 상태 정보를 제공.

| 컬럼           | 용도                                    |
|----------------|---------------------------------------|
| esntlId        | 방 상태 고유 아이디 (PK)                 |
| roomEsntlId    | 방 고유 아이디 (FK)                      |
| contractEsntlId | 계약 고유 아이디 (FK)                   |
| status         | 방 상태 (ON_SALE, CAN_CHECKIN, CONTRACT 등) |
| subStatus      | 하위 상태 (END 등)                       |
| statusStartDate | 상태 시작일                            |
| updatedAt      | 최종 업데이트 시간                       |

---

### 10. paymentLog (PL) - JOIN

결제 로그 정보를 제공 (쿠폰 사용 여부 확인용).

| 컬럼           | 용도                    |
|----------------|-------------------------|
| esntlId        | 결제 로그 고유 아이디 (PK) |
| contractEsntlId | 계약 고유 아이디 (FK)    |
| ucp_eid        | 사용자쿠폰 고유 아이디 (FK) |

---

## API별 상세 설명

### 1. GET /v1/deposit/reservationList

**역할**: 예약금 목록 조회

**사용 테이블**:
- room (R) - 메인
- gosiwon (G) - LEFT JOIN
- roomStatus (RS) - LEFT JOIN (최신 상태만)
- roomContract (RC) - LEFT JOIN (status='CONTRACT' 중 최신 계약)
- deposit (D) - LEFT JOIN (type='RESERVATION')

**필터링**:
- `gosiwonName`: 고시원명 LIKE 검색 → gosiwon 테이블 조회 후 esntlId 리스트로 필터링
- `gosiwonCode`: 고시원 esntlId로 필터링
- `searchString`: roomNumber, room.esntlId, RC.checkinName, RC.customerName LIKE 검색
- `canCheckin`: RS.status = 'CAN_CHECKIN' AND (RS.subStatus IS NULL OR RS.subStatus != 'END')
- `reservationStatus`: 해당 방의 가장 최근 deposit(type='RESERVATION')의 status가 COMPLETED가 아닌 경우만

**정렬**:
1. RS.status = 'ON_SALE' AND subStatus != 'END'인 경우 우선 (0), 그 외는 1
2. sortDate (RS.statusStartDate) DESC
3. R.roomNumber ASC

**서브쿼리**:
- `depositEsntlId`: 해당 방의 가장 최근 deposit(type='RESERVATION', status='PENDING')의 esntlId
- `depositStatus`: 해당 방의 가장 최근 deposit(type='RESERVATION')의 status

**추가 조회**:
- 각 방별로 depositHistory 조회 (type='RESERVATION', 최대 30개, createdAt DESC)
- depositHistory와 roomContract LEFT JOIN하여 checkInDate 포함

**응답 데이터**:
- depositEsntlId, roomEsntlId, contractEsntlId, roomNumber, gosiwonName, roomStatus
- reservationName (RC.checkinName), reservationPhone (RC.checkinPhone)
- contractorName (RC.customerName), contractorPhone (RC.customerPhone)
- checkInDate (RC.startDate), checkOutDate (RC.endDate), depositStatus
- depositHistory[] (각 방의 예약금 내역, 최대 30개)

---

### 2. POST /v1/deposit/reservationRegist

**역할**: 예약금 등록

**사용 테이블**:
- room (R) - 조회 (gosiwonEsntlId 자동 조회)
- deposit (D) - INSERT
- depositHistory (DH) - INSERT

**입력 파라미터**:
- `depositDate`: 입금일시 (필수)
- `amount` 또는 `paidAmount`: 입금금액 (필수)
- `roomEsntlId`: 방 고유 아이디 (필수)
- `gosiwonEsntlId`: 고시원 고유 아이디 (선택, 없으면 room에서 자동 조회)
- `contractEsntlId`: 계약서 고유 아이디 (선택)
- `depositorName`: 입금자명 (선택)
- `manager`: 담당자 (자동: 토큰에서 추출)

**처리 로직**:
1. roomEsntlId로 room 정보 조회하여 gosiwonEsntlId 자동 가져오기
2. type='RESERVATION' 고정으로 deposit 레코드 생성
   - amount: 입력한 금액
   - paidAmount: 0
   - unpaidAmount: 0
   - status: 'PENDING'
3. depositHistory 레코드 생성 (type='DEPOSIT')

**트랜잭션**: 사용 (INSERT 작업)

---

### 3. GET /v1/deposit/reservationRegist/list

**역할**: 예약금 등록 이력 목록 조회

**사용 테이블**:
- depositHistory (DH) - 메인
- deposit (D) - JOIN
- room (R) - JOIN
- gosiwon (G) - JOIN
- roomContract (RC) - LEFT JOIN

**필터링**:
- `contractEsntlId`: 계약서 고유 아이디 (선택, contractEsntlId 또는 roomEsntlId 중 하나 필수)
- `roomEsntlId`: 방 고유 아이디 (선택)
- depositHistory.type = 'DEPOSIT'
- deposit.type = 'RESERVATION'

**정렬**: depositHistory.createdAt DESC

**페이징**: 지원 (page, limit)

---

### 4. GET /v1/deposit/reservationHistoryList

**역할**: 방의 예약금 내역 히스토리 조회

**사용 테이블**:
- deposit (D) - 메인
- roomContract (RC) - LEFT JOIN

**필터링**:
- `roomEsntlId`: 방 고유 아이디 (필수)
- D.type = 'RESERVATION'
- D.deleteYN = 'N' 또는 NULL

**정렬**: D.createdAt DESC

**제한**: 최대 30개

**응답 데이터**:
- roomEsntlId, gosiwonEsntlId
- content: { status, amount, checkInDate, checkinName, checkinPhone }
- manager, recordDate, recordTime (서울 시간 기준)

---

### 5. DELETE /v1/deposit/reservationDelete

**역할**: 예약금 요청 취소

**사용 테이블**:
- deposit (D) - UPDATE
- depositHistory (DH) - INSERT (삭제 이력)

**처리 로직**:
1. deposit.deleteYN = 'Y'로 업데이트
2. deposit.status = 'DELETED'로 업데이트
3. depositHistory에 삭제 이력 기록

**트랜잭션**: 사용 (UPDATE, INSERT 작업)

---

### 6. GET /v1/deposit/depositList

**역할**: 보증금 목록 조회

**사용 테이블**:
- room (R) - 메인
- gosiwon (G) - LEFT JOIN
- customer (C) - LEFT JOIN (R.customerEsntlId 기준)
- roomStatus (RS) - LEFT JOIN (최신 상태만)
- deposit (D) - LEFT JOIN (type='DEPOSIT', 최신 것만)
- roomContract (RC) - LEFT JOIN (D.contractEsntlId 기준)
- depositRefund (DR) - 서브쿼리 (최신 환불 정보)

**필터링**:
- `gosiwonName`: 고시원명 LIKE 검색
- `gosiwonCode`: 고시원 esntlId로 필터링
- `contractEsntlId`: 계약서 esntlId로 필터링
- `searchString`: roomNumber, room.esntlId, RC.checkinName, RC.customerName LIKE 검색
- `disableDeleted`: deposit.deleteYN = 'N' 또는 NULL
- `disableCompleted`: deposit.status != 'COMPLETED'

**정렬**:
1. D.createdAt DESC (신규일자순)
2. R.roomNumber ASC

**서브쿼리**:
- `depositStatus`: 해당 contractEsntlId의 가장 최근 deposit(type='DEPOSIT')의 status
- `depositLastestAmount`: 해당 contractEsntlId의 가장 최근 deposit(type='DEPOSIT')의 paidAmount
- `depositLastestTime`: 해당 contractEsntlId의 가장 최근 deposit(type='DEPOSIT')의 createdAt (서울 시간)
- `refundStatus`: 해당 contractEsntlId의 가장 최근 depositRefund의 status
- `refundCreatedAt`: 해당 contractEsntlId의 가장 최근 depositRefund의 createdAt (서울 시간)

**응답 데이터**:
- depositEsntlId, roomEsntlId, gosiwonEsntlId, gosiwonName, roomNumber
- currentOccupantName (C.name), currentOccupantID (R.customerEsntlId)
- customerBank (C.bank), customerBankAccount (C.bankAccount)
- checkinName (RC.checkinName), checkinPhone (RC.checkinPhone)
- contractorName (RC.customerName), contractorPhone (RC.customerPhone)
- depositAmount (D.amount), contractEsntlId, moveInDate (RC.startDate), moveOutDate (RC.endDate)
- contractStatus (RC.status), depositStatus, depositLastestAmount, depositLastestTime
- refundStatus, refundCreatedAt

---

### 7. GET /v1/deposit/contract-coupon-info

**역할**: 사용쿠폰, 계좌정보 확인 (보증금 환불 등록시 사전 조회용)

**사용 테이블**:
- roomContract (RC) - 메인
- customer (C) - JOIN (RC.customerEsntlId 기준)
- paymentLog (PL) - LEFT JOIN (쿠폰 사용 여부 확인)
- depositRefund (DR) - 서브쿼리 (잔액 조회)

**필터링**:
- `contractEsntlId`: 계약서 고유 아이디 (필수)

**쿠폰 확인 로직**:
- paymentLog에서 contractEsntlId로 조회하여 ucp_eid가 NULL이 아닌 경우 쿠폰 사용으로 판단
- 쿠폰 정보는 별도 쿠폰 테이블에서 조회 (코드에서 구현 필요)

**잔액 계산**:
- depositRefund에서 해당 contractEsntlId의 최신 레코드 조회
- status가 'PARTIAL'이면 remainAmount 반환, 아니면 0

**응답 데이터**:
- contractEsntlId, period: { startDate, endDate }
- hasCoupon: boolean, coupon: { esntId, name, description, value } (쿠폰 사용한 경우만)
- customerName (C.name), bank (C.bank), bankAccount (C.bankAccount)
- remainAmount: 잔액

---

### 8. POST /v1/deposit/depositRefundRegist

**역할**: 보증금 환불 등록

**사용 테이블**:
- roomContract (RC) - 조회 (roomEsntlId 확인)
- depositRefund (DR) - INSERT

**입력 파라미터**:
- `contractEsntlId`: 계약서 고유 아이디 (필수)
- `bank`: 환불 받을 은행명 (선택)
- `bankAccount`: 환불 받을 계좌번호 (선택)
- `accountHolder`: 계좌소유자 이름 (선택)
- `refundItems`: 환불 항목 배열 [{ content, amount }] (필수)
- `totalDepositAmount`: 전체 예약금 금액 (필수)
- `refundAmount`: 환불 금액 (필수)

**처리 로직**:
1. roomContract 조회하여 roomEsntlId 확인
2. 기존 depositRefund 조회하여:
   - 기존 refundAmount 합계 계산
   - status='COMPLETED'인 레코드가 있으면 에러
3. remainAmount 계산: totalDepositAmount - (기존 refundAmount 합계 + 새 refundAmount)
4. remainAmount < 0이면 에러
5. status 자동 계산: remainAmount = 0이면 'COMPLETED', 아니면 'PARTIAL'
6. refundItems의 amount 합계가 refundAmount와 일치하는지 검증
7. depositRefund 레코드 생성 (refundItems는 JSON.stringify하여 저장)

**트랜잭션**: 사용 (INSERT 작업)

**응답 데이터**:
- depositRefundEsntlId, contractEsntlId, status
- totalDepositAmount, refundAmount, remainAmount

---

### 9. GET /v1/deposit/depositReturn/list

**역할**: 보증금 반환 이력 목록 조회

**사용 테이블**:
- depositRefund (DR) - 메인
- roomContract (RC) - LEFT JOIN
- room (R) - LEFT JOIN
- gosiwon (G) - LEFT JOIN

**필터링**:
- `contractEsntlId`: 계약서 고유 아이디 (선택, contractEsntlId 또는 roomEsntlId 중 하나 필수)
- `roomEsntlId`: 방 고유 아이디 (선택)
- DR.deleteYN = 'N' 또는 NULL

**정렬**: DR.createdAt DESC

**페이징**: 지원 (page, limit)

**시간 형식**: 서울 시간(+9) 기준으로 변환

---

### 10. GET /v1/deposit/depositInfo

**역할**: 보증금(예약금) 상세 정보 조회

**사용 테이블**:
- deposit (D) - 메인
- room (R) - LEFT JOIN
- gosiwon (G) - LEFT JOIN
- customer (C) - LEFT JOIN (customer, contractor 각각)
- depositHistory (DH) - 조회
- depositDeduction (DD) - LEFT JOIN (depositHistory 기준)

**필터링**:
- `esntlId`: 보증금 고유 아이디 (필수)

**입금 이력 조회**:
- depositHistory에서 depositEsntlId로 조회
- depositDeduction LEFT JOIN하여 차감 항목 포함
- createdAt DESC 정렬

**총 입금액 계산**:
- depositHistory에서 type='DEPOSIT' AND status IN ('DEPOSIT_COMPLETED', 'PARTIAL_DEPOSIT')인 레코드의 amount 합계

**미납금액 계산**:
- deposit.amount - totalDepositAmount

**응답 데이터**:
- deposit 정보 (room, gosiwon, customer, contractor 포함)
- histories[]: 입금/반환 이력 (deductions 포함)
- totalDepositAmount: 총 입금액
- unpaidAmount: 미납금액

---

### 11. POST /v1/deposit/depositCreate

**역할**: 보증금 등록 (type=DEPOSIT 고정)

**사용 테이블**:
- deposit (D) - INSERT
- depositHistory (DH) - INSERT

**입력 파라미터**:
- `roomEsntlId`: 방 고유 아이디 (필수)
- `gosiwonEsntlId`: 고시원 고유 아이디 (필수)
- `customerEsntlId`: 예약자/입실자 고유 아이디 (선택)
- `contractorEsntlId`: 계약자 고유 아이디 (선택)
- `contractEsntlId`: 방계약 고유 아이디 (선택)
- `amount`: 입금금액 (필수)
- `depositDate`: 입금일시 (필수)
- `depositorName`: 입금자명 (선택)
- `depositorPhone`: 입금자 전화번호 (선택)
- `accountBank`: 은행명 (선택)
- `accountNumber`: 계좌번호 (선택)
- `accountHolder`: 예금주명 (선택)
- `virtualAccountNumber`: 가상계좌번호 (선택)
- `virtualAccountExpiryDate`: 가상계좌 만료일시 (선택)

**처리 로직**:
1. type='DEPOSIT' 고정으로 deposit 레코드 생성
2. depositHistory 레코드 생성 (type='DEPOSIT')

**트랜잭션**: 사용 (INSERT 작업)

**응답 데이터**:
- depositEsntlId, historyId, status, paidAmount, unpaidAmount, amount

---

### 12. PUT /v1/deposit/update

**역할**: 보증금 정보 수정

**사용 테이블**:
- deposit (D) - UPDATE
- depositHistory (DH) - INSERT (변경 이력)

**처리 로직**:
- deposit 정보 업데이트
- 변경 이력을 depositHistory에 기록

**트랜잭션**: 사용 (UPDATE, INSERT 작업)

---

### 13. DELETE /v1/deposit/depositDelete

**역할**: 보증금 삭제 (type=DEPOSIT만)

**사용 테이블**:
- deposit (D) - UPDATE
- depositHistory (DH) - INSERT (삭제 이력)

**처리 로직**:
1. deposit.type = 'DEPOSIT'인 경우만 삭제 가능
2. deposit.deleteYN = 'Y'로 업데이트
3. deposit.status = 'DELETED'로 업데이트
4. depositHistory에 삭제 이력 기록

**트랜잭션**: 사용 (UPDATE, INSERT 작업)

---

### 14. GET /v1/deposit/history

**역할**: 보증금 이력 조회

**사용 테이블**:
- depositHistory (DH) - 메인
- deposit (D) - JOIN

**필터링**:
- `depositEsntlId`: 보증금 고유 아이디 (필수)

**정렬**: depositHistory.createdAt DESC

---

### 15. GET /v1/deposit/gosiwonList

**역할**: 고시원 목록 조회 (입금대기 건수 포함)

**사용 테이블**:
- gosiwon (G) - 메인
- deposit (D) - LEFT JOIN (집계용)

**필터링**:
- G.status = 'OPERATE'

**집계**:
- 각 고시원별로 deposit(type='RESERVATION', status='PENDING', deleteYN='N') 건수 카운트

**정렬**:
1. pendingCount DESC (입금대기 건수가 있는 고시원 우선)
2. G.name ASC

**응답 데이터**:
- esntlId, name, pendingCount

---

### 16. GET /v1/deposit/getRoomDepositList

**역할**: 방 보증금/예약금 이력 조회

**사용 테이블**:
- deposit (D) - 메인

**필터링**:
- `roomEsntlId`: 방 고유 아이디 (필수)
- `type`: 조회 타입 (RESERVATION 또는 DEPOSIT, 필수)
- D.deleteYN = 'N' 또는 NULL

**정렬**: D.depositDate DESC, D.createdAt DESC

**응답 데이터**:
- status, date (depositDate), amount, paidAmount, unpaidAmount, manager, depositorName

---

## 공통 로직

### ID 생성

- **deposit.esntlId**: `DEPO` + 10자리 숫자 (예: DEPO0000000001)
- **depositHistory.esntlId**: `DEHI` + 10자리 숫자
- **depositDeduction.esntlId**: `DEDU` + 10자리 숫자
- **depositRefund.esntlId**: `DERF` + 10자리 숫자

### 상태값

**deposit.status**:
- `PENDING`: 입금대기
- `COMPLETED`: 입금완료
- `PARTIAL_DEPOSIT`: 부분입금
- `DELETED`: 삭제됨

**depositRefund.status**:
- `COMPLETED`: 전액환불
- `PARTIAL`: 부분환불

### 시간 처리

- 모든 createdAt, updatedAt는 UTC 시간 기준
- 응답 시 서울 시간(+9)으로 변환하여 반환
- `DATE_ADD(createdAt, INTERVAL 9 HOUR)` 사용

### 트랜잭션

- INSERT, UPDATE, DELETE 작업은 모두 트랜잭션 사용
- 에러 발생 시 rollback 처리

---

## 주의사항

1. **deposit.type 구분**:
   - `RESERVATION`: 예약금 (입실 전)
   - `DEPOSIT`: 보증금 (입실 후)

2. **최신 데이터 조회**:
   - roomStatus, roomContract, deposit 등은 최신 레코드만 조회하기 위해 서브쿼리 사용
   - MAX(updatedAt) 또는 MAX(createdAt) 기준으로 최신 레코드 선택

3. **삭제 처리**:
   - 실제 DELETE가 아닌 deleteYN='Y'로 soft delete 처리
   - 삭제 이력은 depositHistory에 기록

4. **환불 금액 검증**:
   - depositRefund 등록 시 기존 환불액 합계와 새 환불액의 합이 totalDepositAmount를 초과하지 않도록 검증
   - status='COMPLETED'인 환불이 이미 있으면 추가 환불 불가

5. **페이징**:
   - 대부분의 목록 조회 API는 page, limit 파라미터 지원
   - 기본값: page=1, limit=50
