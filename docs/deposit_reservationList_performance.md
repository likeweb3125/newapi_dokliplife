# GET /v1/deposit/reservationList 속도 개선

## 적용된 코드 개선

1. **고시원명(gosiwonName) 필터**
   - **기존**: `gosiwon.findAll()`로 esntlId 목록 조회 후 `IN (...)` 사용 → DB 왕복 2회
   - **개선**: `R.gosiwonEsntlId IN (SELECT esntlId FROM gosiwon WHERE name LIKE ?)` 서브쿼리로 한 번에 처리 → 왕복 1회

2. **예약금요청상태(reservationStatus) 필터**
   - **기존**: 방마다 `(SELECT ... FROM il_room_deposit WHERE rom_eid = R.esntlId ... LIMIT 1) IS NULL` 상관 서브쿼리 실행 → 방 수만큼 서브쿼리
   - **개선**: 이미 조인된 `D_latest`(방별 최신 il_room_deposit 1건)를 사용해 `D_latest.rdp_completed_dtm IS NULL` 조건만 적용 → 상관 서브쿼리 제거

3. **count 쿼리**
   - **기존**: `il_room_deposit` 전체 조인, reservationStatus 시 상관 서브쿼리 포함
   - **개선**: 메인 쿼리와 동일하게 `D_latest` 조인 사용, reservationStatus 시 `D_latest.rdp_completed_dtm IS NULL`로 통일

## DB 인덱스 권장 (추가 적용 시 속도 향상)

아래 인덱스가 있으면 reservationList 메인/카운트 쿼리의 derived table 및 WHERE/ORDER BY가 더 빨리 처리됩니다.

| 테이블 | 인덱스 (컬럼) | 용도 |
|--------|----------------|------|
| room | (gosiwonEsntlId) | 고시원 필터 |
| roomStatus | (roomEsntlId, updatedAt DESC) | 방별 최신 1건 derived |
| roomContract | (roomEsntlId, status, contractDate DESC) | 방별 CONTRACT 최신 1건 derived |
| il_room_deposit | (rom_eid, rdp_delete_dtm, rdp_regist_dtm DESC) | 방별 최신 1건 derived |
| gosiwon | (name) | 고시원명 서브쿼리 |

이미 동일/유사 인덱스가 있으면 중복 생성하지 않도록 스키마를 확인한 뒤 적용하세요.
