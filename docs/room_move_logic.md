# 방이동 로직 정리

방이동(room move) 시 적용할 비즈니스 규칙 및 테이블별 처리 정리. **타겟방 데이터를 먼저 넣어야 계약날짜가 제대로 들어감.**

---

## 1. room 테이블

| 대상 | startDate | endDate | status |
|------|-----------|---------|--------|
| **타겟방** | 이동하는 날 | 기존 계약의 끝나는 날 | **CONTRACT** |
| **기존 방** | null | null | roomAfterUse에 맞게 (오늘 이동: **EMPTY**, 미래 이동: **LEAVE**) |

- 타겟방을 먼저 업데이트한 뒤 기존 방 업데이트.

---

## 2. roomContract 테이블

| 대상 | startDate | endDate | status |
|------|-----------|---------|--------|
| **타겟방 (신규 계약)** | 이동하는 날 | 기존 계약의 끝나는 날 | **USED** |
| **기존 방 (기존 계약)** | (변경 없음) | 이동하는 날로 업데이트 | **ENDED** |

---

## 3. roomStatus 테이블

- **기존 계약** 연결 roomStatus: **statusEndDate** = 이동일로 변경.
- **타겟방(신규 계약)** roomStatus: **statusStartDate** = 이동일, **statusEndDate** = 기존 계약의 끝나는 날. (상태값은 현재 로직 유지)

---

## 4. roomMoveStatus 테이블

- **당일 이동**: status = **COMPLETED** 로 바로 저장.
- **미래 이동**: status = **PENDING**.

---

## 5. extraPayment / parkStatus (계약서 ID 연동)

### 5-1. 이동일이 오늘인 경우

- **extraPayment**: 기존 계약서 id와 연관된 건들의 **contractEsntlId** 를 **신규 계약서 id** 로 수정.
- **parkStatus**: 동일하게 **contractEsntlId** 를 **신규 계약서 id** 로 수정.

### 5-2. 이동일이 오늘이 아닌 경우

- **추후**: 스케줄러에서 이동일 당일에 extraPayment / parkStatus 의 contractEsntlId 를 기존 계약서 id → 신규 계약서 id 로 변경.

---

## 요약

| 구분 | 이동일 = 오늘 | 이동일 ≠ 오늘 |
|------|----------------|----------------|
| room | 기존 방: startDate/endDate null, EMPTY / 타겟방: startDate=이동일, endDate=기존계약끝, CONTRACT | 기존 방: null, null, LEAVE / 타겟방: 동일 |
| roomContract | 기존: endDate=이동일, ENDED / 타겟(신규): startDate=이동일, endDate=기존계약끝, USED | 동일 |
| roomStatus | 타겟 statusEndDate=기존 계약 끝나는 날 | 동일 |
| roomMoveStatus | status=**COMPLETED** | status=PENDING |
| extraPayment, parkStatus | 당일 계약서 id → 신규 계약서 id 로 변경 | 스케줄러로 이동일에 변경 |
 