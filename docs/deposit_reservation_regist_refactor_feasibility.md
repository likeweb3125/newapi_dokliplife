# /v1/deposit/reservationRegist 리팩터링 — 가능 여부 및 필요 사항

## 요구 사항 요약

1. **대상 테이블 변경**: 기존 `deposit` → `il_room_deposit` (메인 데이터)
2. **히스토리 테이블**: 별도 히스토리 관리 → `il_room_deposit_history` 사용 (기존 `depositHistory` 대체)
3. **예약금/보증금 구분 제거**: 예약금 입력 시 곧 보증금으로 간주하여 하나의 타입으로 처리

---

## 가능 여부

| 항목 | 가능 여부 | 비고 |
|------|-----------|------|
| 메인 테이블 `deposit` → `il_room_deposit` 전환 | ⚠️ 가능 (DB·코드 작업 필요) | 테이블/모델 신규 생성 및 API 전면 수정 |
| 히스토리 테이블 `depositHistory` → `il_room_deposit_history` 전환 | ✅ 가능 | 테이블·모델 추가 후 `registerDeposit`에서 해당 테이블로 기록하도록 변경 (현재 구현 완료) |
| 예약금/보증금 구분 제거 | ✅ 가능 | type 단일화, 비즈니스 로직만 정리 |

---

## 전체 리팩터링 시 필요 사항

### 1. DB 테이블

#### 1-1. `il_room_deposit` (메인 테이블, 신규)

- **역할**: 기존 `deposit`과 동일한 “방별 보증금(예약금 포함)” 메인 정보.
- **필요 작업**:
  - `il_room_deposit` 테이블 CREATE (컬럼은 `deposit`과 유사하게 설계, 예: roomEsntlId, gosiwonEsntlId, amount, status, depositDate, depositorName 등).
  - 예약금/보증금 구분 없이 하나의 타입만 둘 경우 `type` 컬럼 제거 또는 단일 값(예: `DEPOSIT`) 고정.
- **참고**: 현재 코드베이스·SQL에는 `il_room_deposit` 정의 없음 → **신규 작성 필요**.

#### 1-2. `il_room_deposit_history` (히스토리 테이블)

- **역할**: 입금/등록/변경 이력 저장.
- **필요 작업**:
  - 테이블 CREATE: `sql/create_il_room_deposit_history_table.sql` 추가됨.
  - `deposit` 연동 단계에서는 `depositEsntlId`로 기존 `deposit.esntlId` 참조.
  - 이후 메인을 `il_room_deposit`으로 옮기면 `room_deposit_esntl_id`(또는 동일 역할 컬럼)로 `il_room_deposit` 참조하도록 스키마/모델만 변경하면 됨.
- **상태**: 스키마·모델 생성 및 `registerDeposit`에서 이 테이블로 기록하도록 반영 완료.

### 2. 애플리케이션 코드

#### 2-1. 메인 테이블을 `il_room_deposit`으로 바꿀 경우

- **모델**: `il_room_deposit`용 Sequelize 모델 신규 생성.
- **API**:
  - `POST /v1/deposit/reservationRegist`:  
    - `deposit.create` → `ilRoomDeposit.create`로 변경.  
    - 입력 데이터를 “예약금이 곧 보증금” 규칙에 맞게 매핑.
  - `GET /v1/deposit/reservationList`, `depositList` 등 **deposit 테이블을 참조하는 모든 API**에서:
    - `deposit` 조회 → `il_room_deposit` 조회로 변경.
    - 필요한 경우 기존 `deposit`과 동시 조회(마이그레이션 기간) 후 점진적 전환.
- **ID 생성**: `deposit`의 `DEPO` + 10자리와 동일한 규칙을 `il_room_deposit`용으로 새 함수 추가 또는 prefix만 `IRD` 등으로 변경.

#### 2-2. 히스토리만 `il_room_deposit_history`로 사용 (현재 적용 범위)

- **모델**: `ilRoomDepositHistory` 모델 추가됨.
- **API**: `registerDeposit`에서 입금 이력 저장 시 `depositHistory` 대신 `ilRoomDepositHistory`(테이블 `il_room_deposit_history`) 사용하도록 변경됨.
- **기타 API**: `getDepositInfo`, `getDepositHistory` 등에서 “예약금 등록 이력”을 `il_room_deposit_history`에서도 조회해야 하면, 해당 API에 `il_room_deposit_history` 조회 분기 추가 필요 (선택).

### 3. 기존 데이터 마이그레이션 (선택)

- 메인을 `il_room_deposit`으로 완전 전환할 경우:
  - `deposit` (type=RESERVATION 또는 DEPOSIT) → `il_room_deposit` 로 이관 스크립트 필요.
  - `depositHistory` → `il_room_deposit_history` 복사 또는 이관 스크립트 (이미 새 테이블 구조라면 필요 시에만).

### 4. 정리

- **지금 완료된 것**:  
  - `il_room_deposit_history` 테이블 생성 SQL 및 모델 추가.  
  - `POST /v1/deposit/reservationRegist` 호출 시 입금 이력을 **depositHistory 대신 il_room_deposit_history**에 저장하도록 변경.
- **나중에 할 것** (메인 테이블 전환 시):  
  - `il_room_deposit` 테이블/모델 생성.  
  - `reservationRegist` 및 deposit 관련 모든 API를 `il_room_deposit` 기준으로 수정.  
  - 예약금/보증금 구분 제거에 맞춰 type 단일화 및 문서·Swagger 수정.
