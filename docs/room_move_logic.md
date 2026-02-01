# 방이동 로직 정리

방이동(room move) 시 적용할 비즈니스 규칙 및 테이블별 처리 정리.

---

## 1. room 테이블 상태값

### 1-1. 이동일이 오늘인 경우

| 대상 | 변경 전 | 변경 후 |
|------|---------|---------|
| 기존 방 | CONTRACT | **EMPTY** |
| 이동 방 | (기존 상태) | **CONTRACT** |

### 1-2. 이동일이 오늘이 아닌 경우

| 대상 | 변경 전 | 변경 후 |
|------|---------|---------|
| 기존 방 | CONTRACT | **LEAVE** |
| 이동 방 | (기존 상태) | **RESERVE** |

- **추후**: 스케줄러에서 이동일 당일에 이동 방 상태를 **RESERVE → CONTRACT** 로 변경.

---

## 2. roomStatus 테이블 날짜

1. **기존 계약서(roomContract) id**  
   - 해당 계약에 연결된 roomStatus의 **statusEndDate** 를 **이동일(이동날짜)** 로 변경.

2. **신규 계약서 id**  
   - **statusStartDate**: **이동일(이동날짜)**  
   - **statusEndDate**: **신규 계약서의 endDate** (계약서 종료일).

---

## 3. extraPayment / parkStatus (계약서 ID 연동)

### 3-1. 이동일이 오늘인 경우

- **extraPayment**: 기존 계약서 id와 연관된 건들의 **contractEsntlId** 를 **신규 계약서 id** 로 수정.
- **parkStatus**: 동일하게 **contractEsntlId** 를 **신규 계약서 id** 로 수정.

### 3-2. 이동일이 오늘이 아닌 경우

- **추후**: 스케줄러에서 이동일 당일에 extraPayment / parkStatus 의 contractEsntlId 를 기존 계약서 id → 신규 계약서 id 로 변경.

---

## 요약

| 구분 | 이동일 = 오늘 | 이동일 ≠ 오늘 |
|------|----------------|----------------|
| 기존 방 (room.status) | CONTRACT → EMPTY | CONTRACT → LEAVE |
| 이동 방 (room.status) | CONTRACT | RESERVE (스케줄러에서 이동일에 CONTRACT 로 변경) |
| roomStatus | 기존 계약: statusEndDate=이동일 / 신규 계약: statusStartDate=이동일, statusEndDate=계약 endDate | 동일 |
| extraPayment, parkStatus | 당일 계약서 id → 신규 계약서 id 로 변경 | 스케줄러로 이동일에 변경 |
